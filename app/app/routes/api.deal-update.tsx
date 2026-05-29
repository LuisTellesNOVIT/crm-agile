import type { ActionFunctionArgs } from "react-router";
import { prisma } from "../lib/db.server";
import { stageProbability } from "../lib/stages";
import { requireUser } from "../lib/session.server";

/**
 * Resource route — POST /api/deal-update
 *
 * Body (FormData) — campos opcionales (sólo los provistos se actualizan):
 *   id           publicId del deal (REQUERIDO, ej "NOVIT-0012")
 *   stage        stage key (si cambia, también recalcula probability + closedAt)
 *   name         string
 *   value        number (setup / one-time)
 *   isRecurring  "true" | "false"
 *   arr          number (annual recurring revenue, usado si isRecurring)
 *   probability  number 0..1 (override manual, se aplica DESPUÉS del stage default)
 *   ai           number 0..100 (override manual)
 *   ownerId      User.id (debe existir en el mismo workspace)
 *   companyId    Company.id (debe existir en el mismo workspace)
 *   estimatedCloseAt  ISO date (YYYY-MM-DD ok)
 *   source       string ("fb_ads" | "linkedin" | "web" | "referral" | otro)
 *   publicId     nuevo publicId (renombrar el código)
 *
 * Validaciones:
 *   - El deal debe existir
 *   - stage key debe pertenecer al PipelineStage del workspace
 *   - ownerId / companyId deben pertenecer al mismo workspace que el deal
 *   - publicId nuevo debe ser único globalmente
 *   - probability debe estar en [0, 1]
 *   - ai debe estar en [0, 100]
 *
 * React Router revalida loaders automáticamente tras la action,
 * así que la UI se refresca sin manualWork.
 */
export async function action({ request }: ActionFunctionArgs) {
  const me = await requireUser(request);
  const form = await request.formData();
  const publicId = String(form.get("id") ?? "");
  if (!publicId) {
    return Response.json({ error: "missing id" }, { status: 400 });
  }

  const existing = await prisma.deal.findUnique({
    where: { publicId },
    select: { id: true, workspaceId: true, companyId: true, ownerId: true, isRecurring: true, mrr: true, stage: true },
  });
  if (!existing) {
    return Response.json({ error: `deal not found: ${publicId}` }, { status: 404 });
  }

  const data: Record<string, unknown> = {};
  const errors: string[] = [];

  // ─── moveToWorkspace (cambio de grupo NOVIT/SHARKY — solo admin) ─
  // Mueve el deal Y su empresa al workspace destino. Remapea stage (por key
  // si existe en destino, sino primer stage) y owner (si el actual no
  // pertenece al destino, queda el admin que ejecuta).
  let targetWsId = existing.workspaceId;
  const moveSlug = form.get("moveToWorkspace");
  if (moveSlug != null && String(moveSlug).trim()) {
    if (me.permissions !== "admin") {
      errors.push("Solo administradores pueden mover de grupo");
    } else {
      const targetWs = await prisma.workspace.findUnique({
        where: { slug: String(moveSlug).trim().toLowerCase() },
        select: { id: true },
      });
      if (!targetWs) {
        errors.push(`Grupo destino no encontrado: ${moveSlug}`);
      } else if (targetWs.id !== existing.workspaceId) {
        targetWsId = targetWs.id;
        data.workspaceId = targetWs.id;
        // mover la empresa al grupo destino (capturamos conflicto de unicidad)
        try {
          await prisma.company.update({
            where: { id: existing.companyId },
            data: { workspaceId: targetWs.id },
          });
        } catch (e) {
          const msg = (e as Error).message ?? "";
          if (msg.includes("Unique constraint")) {
            return Response.json(
              { error: "El grupo destino ya tiene una empresa con ese nombre o RUC. Renombrá primero." },
              { status: 409 },
            );
          }
          throw e;
        }
        // remapear owner si el actual no pertenece al destino
        const ownerOk = await prisma.user.findFirst({
          where: { id: existing.ownerId, workspaceId: targetWs.id },
          select: { id: true },
        });
        if (!ownerOk) {
          const meInTarget = me.workspaceId === targetWs.id;
          if (meInTarget) data.ownerId = me.id;
          else {
            const firstUser = await prisma.user.findFirst({
              where: { workspaceId: targetWs.id },
              select: { id: true },
            });
            if (firstUser) data.ownerId = firstUser.id;
          }
        }
      }
    }
  }

  // ─── stage (con recálculo de probability + closedAt) ────────
  const stageKey = form.get("stage");
  let stageRow: { key: string; probability: number | null; isWon: boolean; isLost: boolean } | null = null;
  if (stageKey != null && String(stageKey).trim()) {
    const key = String(stageKey).trim();
    stageRow = await prisma.pipelineStage.findUnique({
      where: { workspaceId_key: { workspaceId: targetWsId, key } },
      select: { key: true, probability: true, isWon: true, isLost: true },
    });
    if (!stageRow) {
      errors.push(`invalid stage: ${key}`);
    } else {
      data.stage = stageRow.key;
      // probability se setea desde el stage A MENOS que venga override explícito abajo
      data.probability = stageRow.probability ?? stageProbability(stageRow.key);
      // closedAt: marca/desmarca según won/lost del nuevo stage
      data.closedAt = stageRow.isWon || stageRow.isLost ? new Date() : null;
    }
  }

  // Si movimos de grupo y el stage actual no existe en el destino, mapear al primero
  if (data.workspaceId && !data.stage) {
    const stillValid = await prisma.pipelineStage.findUnique({
      where: { workspaceId_key: { workspaceId: targetWsId, key: existing.stage } },
      select: { key: true, probability: true },
    });
    if (!stillValid) {
      const first = await prisma.pipelineStage.findFirst({
        where: { workspaceId: targetWsId, isWon: false, isLost: false },
        orderBy: { position: "asc" },
        select: { key: true, probability: true },
      });
      if (first) {
        data.stage = first.key;
        data.probability = first.probability ?? stageProbability(first.key);
      }
    }
  }

  // ─── name ──────────────────────────────────────────────
  const name = form.get("name");
  if (name != null) {
    const v = String(name).trim();
    if (!v) errors.push("name no puede estar vacío");
    else data.name = v;
  }

  // ─── value (setup / one-time) ──────────────────────────
  const value = form.get("value");
  if (value != null && String(value).trim()) {
    const n = parseFloat(String(value));
    if (!Number.isFinite(n) || n < 0) errors.push("value inválido");
    else data.value = n;
  }

  // ─── isRecurring + arr (recurring) ─────────────────────
  // Aceptamos "true"/"false"/"1"/"0"/"on"/null
  const recurringRaw = form.get("isRecurring");
  let willBeRecurring = existing.isRecurring;
  if (recurringRaw != null) {
    const v = String(recurringRaw).toLowerCase();
    willBeRecurring = v === "true" || v === "1" || v === "on";
    data.isRecurring = willBeRecurring;
  }

  const arr = form.get("arr");
  if (arr != null && String(arr).trim()) {
    const n = parseFloat(String(arr));
    if (!Number.isFinite(n) || n < 0) errors.push("arr inválido");
    else {
      // MRR = ARR / 12. Si no es recurrente, igual lo guardamos pero quedará no usado.
      data.mrr = willBeRecurring ? Math.round((n / 12) * 100) / 100 : null;
    }
  } else if (recurringRaw != null && !willBeRecurring) {
    // Si lo desmarcamos como recurring, limpiamos mrr
    data.mrr = null;
  }

  // ─── probability (override manual, sobrescribe lo de stage) ─
  const prob = form.get("probability");
  if (prob != null && String(prob).trim()) {
    const n = parseFloat(String(prob));
    if (!Number.isFinite(n) || n < 0 || n > 1) {
      errors.push("probability debe estar entre 0 y 1");
    } else {
      data.probability = n;
    }
  }

  // ─── ai (manual override 0..100) ───────────────────────
  const ai = form.get("ai");
  if (ai != null && String(ai).trim()) {
    const n = parseInt(String(ai), 10);
    if (!Number.isFinite(n) || n < 0 || n > 100) errors.push("ai debe estar entre 0 y 100");
    else data.ai = n;
  }

  // ─── ownerId (validar que pertenece al workspace destino) ──────
  const ownerId = form.get("ownerId");
  if (ownerId != null && String(ownerId).trim()) {
    const id = String(ownerId);
    const u = await prisma.user.findUnique({
      where: { id },
      select: { workspaceId: true },
    });
    if (!u || u.workspaceId !== targetWsId) {
      errors.push("ownerId no pertenece al grupo del deal");
    } else {
      data.ownerId = id;
    }
  }

  // ─── companyId (validar que pertenece al workspace destino) ────
  const companyId = form.get("companyId");
  if (companyId != null && String(companyId).trim()) {
    const id = String(companyId);
    const c = await prisma.company.findUnique({
      where: { id },
      select: { workspaceId: true },
    });
    if (!c || c.workspaceId !== targetWsId) {
      errors.push("companyId no pertenece al grupo del deal");
    } else {
      data.companyId = id;
    }
  }

  // ─── estimatedCloseAt ──────────────────────────────────
  const closeAt = form.get("estimatedCloseAt");
  if (closeAt != null && String(closeAt).trim()) {
    const d = new Date(String(closeAt));
    if (Number.isNaN(d.getTime())) errors.push("estimatedCloseAt inválida");
    else data.estimatedCloseAt = d;
  }

  // ─── source ────────────────────────────────────────────
  const source = form.get("source");
  if (source != null) {
    const v = String(source).trim();
    data.source = v || null;
  }

  // ─── publicId (renombrar código público) ───────────────
  const newPublicId = form.get("publicId");
  if (newPublicId != null && String(newPublicId).trim()) {
    const v = String(newPublicId).trim().toUpperCase();
    if (v !== publicId) {
      // unicidad
      const dup = await prisma.deal.findUnique({ where: { publicId: v }, select: { id: true } });
      if (dup) errors.push(`ya existe un deal con publicId ${v}`);
      else data.publicId = v;
    }
  }

  if (errors.length > 0) {
    return Response.json({ error: errors.join(" · ") }, { status: 400 });
  }

  // Si no hay nada que actualizar más allá de touching, igual marcamos lastActivity.
  data.lastActivityAt = new Date();

  const updated = await prisma.deal.update({
    where: { publicId },
    data,
    select: { publicId: true, stage: true },
  });

  return Response.json({ ok: true, id: updated.publicId, stage: updated.stage });
}
