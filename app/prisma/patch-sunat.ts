/**
 * Patch: pobla la info SUNAT inicial de NOVIT y SHARKY sin tocar el resto de la data.
 * Correr una vez: `npx tsx prisma/patch-sunat.ts`
 *
 * Los datos abajo son DEMO. Reemplazar con la info real desde /empresas en la app.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("→ Patcheando info SUNAT en Workspaces…");

  await prisma.workspace.update({
    where: { slug: "novit" },
    data: {
      ruc: "20512345678",
      razonSocial: "NOVIT CONSULTORIA S.A.C.",
      nombreComercial: "NOVIT",
      estado: "ACTIVO",
      condicion: "HABIDO",
      tipoContribuyente: "SOCIEDAD ANONIMA CERRADA",
      ciiu: "6202",
      ciiuDescripcion: "Consultoría de informática y gestión de instalaciones",
      domicilioFiscal: "Av. Javier Prado Este 123 Of. 1502",
      distrito: "San Isidro",
      provincia: "Lima",
      departamento: "Lima",
      ubigeo: "150131",
      fechaInscripcion: new Date("2015-03-15"),
      fechaInicioActividades: new Date("2015-04-01"),
      representanteLegal: "Luis Telles Atto",
      representanteDni: "44556677",
      representanteCargo: "Gerente General",
      telefono: "+51 1 442-1234",
      email: "contacto@novit.pe",
      trabajadoresActivos: 42,
      sistemaEmision: "ELECTRÓNICO",
      sistemaContabilidad: "COMPUTARIZADO",
      notas: "Habido SUNAT — emisión electrónica activa desde 2018.",
    },
  });

  await prisma.workspace.update({
    where: { slug: "sharky" },
    data: {
      ruc: "20549876543",
      razonSocial: "SHARKY GROWTH STUDIO S.A.C.",
      nombreComercial: "SHARKY",
      estado: "ACTIVO",
      condicion: "HABIDO",
      tipoContribuyente: "SOCIEDAD ANONIMA CERRADA",
      ciiu: "7311",
      ciiuDescripcion: "Publicidad — agencia de medios y growth marketing",
      domicilioFiscal: "Calle Las Begonias 456 Piso 7",
      distrito: "San Isidro",
      provincia: "Lima",
      departamento: "Lima",
      ubigeo: "150131",
      fechaInscripcion: new Date("2019-08-22"),
      fechaInicioActividades: new Date("2019-09-15"),
      representanteLegal: "Ariana Vélez Quispe",
      representanteDni: "70234567",
      representanteCargo: "CEO & Fundadora",
      telefono: "+51 1 700-5678",
      email: "hola@sharky.pe",
      trabajadoresActivos: 18,
      sistemaEmision: "ELECTRÓNICO",
      sistemaContabilidad: "COMPUTARIZADO",
      notas: "Habido SUNAT — boutique B2B SaaS, vertical fintech y seguros.",
    },
  });

  const rows = await prisma.workspace.findMany({
    select: { slug: true, ruc: true, razonSocial: true },
  });
  console.log("\n✓ Patch completo");
  console.table(rows);
}

main()
  .catch((e) => {
    console.error("✗ Patch falló:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
