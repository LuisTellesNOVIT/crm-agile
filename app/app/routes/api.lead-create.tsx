import type { ActionFunctionArgs } from "react-router";
import { prisma } from "../lib/db.server";
import { requireUser } from "../lib/session.server";

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

  // ── Validaciones ────────────────────────────────────────
  const errors: string[] = [];
  if (!firstName) errors.push("Nombre requerido");
  if (!email) errors.push("Email requerido");
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push("Email inválido");
  if (!companyName) errors.push("Nombre de empresa requerido");
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

  // ── Company: por RUC si viene, sino por nombre ──────
  let company: { id: string; name: string } | null = null;

  if (ruc) {
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

  // ── Contact ──────────────────────────────────────────
  const contactName = `${firstName} ${lastName}`.trim();
  await prisma.contact.create({
    data: {
      name: contactName,
      email,
      phone: phone || null,
      companyId: company.id,
    },
  });

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
      estimatedCloseAt,
      closedAt: isWonOrLost ? new Date() : null,
      workspaceId: ws.id,
      companyId: company.id,
      ownerId: me.id,
    },
    select: { publicId: true, name: true },
  });

  return Response.json({
    ok: true,
    dealId: deal.publicId,
    dealName: deal.name,
    company: company.name,
    message: `Lead ${deal.publicId} creado en ${company.name}`,
  });
}
