/**
 * scheduler.ts — Runner local de Programaciones (plano de control en la DB).
 *
 * Lee ScheduledMessage (de la UI), decide qué corresponde enviar ahora
 * (por horario o por "Enviar ahora"/runNow), envía por WhatsApp y registra
 * en MessageLog. Honra `enabled`. NUNCA toca secuencias ni clientes salvo
 * lo que vos definiste explícitamente como programación.
 *
 *   npx tsx scripts/scheduler.ts            # corre las vencidas + runNow
 *   npx tsx scripts/scheduler.ts --now      # fuerza TODAS las activas ahora
 *   npx tsx scripts/scheduler.ts --dry      # muestra qué haría, sin enviar
 *   npx tsx scripts/scheduler.ts --list     # lista las programaciones
 */
import { PrismaClient } from "@prisma/client";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
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

const execFileP = promisify(execFile);
const prisma = new PrismaClient();
const OPENCLAW = process.env.OPENCLAW_BIN || "openclaw";

async function sendWa(target: string, message: string) {
  await execFileP(OPENCLAW, ["message", "send", "--channel", "whatsapp", "--account", "default", "--target", target, "--message", message]);
}
async function runBrief(target: string) {
  const tsx = join(__dirname, "..", "node_modules", ".bin", "tsx");
  await execFileP(tsx, [join(__dirname, "daily-brief.ts"), "--send"], {
    env: { ...process.env, BRIEF_TARGETS: target },
    cwd: join(__dirname, ".."),
    maxBuffer: 1024 * 1024 * 20,
  });
}

/** Última ocurrencia programada ≤ now (o null si manual). */
function lastOccurrence(now: Date, freq: string, weekday: number, hour: number, minute: number): Date | null {
  if (freq === "manual") return null;
  const occ = new Date(now);
  occ.setHours(hour, minute, 0, 0);
  if (freq === "daily") {
    if (occ > now) occ.setDate(occ.getDate() - 1);
    return occ;
  }
  // weekly: retrocede al weekday objetivo
  const diff = (occ.getDay() - weekday + 7) % 7;
  occ.setDate(occ.getDate() - diff);
  if (occ > now) occ.setDate(occ.getDate() - 7);
  return occ;
}

(async () => {
  const argv = process.argv.slice(2);
  const dry = argv.includes("--dry");
  const force = argv.includes("--now");

  if (argv.includes("--list")) {
    const all = await prisma.scheduledMessage.findMany({ orderBy: { createdAt: "asc" } });
    for (const s of all) {
      console.log(`${s.enabled ? "🟢" : "⚪"} ${s.name} · ${s.kind}/${s.channel} · ${s.freq} ${s.hour}:${String(s.minute).padStart(2, "0")} · → ${s.targetLabel ?? s.target}${s.runNow ? " · ⏳runNow" : ""}`);
    }
    await prisma.$disconnect();
    return;
  }

  const now = new Date();
  const scheds = await prisma.scheduledMessage.findMany({ where: { enabled: true } });
  let acted = 0;
  for (const s of scheds) {
    let due = false;
    let reason = "";
    if (s.runNow) {
      due = true;
      reason = "Enviar ahora";
    } else if (force) {
      due = true;
      reason = "--now";
    } else {
      const occ = lastOccurrence(now, s.freq, s.weekday ?? 1, s.hour, s.minute);
      if (occ && now >= occ && (!s.lastRunAt || s.lastRunAt < occ)) {
        due = true;
        reason = `horario (${occ.toISOString()})`;
      }
    }
    if (!due) continue;
    acted++;
    console.log(`▶ ${s.name}  ·  ${reason}`);
    if (dry) {
      console.log("  (dry) no se envía");
      continue;
    }

    let status = "sent";
    let error: string | null = null;
    let summary = s.name;
    try {
      if (s.kind === "brief") {
        await runBrief(s.target);
        summary = "Resumen CRM (texto + 2 gráficos)";
      } else {
        const body = (s.body ?? "").trim();
        if (!body) throw new Error("Mensaje vacío");
        if (s.channel === "email") throw new Error("Canal email aún no configurado");
        summary = body.slice(0, 90);
        const targets = s.target.split(",").map((t) => t.trim()).filter(Boolean);
        for (const t of targets) {
          await sendWa(t, body);
          await new Promise((r) => setTimeout(r, 800));
        }
      }
      console.log("  ✅ enviado");
    } catch (e) {
      status = "failed";
      error = ((e as Error).message ?? String(e)).slice(0, 300);
      console.error("  ✗", error);
    }
    await prisma.messageLog.create({
      data: { scheduledId: s.id, kind: s.kind, channel: s.channel, target: s.target, summary, status, error },
    });
    await prisma.scheduledMessage.update({
      where: { id: s.id },
      data: { runNow: false, lastRunAt: now, lastStatus: status, lastError: error },
    });
  }
  console.log(acted ? `✓ scheduler: ${acted} programación(es) procesada(s)` : "Sin programaciones vencidas.");
  await prisma.$disconnect();
})().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
