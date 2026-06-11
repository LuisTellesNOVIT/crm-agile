import type { ActionFunctionArgs } from "react-router";
import { prisma } from "../lib/db.server";
import { requireUser } from "../lib/session.server";
import { hasWorkspaceAccess, forbidden } from "../lib/authz.server";

/**
 * Resource route — POST /api/deal-delete
 *   { id: <publicId> }  → elimina el Deal (y en cascada sus Activity/File/
 *   Conversation/Message gracias a onDelete: Cascade en el schema).
 *
 * NO borra la Company ni los Contacts — pueden tener otros deals.
 *
 * Guard: sesión + el deal debe ser del workspace del usuario (admin puede
 * borrar de cualquier grupo).
 */
export async function action({ request }: ActionFunctionArgs) {
  const me = await requireUser(request);
  const form = await request.formData();
  const publicId = String(form.get("id") ?? "");

  if (!publicId) {
    return Response.json({ error: "Falta el id del trato" }, { status: 400 });
  }

  const existing = await prisma.deal.findUnique({
    where: { publicId },
    select: { id: true, name: true, workspaceId: true },
  });
  if (!existing) {
    return Response.json({ error: `Trato no encontrado: ${publicId}` }, { status: 404 });
  }
  if (!hasWorkspaceAccess(me, existing.workspaceId)) {
    return forbidden("Solo un admin puede eliminar tratos de otro grupo.");
  }

  // El cascade del schema borra Activity / File / Conversation / Message.
  await prisma.deal.delete({ where: { publicId } });

  return Response.json({ ok: true, id: publicId, name: existing.name });
}
