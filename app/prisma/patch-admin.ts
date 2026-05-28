/**
 * Crea o actualiza el usuario admin con login Ltelles@novit.pe / NOVIT2023.
 * Idempotente: si ya existe, solo actualiza passwordHash + permissions.
 *
 * Correr: `npx tsx prisma/patch-admin.ts`
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const EMAIL = "ltelles@novit.pe";
const PLAIN = "NOVIT2023";

async function main() {
  const novit = await prisma.workspace.findUnique({ where: { slug: "novit" } });
  if (!novit) throw new Error("Workspace NOVIT no existe. Re-seed primero.");

  const hash = await bcrypt.hash(PLAIN, 10);

  // upsert por email
  const existing = await prisma.user.findUnique({ where: { email: EMAIL } });
  if (existing) {
    const updated = await prisma.user.update({
      where: { email: EMAIL },
      data: { passwordHash: hash, permissions: "admin", name: "Luis Telles Atto", initials: "LT" },
    });
    console.log("✓ Admin actualizado:", updated.email, "(permissions:", updated.permissions + ")");
  } else {
    const created = await prisma.user.create({
      data: {
        email: EMAIL,
        name: "Luis Telles Atto",
        role: "Administrador",
        initials: "LT",
        color: "#0a0a0a",
        workspaceId: novit.id,
        passwordHash: hash,
        permissions: "admin",
      },
    });
    console.log("✓ Admin creado:", created.email);
  }
  console.log(`\n  Credenciales para login:`);
  console.log(`  Email:  ${EMAIL}`);
  console.log(`  Pass:   ${PLAIN}`);
}

main()
  .catch((e) => { console.error("✗ Patch falló:", e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
