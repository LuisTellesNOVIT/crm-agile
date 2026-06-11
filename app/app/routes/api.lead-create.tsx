import type { ActionFunctionArgs } from "react-router";
import { prisma } from "../lib/db.server";
import { parseTags } from "../lib/tags";
import { requireUser } from "../lib/session.server";
import { hasWorkspaceAccess, forbidden } from "../lib/authz.server";

/**
 * Resource route — POST /api/lead-create
 *
 * Crea un nuevo lead end-to-end en la DB:
 *   1. Resuelve o crea la Company (por RUC si viene, sino por nombre)
 *   2. Crea el Contact ligado a la Company
 *   3. Crea el Deal con un publicId secuencial (NOVIT-NNNN / SHARKY-NNNN)
 *
 * Body (FormData):
 *   workspaceSlug   "novit" | "sharky"
 *   firstName       string (requerido)
 *   lastName        string
 *   email           string (requerido)
 *   phone           string (con prefijo +51 por default)
 *   companyName     string (requerido)
 *   ruc             string (11 dígitos, opcional)
 *   industry        string
 *   source          "fb_ads" | "linkedin" | "web" | "referral" | "outbound" | "event" | "other"
 *   estimatedValue  number (USD, opcional — default 0)
 *   stage           string (key de PipelineStage, default primer stage no-won)
 *   dealName        string (opcional — default "{companyName} · Nueva oportunidad")
 *
 * El owner del deal es el usuario logueado (requireUser).
 */
export async function action({ request }: ActionFunctionArgs) {
  const me = await requireUser(request);
  const fd = await request.formData();

  const workspaceSlug = String(fd.get("workspaceSlug") ?? "novit").toLowerCase();
  const firstName = String(fd.get("firstName") ?? "").trim();
  const lastName = String(fd.get("lastName") ?? "").trim();
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const phone = String(fd.get("phone") ?? "").trim();
  const companyName = String(fd.get("companyName") ?? "").trim();
  const ruc = String(fd.get("ruc") ?? "").trim();
  const industry = String(fd.get("industry") ?? "").trim() || null;
  const source = String(fd.get("source") ?? "").trim() || null;
  const estimatedValueRaw = String(fd.get("estimatedValue") ?? "0").trim();
  const stageKey = String(fd.get("stage") ?? "").trim();
  const dealNameRaw = String(fd.get("dealName") ?? "").trim();
  const tags = parseTags(String(fd.get("tags") ?? ""));
  const sequenceId = String(fd.get("sequenceId") ?? "").trim();
  const strategic = ["true", "1", "on", "si", "sí"].includes(String(fd.get("strategic") ?? "").toLowerCase());
  // Maestros: cliente y contacto existentes (si se eligen, no se crean de nuevo)
  const companyId = String(fd.get("companyId") ?? "").trim();
  const contactId = String(fd.get("contactId") ?? "").trim();

  // ── Validaciones ────────────────────────────────────────
  const errors: string[] = [];
  // Si se elige un contacto existente, no exigimos nombre/email nuevos.
  if (!contactId) {
    if (!firstName) errors.push("Nombre del contacto requerido");
    if (!email) errors.push("Email del contacto requerido");
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push("Email inválido");
  }
  // Cliente: por id existente o por nombre nuevo.
  if (!companyId && !companyName) errors.push("Elegí un cliente o escribí el nombre");
  if (ruc && !/^\d{11}$/.test(ruc)) errors.push("RUC debe tener 11 dígitos");
  const estimatedValue = parseFloat(estimatedValueRaw);
  if (!Number.isFinite(estimatedValue) || estimatedValue < 0) errors.push("Valor estimado inválido");

  if (errors.length > 0) {
    return Response.json({ error: errors.join(" · ") }, { status: 400 });
  }

  // ── Workspace ────────────────────────────────────────
  const ws = await prisma.workspace.findUnique({
    where: { slug: workspaceSlug },
    select: { id: true, slug: true },
  });
  if (!ws) {
    return Response.json({ error: `Workspace no encontrado: ${workspaceSlug}` }, { status: 400 });
  }
  if (!hasWorkspaceAccess(me, ws.id)) {
    return forbidden("Solo un admin puede crear leads en otro grupo.");
  }

  // ── Secuencia de seguimiento (opcional) — debe ser del mismo grupo ──
  let validSeqId: string | null = null;
  if (sequenceId) {
    const seq = await prisma.sequence.findUnique({ where: { id: sequenceId }, select: { workspaceId: true } });
    if (seq && seq.workspaceId === ws.id) validSeqId = sequenceId;
  }

  // ── Stage default (primer no-won/lost) ──────────────
  let resolvedStageKey = stageKey;
  if (!resolvedStageKey) {
    const firstStage = await prisma.pipelineStage.findFirst({
      where: { workspaceId: ws.id, isWon: false, isLost: false },
      orderBy: { position: "asc" },
      select: { key: true },
    });
    resolvedStageKey = firstStage?.key ?? "qualified";
  }
  const stageRow = await prisma.pipelineStage.findUnique({
    where: { workspaceId_key: { workspaceId: ws.id, key: resolvedStageKey } },
    select: { key: true, probability: true, isWon: true, isLost: true },
  });
  if (!stageRow) {
    return Response.json({ error: `Stage inválido: ${resolvedStageKey}` }, { status: 400 });
  }

  // ── Cliente: id existente (maestro) → RUC → nombre → crear ──
  let company: { id: string; name: string } | null = null;

  if (companyId) {
    const existing = await prisma.company.findFirst({
      where: { id: companyId, workspaceId: ws.id },
      select: { id: true, name: true },
    });
    if (existing) company = existing;
  }

  if (!company && ruc) {
    const existingByRuc = await prisma.company.findFirst({
      where: { workspaceId: ws.id, ruc },
      select: { id: true, name: true },
    });
    if (existingByRuc) company = existingByRuc;
  }

  if (!company) {
    const existingByName = await prisma.company.findFirst({
      where: { workspaceId: ws.id, name: companyName },
      select: { id: true, name: true },
    });
    if (existingByName) {
      company = existingByName;
      if (ruc) {
        await prisma.company.update({ where: { id: existingByName.id }, data: { ruc } });
      }
    }
  }

  if (!company) {
    company = await prisma.company.create({
      data: {
        name: companyName,
        ruc: ruc || null,
        industry,
        workspaceId: ws.id,
      },
      select: { id: true, name: true },
    });
  }

  // ── Contacto: maestro (id existente → dedup por email → crear) ──
  let contact: { id: string; name: string } | null = null;
  if (contactId) {
    const existing = await prisma.contact.findFirst({ where: { id: contactId }, select: { id: true, name: true } });
    if (existing) contact = existing;
  }
  if (!contact && email) {
    const existingByEmail = await prisma.contact.findFirst({
      where: { companyId: company.id, email },
      select: { id: true, name: true },
    });
    if (existingByEmail) contact = existingByEmail;
  }
  if (!contact && (firstName || email)) {
    const newName = `${firstName} ${lastName}`.trim() || email;
    contact = await prisma.contact.create({
      data: { name: newName, email: email || "", phone: phone || null, companyId: company.id },
      select: { id: true, name: true },
    });
  }

  // ── publicId secuencial (NOVIT-NNNN / SHARKY-NNNN) ──
  const prefix = ws.slug.toUpperCase();
  const lastDeal = await prisma.deal.findFirst({
    where: { workspaceId: ws.id, publicId: { startsWith: `${prefix}-` } },
    orderBy: { publicId: "desc" },
    select: { publicId: true },
  });
  let nextNum = 1;
  if (lastDeal?.publicId) {
    const match = /-(\d+)$/.exec(lastDeal.publicId);
    if (match) nextNum = parseInt(match[1], 10) + 1;
  }
  const publicId = `${prefix}-${String(nextNum).padStart(4, "0")}`;

  // ── Deal ─────────────────────────────────────────────
  const probabilityFinal = stageRow.probability ?? 0.25;
  const dealName = dealNameRaw || `${company.name} · Nueva oportunidad`;
  const isWonOrLost = stageRow.isWon || stageRow.isLost;

  // Fecha estimada de cierre = hoy + 60 días (default)
  const estimatedCloseAt = new Date();
  estimatedCloseAt.setDate(estimatedCloseAt.getDate() + 60);
  // Proyecto por default: arranca al cierre y dura 2 meses (editable luego).
  const projectStartAt = new Date(estimatedCloseAt);
  const projectEndAt = new Date(estimatedCloseAt);
  projectEndAt.setMonth(projectEndAt.getMonth() + 2);

  const deal = await prisma.deal.create({
    data: {
      publicId,
      name: dealName,
      value: estimatedValue,
      isRecurring: false,
      stage: stageRow.key,
      probability: probabilityFinal,
      ai: 50, // AI score inicial neutro
      source,
      tags,
      estimatedCloseAt,
      projectStartAt,
      projectEndAt,
      closedAt: isWonOrLost ? new Date() : null,
      sequenceId: validSeqId,
      strategic,
      workspaceId: ws.id,
      companyId: company.id,
      contactId: contact?.id ?? null,
      ownerId: me.id,
    },
    select: { id: true, publicId: true, name: true },
  });

  // Inscribe el lead en la secuencia elegida (motor agendado).
  if (validSeqId) {
    await prisma.sequenceEnrollment.create({
      data: {
        workspaceId: ws.id,
        sequenceId: validSeqId,
        dealId: deal.id,
        stepIndex: 0,
        status: "active",
        nextFireAt: new Date(),
        log: [] as never,
      },
    });
  }

  return Response.json({
    ok: true,
    dealId: deal.publicId,
    dealName: deal.name,
    company: company.name,
    message: `Lead ${deal.publicId} creado en ${company.name}`,
  });
}
