// Autorización por workspace (tenant isolation).
//
// Política del CRM: cualquier usuario logueado puede LEER ambos grupos
// (vista consolidada), pero solo puede ESCRIBIR/BORRAR recursos de su propio
// workspace; las operaciones cross-workspace requieren permissions === "admin".

export type SessionUser = {
  id: string;
  workspaceId: string;
  permissions: string | null;
};

export function isAdmin(me: SessionUser): boolean {
  return me.permissions === "admin";
}

/** ¿Puede `me` escribir sobre un recurso que pertenece a `resourceWorkspaceId`? */
export function hasWorkspaceAccess(me: SessionUser, resourceWorkspaceId: string): boolean {
  return isAdmin(me) || me.workspaceId === resourceWorkspaceId;
}

/** Respuesta 403 estándar para mutaciones fuera del workspace del usuario. */
export function forbidden(msg = "Sin permiso sobre recursos de otro grupo.") {
  return Response.json({ error: msg }, { status: 403 });
}
