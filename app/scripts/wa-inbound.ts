/**
 * wa-inbound.ts — Captura de mensajes ENTRANTES de WhatsApp (modo solo-registro).
 *
 * Lee el log del gateway de OpenClaw, detecta las líneas "Inbound message …"
 * y las guarda en la tabla InboundMessage. NUNCA responde nada.
 * El motor usa esto para ramificar "¿Respondió?".
 *
 *   npx tsx scripts/wa-inbound.ts          # captura los entrantes recientes (idempotente)
 *
 * Requiere que el canal reciba entrantes (dmPolicy != disabled) y SIN binding de
 * agente (bindings: []), para que registre pero no auto-responda.
 */
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
function loadEnvLocal() {
  try {
    const txt = readFileSync(join(__dirname, "..", ".env.local"), "utf8");
    for (const line of txt.split("\n")) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
      if (!m) continue;
      let v = m[2].trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      if (!process.env[m[1]]) process.env[m[1]] = v;
    }
  } catch {}
}
loadEnvLocal();

const prisma = new PrismaClient();
const LOG = process.env.WA_LOG ?? `${process.env.HOME}/Library/Logs/openclaw/gateway.log`;
const RE = /^(\d{4}-\d{2}-\d{2}T[\d:.+-]+)\s+\[whatsapp\]\s+Inbound message (\S+) -> (\S+) \((DM|group)/;

(async () => {
  let txt = "";
  try {
    txt = readFileSync(LOG, "utf8");
  } catch {
    console.log("(sin log de gateway)");
    await prisma.$disconnect();
    return;
  }
  const cutoff = Date.now() - 7 * 86400000; // solo últimos 7 días
  let inserted = 0;
  for (const line of txt.split("\n")) {
    const m = RE.exec(line);
    if (!m) continue;
    const at = new Date(m[1]);
    if (isNaN(at.getTime()) || at.getTime() < cutoff) continue;
    const jid = m[2];
    const to = m[3];
    const chatType = m[4] === "DM" ? "dm" : "group";
    const fromNumber = jid.replace(/@.*/, "").replace(/[^0-9]/g, "");
    if (!fromNumber) continue;
    const exists = await prisma.inboundMessage.findFirst({ where: { fromNumber, at } });
    if (exists) continue;
    await prisma.inboundMessage.create({
      data: { fromNumber, toNumber: to.replace(/[^0-9+]/g, ""), chatType, at },
    });
    inserted++;
  }
  console.log(`✓ Entrantes capturados (nuevos): ${inserted}`);
  await prisma.$disconnect();
})().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
