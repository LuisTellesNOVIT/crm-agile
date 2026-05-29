import type { ActionFunctionArgs } from "react-router";
import { prisma } from "../lib/db.server";
import { requireUser } from "../lib/session.server";

/**
 * Resource route — POST /api/company-update
 *   Actualiza los datos (SUNAT incluidos) de una Company por id.
 *
 * Body (FormData) — campos opcionales, solo los provistos se actualizan:
 *   companyId          (REQUERIDO)
 *   name, ruc, industry, website, employees, tier
 *   razonSocial, nombreComercial, estado, condicion, tipoContribuyente
 *   domicilioFiscal, distrito, provincia, departamento, ubigeo
 *   representanteLegal, representanteDni, representanteCargo, telefono, email
 *
 * Validaciones:
 *   - ruc (si viene) = 11 dígitos
 *   - name no puede quedar vacío
 *   - name/ruc únicos por workspace (lo valida la DB; capturamos el error)
 */
const TEXT_FIELDS = [
  "name",
  "industry",
  "website",
  "employees",
  "tier",
  "razonSocial",
  "nombreComercial",
  "estado",
  "condicion",
  "tipoContribuyente",
  "domicilioFiscal",
  "distrito",
  "provincia",
  "departamento",
  "ubigeo",
  "representanteLegal",
  "representanteDni",
  "representanteCargo",
  "telefono",
  "email",
] as const;

export async function action({ request }: ActionFunctionArgs) {
  await requireUser(request);
  const fd = await request.formData();
  const companyId = String(fd.get("companyId") ?? "");
  if (!companyId) {
    return Response.json({ error: "Falta companyId" }, { status: 400 });
  }

  const existing = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true },
  });
  if (!existing) {
    return Response.json({ error: "Empresa no encontrada" }, { status: 404 });
  }

  const data: Record<string, unknown> = {};
  const errors: string[] = [];

  for (const k of TEXT_FIELDS) {
    const v = fd.get(k);
    if (v != null) {
      const s = String(v).trim();
      if (k === "name" && !s) {
        errors.push("La razón social / nombre no puede estar vacío");
      } else {
        data[k] = s || null;
      }
    }
  }

  // RUC
  const ruc = fd.get("ruc");
  if (ruc != null) {
    const s = String(ruc).trim();
    if (s && !/^\d{11}$/.test(s)) errors.push("RUC debe tener 11 dígitos");
    else data.ruc = s || null;
  }

  if (errors.length > 0) {
    return Response.json({ error: errors.join(" · ") }, { status: 400 });
  }

  try {
    const updated = await prisma.company.update({
      where: { id: companyId },
      data,
      select: { id: true, name: true },
    });
    return Response.json({ ok: true, companyId: updated.id, name: updated.name });
  } catch (e) {
    const msg = (e as Error).message ?? "";
    if (msg.includes("Unique constraint")) {
      return Response.json(
        { error: "Ya existe otra empresa con ese nombre o RUC en este grupo." },
        { status: 409 },
      );
    }
    return Response.json({ error: "No se pudo actualizar la empresa." }, { status: 500 });
  }
}
