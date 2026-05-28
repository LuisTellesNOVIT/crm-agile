/**
 * Seed: carga inicial desde prisma/seed-data.csv (export del Google Sheet).
 *
 * Idempotente: borra todos los Deals/Companies/Users/Workspaces antes de re-crear.
 * Para re-importar con datos actualizados:
 *   1) Re-exportar el sheet a prisma/seed-data.csv
 *   2) npx tsx prisma/seed.ts
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
  "12 meses": string;
  "24 meses": string;
  "36 meses": string;
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
  discovery: 0.1,
  qualified: 0.25,
  proposal: 0.5,
  negotiation: 0.75,
  signing: 0.9,
  won: 1.0,
  lost: 0.0,
};

const STAGE_AI: Record<Stage, number> = {
  discovery: 25,
  qualified: 40,
  proposal: 60,
  negotiation: 80,
  signing: 92,
  won: 100,
  lost: 0,
};

function parseMoney(raw: string | undefined): number {
  if (!raw) return 0;
  const clean = raw.replace(/US\$|\$|,|\s/g, "").trim();
  if (!clean) return 0;
  const n = parseFloat(clean);
  return Number.isFinite(n) ? n : 0;
}

function parseWorkspaceSlug(raw: string): "novit" | "sharky" {
  return raw.trim().toLowerCase() === "sharky" ? "sharky" : "novit";
}

function publicId(ws: "novit" | "sharky", index: number): string {
  return `${ws.toUpperCase()}-${String(index).padStart(4, "0")}`;
}

async function main() {
  console.log("→ Borrando datos previos…");
  await prisma.message.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.file.deleteMany();
  await prisma.activity.deleteMany();
  await prisma.deal.deleteMany();
  await prisma.contact.deleteMany();
  await prisma.company.deleteMany();
  await prisma.user.deleteMany();
  await prisma.workspace.deleteMany();
  await prisma.template.deleteMany();
  await prisma.sequence.deleteMany();

  console.log("→ Creando workspaces y usuarios…");
  const novit = await prisma.workspace.create({
    data: {
      slug: "novit",
      name: "NOVIT",
      tagline: "Tech & enterprise",
      brandColor: "#2563eb",
      currency: "USD",
    },
  });
  const sharky = await prisma.workspace.create({
    data: {
      slug: "sharky",
      name: "SHARKY",
      tagline: "Growth studio",
      brandColor: "#ea580c",
      currency: "USD",
    },
  });

  const mp = await prisma.user.create({
    data: {
      email: "maria.paz@novit.pe",
      name: "María Paz Iribarren",
      role: "Account Executive",
      initials: "MP",
      color: "#2563eb",
      workspaceId: novit.id,
    },
  });
  const av = await prisma.user.create({
    data: {
      email: "ariana.velez@sharky.pe",
      name: "Ariana Vélez",
      role: "Growth Lead",
      initials: "AV",
      color: "#ea580c",
      workspaceId: sharky.id,
    },
  });

  const workspaces = { novit, sharky };
  const owners = { novit: mp, sharky: av };

  console.log("→ Leyendo seed-data.csv…");
  const csv = readFileSync(join(__dirname, "seed-data.csv"), "utf-8");
  const { data, errors } = Papa.parse<Row>(csv, {
    header: true,
    skipEmptyLines: true,
  });
  if (errors.length) {
    console.warn("⚠ CSV parse warnings:", errors.slice(0, 3));
  }

  console.log(`→ Procesando ${data.length} deals…`);
  const today = new Date();
  let novitIdx = 0;
  let sharkyIdx = 0;
  let skipped = 0;

  for (const row of data) {
    if (!row.Proyecto || !row.Cliente) {
      skipped++;
      continue;
    }
    const wsSlug = parseWorkspaceSlug(row.empresa);
    const workspace = workspaces[wsSlug];
    const owner = owners[wsSlug];
    const stage = STAGE_MAP[row.Estado.trim()];
    if (!stage) {
      console.warn(`  ⚠ stage desconocido "${row.Estado}" en fila ${row.ID} — saltando`);
      skipped++;
      continue;
    }

    const setup = parseMoney(row.setup);
    const mrr = parseMoney(row.mensualidad);

    // Upsert Company (unique por workspace+name)
    const company = await prisma.company.upsert({
      where: {
        workspaceId_name: { workspaceId: workspace.id, name: row.Cliente.trim() },
      },
      update: {},
      create: {
        name: row.Cliente.trim(),
        workspaceId: workspace.id,
      },
    });

    const idx = wsSlug === "novit" ? ++novitIdx : ++sharkyIdx;

    // closedAt para won/lost: cierre estimado ~30d atrás
    // estimatedCloseAt para abiertos: +60d desde hoy
    const isClosed = stage === Stage.won || stage === Stage.lost;
    const closeDate = new Date(today);
    if (isClosed) {
      closeDate.setDate(closeDate.getDate() - 30);
    } else {
      closeDate.setDate(closeDate.getDate() + 60);
    }

    await prisma.deal.create({
      data: {
        publicId: publicId(wsSlug, idx),
        name: row.Proyecto.trim(),
        value: setup,
        mrr: mrr > 0 ? mrr : null,
        isRecurring: mrr > 0,
        stage,
        probability: STAGE_PROBABILITY[stage],
        ai: STAGE_AI[stage],
        estimatedCloseAt: closeDate,
        closedAt: isClosed ? closeDate : null,
        workspaceId: workspace.id,
        companyId: company.id,
        ownerId: owner.id,
      },
    });
  }

  // ---------- Templates + Sequence ----------
  console.log("→ Sembrando templates y secuencias…");
  for (const ws of [novit, sharky]) {
    await prisma.template.createMany({
      data: [
        {
          workspaceId: ws.id,
          channel: "wa",
          name: "Welcome new lead",
          description: "Primer mensaje al recibir un lead inbound",
          body: "Hola {{first_name}} 👋\n\nGracias por contactarte con {{workspace_name}}. ¿Tenés 15 min esta semana para una primera charla?",
          uses: 1248,
          replyRate: 67,
        },
        {
          workspaceId: ws.id,
          channel: "wa",
          name: "Follow-up sin respuesta",
          description: "2do toque cuando no hay respuesta en 48hs",
          body: "Hola {{first_name}}, ¿te queda en el radar lo de {{deal_name}}?",
          uses: 892,
          replyRate: 41,
        },
        {
          workspaceId: ws.id,
          channel: "email",
          name: "Propuesta enviada — recap",
          description: "Email recap luego de enviar propuesta",
          body: "Hola {{first_name}},\n\nAdjunto la propuesta de {{deal_name}}. Quedo atento.",
          uses: 412,
          replyRate: 78,
        },
      ],
    });
    await prisma.sequence.create({
      data: {
        workspaceId: ws.id,
        name: "Lead inbound — onboarding 7 días",
        active: true,
        nodes: [
          { kind: "trigger", title: "Lead creado", body: "Nuevo lead desde web/FB Ads/referido." },
          { kind: "delay", title: "Inmediato", body: "0 minutos" },
          { kind: "wa", title: "WhatsApp · Welcome", body: "Plantilla welcome." },
          { kind: "delay", title: "Esperar 2 días", body: "Si no responde, continuar" },
          { kind: "email", title: "Email · Caso de éxito", body: "Caso similar + invitación a 15min" },
          { kind: "delay", title: "Esperar 3 días", body: "Si no responde, continuar" },
          { kind: "wa", title: "WhatsApp · Nurture", body: "Último toque" },
          { kind: "exit", title: "Salida → Cold", body: "Después de 7 días sin respuesta" },
        ],
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

  console.log("\n✓ Seed completo");
  console.log(totals);
  if (skipped > 0) console.log(`(${skipped} filas saltadas)`);
}

main()
  .catch((e) => {
    console.error("✗ Seed falló:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
