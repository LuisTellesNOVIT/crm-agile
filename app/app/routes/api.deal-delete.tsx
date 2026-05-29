import type { ActionFunctionArgs } from "react-router";
import { prisma } from "../lib/db.server";
import { requireUser } from "../lib/session.server";

/**
 * Resource route — POST /api/deal-delete
 *   { id: <publicId> }  → elimina el Deal (y en cascada sus Activity/File/
 *   Conversation/Message gracias a onDelete: Cascade en el schema).
 *
 * NO borra la Company ni los Contacts — pueden tener otros deals.
 *
 * Guard: requiere sesión. Sólo borra deals del workspace del usuario
 * (o cualquiera si es admin — acá permitimos borrar cualquiera con sesión
 * válida; el deal se identifica por publicId único global).
 */
export async function action({ request }: ActionFunctionArgs) {
  await requireUser(request);
  const form = await request.formData();
  const publicId = String(form.get("id") ?? "");

  if (!publicId) {
    return Response.json({ error: "Falta el id del trato" }, { status: 400 });
  }

  const existing = await prisma.deal.findUnique({
    where: { publicId },
    select: { id: true, name: true },
  });
  if (!existing) {
    return Response.json({ error: `Trato no encontrado: ${publicId}` }, { status: 404 });
  }

  // El cascade del schema borra Activity / File / Conversation / Message.
  await prisma.deal.delete({ where: { publicId } });

  return Response.json({ ok: true, id: publicId, name: existing.name });
}
