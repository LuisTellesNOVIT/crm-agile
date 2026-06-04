import type { ActionFunctionArgs } from "react-router";
import { prisma } from "../lib/db.server";
import { requireUser } from "../lib/session.server";

/**
 * POST /api/sequence-update — guarda una secuencia (nodos + active + name) y,
 * opcionalmente, los cuerpos de plantillas editadas inline.
 *
 * FormData:
 *   id         (req) id de la secuencia
 *   nodes      JSON { category, description, trigger, steps:[...] }
 *   active     "true" | "false"
 *   name       string
 *   templates  JSON [{ name, body }]  (actualiza Template.body por nombre)
 */
export async function action({ request }: ActionFunctionArgs) {
  await requireUser(request);
  const fd = await request.formData();
  const id = String(fd.get("id") ?? "");
  if (!id) return Response.json({ error: "missing id" }, { status: 400 });

  const seq = await prisma.sequence.findUnique({ where: { id }, select: { id: true, workspaceId: true } });
  if (!seq) return Response.json({ error: "sequence not found" }, { status: 404 });

  const data: Record<string, unknown> = {};
  const nodesRaw = fd.get("nodes");
  if (nodesRaw != null && String(nodesRaw).trim()) {
    try {
      data.nodes = JSON.parse(String(nodesRaw));
    } catch {
      return Response.json({ error: "nodes JSON inválido" }, { status: 400 });
    }
  }
  const activeRaw = fd.get("active");
  if (activeRaw != null) data.active = String(activeRaw) === "true";
  const name = fd.get("name");
  if (name != null && String(name).trim()) data.name = String(name).trim();

  if (Object.keys(data).length) {
    await prisma.sequence.update({ where: { id }, data });
  }

  const tplRaw = fd.get("templates");
  if (tplRaw != null && String(tplRaw).trim()) {
    try {
      const edits = JSON.parse(String(tplRaw)) as { name: string; body: string }[];
      for (const e of edits) {
        if (!e?.name) continue;
        await prisma.template.updateMany({
          where: { workspaceId: seq.workspaceId, name: e.name },
          data: { body: e.body ?? "" },
        });
      }
    } catch {
      // ignora errores de plantillas; la secuencia ya se guardó
    }
  }

  return Response.json({ ok: true });
}
