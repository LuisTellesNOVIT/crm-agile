/**
 * sequence-engine.ts — Motor de secuencias (Fase 1).
 *
 * Modo PRUEBA (seguro): ejecuta una secuencia contra UN número de prueba,
 * ignorando las esperas, para validar render de plantillas + envío por OpenClaw.
 *
 *   npx tsx scripts/sequence-engine.ts --test                    # secuencia TEST → tu número
 *   npx tsx scripts/sequence-engine.ts --test --seq "Grandes — SLA de requerimientos" --target +51980203171
 *
 * Vínculo: cada paso wa/email referencia una plantilla por `templateKey`;
 * el motor reemplaza {{variables}} con los datos provistos y envía.
 *
 * La versión AGENDADA (enrollment + esperas reales + por categoría + detección
 * de respuestas) se construye encima de estas mismas funciones.
 */
import { PrismaClient } from "@prisma/client";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const execFileP = promisify(execFile);
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

type Step = {
  kind: string;
  title: string;
  body: string;
  to?: "client" | "internal";
  templateKey?: string;
  delayDays?: number;
};

/** Reemplaza {{var}} en el cuerpo con los valores provistos. */
export function renderTemplate(body: string, vars: Record<string, string>): string {
  return body.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => vars[k] ?? `{{${k}}}`);
}

async function sendWa(target: string, message: string) {
  const bin = process.env.OPENCLAW_BIN ?? "openclaw";
  await execFileP(bin, ["message", "send", "--channel", "whatsapp", "--account", "default", "--target", target, "--message", message]);
}

async function runTest(opts: { sequenceName: string; target: string; vars: Record<string, string> }) {
  const ws = await prisma.workspace.findUnique({ where: { slug: "novit" }, select: { id: true } });
  if (!ws) throw new Error("Workspace 'novit' no encontrado");
  const seq = await prisma.sequence.findFirst({ where: { workspaceId: ws.id, name: opts.sequenceName } });
  if (!seq) throw new Error(`Secuencia no encontrada: ${opts.sequenceName}`);
  const steps: Step[] = ((seq.nodes as Record<string, unknown>)?.steps as Step[]) ?? [];
  const tpls = await prisma.template.findMany({ where: { workspaceId: ws.id }, select: { name: true, body: true } });
  const tplMap = new Map(tpls.map((t) => [t.name, t.body]));

  console.log(`\n▶ PRUEBA · "${seq.name}"  →  ${opts.target}  (esperas ignoradas)\n`);
  let sent = 0;
  for (const step of steps) {
    if (step.kind === "delay") {
      console.log(`  ⏸  ${step.title}  ·  (en prueba no se espera)`);
      continue;
    }
    if (step.kind === "wa" || step.kind === "email") {
      const raw = step.templateKey ? tplMap.get(step.templateKey) : step.body;
      if (!raw) {
        console.log(`  ⚠️  ${step.title}  ·  sin plantilla (${step.templateKey ?? "—"})`);
        continue;
      }
      const dest = step.to === "internal" ? "[interno]" : "[cliente]";
      const prefix = step.kind === "email" ? "✉️ (Email simulado por WhatsApp en prueba)\n" : "";
      const msg = prefix + renderTemplate(raw, opts.vars);
      await sendWa(opts.target, msg);
      sent++;
      console.log(`  ✅  ${step.title}  ${dest}  →  enviado`);
      await new Promise((r) => setTimeout(r, 1200));
    } else {
      console.log(`  •   ${step.title}  (${step.kind})`);
    }
  }
  console.log(`\n✓ Prueba completa: ${sent} mensaje(s) enviados a ${opts.target}\n`);
}

const argv = process.argv.slice(2);
function arg(name: string, def: string): string {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : def;
}

(async () => {
  if (argv[0] === "--test") {
    const sequenceName = arg("--seq", "TEST — Cliente básico (prueba)");
    const target = arg("--target", process.env.BRIEF_TARGET ?? "+51980203171");
    const vars: Record<string, string> = {
      nombre: arg("--name", "Luis"),
      empresa: arg("--empresa", "Empresa Demo"),
      trato: arg("--trato", "Propuesta Demo"),
      valor: arg("--valor", "S/100k"),
      ejecutivo: arg("--ejecutivo", "Luis Telles"),
      industria: arg("--industria", "seguros"),
    };
    await runTest({ sequenceName, target, vars });
  } else {
    console.log('Uso: tsx scripts/sequence-engine.ts --test [--seq "<nombre>"] [--target +51...] [--name <nombre>]');
  }
  await prisma.$disconnect();
})().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
