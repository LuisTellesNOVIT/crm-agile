import type { ActionFunctionArgs } from "react-router";
import { prisma } from "../lib/db.server";
import { requireUser } from "../lib/session.server";

/**
 * Resource route — POST /api/contact-delete
 *   { ids: "id1,id2,…" }  → elimina uno o varios contactos del maestro.
 *
 * Antes de borrar, desvincula los tratos que apuntaban a esos contactos
 * (deal.contactId = null) para no romper la referencia. No borra empresas
 * ni tratos.
 *
 * Guard: requiere sesión.
 */
export async function action({ request }: ActionFunctionArgs) {
  await requireUser(request);
  const form = await request.formData();
  const ids = String(form.get("ids") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (ids.length === 0) {
    return Response.json({ error: "No se indicaron contactos a eliminar" }, { status: 400 });
  }

  // 1) Desvincular los tratos que usaban estos contactos.
  await prisma.deal.updateMany({
    where: { contactId: { in: ids } },
    data: { contactId: null },
  });

  // 2) Borrar los contactos.
  const res = await prisma.contact.deleteMany({ where: { id: { in: ids } } });

  return Response.json({ ok: true, deleted: res.count });
}
