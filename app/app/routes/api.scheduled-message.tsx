import type { ActionFunctionArgs } from "react-router";
import { prisma } from "../lib/db.server";
import { requireUser } from "../lib/session.server";
import { isAdmin, forbidden } from "../lib/authz.server";

/**
 * POST /api/scheduled-message — CRUD + toggle + "enviar ahora" de programaciones.
 *
 * Guard: SOLO admin — las programaciones (briefs a Gerencia, mensajes a
 * clientes) son globales, no tienen workspace; cualquier cambio afecta a todos.
 *
 * FormData:
 *   op  "toggle" | "runNow" | "save" | "delete"
 *   id  (toggle/runNow/delete/save-edit)
 *   ...campos para save
 */
function intOr(v: FormDataEntryValue | null, def: number): number {
  const n = parseInt(String(v ?? ""), 10);
  return Number.isFinite(n) ? n : def;
}

export async function action({ request }: ActionFunctionArgs) {
  const me = await requireUser(request);
  if (!isAdmin(me)) {
    return forbidden("Solo administradores pueden gestionar programaciones.");
  }
  const fd = await request.formData();
  const op = String(fd.get("op") ?? "");
  const id = String(fd.get("id") ?? "");

  if (op === "toggle") {
    if (!id) return Response.json({ error: "missing id" }, { status: 400 });
    const enabled = String(fd.get("enabled") ?? "") === "true";
    await prisma.scheduledMessage.update({ where: { id }, data: { enabled } });
    return Response.json({ ok: true });
  }

  if (op === "runNow") {
    if (!id) return Response.json({ error: "missing id" }, { status: 400 });
    await prisma.scheduledMessage.update({ where: { id }, data: { runNow: true } });
    return Response.json({ ok: true, queued: true });
  }

  if (op === "delete") {
    if (!id) return Response.json({ error: "missing id" }, { status: 400 });
    await prisma.scheduledMessage.delete({ where: { id } });
    return Response.json({ ok: true });
  }

  if (op === "save") {
    const data = {
      name: String(fd.get("name") ?? "").trim() || "Programación",
      kind: String(fd.get("kind") ?? "custom"),
      channel: String(fd.get("channel") ?? "wa"),
      target: String(fd.get("target") ?? "").trim(),
      targetLabel: String(fd.get("targetLabel") ?? "").trim() || null,
      body: String(fd.get("body") ?? "").trim() || null,
      freq: String(fd.get("freq") ?? "weekly"),
      weekday: fd.get("weekday") != null && String(fd.get("weekday")) !== "" ? intOr(fd.get("weekday"), 1) : null,
      hour: intOr(fd.get("hour"), 8),
      minute: intOr(fd.get("minute"), 0),
      enabled: String(fd.get("enabled") ?? "true") === "true",
    };
    if (!data.target) return Response.json({ error: "Falta el destino" }, { status: 400 });
    if (id) await prisma.scheduledMessage.update({ where: { id }, data });
    else await prisma.scheduledMessage.create({ data });
    return Response.json({ ok: true });
  }

  return Response.json({ error: "op inválido" }, { status: 400 });
}
