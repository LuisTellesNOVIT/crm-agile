/**
 * /api/stages — CRUD de PipelineStage por workspace.
 *
 * POST con body JSON: { workspaceSlug, stages: [{id?, key, label, color, probability, position, isWon, isLost, _delete?}, ...] }
 * Reemplaza el set completo de stages del workspace (UPSERT por key, delete los que tienen _delete=true).
 *
 * Validación: al menos 1 stage. Las keys deben ser únicas. No se puede borrar una stage si tiene deals
 * asignados (devuelve 409 con la lista de keys problemáticas).
 */
import { type ActionFunctionArgs } from "react-router";
import { prisma } from "../lib/db.server";
import { requireUser } from "../lib/session.server";

type IncomingStage = {
  id?: string;
  key: string;
  label: string;
  color: string;
  probability: number;
  position: number;
  isWon?: boolean;
  isLost?: boolean;
  _delete?: boolean;
};

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }
  await requireUser(request);

  const body = await request.json().catch(() => null) as
    | { workspaceSlug?: string; stages?: IncomingStage[] }
    | null;

  if (!body?.workspaceSlug || !Array.isArray(body.stages)) {
    return Response.json({ error: "Missing workspaceSlug or stages array" }, { status: 400 });
  }

  const ws = await prisma.workspace.findUnique({
    where: { slug: body.workspaceSlug },
    select: { id: true },
  });
  if (!ws) return Response.json({ error: "Workspace not found" }, { status: 404 });

  const keep = body.stages.filter((s) => !s._delete);
  const remove = body.stages.filter((s) => s._delete);

  if (keep.length === 0) {
    return Response.json({ error: "El pipeline necesita al menos 1 etapa" }, { status: 400 });
  }

  // Validar keys únicas
  const keys = keep.map((s) => s.key);
  if (new Set(keys).size !== keys.length) {
    return Response.json({ error: "Las keys de las etapas deben ser únicas" }, { status: 400 });
  }

  // Validar que las stages a eliminar no tienen deals
  if (remove.length > 0) {
    const blockingDeals = await prisma.deal.findMany({
      where: {
        workspaceId: ws.id,
        stage: { in: remove.map((s) => s.key) },
      },
      select: { stage: true },
    });
    const blockingKeys = Array.from(new Set(blockingDeals.map((d) => d.stage)));
    if (blockingKeys.length > 0) {
      return Response.json(
        {
          error: "No se pueden eliminar etapas con deals asignados",
          blockingKeys,
        },
        { status: 409 },
      );
    }
  }

  // Tx: delete, upsert
  try {
    await prisma.$transaction([
      // Borrar las marcadas para eliminar
      prisma.pipelineStage.deleteMany({
        where: {
          workspaceId: ws.id,
          key: { in: remove.map((s) => s.key) },
        },
      }),
      // Upsert las que se mantienen (rename por key)
      ...keep.map((s) =>
        prisma.pipelineStage.upsert({
          where: { workspaceId_key: { workspaceId: ws.id, key: s.key } },
          update: {
            label: s.label,
            color: s.color,
            probability: s.probability,
            position: s.position,
            isWon: s.isWon ?? false,
            isLost: s.isLost ?? false,
          },
          create: {
            workspaceId: ws.id,
            key: s.key,
            label: s.label,
            color: s.color,
            probability: s.probability,
            position: s.position,
            isWon: s.isWon ?? false,
            isLost: s.isLost ?? false,
          },
        }),
      ),
    ]);
  } catch (err) {
    console.error("[api.stages] tx failed:", err);
    return Response.json({ error: "Error al guardar etapas" }, { status: 500 });
  }

  return Response.json({ ok: true, count: keep.length });
}

export async function loader() {
  return Response.json({ error: "Use POST" }, { status: 405 });
}
