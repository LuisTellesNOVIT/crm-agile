import type { ActionFunctionArgs } from "react-router";
import { prisma } from "../lib/db.server";
import { requireUser } from "../lib/session.server";
import { hasWorkspaceAccess, forbidden } from "../lib/authz.server";

/**
 * POST /api/sequence-enroll — inscribe (o quita) un trato en una secuencia.
 * Crea/borra una fila SequenceEnrollment en la misma DB que lee el motor local;
 * el envío real ocurre cuando el motor corre en la Mac.
 *
 * FormData:
 *   op          "enroll" | "unenroll"
 *   sequenceId  (req)
 *   dealId      (req)
 *   test        "true" | "false"  → si true, los envíos van a tu número (+51980203171)
 */
const TEST_NUMBER = "+51980203171";

export async function action({ request }: ActionFunctionArgs) {
  const me = await requireUser(request);
  const fd = await request.formData();
  const op = String(fd.get("op") ?? "enroll");
  const sequenceId = String(fd.get("sequenceId") ?? "");
  const dealId = String(fd.get("dealId") ?? "");
  if (!sequenceId || !dealId) return Response.json({ error: "missing ids" }, { status: 400 });

  const deal = await prisma.deal.findUnique({ where: { id: dealId }, select: { id: true, workspaceId: true } });
  if (!deal) return Response.json({ error: "deal not found" }, { status: 404 });
  if (!hasWorkspaceAccess(me, deal.workspaceId)) {
    return forbidden("Solo un admin puede gestionar secuencias de tratos de otro grupo.");
  }

  if (op === "unenroll") {
    await prisma.sequenceEnrollment.deleteMany({ where: { sequenceId, dealId } });
    return Response.json({ ok: true, op: "unenroll" });
  }

  const seq = await prisma.sequence.findUnique({ where: { id: sequenceId }, select: { workspaceId: true } });
  if (!seq) return Response.json({ error: "sequence not found" }, { status: 404 });
  // Integridad: la secuencia debe ser del MISMO grupo que el trato (evita
  // inscribir un deal de un grupo en una secuencia del otro y mensajear mal).
  if (seq.workspaceId !== deal.workspaceId) {
    return Response.json({ error: "La secuencia y el trato pertenecen a grupos distintos." }, { status: 400 });
  }

  const test = String(fd.get("test") ?? "") === "true";
  const data = {
    workspaceId: seq.workspaceId,
    sequenceId,
    dealId,
    stepIndex: 0,
    status: "active",
    nextFireAt: new Date(),
    testTarget: test ? TEST_NUMBER : null,
    log: [] as never,
  };
  await prisma.sequenceEnrollment.upsert({
    where: { sequenceId_dealId: { sequenceId, dealId } },
    create: data,
    update: data,
  });
  return Response.json({ ok: true, op: "enroll" });
}
