// One-shot: agrega Company.ruc + índice único a Neon, sin esperar el
// `prisma db push` completo (que en Google Drive tarda minutos).
// Idempotente: IF NOT EXISTS en todo.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("→ Conectando a Neon…");
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "ruc" TEXT;`,
  );
  console.log("✓ Columna ruc agregada (o ya existía)");

  await prisma.$executeRawUnsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS "Company_workspaceId_ruc_key" ON "Company"("workspaceId", "ruc");`,
  );
  console.log("✓ Índice único (workspaceId, ruc) creado");

  // Verificación
  const rows = await prisma.$queryRawUnsafe(
    `SELECT column_name FROM information_schema.columns WHERE table_name = 'Company' AND column_name = 'ruc';`,
  );
  console.log("VERIFY:", JSON.stringify(rows));
}

main()
  .then(() => prisma.$disconnect())
  .then(() => { console.log("DONE"); process.exit(0); })
  .catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
