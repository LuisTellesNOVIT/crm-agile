import { useState } from "react";
import {
  CURRENT_USER,
  WORKSPACE_META,
  useActiveWorkspace,
  useAppStore,
  useCurrentUser,
  type Currency,
  type Density,
  type Theme,
} from "../lib/store";
import { EXCHANGE_RATES } from "../lib/format";
import { Card } from "../components/ui/Card";
import { Chip } from "../components/ui/Chip";
import { Avatar } from "../components/ui/Avatar";
import { PipelineStageEditor } from "../components/pipeline/PipelineStageEditor";
import { Icon } from "../components/shell/Icon";

const SECTIONS = [
  { id: "appearance", label: "Apariencia" },
  { id: "currency", label: "Moneda + FX" },
  { id: "stages", label: "Etapas del Pipeline" },
  { id: "brand", label: "Marca" },
  { id: "users", label: "Usuarios + permisos" },
  { id: "workspace", label: "Workspace" },
];

export default function SettingsRoute() {
  const [section, setSection] = useState("appearance");

  return (
    <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", height: "100%", overflow: "hidden" }}>
      <aside style={{ borderRight: "1px solid var(--border)", padding: 14, background: "var(--bg-2)" }}>
        <h1 style={{ fontSize: "var(--fs-md)", fontWeight: 600, marginBottom: 12, letterSpacing: "-0.01em" }}>
          Configuración
        </h1>
        <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSection(s.id)}
              style={{
                textAlign: "left",
                padding: "6px 10px",
                borderRadius: "var(--radius-sm)",
                background: section === s.id ? "var(--bg)" : "transparent",
                border: section === s.id ? "1px solid var(--border)" : "1px solid transparent",
                fontSize: "var(--fs-sm)",
                color: section === s.id ? "var(--fg)" : "var(--fg-2)",
                cursor: "pointer",
              }}
            >
              {s.label}
            </button>
          ))}
        </nav>
      </aside>
      <main style={{ padding: "20px 28px", overflow: "auto" }}>
        {section === "appearance" && <Appearance />}
        {section === "currency" && <CurrencyFX />}
        {section === "stages" && <StagesSection />}
        {section === "brand" && <Brand />}
        {section === "users" && <Users />}
        {section === "workspace" && <WorkspaceInfo />}
      </main>
    </div>
  );
}

function Appearance() {
  const theme = useAppStore((s) => s.theme);
  const density = useAppStore((s) => s.density);
  const setTheme = useAppStore((s) => s.setTheme);
  const setDensity = useAppStore((s) => s.setDensity);

  return (
    <div style={{ display: "grid", gap: 14, maxWidth: 680 }}>
      <h2 style={{ fontSize: "var(--fs-lg)", fontWeight: 600 }}>Apariencia</h2>
      <Card>
        <Card.Header label="Tema" />
        <Card.Body>
          <div style={{ display: "flex", gap: 8 }}>
            {(["light", "dark"] as const).map((t) => (
              <button
                key={t}
                type="button"
                className={`btn ${theme === t ? "btn--accent" : ""}`.trim()}
                onClick={() => setTheme(t as Theme)}
              >
                {t === "light" ? "Claro" : "Oscuro"}
              </button>
            ))}
          </div>
          <p style={{ color: "var(--fg-3)", fontSize: "var(--fs-xs)", marginTop: 8 }}>
            (Modo oscuro pendiente de tokens — el toggle aplica clase pero los tokens dark llegan en una pasada futura)
          </p>
        </Card.Body>
      </Card>
      <Card>
        <Card.Header label="Densidad" />
        <Card.Body>
          <div style={{ display: "flex", gap: 8 }}>
            {(["compact", "cozy"] as const).map((d) => (
              <button
                key={d}
                type="button"
                className={`btn ${density === d ? "btn--accent" : ""}`.trim()}
                onClick={() => setDensity(d as Density)}
              >
                {d === "compact" ? "Compacta · 32px / 13px" : "Cómoda · 38px / 14px"}
              </button>
            ))}
          </div>
        </Card.Body>
      </Card>
    </div>
  );
}

function CurrencyFX() {
  const currency = useAppStore((s) => s.currency);
  const setCurrency = useAppStore((s) => s.setCurrency);

  return (
    <div style={{ display: "grid", gap: 14, maxWidth: 680 }}>
      <h2 style={{ fontSize: "var(--fs-lg)", fontWeight: 600 }}>Moneda + tipos de cambio</h2>
      <Card>
        <Card.Header label="Moneda activa" />
        <Card.Body>
          <div style={{ display: "flex", gap: 8 }}>
            {(["USD", "PEN"] as const).map((c) => (
              <button
                key={c}
                type="button"
                className={`btn ${currency === c ? "btn--accent" : ""}`.trim()}
                onClick={() => setCurrency(c as Currency)}
              >
                <span className="mono">{c}</span>
              </button>
            ))}
          </div>
        </Card.Body>
      </Card>
      <Card>
        <Card.Header label="Tipos de cambio · base USD" />
        <Card.Body style={{ padding: 0 }}>
          <table className="table">
            <thead>
              <tr>
                <th>Moneda</th>
                <th style={{ textAlign: "right" }}>Tasa</th>
                <th style={{ textAlign: "right" }}>1 USD =</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(EXCHANGE_RATES).map(([code, rate]) => (
                <tr key={code}>
                  <td><span className="mono">{code}</span></td>
                  <td className="mono" style={{ textAlign: "right" }}>{rate}</td>
                  <td className="mono" style={{ textAlign: "right", color: "var(--fg-3)" }}>{rate} {code}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{ color: "var(--fg-3)", fontSize: "var(--fs-xs)", padding: 10 }}>
            FX editable es pendiente — por ahora los valores son fijos en lib/format.ts.
          </p>
        </Card.Body>
      </Card>
    </div>
  );
}

function Brand() {
  return (
    <div style={{ display: "grid", gap: 14, maxWidth: 680 }}>
      <h2 style={{ fontSize: "var(--fs-lg)", fontWeight: 600 }}>Colores de marca por workspace</h2>
      {(["novit", "sharky"] as const).map((ws) => {
        const meta = WORKSPACE_META[ws];
        const color = ws === "novit" ? "#2563eb" : "#ea580c";
        return (
          <Card key={ws}>
            <Card.Header label={meta.url}>
              <span style={{ fontWeight: 600 }}>{meta.name}</span>
            </Card.Header>
            <Card.Body>
              <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                <div
                  style={{
                    width: 60,
                    height: 60,
                    borderRadius: "var(--radius)",
                    background: color,
                  }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "var(--fs-sm)", fontWeight: 500 }}>{meta.name}</div>
                  <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-3)" }}>
                    {meta.tagline}
                  </div>
                  <div className="mono" style={{ fontSize: "var(--fs-xs)", color: "var(--fg-2)", marginTop: 6 }}>
                    accent: {color}
                  </div>
                </div>
              </div>
            </Card.Body>
          </Card>
        );
      })}
    </div>
  );
}

function Users() {
  const workspace = useAppStore((s) => s.workspace);
  const meKey = workspace === "sharky" ? "sharky" : "novit";
  const me = CURRENT_USER[meKey];
  const PERMS = ["view", "edit", "delete", "share"] as const;
  const ROLES = ["Owner", "AE", "BDR"];

  return (
    <div style={{ display: "grid", gap: 14, maxWidth: 760 }}>
      <h2 style={{ fontSize: "var(--fs-lg)", fontWeight: 600 }}>Usuarios + permisos</h2>
      <Card>
        <Card.Header label="Equipo actual" />
        <Card.Body>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Avatar initials={me.initials} workspace={meKey} />
            <div>
              <div style={{ fontWeight: 500, fontSize: "var(--fs-sm)" }}>{me.name}</div>
              <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-3)" }}>{me.role}</div>
            </div>
            <Chip tone="success" dot>Activo</Chip>
          </div>
        </Card.Body>
      </Card>
      <Card>
        <Card.Header label="Matriz de permisos por rol" />
        <Card.Body style={{ padding: 0 }}>
          <table className="table">
            <thead>
              <tr>
                <th>Rol</th>
                {PERMS.map((p) => (
                  <th key={p} style={{ textAlign: "center" }}>{p}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROLES.map((role, ri) => (
                <tr key={role}>
                  <td>{role}</td>
                  {PERMS.map((p, pi) => {
                    const allowed = ri === 0 || (ri === 1 && pi < 3) || (ri === 2 && pi < 2);
                    return (
                      <td key={p} style={{ textAlign: "center" }}>
                        {allowed ? <Chip tone="success" dot>✓</Chip> : <span style={{ color: "var(--fg-4)" }}>—</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{ color: "var(--fg-3)", fontSize: "var(--fs-xs)", padding: 10 }}>
            Decorativo — la lógica real va en el backend (workspace_id scoping + middleware).
          </p>
        </Card.Body>
      </Card>
    </div>
  );
}

function WorkspaceInfo() {
  const workspace = useAppStore((s) => s.workspace);
  const meta = WORKSPACE_META[workspace];
  return (
    <div style={{ display: "grid", gap: 14, maxWidth: 680 }}>
      <h2 style={{ fontSize: "var(--fs-lg)", fontWeight: 600 }}>Workspace</h2>
      <Card>
        <Card.Header label="Datos">
          <span style={{ fontWeight: 600 }}>{meta.name}</span>
        </Card.Header>
        <Card.Body>
          <div style={{ display: "grid", gap: 4 }}>
            <div style={{ fontSize: "var(--fs-sm)" }}>{meta.tagline}</div>
            <div className="mono" style={{ fontSize: "var(--fs-xs)", color: "var(--fg-3)" }}>{meta.url}</div>
          </div>
        </Card.Body>
      </Card>
    </div>
  );
}

function StagesSection() {
  const ws = useActiveWorkspace();
  const workspace = useAppStore((s) => s.workspace);
  const currentUser = useCurrentUser();
  const [open, setOpen] = useState(false);
  const slug = workspace === "all" ? (currentUser?.workspaceSlug ?? "novit") : workspace;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <h2 style={{ fontSize: "var(--fs-lg)", fontWeight: 600 }}>Etapas del Pipeline</h2>
      <Card>
        <Card.Header label={`Etapas activas · ${slug.toUpperCase()}`}>
          <span style={{ marginLeft: "auto" }}>
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => setOpen(true)}
            >
              <Icon name="settings" size={12} /> Editar etapas
            </button>
          </span>
        </Card.Header>
        <Card.Body>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {ws.stages.map((s, i) => (
              <div
                key={s.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "8px 10px",
                  background: "var(--bg-2)",
                  border: "1px solid var(--border-2)",
                  borderRadius: "var(--radius-sm)",
                }}
              >
                <span className="mono" style={{ width: 22, fontSize: 11, color: "var(--fg-3)", textAlign: "center" }}>
                  {i + 1}
                </span>
                <span
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: "50%",
                    background: s.color,
                    flexShrink: 0,
                  }}
                />
                <span style={{ flex: 1, fontWeight: 500 }}>{s.label}</span>
                <span className="mono" style={{ fontSize: 11, color: "var(--fg-3)" }}>
                  key: {String(s.id)}
                </span>
                <span className="mono" style={{ fontSize: 11, fontWeight: 600 }}>
                  {Math.round(s.prob * 100)}%
                </span>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 12, color: "var(--fg-3)", marginTop: 14, lineHeight: 1.5 }}>
            Las etapas se persisten en la tabla <code style={{ background: "var(--bg-3)", padding: "1px 5px", borderRadius: 3 }}>PipelineStage</code> por workspace.
            Renombrá, agregá nuevas o reordená sin perder los deals existentes — el deal mantiene la referencia por <code style={{ background: "var(--bg-3)", padding: "1px 5px", borderRadius: 3 }}>key</code> estable.
            No se puede eliminar una etapa con deals asignados (debés mover los deals primero).
          </p>
        </Card.Body>
      </Card>

      {open && (
        <PipelineStageEditor
          workspaceSlug={slug}
          stages={ws.stages}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}
