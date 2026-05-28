/**
 * /users — Mantenimiento de usuarios del workspace.
 *
 * Permisos:
 * - Usuarios con permissions=admin: pueden ver listado, asignar roles (admin/user),
 *   resetear password (escribiendo una nueva), crear usuarios y eliminar usuarios.
 * - Usuarios sin permissions admin: ven mensaje "Sin permisos · contactá a un admin".
 *
 * Reset password: el admin ingresa una nueva contraseña en un input → bcrypt hash
 * y guardar. El usuario afectado usa esa password en el próximo login.
 *
 * Validaciones:
 * - No te podés eliminar a vos mismo.
 * - No podés sacar el rol admin a vos mismo (evitar lockout).
 * - El email debe ser único.
 * - Password debe tener ≥ 6 chars.
 */
import { useState } from "react";
import {
  Form,
  redirect,
  useActionData,
  useFetcher,
  useLoaderData,
  useNavigation,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "react-router";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/db.server";
import { requireUser } from "../lib/session.server";
import { Icon } from "../components/shell/Icon";

type LoaderData = {
  isAdmin: boolean;
  currentUserId: string;
  users: Array<{
    id: string;
    email: string;
    name: string;
    role: string;
    initials: string;
    color: string;
    permissions: string | null;
    workspaceSlug: string;
    workspaceName: string;
    createdAt: string;
    hasPassword: boolean;
  }>;
};

export async function loader({ request }: LoaderFunctionArgs): Promise<LoaderData> {
  const me = await requireUser(request);
  const isAdmin = me.permissions === "admin";

  // Admins ven todos los usuarios. Non-admins solo se ven a ellos.
  const where = isAdmin ? {} : { id: me.id };
  const users = await prisma.user.findMany({
    where,
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      initials: true,
      color: true,
      permissions: true,
      passwordHash: true,
      createdAt: true,
      workspace: { select: { slug: true, name: true } },
    },
    orderBy: [{ permissions: "desc" }, { createdAt: "asc" }],
  });

  return {
    isAdmin,
    currentUserId: me.id,
    users: users.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      initials: u.initials,
      color: u.color,
      permissions: u.permissions,
      workspaceSlug: u.workspace.slug,
      workspaceName: u.workspace.name,
      createdAt: u.createdAt.toISOString(),
      hasPassword: Boolean(u.passwordHash),
    })),
  };
}

type ActionResult = { ok?: boolean; error?: string; action?: string; userId?: string };

export async function action({ request }: ActionFunctionArgs): Promise<Response> {
  const me = await requireUser(request);
  const fd = await request.formData();
  const intent = String(fd.get("intent") ?? "");

  if (me.permissions !== "admin") {
    return Response.json({ error: "Solo administradores pueden hacer cambios." } satisfies ActionResult, { status: 403 });
  }

  // ── INTENT: update-role ──────────────────────────────────────
  if (intent === "update-role") {
    const userId = String(fd.get("userId") ?? "");
    const role = String(fd.get("role") ?? ""); // job title libre
    const permissions = String(fd.get("permissions") ?? ""); // "admin" | ""

    if (!userId) {
      return Response.json({ error: "Falta userId", action: intent } satisfies ActionResult, { status: 400 });
    }
    if (userId === me.id && permissions !== "admin") {
      return Response.json({ error: "No te podés sacar el rol de admin a vos mismo." } satisfies ActionResult, { status: 400 });
    }
    await prisma.user.update({
      where: { id: userId },
      data: {
        role: role || undefined,
        permissions: permissions === "admin" ? "admin" : null,
      },
    });
    return Response.json({ ok: true, action: intent, userId } satisfies ActionResult);
  }

  // ── INTENT: reset-password ───────────────────────────────────
  if (intent === "reset-password") {
    const userId = String(fd.get("userId") ?? "");
    const password = String(fd.get("password") ?? "");
    if (!userId) {
      return Response.json({ error: "Falta userId", action: intent } satisfies ActionResult, { status: 400 });
    }
    if (password.length < 6) {
      return Response.json({ error: "La contraseña debe tener al menos 6 caracteres.", action: intent } satisfies ActionResult, { status: 400 });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });
    return Response.json({ ok: true, action: intent, userId } satisfies ActionResult);
  }

  // ── INTENT: create-user ──────────────────────────────────────
  if (intent === "create") {
    const email = String(fd.get("email") ?? "").toLowerCase().trim();
    const name = String(fd.get("name") ?? "").trim();
    const role = String(fd.get("role") ?? "").trim() || "Member";
    const initials = String(fd.get("initials") ?? "").trim().toUpperCase() || name.split(" ").map((s) => s[0] ?? "").slice(0, 2).join("").toUpperCase();
    const color = String(fd.get("color") ?? "").trim() || "#6366f1";
    const workspaceSlug = String(fd.get("workspaceSlug") ?? "novit");
    const permissions = String(fd.get("permissions") ?? "") === "admin" ? "admin" : null;
    const password = String(fd.get("password") ?? "");

    if (!email || !name) {
      return Response.json({ error: "Email y nombre son obligatorios.", action: intent } satisfies ActionResult, { status: 400 });
    }
    if (password.length < 6) {
      return Response.json({ error: "Password ≥ 6 chars.", action: intent } satisfies ActionResult, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return Response.json({ error: "Ya existe un usuario con ese email.", action: intent } satisfies ActionResult, { status: 409 });
    }

    const ws = await prisma.workspace.findUnique({ where: { slug: workspaceSlug } });
    if (!ws) {
      return Response.json({ error: `Workspace no encontrado: ${workspaceSlug}`, action: intent } satisfies ActionResult, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await prisma.user.create({
      data: {
        email,
        name,
        role,
        initials: initials.slice(0, 3),
        color,
        permissions,
        passwordHash,
        workspaceId: ws.id,
      },
    });
    return Response.json({ ok: true, action: intent } satisfies ActionResult);
  }

  // ── INTENT: delete ───────────────────────────────────────────
  if (intent === "delete") {
    const userId = String(fd.get("userId") ?? "");
    if (!userId) {
      return Response.json({ error: "Falta userId", action: intent } satisfies ActionResult, { status: 400 });
    }
    if (userId === me.id) {
      return Response.json({ error: "No te podés eliminar a vos mismo." } satisfies ActionResult, { status: 400 });
    }
    // Prevenir borrar si tiene deals (FK constraint lo bloquearía igual)
    const dealsCount = await prisma.deal.count({ where: { ownerId: userId } });
    if (dealsCount > 0) {
      return Response.json({ error: `Este usuario tiene ${dealsCount} deals asignados. Reasigná los deals antes de eliminar.` } satisfies ActionResult, { status: 409 });
    }
    await prisma.user.delete({ where: { id: userId } });
    return Response.json({ ok: true, action: intent } satisfies ActionResult);
  }

  return Response.json({ error: `Intent no reconocido: ${intent}` } satisfies ActionResult, { status: 400 });
}

/* ============================================================
   UI
   ============================================================ */
export default function UsersRoute() {
  const { users, isAdmin, currentUserId } = useLoaderData<typeof loader>();
  const [createOpen, setCreateOpen] = useState(false);

  if (!isAdmin) {
    return (
      <div style={{ padding: 32, display: "flex", flexDirection: "column", gap: 12, maxWidth: 480, margin: "60px auto", textAlign: "center" }}>
        <div style={{ fontSize: 32 }}>🔒</div>
        <h1 style={{ fontSize: 20, fontWeight: 600 }}>Sin permisos</h1>
        <p style={{ color: "var(--fg-3)", fontSize: 14 }}>
          La gestión de usuarios está restringida a administradores. Contactá a un admin si necesitás
          permisos elevados.
        </p>
        <div className="users-card" style={{ marginTop: 16 }}>
          <div className="users-card__head">
            <UserAvatar
              initials={users[0]?.initials ?? "?"}
              color={users[0]?.color ?? "#94a3b8"}
            />
            <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
              <div className="users-card__name">{users[0]?.name}</div>
              <div className="users-card__role">{users[0]?.role}</div>
            </div>
            <span className="users-card__email mono">{users[0]?.email}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="users-page">
      <header className="users-page__head">
        <div>
          <h1 className="users-page__title">Mantenimiento de usuarios</h1>
          <p className="users-page__sub">
            {users.length} {users.length === 1 ? "usuario" : "usuarios"} ·{" "}
            {users.filter((u) => u.permissions === "admin").length} {users.filter((u) => u.permissions === "admin").length === 1 ? "admin" : "admins"}
          </p>
        </div>
        <button
          type="button"
          className="btn btn--primary"
          onClick={() => setCreateOpen(true)}
        >
          <Icon name="plus" size={13} /> Nuevo usuario
        </button>
      </header>

      <div className="users-grid">
        {users.map((u) => (
          <UserCard key={u.id} user={u} isMe={u.id === currentUserId} />
        ))}
      </div>

      {createOpen && <CreateUserModal onClose={() => setCreateOpen(false)} />}
    </div>
  );
}

/* ============================================================
   UserCard
   ============================================================ */
function UserCard({ user, isMe }: { user: LoaderData["users"][0]; isMe: boolean }) {
  const [editing, setEditing] = useState<"none" | "role" | "password">("none");
  const fetcher = useFetcher<ActionResult>();
  const saving = fetcher.state !== "idle";

  // Reset edit mode al recibir éxito
  if (fetcher.data?.ok && fetcher.state === "idle" && editing !== "none") {
    setTimeout(() => setEditing("none"), 100);
  }

  const isAdmin = user.permissions === "admin";

  return (
    <div className={`users-card ${isMe ? "is-me" : ""}`.trim()}>
      <div className="users-card__head">
        <UserAvatar initials={user.initials} color={user.color} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="users-card__name">
            {user.name}
            {isMe && <span className="users-card__me-tag">vos</span>}
          </div>
          <div className="users-card__role">{user.role}</div>
        </div>
        <div className="users-card__badges">
          <span className={`users-badge users-badge--${isAdmin ? "admin" : "user"}`}>
            {isAdmin ? "ADMIN" : "USER"}
          </span>
          {!user.hasPassword && (
            <span className="users-badge users-badge--nopass" title="No tiene password seteada">
              ⚠ Sin password
            </span>
          )}
        </div>
      </div>

      <div className="users-card__meta">
        <span><Icon name="mail" size={11} /> {user.email}</span>
        <span><Icon name="users" size={11} /> {user.workspaceName}</span>
        <span><Icon name="clock" size={11} /> Creado {new Date(user.createdAt).toLocaleDateString("es-PE")}</span>
      </div>

      {/* ── Edit role inline ── */}
      {editing === "role" ? (
        <fetcher.Form method="POST" className="users-card__form">
          <input type="hidden" name="intent" value="update-role" />
          <input type="hidden" name="userId" value={user.id} />
          <label className="users-card__field">
            <span>Job title</span>
            <input
              type="text"
              name="role"
              defaultValue={user.role}
              required
              placeholder="Account Executive, Admin, etc."
            />
          </label>
          <label className="users-card__field">
            <span>Permisos</span>
            <select name="permissions" defaultValue={user.permissions ?? ""} disabled={isMe}>
              <option value="">user (operacional)</option>
              <option value="admin">admin (todos los permisos)</option>
            </select>
          </label>
          {isMe && (
            <div className="users-card__hint">
              No podés cambiar tu propio nivel de permisos (anti-lockout).
            </div>
          )}
          {fetcher.data?.error && fetcher.data?.action === "update-role" && (
            <div className="users-card__error">{fetcher.data.error}</div>
          )}
          <div className="users-card__actions">
            <button type="button" className="btn" onClick={() => setEditing("none")} disabled={saving}>Cancelar</button>
            <button type="submit" className="btn btn--primary" disabled={saving}>
              {saving ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </fetcher.Form>
      ) : editing === "password" ? (
        <fetcher.Form method="POST" className="users-card__form">
          <input type="hidden" name="intent" value="reset-password" />
          <input type="hidden" name="userId" value={user.id} />
          <label className="users-card__field">
            <span>Nueva password</span>
            <input
              type="password"
              name="password"
              minLength={6}
              required
              autoFocus
              placeholder="Mínimo 6 caracteres"
            />
          </label>
          <div className="users-card__hint">
            Pasale esta password a <b>{user.name}</b> por canal seguro (WhatsApp, 1Password, etc.).
            Después la podrá cambiar desde su cuenta.
          </div>
          {fetcher.data?.error && fetcher.data?.action === "reset-password" && (
            <div className="users-card__error">{fetcher.data.error}</div>
          )}
          {fetcher.data?.ok && fetcher.data?.action === "reset-password" && fetcher.data.userId === user.id && (
            <div className="users-card__success">
              ✓ Password actualizada. Que la use en el próximo login.
            </div>
          )}
          <div className="users-card__actions">
            <button type="button" className="btn" onClick={() => setEditing("none")} disabled={saving}>Cerrar</button>
            <button type="submit" className="btn btn--primary" disabled={saving}>
              {saving ? "Guardando…" : "Actualizar password"}
            </button>
          </div>
        </fetcher.Form>
      ) : (
        <div className="users-card__actions">
          <button
            type="button"
            className="btn"
            onClick={() => setEditing("role")}
          >
            <Icon name="settings" size={12} /> Editar rol
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => setEditing("password")}
          >
            <Icon name="settings" size={12} /> Reset password
          </button>
          {!isMe && (
            <fetcher.Form method="POST" style={{ marginLeft: "auto" }} onSubmit={(e) => {
              if (!confirm(`¿Eliminar a ${user.name}? Esta acción no se puede deshacer.`)) e.preventDefault();
            }}>
              <input type="hidden" name="intent" value="delete" />
              <input type="hidden" name="userId" value={user.id} />
              <button type="submit" className="btn users-card__delete" disabled={saving}>
                <Icon name="x" size={12} /> Eliminar
              </button>
            </fetcher.Form>
          )}
        </div>
      )}

      {fetcher.data?.error && editing === "none" && fetcher.data?.action === "delete" && (
        <div className="users-card__error">{fetcher.data.error}</div>
      )}
    </div>
  );
}

/* ============================================================
   CreateUserModal
   ============================================================ */
function CreateUserModal({ onClose }: { onClose: () => void }) {
  const fetcher = useFetcher<ActionResult>();
  const saving = fetcher.state !== "idle";
  const [color, setColor] = useState("#6366f1");

  // Cerrar al recibir éxito
  if (fetcher.data?.ok && fetcher.data?.action === "create" && fetcher.state === "idle") {
    setTimeout(onClose, 100);
  }

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <div className="users-modal" onClick={(e) => e.stopPropagation()}>
        <header className="users-modal__head">
          <h2>Nuevo usuario</h2>
          <button type="button" className="btn btn--icon" onClick={onClose}>
            <Icon name="x" size={14} />
          </button>
        </header>
        <fetcher.Form method="POST" className="users-modal__body">
          <input type="hidden" name="intent" value="create" />

          <div className="users-modal__row">
            <label className="users-card__field" style={{ flex: 2 }}>
              <span>Nombre completo *</span>
              <input type="text" name="name" required autoFocus placeholder="María Paz Iribarren" />
            </label>
            <label className="users-card__field" style={{ flex: 1 }}>
              <span>Iniciales</span>
              <input type="text" name="initials" maxLength={3} placeholder="MP" />
            </label>
          </div>

          <label className="users-card__field">
            <span>Email *</span>
            <input type="email" name="email" required placeholder="maria.paz@novit.pe" />
          </label>

          <div className="users-modal__row">
            <label className="users-card__field" style={{ flex: 2 }}>
              <span>Job title</span>
              <input type="text" name="role" defaultValue="Member" placeholder="Account Executive" />
            </label>
            <label className="users-card__field" style={{ flex: 1 }}>
              <span>Workspace</span>
              <select name="workspaceSlug" defaultValue="novit">
                <option value="novit">NOVIT</option>
                <option value="sharky">SHARKY</option>
              </select>
            </label>
          </div>

          <div className="users-modal__row">
            <label className="users-card__field" style={{ flex: 1 }}>
              <span>Permisos</span>
              <select name="permissions" defaultValue="">
                <option value="">user (operacional)</option>
                <option value="admin">admin (todos los permisos)</option>
              </select>
            </label>
            <label className="users-card__field" style={{ flex: 1 }}>
              <span>Color de avatar</span>
              <input
                type="color"
                name="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                style={{ height: 36, padding: 2, cursor: "pointer" }}
              />
            </label>
          </div>

          <label className="users-card__field">
            <span>Password inicial *</span>
            <input
              type="password"
              name="password"
              minLength={6}
              required
              placeholder="Mínimo 6 caracteres"
            />
            <small style={{ fontSize: 11, color: "var(--fg-3)", marginTop: 2 }}>
              El usuario podrá cambiarla después de iniciar sesión.
            </small>
          </label>

          {fetcher.data?.error && (
            <div className="users-card__error">{fetcher.data.error}</div>
          )}

          <div className="users-modal__foot">
            <button type="button" className="btn" onClick={onClose} disabled={saving}>
              Cancelar
            </button>
            <button type="submit" className="btn btn--primary" disabled={saving}>
              {saving ? "Creando…" : "Crear usuario"}
            </button>
          </div>
        </fetcher.Form>
      </div>
    </div>
  );
}

/* ============================================================
   UserAvatar (helper)
   ============================================================ */
function UserAvatar({ initials, color }: { initials: string; color: string }) {
  return (
    <span
      className="users-avatar"
      style={{ background: `linear-gradient(135deg, ${color}cc, ${color})` }}
    >
      {initials}
    </span>
  );
}
