import type { ActionFunctionArgs } from "react-router";
import { prisma } from "../lib/db.server";
import { requireUser } from "../lib/session.server";
import { isAdmin, forbidden } from "../lib/authz.server";

/**
 * Resource route — POST /api/contact-delete
 *   { ids: "id1,id2,…" }  → elimina uno o varios contactos del maestro.
 *
 * Antes de borrar, desvincula los tratos que apuntaban a esos contactos
 * (deal.contactId = null) para no romper la referencia. No borra empresas
 * ni tratos.
 *
 * Guard: sesión + los contactos deben pertenecer a empresas del workspace
 * del usuario (admin puede borrar de cualquier grupo). Los ids fuera de
 * alcance se ignoran y se reportan en `skipped`.
 */
export async function action({ request }: ActionFunctionArgs) {
  const me = await requireUser(request);
  const form = await request.formData();
  const ids = String(form.get("ids") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (ids.length === 0) {
    return Response.json({ error: "No se indicaron contactos a eliminar" }, { status: 400 });
  }

  // Solo los contactos accesibles para este usuario (el contacto hereda el
  // workspace de su empresa).
  const accessible = await prisma.contact.findMany({
    where: isAdmin(me)
      ? { id: { in: ids } }
      : { id: { in: ids }, company: { workspaceId: me.workspaceId } },
    select: { id: true },
  });
  const okIds = accessible.map((c) => c.id);
  if (okIds.length === 0) {
    return forbidden("Sin permiso sobre los contactos indicados.");
  }

  // 1) Desvincular los tratos que usaban estos contactos.
  await prisma.deal.updateMany({
    where: { contactId: { in: okIds } },
    data: { contactId: null },
  });

  // 2) Borrar los contactos.
  const res = await prisma.contact.deleteMany({ where: { id: { in: okIds } } });

  return Response.json({ ok: true, deleted: res.count, skipped: ids.length - okIds.length });
}
