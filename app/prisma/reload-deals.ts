/**
 * Reload limpio de la data transaccional:
 *   ✗ borra: Activity, File, Conversation, Message, Deal, Contact, Company, Template, Sequence
 *   ✓ preserva: Workspace (con SUNAT info patcheada), User (owners + admin)
 *   ✓ re-importa: Company + Deal desde prisma/seed-data.csv
 *
 * Correr: `npx tsx prisma/reload-deals.ts`
 */
import { PrismaClient, Stage } from "@prisma/client";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import Papa from "papaparse";

const prisma = new PrismaClient();
const __dirname = dirname(fileURLToPath(import.meta.url));

type Row = {
  ID: string;
  Cliente: string;
  Estado: string;
  Proyecto: string;
  empresa: string;
  setup: string;
  mensualidad: string;
};

const STAGE_MAP: Record<string, Stage> = {
  Demo: Stage.qualified,
  Propuesta: Stage.proposal,
  Negociación: Stage.negotiation,
  Negociacion: Stage.negotiation,
  "Firma del Contrato": Stage.signing,
  Ganado: Stage.won,
  Perdido: Stage.lost,
};

const STAGE_PROBABILITY: Record<Stage, number> = {
  discovery: 0.1, qualified: 0.25, proposal: 0.5,
  negotiation: 0.75, signing: 0.9, won: 1.0, lost: 0.0,
};
const STAGE_AI: Record<Stage, number> = {
  discovery: 25, qualified: 40, proposal: 60,
  negotiation: 80, signing: 92, won: 100, lost: 0,
};

const CLOSE_RANGES: Record<Stage, [number, number] | null> = {
  signing: [7, 21], negotiation: [14, 35], proposal: [30, 75],
  qualified: [60, 120], discovery: [90, 180], won: null, lost: null,
};
const AGE_RANGES: Record<Stage, [number, number]> = {
  discovery: [3, 14], qualified: [10, 30], proposal: [20, 60],
  negotiation: [40, 100], signing: [60, 140], won: [60, 200], lost: [60, 200],
};

function parseMoney(raw: string | undefined): number {
  if (!raw) return 0;
  const clean = raw.replace(/US\$|\$|,|\s/g, "").trim();
  if (!clean) return 0;
  const n = parseFloat(clean);
  return Number.isFinite(n) ? n : 0;
}
function parseWs(raw: string): "novit" | "sharky" {
  return raw.trim().toLowerCase() === "sharky" ? "sharky" : "novit";
}
function hash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}
function frac(publicId: string, salt: number): number {
  const v = Math.sin(hash(publicId) + salt * 13.37) * 10000;
  return v - Math.floor(v);
}
function pickRange(id: string, salt: number, lo: number, hi: number): number {
  return Math.round(lo + frac(id, salt) * (hi - lo));
}

async function main() {
  console.log("→ Borrando data transaccional (preservando workspaces+users+SUNAT)…");
  await prisma.message.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.file.deleteMany();
  await prisma.activity.deleteMany();
  await prisma.deal.deleteMany();
  await prisma.contact.deleteMany();
  await prisma.company.deleteMany();
  await prisma.template.deleteMany();
  await prisma.sequence.deleteMany();
  console.log("  ✓ borrado");

  const novit = await prisma.workspace.findUnique({ where: { slug: "novit" }, include: { users: true } });
  const sharky = await prisma.workspace.findUnique({ where: { slug: "sharky" }, include: { users: true } });
  if (!novit || !sharky) {
    throw new Error("Workspaces NOVIT o SHARKY no existen. Correr 'npx tsx prisma/patch-sunat.ts' primero o re-seedear.");
  }
  const ownerNovit = novit.users.find((u) => u.initials === "MP") ?? novit.users[0];
  const ownerSharky = sharky.users.find((u) => u.initials === "AV") ?? sharky.users[0];
  if (!ownerNovit || !ownerSharky) {
    throw new Error("Owners no encontrados. Re-seedear users primero.");
  }
  console.log(`→ Workspaces preservados: ${novit.name} (${novit.ruc}), ${sharky.name} (${sharky.ruc})`);

  const workspaces = { novit, sharky };
  const owners = { novit: ownerNovit, sharky: ownerSharky };

  console.log("→ Leyendo seed-data.csv…");
  const csv = readFileSync(join(__dirname, "seed-data.csv"), "utf-8");
  const { data, errors } = Papa.parse<Row>(csv, { header: true, skipEmptyLines: true });
  if (errors.length) console.warn("  ⚠ parse warnings:", errors.slice(0, 3));

  console.log(`→ Procesando ${data.length} filas del sheet…`);
  const today = new Date();
  let novitIdx = 0, sharkyIdx = 0, skipped = 0;

  for (const row of data) {
    if (!row.Proyecto || !row.Cliente) { skipped++; continue; }
    const wsSlug = parseWs(row.empresa);
    const workspace = workspaces[wsSlug];
    const owner = owners[wsSlug];
    const stage = STAGE_MAP[row.Estado.trim()];
    if (!stage) {
      console.warn(`  ⚠ stage desconocido "${row.Estado}" (fila ${row.ID}) — skip`);
      skipped++;
      continue;
    }

    const setup = parseMoney(row.setup);
    const mrr = parseMoney(row.mensualidad);

    const company = await prisma.company.upsert({
      where: { workspaceId_name: { workspaceId: workspace.id, name: row.Cliente.trim() } },
      update: {},
      create: { name: row.Cliente.trim(), workspaceId: workspace.id },
    });

    const idx = wsSlug === "novit" ? ++novitIdx : ++sharkyIdx;
    const publicId = `${wsSlug.toUpperCase()}-${String(idx).padStart(4, "0")}`;

    // Realistic distributed dates
    const ageDays = pickRange(publicId, 7, AGE_RANGES[stage][0], AGE_RANGES[stage][1]);
    const createdAt = new Date(today);
    createdAt.setDate(createdAt.getDate() - ageDays);

    let estimatedCloseAt: Date;
    let closedAt: Date | null = null;
    const range = CLOSE_RANGES[stage];
    if (range) {
      const days = pickRange(publicId, 3, range[0], range[1]);
      estimatedCloseAt = new Date(today);
      estimatedCloseAt.setDate(estimatedCloseAt.getDate() + days);
    } else {
      const daysAgo = pickRange(publicId, 5, 5, 60);
      estimatedCloseAt = new Date(today);
      estimatedCloseAt.setDate(estimatedCloseAt.getDate() - daysAgo);
      closedAt = estimatedCloseAt;
    }

    await prisma.deal.create({
      data: {
        publicId,
        name: row.Proyecto.trim(),
        value: setup,
        mrr: mrr > 0 ? mrr : null,
        isRecurring: mrr > 0,
        stage,
        probability: STAGE_PROBABILITY[stage],
        ai: STAGE_AI[stage],
        createdAt,
        estimatedCloseAt,
        closedAt,
        lastActivityAt: new Date(),
        workspaceId: workspace.id,
        companyId: company.id,
        ownerId: owner.id,
      },
    });
  }

  const totals = {
    workspaces: await prisma.workspace.count(),
    users: await prisma.user.count(),
    companies: await prisma.company.count(),
    deals: await prisma.deal.count(),
    templates: await prisma.template.count(),
    sequences: await prisma.sequence.count(),
  };
  console.log("\n✓ Reload completo");
  console.table(totals);
  if (skipped > 0) console.log(`(${skipped} filas saltadas)`);
}

main()
  .catch((e) => { console.error("✗ Reload falló:", e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
