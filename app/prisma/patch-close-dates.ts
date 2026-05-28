/**
 * Patch: distribuye estimatedCloseAt y createdAt de los deals abiertos
 * para que el GANTT y el Forecast tengan distribución natural.
 *
 * Reglas (relativas a hoy):
 *   signing      +7  → +21 días
 *   negotiation  +14 → +35 días
 *   proposal     +30 → +75 días
 *   qualified    +60 → +120 días
 *   discovery    +90 → +180 días
 *   won/lost     no se tocan (ya tienen closedAt)
 *
 * createdAt va al pasado proporcional al stage (deals más avanzados
 * llevan más tiempo en el pipeline).
 *
 * El jitter es determinístico via hash(publicId) → estable entre runs.
 * Correr: `npx tsx prisma/patch-close-dates.ts`
 */
import { PrismaClient, Stage } from "@prisma/client";

const prisma = new PrismaClient();

const CLOSE_RANGES: Record<Stage, [number, number] | null> = {
  signing: [7, 21],
  negotiation: [14, 35],
  proposal: [30, 75],
  qualified: [60, 120],
  discovery: [90, 180],
  won: null,
  lost: null,
};

// Tiempo "típico" en pipeline (días) por stage (cuántos días lleva ya abierto)
const AGE_RANGES: Record<Stage, [number, number]> = {
  discovery: [3, 14],
  qualified: [10, 30],
  proposal: [20, 60],
  negotiation: [40, 100],
  signing: [60, 140],
  won: [60, 200],
  lost: [60, 200],
};

function hash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** Fraction in [0, 1) deterministic por publicId + salt. */
function frac(publicId: string, salt: number): number {
  const v = Math.sin(hash(publicId) + salt * 13.37) * 10000;
  return v - Math.floor(v);
}

function pickInRange(publicId: string, salt: number, lo: number, hi: number): number {
  return Math.round(lo + frac(publicId, salt) * (hi - lo));
}

async function main() {
  console.log("→ Distribuyendo fechas de cierre y de creación…");

  const deals = await prisma.deal.findMany({
    select: { id: true, publicId: true, stage: true },
  });
  console.log(`  ${deals.length} deals a procesar`);

  const today = new Date();
  let updated = 0;

  for (const d of deals) {
    const range = CLOSE_RANGES[d.stage];
    const ageRange = AGE_RANGES[d.stage];
    const ageDays = pickInRange(d.publicId, 7, ageRange[0], ageRange[1]);
    const createdAt = new Date(today);
    createdAt.setDate(createdAt.getDate() - ageDays);

    let estimatedCloseAt: Date;
    let closedAt: Date | null = null;

    if (range) {
      const days = pickInRange(d.publicId, 3, range[0], range[1]);
      estimatedCloseAt = new Date(today);
      estimatedCloseAt.setDate(estimatedCloseAt.getDate() + days);
    } else {
      // won/lost — close en el pasado proporcional al age
      const daysAgo = pickInRange(d.publicId, 5, 5, 60);
      estimatedCloseAt = new Date(today);
      estimatedCloseAt.setDate(estimatedCloseAt.getDate() - daysAgo);
      closedAt = estimatedCloseAt;
    }

    await prisma.deal.update({
      where: { id: d.id },
      data: { createdAt, estimatedCloseAt, closedAt, lastActivityAt: new Date() },
    });
    updated++;
  }

  // Sample of result
  const sample = await prisma.deal.findMany({
    take: 8,
    select: { publicId: true, stage: true, createdAt: true, estimatedCloseAt: true },
    orderBy: { stage: "asc" },
  });
  console.log("\n✓ Actualizados:", updated);
  console.table(
    sample.map((s) => ({
      publicId: s.publicId,
      stage: s.stage,
      created: s.createdAt.toISOString().slice(0, 10),
      close: s.estimatedCloseAt.toISOString().slice(0, 10),
    })),
  );
}

main()
  .catch((e) => {
    console.error("✗ Patch falló:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
