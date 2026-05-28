-- Migración manual: Deal.stage (enum Stage) → Deal.stage (TEXT)
-- Necesario porque Prisma db push no puede castear enum→text con data existente.

-- 1) Agregar nueva columna text
ALTER TABLE "Deal" ADD COLUMN "stage_new" TEXT;

-- 2) Copiar valores con cast explícito (PG sí permite enum → text)
UPDATE "Deal" SET "stage_new" = "stage"::TEXT;

-- 3) Drop índice que depende de stage
DROP INDEX IF EXISTS "Deal_workspaceId_stage_idx";

-- 4) Drop columna vieja (libera dependencia del enum)
ALTER TABLE "Deal" DROP COLUMN "stage";

-- 5) Renombrar nueva columna
ALTER TABLE "Deal" RENAME COLUMN "stage_new" TO "stage";

-- 6) Set NOT NULL
ALTER TABLE "Deal" ALTER COLUMN "stage" SET NOT NULL;

-- 7) Drop enum Stage
DROP TYPE "Stage";

-- 8) Re-crear índice
CREATE INDEX "Deal_workspaceId_stage_idx" ON "Deal"("workspaceId", "stage");

-- 9) Crear tabla PipelineStage
CREATE TABLE "PipelineStage" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "color" TEXT NOT NULL,
  "probability" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
  "position" INTEGER NOT NULL,
  "isWon" BOOLEAN NOT NULL DEFAULT false,
  "isLost" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PipelineStage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PipelineStage_workspaceId_key_key" ON "PipelineStage"("workspaceId", "key");
CREATE INDEX "PipelineStage_workspaceId_position_idx" ON "PipelineStage"("workspaceId", "position");

ALTER TABLE "PipelineStage"
  ADD CONSTRAINT "PipelineStage_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
