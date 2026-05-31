// Limpia los leads de prueba QA que creamos al testear el endpoint.
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const qaCompanies = await prisma.company.findMany({
    where: { name: { startsWith: "Empresa QA" } },
    select: { id: true, name: true },
  });
  for (const c of qaCompanies) {
    await prisma.deal.deleteMany({ where: { companyId: c.id } });
    await prisma.contact.deleteMany({ where: { companyId: c.id } });
    await prisma.company.delete({ where: { id: c.id } });
    console.log("✓ eliminado:", c.name);
  }
  // También el "Empresa Test QA SAC" del primer intento (si quedó)
  await prisma.company.deleteMany({ where: { name: "Empresa Test QA SAC" } }).catch(() => {});
  console.log(`DONE — ${qaCompanies.length} empresas QA limpiadas`);
}

main()
  .then(() => prisma.$disconnect())
  .then(() => process.exit(0))
  .catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
