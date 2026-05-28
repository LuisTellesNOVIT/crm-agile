import { useState } from "react";
import { NavLink } from "react-router";
import { Icon, type IconName } from "./Icon";
import { CURRENT_USER, WORKSPACE_META, useAppStore, useCurrentUser } from "../../lib/store";
import { inbox } from "../../lib/mock/rich";
import type { ActiveWorkspaceId } from "../../lib/types";

type View = {
  id: string;
  path: string;
  label: string;
  icon: IconName;
  group: "main" | "auto" | "data";
};

const VIEWS: View[] = [
  { id: "dashboard", path: "/", label: "Dashboard", icon: "dashboard", group: "main" },
  { id: "inbox", path: "/inbox", label: "Inbox", icon: "inbox", group: "main" },
  { id: "pipeline", path: "/pipeline", label: "Pipeline", icon: "kanban", group: "main" },
  { id: "forecast", path: "/forecast", label: "Forecast (GANTT)", icon: "gantt", group: "main" },
  { id: "customers", path: "/customers", label: "Cliente 360", icon: "user", group: "main" },
  { id: "chat", path: "/chat", label: "Conversaciones", icon: "chat", group: "main" },
  { id: "templates", path: "/templates", label: "Templates", icon: "template", group: "auto" },
  { id: "sequences", path: "/sequences", label: "Secuencias", icon: "zap", group: "auto" },
  { id: "objects", path: "/objects", label: "Custom objects", icon: "database", group: "data" },
  { id: "schema", path: "/schema", label: "Schema (Prisma)", icon: "code", group: "data" },
  { id: "empresas", path: "/empresas", label: "Empresas (SUNAT)", icon: "users", group: "data" },
  { id: "users", path: "/users", label: "Usuarios", icon: "user", group: "data" },
];

function inboxUnread(workspace: ActiveWorkspaceId): number {
  if (workspace === "all") {
    return (
      inbox.novit.filter((i) => i.unread).length +
      inbox.sharky.filter((i) => i.unread).length
    );
  }
  return inbox[workspace].filter((i) => i.unread).length;
}

export function Sidebar() {
  const workspace = useAppStore((s) => s.workspace);
  const setWorkspace = useAppStore((s) => s.setWorkspace);
  const openCmdK = useAppStore((s) => s.openCmdK);
  const currentUser = useCurrentUser();
  const ws = WORKSPACE_META[workspace];
  // Sidebar footer = usuario logueado (no el workspace owner)
  const user = currentUser
    ? { initials: currentUser.initials, name: currentUser.name, role: currentUser.role }
    : CURRENT_USER[workspace];
  const inboxCount = inboxUnread(workspace);
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <div className="ws-switcher" onClick={() => setMenuOpen((o) => !o)}>
          <div className={`ws-mark ws-mark--${workspace}`}>{ws.mark}</div>
          <div className="ws-name">
            <b>{ws.name}</b>
            <span>{ws.url}</span>
          </div>
          <Icon name="chevron-down" size={14} className="ws-chevron" />
        </div>
        {menuOpen && (
          <div className="ws-menu" onMouseLeave={() => setMenuOpen(false)}>
            {(["novit", "sharky", "all"] as const).map((w) => {
              const meta = WORKSPACE_META[w];
              return (
                <div
                  key={w}
                  className="ws-menu__item"
                  onClick={() => {
                    setWorkspace(w);
                    setMenuOpen(false);
                  }}
                >
                  <div className={`ws-mark ws-mark--${w}`}>{meta.mark}</div>
                  <div className="ws-name">
                    <b>{meta.name}</b>
                    <span>{meta.tagline}</span>
                  </div>
                  {w === workspace && (
                    <Icon name="check" size={14} className="check" />
                  )}
                </div>
              );
            })}
            <div style={{ borderTop: "1px solid var(--border-2)", margin: "4px 0" }} />
            <div className="ws-menu__item" style={{ color: "var(--fg-3)" }}>
              <Icon name="plus" size={14} />
              <span>Nuevo workspace</span>
            </div>
          </div>
        )}
      </div>

      <div className="sidebar__search" onClick={openCmdK}>
        <Icon name="search" size={13} />
        <span>Buscar o ejecutar…</span>
        <span className="kbd">⌘</span>
        <span className="kbd">K</span>
      </div>

      <nav className="sidebar__nav">
        <div className="nav-group">
          {VIEWS.filter((v) => v.group === "main").map((v) => (
            <NavLinkItem
              key={v.id}
              v={v}
              badge={v.id === "inbox" ? inboxCount : undefined}
            />
          ))}
        </div>
        <div className="nav-group">
          <div className="nav-group__label">Automation</div>
          {VIEWS.filter((v) => v.group === "auto").map((v) => (
            <NavLinkItem key={v.id} v={v} />
          ))}
        </div>
        <div className="nav-group">
          <div className="nav-group__label">Data model</div>
          {VIEWS.filter((v) => v.group === "data").map((v) => (
            <NavLinkItem key={v.id} v={v} />
          ))}
        </div>
      </nav>

      <div className="sidebar__foot">
        <div
          className="avatar"
          style={
            currentUser
              ? { background: `linear-gradient(135deg, ${currentUser.color}aa, ${currentUser.color})` }
              : workspace === "sharky"
                ? { background: "linear-gradient(135deg,#fdba74,#ea580c)" }
                : undefined
          }
        >
          {user.initials}
        </div>
        <div className="meta">
          <b>{user.name}</b>
          <span>{user.role}</span>
        </div>
        <form method="POST" action="/logout" style={{ marginLeft: "auto", display: "inline-flex" }}>
          <button
            type="submit"
            title="Cerrar sesión"
            style={{
              background: "transparent",
              border: "none",
              color: "var(--fg-3)",
              cursor: "pointer",
              padding: 4,
              display: "inline-flex",
            }}
          >
            <Icon name="x" size={14} />
          </button>
        </form>
      </div>
    </aside>
  );
}

function NavLinkItem({ v, badge }: { v: View; badge?: number }) {
  return (
    <NavLink
      to={v.path}
      end={v.path === "/"}
      className={({ isActive }) =>
        `nav-item ${isActive ? "is-active" : ""}`.trim()
      }
    >
      <Icon name={v.icon} className="icon" size={16} />
      <span>{v.label}</span>
      {badge ? <span className="nav-item__badge">{badge}</span> : null}
    </NavLink>
  );
}
