import type { ActionFunctionArgs } from "react-router";
import { prisma } from "../lib/db.server";
import { requireUser } from "../lib/session.server";
import { hasWorkspaceAccess, forbidden } from "../lib/authz.server";

/**
 * Resource route — POST /api/contact-update
 *   Edita un contacto del maestro. Campos opcionales: solo los provistos se
 *   actualizan. Permite reasignar el contacto a otro cliente (companyId).
 *
 * FormData:
 *   id (REQUERIDO), name, role, email, phone, companyId
 *
 * Guard: sesión + el contacto (y el cliente destino) deben ser del workspace
 * del usuario (admin puede de cualquier grupo).
 */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function action({ request }: ActionFunctionArgs) {
  const me = await requireUser(request);
  const fd = await request.formData();
  const id = String(fd.get("id") ?? "").trim();
  if (!id) return Response.json({ error: "Falta el id del contacto" }, { status: 400 });

  const existing = await prisma.contact.findUnique({
    where: { id },
    select: { id: true, company: { select: { workspaceId: true } } },
  });
  if (!existing) return Response.json({ error: "Contacto no encontrado" }, { status: 404 });
  if (!hasWorkspaceAccess(me, existing.company.workspaceId)) {
    return forbidden("Solo un admin puede editar contactos de otro grupo.");
  }

  const data: Record<string, unknown> = {};
  const errors: string[] = [];

  const name = fd.get("name");
  if (name != null) {
    const v = String(name).trim();
    if (!v) errors.push("El nombre no puede estar vacío");
    else data.name = v;
  }

  const role = fd.get("role");
  if (role != null) data.role = String(role).trim() || null;

  const email = fd.get("email");
  if (email != null) {
    const v = String(email).trim();
    if (v && !EMAIL_RE.test(v)) errors.push("Email inválido");
    else data.email = v; // Contact.email es String (no-null); "" permitido
  }

  const phone = fd.get("phone");
  if (phone != null) data.phone = String(phone).trim() || null;

  // Reasignar cliente (company) — debe ser accesible para el usuario.
  const companyId = fd.get("companyId");
  if (companyId != null && String(companyId).trim()) {
    const cid = String(companyId).trim();
    const co = await prisma.company.findUnique({ where: { id: cid }, select: { workspaceId: true } });
    if (!co) errors.push("Cliente no encontrado");
    else if (!hasWorkspaceAccess(me, co.workspaceId)) errors.push("Sin permiso sobre el cliente destino");
    else data.companyId = cid;
  }

  if (errors.length) return Response.json({ error: errors.join(" · ") }, { status: 400 });
  if (Object.keys(data).length === 0) return Response.json({ ok: true, noop: true });

  const updated = await prisma.contact.update({ where: { id }, data, select: { id: true, name: true } });
  return Response.json({ ok: true, id: updated.id, name: updated.name });
}
