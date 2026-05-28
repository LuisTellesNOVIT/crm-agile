/**
 * Seed inicial de PipelineStage por workspace. Se ejecuta una sola vez tras
 * la migración manual (migrate-stages.sql). Crea los 7 stages default para
 * cada workspace existente (NOVIT y SHARKY).
 *
 *   npx tsx prisma/seed-stages.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DEFAULT_STAGES = [
  { key: "discovery", label: "Discovery", color: "#94a3b8", probability: 0.1, position: 0, isWon: false, isLost: false },
  { key: "qualified", label: "Qualified", color: "#0ea5e9", probability: 0.25, position: 1, isWon: false, isLost: false },
  { key: "proposal", label: "Proposal", color: "#8b5cf6", probability: 0.5, position: 2, isWon: false, isLost: false },
  { key: "negotiation", label: "Negotiation", color: "#f59e0b", probability: 0.75, position: 3, isWon: false, isLost: false },
  { key: "signing", label: "Signing", color: "#06b6d4", probability: 0.9, position: 4, isWon: false, isLost: false },
  { key: "won", label: "Closed Won", color: "#16a34a", probability: 1.0, position: 5, isWon: true, isLost: false },
  { key: "lost", label: "Closed Lost", color: "#94a3b8", probability: 0.0, position: 6, isWon: false, isLost: true },
];

async function main() {
  const workspaces = await prisma.workspace.findMany();
  console.log(`Encontrados ${workspaces.length} workspaces.`);

  for (const ws of workspaces) {
    console.log(`\n→ Seeding stages para ${ws.slug} (${ws.id})...`);
    for (const s of DEFAULT_STAGES) {
      await prisma.pipelineStage.upsert({
        where: { workspaceId_key: { workspaceId: ws.id, key: s.key } },
        update: {}, // no tocar si ya existe (por si re-corremos)
        create: {
          workspaceId: ws.id,
          ...s,
        },
      });
      console.log(`  ✓ ${s.key} (${s.label})`);
    }
  }

  console.log("\n✅ Seed completo.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
