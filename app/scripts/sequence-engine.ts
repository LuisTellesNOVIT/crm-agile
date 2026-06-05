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

/* ============================================================
   Motor agendado: enrolamiento + esperas reales + guard de cliente
   ============================================================ */
const GERENCIA = process.env.SEQ_INTERNAL_TARGET ?? "12018757382-1438204825@g.us"; // grupo Gerencia NOVIT
const CLIENT_SENDS_ON = (process.env.SEQ_CLIENT_SENDS ?? "off").toLowerCase() === "on";
const FX = 3.75;
function money(v: number): string {
  const c = v * FX;
  const a = Math.abs(c);
  if (a >= 1_000_000) return "S/" + (c / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (a >= 1_000) return "S/" + Math.round(c / 1000) + "k";
  return "S/" + Math.round(c);
}

async function dealVars(dealId: string): Promise<{ vars: Record<string, string>; clientPhone: string | null } | null> {
  const d = await prisma.deal.findUnique({
    where: { id: dealId },
    select: {
      name: true,
      value: true,
      company: { select: { name: true, industry: true, contacts: { select: { name: true, phone: true }, take: 1 } } },
      owner: { select: { name: true } },
    },
  });
  if (!d) return null;
  const contact = d.company?.contacts?.[0];
  const first = (contact?.name ?? "").trim().split(/\s+/)[0] || "cliente";
  return {
    vars: {
      nombre: first,
      empresa: d.company?.name ?? "",
      trato: d.name,
      valor: money(d.value),
      ejecutivo: d.owner?.name ?? "NOVIT",
      industria: d.company?.industry ?? "tu sector",
    },
    clientPhone: contact?.phone ?? null,
  };
}

async function enroll(opts: { dealPublicId: string; sequenceName: string; testTarget?: string }) {
  const ws = await prisma.workspace.findUnique({ where: { slug: "novit" }, select: { id: true } });
  if (!ws) throw new Error("Workspace 'novit' no encontrado");
  const seq = await prisma.sequence.findFirst({ where: { workspaceId: ws.id, name: opts.sequenceName }, select: { id: true, name: true } });
  if (!seq) throw new Error(`Secuencia no encontrada: ${opts.sequenceName}`);
  const deal = await prisma.deal.findUnique({ where: { publicId: opts.dealPublicId }, select: { id: true, name: true } });
  if (!deal) throw new Error(`Trato no encontrado: ${opts.dealPublicId}`);
  const e = await prisma.sequenceEnrollment.upsert({
    where: { sequenceId_dealId: { sequenceId: seq.id, dealId: deal.id } },
    update: { stepIndex: 0, status: "active", nextFireAt: new Date(), testTarget: opts.testTarget ?? null, log: [] },
    create: { workspaceId: ws.id, sequenceId: seq.id, dealId: deal.id, testTarget: opts.testTarget ?? null },
  });
  console.log(`✓ Enrolado "${deal.name}" en "${seq.name}"${opts.testTarget ? ` · PRUEBA → ${opts.testTarget}` : ""} · enrollment ${e.id}`);
}

function lastSentAt(log: unknown[]): Date | null {
  for (let i = log.length - 1; i >= 0; i--) {
    const e = log[i] as { act?: string; at?: string };
    if (e?.act === "sent" && e.at) return new Date(e.at);
  }
  return null;
}
/** ¿Hay un mensaje entrante del cliente después de `since`? */
async function clientReplied(phone: string, since: Date): Promise<boolean> {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return false;
  const tail = digits.slice(-9);
  const msgs = await prisma.inboundMessage.findMany({
    where: { chatType: "dm", at: { gt: since } },
    select: { fromNumber: true },
    orderBy: { at: "desc" },
    take: 300,
  });
  return msgs.some((m) => m.fromNumber.endsWith(tail) || tail.endsWith(m.fromNumber.slice(-9)));
}

async function runDue(opts: { fast: boolean }) {
  const now = new Date();
  const due = await prisma.sequenceEnrollment.findMany({ where: { status: "active", nextFireAt: { lte: now } } });
  if (!due.length) {
    console.log("Sin enrolamientos vencidos.");
    return;
  }
  for (const e of due) {
    const seq = await prisma.sequence.findUnique({ where: { id: e.sequenceId } });
    if (!seq) {
      await prisma.sequenceEnrollment.update({ where: { id: e.id }, data: { status: "exited" } });
      continue;
    }
    // Secuencia pausada → los inscritos esperan (salvo modo prueba, que siempre corre a tu número).
    if (!seq.active && !e.testTarget) {
      console.log(`⏸ ${seq.name}: pausada — inscrito …${e.dealId.slice(-6)} en espera`);
      continue;
    }
    const steps: Step[] = ((seq.nodes as Record<string, unknown>)?.steps as Step[]) ?? [];
    const dv = await dealVars(e.dealId);
    const tpls = await prisma.template.findMany({ where: { workspaceId: e.workspaceId }, select: { name: true, body: true } });
    const tplMap = new Map(tpls.map((t) => [t.name, t.body]));
    const log: unknown[] = Array.isArray(e.log) ? (e.log as unknown[]) : [];
    let idx = e.stepIndex;
    let status = e.status;
    let nextFireAt = e.nextFireAt;
    console.log(`\n▶ ${seq.name} · deal …${e.dealId.slice(-6)} · desde paso ${idx}`);
    while (idx < steps.length) {
      const step = steps[idx];
      if (step.kind === "trigger") { idx++; continue; }
      if (step.kind === "delay") {
        if (opts.fast) { log.push({ step: idx, act: "delay-skip" }); idx++; continue; }
        nextFireAt = new Date(Date.now() + (step.delayDays ?? 1) * 86400000);
        idx++; // reanuda DESPUÉS de la espera
        log.push({ step: idx, act: "delay", until: nextFireAt.toISOString() });
        console.log(`  ⏸ ${step.title} → reanuda ${nextFireAt.toISOString()}`);
        break;
      }
      if (step.kind === "wa" || step.kind === "email") {
        const raw = step.templateKey ? tplMap.get(step.templateKey) : step.body;
        const msg = raw ? renderTemplate(raw, dv?.vars ?? {}) : step.body;
        const toClient = step.to !== "internal";
        const target = e.testTarget || (toClient ? dv?.clientPhone ?? "" : GERENCIA);
        if (toClient && !e.testTarget && !CLIENT_SENDS_ON) {
          console.log(`  ⏭ ${step.title} [cliente] → PAUSADO (SEQ_CLIENT_SENDS=off)`);
          log.push({ step: idx, act: "client-paused" });
          idx++;
          continue;
        }
        if (!target) {
          console.log(`  ⚠ ${step.title}: sin destino (sin teléfono de contacto)`);
          log.push({ step: idx, act: "no-target" });
          idx++;
          continue;
        }
        const pref = step.kind === "email" ? "✉️ (Email simulado por WhatsApp)\n" : "";
        await sendWa(target, pref + msg);
        console.log(`  ✅ ${step.title} ${toClient ? "[cliente]" : "[interno]"} → ${target}`);
        log.push({ step: idx, act: "sent", to: target, at: new Date().toISOString() });
        idx++;
        await new Promise((r) => setTimeout(r, 1000));
        continue;
      }
      if (step.kind === "branch") {
        // ¿Respondió? — busca un entrante del cliente después del último envío
        const phone = e.testTarget || dv?.clientPhone || "";
        const since = lastSentAt(log) ?? e.createdAt;
        const replied = phone ? await clientReplied(phone, since) : false;
        if (replied) {
          status = "exited";
          log.push({ step: idx, act: "branch-replied-exit", at: new Date().toISOString() });
          console.log(`  ↩ ${step.title}: el cliente respondió → exit`);
          idx++;
          break;
        }
        log.push({ step: idx, act: "branch-no-reply", at: new Date().toISOString() });
        console.log(`  → ${step.title}: sin respuesta aún → continúa`);
        idx++;
        continue;
      }
      if (step.kind === "exit") { status = "done"; log.push({ step: idx, act: "exit" }); idx++; break; }
      idx++;
    }
    if (idx >= steps.length && status === "active") status = "done";
    await prisma.sequenceEnrollment.update({ where: { id: e.id }, data: { stepIndex: idx, status, nextFireAt, log: log as never } });
    console.log(`  → ${status} · paso ${idx}`);
  }
}

async function autoEnroll() {
  const ws = await prisma.workspace.findUnique({ where: { slug: "novit" }, select: { id: true } });
  if (!ws) throw new Error("Workspace 'novit' no encontrado");
  const active = await prisma.sequence.findMany({ where: { workspaceId: ws.id, active: true }, select: { id: true, name: true, nodes: true } });
  if (!active.length) {
    console.log("No hay secuencias ACTIVAS → no se auto-enrola nada (seguro).");
    return;
  }
  let created = 0;
  for (const seq of active) {
    const cat = (seq.nodes as Record<string, unknown>)?.category as string | undefined;
    if (!cat) continue;
    const deals = await prisma.deal.findMany({
      where: { workspaceId: ws.id, stage: { notIn: ["won", "lost"] }, company: { tier: cat } },
      select: { id: true },
    });
    for (const d of deals) {
      const exists = await prisma.sequenceEnrollment.findUnique({ where: { sequenceId_dealId: { sequenceId: seq.id, dealId: d.id } } });
      if (exists) continue;
      await prisma.sequenceEnrollment.create({ data: { workspaceId: ws.id, sequenceId: seq.id, dealId: d.id } });
      created++;
    }
  }
  console.log(`✓ Auto-enrolados: ${created}`);
}

async function listEnrollments() {
  const es = await prisma.sequenceEnrollment.findMany({ orderBy: { updatedAt: "desc" }, take: 30 });
  if (!es.length) { console.log("Sin enrolamientos."); return; }
  for (const e of es) {
    const seq = await prisma.sequence.findUnique({ where: { id: e.sequenceId }, select: { name: true } });
    console.log(`${e.status.padEnd(7)} paso ${e.stepIndex} · ${seq?.name ?? "?"} · deal …${e.dealId.slice(-6)}${e.testTarget ? ` · test→${e.testTarget}` : ""} · próximo ${e.nextFireAt.toISOString()}`);
  }
}

const argv = process.argv.slice(2);
function arg(name: string, def: string): string {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : def;
}

(async () => {
  const mode = argv[0];
  if (mode === "--test") {
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
  } else if (mode === "--enroll") {
    const dealPublicId = arg("--deal", "");
    const sequenceName = arg("--seq", "TEST — Cliente básico (prueba)");
    const testTarget = arg("--test-target", "");
    if (!dealPublicId) throw new Error("Falta --deal <publicId>");
    await enroll({ dealPublicId, sequenceName, testTarget: testTarget || undefined });
  } else if (mode === "--run") {
    await runDue({ fast: argv.includes("--fast") });
  } else if (mode === "--auto-enroll") {
    await autoEnroll();
  } else if (mode === "--list") {
    await listEnrollments();
  } else {
    console.log(
      [
        "Motor de Secuencias — uso:",
        '  --test [--seq "<nombre>"] [--target +51...]          prueba inmediata (ignora esperas)',
        '  --enroll --deal NOVIT-00XX --seq "<nombre>" [--test-target +51...]   enrola un trato',
        "  --run [--fast]                                       procesa enrolamientos vencidos (--fast ignora esperas)",
        "  --auto-enroll                                        enrola tratos por categoría en secuencias ACTIVAS",
        "  --list                                               lista enrolamientos",
        "",
        "Guard: SEQ_CLIENT_SENDS=on para habilitar envíos a clientes (default off).",
      ].join("\n"),
    );
  }
  await prisma.$disconnect();
})().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
