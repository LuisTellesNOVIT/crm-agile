/**
 * daily-brief.ts — Brief ejecutivo diario del CRM AGILE por WhatsApp.
 *
 * Consulta Neon (Prisma), arma un mensaje ejecutivo consolidado + por grupo
 * (NOVIT / SHARKY) y lo envía por OpenClaw WhatsApp al número configurado.
 *
 * Uso:
 *   npx tsx scripts/daily-brief.ts            # imprime el mensaje (NO envía)
 *   npx tsx scripts/daily-brief.ts --send     # envía por WhatsApp
 *
 * Variables de entorno (opcionales):
 *   BRIEF_TARGET   número E.164 destino           (default +51980203171)
 *   CRM_URL        url del CRM para el link        (default producción Vercel)
 *   OPENCLAW_BIN   ruta al binario openclaw        (default "openclaw" en PATH)
 *
 * El monto se muestra en Soles (S/) — mismo criterio que el dashboard
 * (valor en USD × tipo de cambio 3.75).
 */
import { PrismaClient } from "@prisma/client";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { renderTopClients, renderFunnel, type ClientSeg, type FunnelStage } from "./brief-charts";

const execFileP = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Cargar .env.local (DATABASE_URL) si no está en el entorno ──────────
function loadEnvLocal() {
  const p = join(__dirname, "..", ".env.local");
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (!process.env[m[1]]) process.env[m[1]] = v;
  }
}
loadEnvLocal();

const prisma = new PrismaClient();

// ── Formato de plata: replica fmtMoney del dashboard (PEN = USD × 3.75) ─
const FX = 3.75;
function money(v: number): string {
  const conv = v * FX;
  const abs = Math.abs(conv);
  if (abs >= 1_000_000) return `S/${(conv / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (abs >= 1_000) return `S/${Math.round(conv / 1000)}k`;
  return `S/${Math.round(conv).toLocaleString("en-US")}`;
}

const DAY = 86_400_000;
const now = new Date();
const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
const in7 = new Date(startToday.getTime() + 7 * DAY);
const last7 = new Date(startToday.getTime() - 7 * DAY);
const stale14 = new Date(now.getTime() - 14 * DAY);

type StageMeta = { key: string; label: string; isWon: boolean; isLost: boolean };

async function buildBrief() {
  const workspaces = await prisma.workspace.findMany({
    where: { slug: { in: ["novit", "sharky"] } },
    select: {
      slug: true,
      name: true,
      pipelineStages: { select: { key: true, label: true, isWon: true, isLost: true, color: true, position: true } },
      deals: {
        select: {
          name: true,
          value: true,
          mrr: true,
          isRecurring: true,
          stage: true,
          probability: true,
          estimatedCloseAt: true,
          closedAt: true,
          lastActivityAt: true,
          company: { select: { name: true } },
        },
      },
    },
  });
  // NOVIT primero
  workspaces.sort((a) => (a.slug === "novit" ? -1 : 1));

  const fmtDate = capitalize(
    now.toLocaleDateString("es-PE", { weekday: "long", day: "numeric", month: "long", year: "numeric" }),
  );

  const totals = {
    pipe: 0, opp: 0, forecast: 0, arr: 0,
    closing: 0, closingVal: 0, won7: 0, won7Val: 0, lost7: 0, stale: 0, overdue: 0,
  };
  const blocks: string[] = [];
  // Top clientes consolidado: ganados + en proceso (excluye perdidos)
  const clientMap = new Map<string, { value: number; count: number }>();
  // Embudo consolidado: valor por etapa (excluye perdidos, incluye won)
  const stageAgg = new Map<string, { value: number; label: string; color: string; position: number }>();

  for (const ws of workspaces) {
    const stageMap = new Map<string, StageMeta>();
    ws.pipelineStages.forEach((s) => stageMap.set(s.key, s));
    const isWon = (k: string) => stageMap.get(k)?.isWon ?? false;
    const isLost = (k: string) => stageMap.get(k)?.isLost ?? false;
    const stageLabel = (k: string) => stageMap.get(k)?.label ?? k;

    ws.pipelineStages.forEach((st) => {
      if (st.isLost) return;
      if (!stageAgg.has(st.key)) {
        stageAgg.set(st.key, { value: 0, label: st.label, color: st.color, position: st.position });
      }
    });
    ws.deals.forEach((d) => {
      if (isLost(d.stage)) return;
      const name = d.company?.name ?? "—";
      const cur = clientMap.get(name) ?? { value: 0, count: 0 };
      cur.value += d.value;
      cur.count += 1;
      clientMap.set(name, cur);
      const ag = stageAgg.get(d.stage);
      if (ag) ag.value += d.value;
    });

    const open = ws.deals.filter((d) => !isWon(d.stage) && !isLost(d.stage));
    const pipe = open.reduce((a, d) => a + d.value, 0);
    const forecast = open.reduce((a, d) => a + d.value * d.probability, 0);
    const arr = open.filter((d) => d.isRecurring && d.mrr).reduce((a, d) => a + (d.mrr ?? 0) * 12, 0);
    const closing = open.filter((d) => d.estimatedCloseAt >= startToday && d.estimatedCloseAt < in7);
    const closingVal = closing.reduce((a, d) => a + d.value, 0);
    const won7 = ws.deals.filter((d) => isWon(d.stage) && d.closedAt && d.closedAt >= last7);
    const won7Val = won7.reduce((a, d) => a + d.value, 0);
    const lost7 = ws.deals.filter((d) => isLost(d.stage) && d.closedAt && d.closedAt >= last7);
    const stale = open.filter((d) => d.lastActivityAt < stale14);
    const overdue = open.filter((d) => d.estimatedCloseAt < startToday);
    const top = [...open].sort((a, b) => b.value - a.value).slice(0, 3);

    totals.pipe += pipe; totals.opp += open.length; totals.forecast += forecast; totals.arr += arr;
    totals.closing += closing.length; totals.closingVal += closingVal;
    totals.won7 += won7.length; totals.won7Val += won7Val; totals.lost7 += lost7.length;
    totals.stale += stale.length; totals.overdue += overdue.length;

    const topLines = top.length
      ? top.map((d, i) => `  ${i + 1}. ${truncate(d.name, 34)} · *${money(d.value)}* _(${stageLabel(d.stage)})_`).join("\n")
      : "  —";

    const alertLine =
      stale.length || overdue.length
        ? `\n⚠️ Sin actividad +14d: ${stale.length} · Cierre vencido: ${overdue.length}`
        : "";

    blocks.push(
      `*━━ ${ws.name.toUpperCase()} ━━*\n` +
        `💼 Pipeline: *${money(pipe)}* · ${open.length} opp\n` +
        `🎯 Forecast ponderado: *${money(forecast)}*` +
        (arr > 0 ? `\n🔁 ARR recurrente: *${money(arr)}*` : "") +
        `\n📅 Cierran ≤7 días: *${closing.length}* (${money(closingVal)})\n` +
        `✅ Ganado 7d: *${won7.length}* (${money(won7Val)})  ·  ❌ Perdido 7d: *${lost7.length}*` +
        alertLine +
        `\n🏆 Top oportunidades:\n${topLines}`,
    );
  }

  const header =
    `☀️ *CRM AGILE — Resumen ejecutivo*\n` +
    `_${fmtDate}_\n\n` +
    `*━━ CONSOLIDADO ━━*\n` +
    `💼 Pipeline activo: *${money(totals.pipe)}* · ${totals.opp} opp\n` +
    `🎯 Forecast ponderado: *${money(totals.forecast)}*\n` +
    `🔁 ARR recurrente: *${money(totals.arr)}*\n` +
    `📅 Cierran ≤7 días: *${totals.closing}* (${money(totals.closingVal)})\n` +
    `✅ Ganado 7d: *${totals.won7}* (${money(totals.won7Val)}) · ❌ Perdido 7d: *${totals.lost7}*\n` +
    `⚠️ Alertas: ${totals.stale} sin actividad · ${totals.overdue} con cierre vencido`;

  // ── Top 5 clientes (ganados + en proceso, consolidado) ──
  const clientsSorted = [...clientMap.entries()]
    .map(([name, v]) => ({ name, value: v.value, count: v.count }))
    .sort((a, b) => b.value - a.value);
  const clientTotal = clientsSorted.reduce((a, c) => a + c.value, 0);
  const top5 = clientsSorted.slice(0, 5);
  const otros = clientsSorted.slice(5);
  const otrosVal = otros.reduce((a, c) => a + c.value, 0);
  const otrosCount = otros.reduce((a, c) => a + c.count, 0);
  const clientLines = top5
    .map((c, i) => {
      const pct = clientTotal ? Math.round((c.value / clientTotal) * 100) : 0;
      return `  ${i + 1}. ${truncate(c.name, 28)} · *${money(c.value)}* (${pct}%)`;
    })
    .join("\n");
  const clientsBlock =
    `*━━ TOP 5 CLIENTES ━━*\n` +
    `_ganados + en proceso · ${money(clientTotal)}_\n` +
    (clientLines || "  —") +
    (otros.length ? `\n  +${otros.length} otros · ${money(otrosVal)}` : "");

  const footer = `\n\n📲 Abrí el CRM: ${process.env.CRM_URL ?? "https://crm-agile.vercel.app"}`;
  const text = [header, clientsBlock, ...blocks].join("\n\n") + footer;

  // ── Datos para los gráficos PNG ──
  const PALETTE = ["#4f46e5", "#0ea5e9", "#7c3aed", "#f59e0b", "#10b981", "#94a3b8"];
  const clientSegs: ClientSeg[] = top5.map((c, i) => ({ label: c.name, value: c.value, count: c.count, color: PALETTE[i] }));
  if (otros.length) clientSegs.push({ label: `Otros (${otros.length})`, value: otrosVal, count: otrosCount, color: PALETTE[5] });
  const funnelStages: FunnelStage[] = [...stageAgg.values()]
    .sort((a, b) => a.position - b.position)
    .filter((s) => s.value > 0)
    .map((s) => ({ label: s.label, value: s.value, color: s.color }));

  return { text, clientSegs, clientTotal, clientCount: clientMap.size, funnelStages };
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

async function main() {
  const send = process.argv.includes("--send");
  const brief = await buildBrief();

  // Render de los dos gráficos a PNG (headless)
  const top5Path = "/tmp/crm-brief-top5.png";
  const funnelPath = "/tmp/crm-brief-funnel.png";
  writeFileSync(top5Path, renderTopClients(brief.clientSegs, brief.clientTotal, brief.clientCount, "PEN"));
  writeFileSync(funnelPath, renderFunnel(brief.funnelStages, "PEN"));

  if (!send) {
    console.log(brief.text);
    console.log(`\n[dry-run] gráficos: ${top5Path} · ${funnelPath}`);
    await prisma.$disconnect();
    return;
  }

  // Uno o varios destinos (coma-separados): números E.164 y/o JIDs de grupo (…@g.us)
  const targets = (process.env.BRIEF_TARGETS ?? process.env.BRIEF_TARGET ?? "+51980203171")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const bin = process.env.OPENCLAW_BIN ?? "openclaw";
  const sendWa = (target: string, args: string[]) =>
    execFileP(bin, ["message", "send", "--channel", "whatsapp", "--account", "default", "--target", target, ...args]);

  for (const target of targets) {
    // 1) texto · 2) Top 5 clientes · 3) Embudo por etapa
    await sendWa(target, ["--message", brief.text]);
    await sendWa(target, ["--media", top5Path, "--message", "📊 Top 5 clientes — ganados + en proceso"]);
    await sendWa(target, ["--media", funnelPath, "--message", "📈 Embudo por etapa — valor por etapa"]);
    console.log(`✓ Brief + 2 gráficos enviados a ${target} (${new Date().toISOString()})`);
  }
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error("✗ daily-brief falló:", e);
  await prisma.$disconnect();
  process.exit(1);
});
