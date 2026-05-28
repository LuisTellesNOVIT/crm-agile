import { useLocation } from "react-router";
import { Icon } from "./Icon";
import {
  WORKSPACE_META,
  countActiveFilters,
  useAppStore,
} from "../../lib/store";

const PATH_LABELS: Record<string, string> = {
  "/": "Dashboard",
  "/inbox": "Inbox",
  "/pipeline": "Pipeline",
  "/forecast": "Forecast (GANTT)",
  "/customers": "Cliente 360",
  "/chat": "Conversaciones",
  "/templates": "Templates",
  "/sequences": "Secuencias",
  "/objects": "Custom objects",
  "/schema": "Schema (Prisma)",
  "/settings": "Configuración",
  "/empresas": "Empresas (SUNAT)",
  "/atoms": "Atomic components",
};

export function Topbar() {
  const workspace = useAppStore((s) => s.workspace);
  const currency = useAppStore((s) => s.currency);
  const setCurrency = useAppStore((s) => s.setCurrency);
  const openCmdK = useAppStore((s) => s.openCmdK);
  const openAI = useAppStore((s) => s.openAI);
  const openNewLead = useAppStore((s) => s.openNewLead);
  const filtersOpen = useAppStore((s) => s.ui.filtersOpen);
  const setFiltersOpen = useAppStore((s) => s.setFiltersOpen);
  const filters = useAppStore((s) => s.filters);
  const wsName = WORKSPACE_META[workspace].name;
  const { pathname } = useLocation();
  const viewLabel = PATH_LABELS[pathname] ?? "Vista";
  const filtersCount = countActiveFilters(filters);

  return (
    <header className="topbar">
      <div className="topbar__crumbs">
        <span>{wsName}</span>
        <Icon name="chevron-right" size={12} />
        <span style={{ color: "var(--fg)" }}>{viewLabel}</span>
      </div>
      <div className="topbar__spacer" />
      <div className="ccy-toggle" title="Moneda activa">
        {(["USD", "PEN"] as const).map((c) => (
          <button
            type="button"
            key={c}
            className={`ccy-toggle__btn ${currency === c ? "is-active" : ""}`.trim()}
            onClick={() => setCurrency(c)}
          >
            {c}
          </button>
        ))}
      </div>
      <button type="button" className="btn btn--ghost" onClick={openCmdK} title="Cmd+K">
        <Icon name="command" size={14} /> <span className="kbd">K</span>
      </button>
      <button
        type="button"
        className={`btn ${filtersCount > 0 ? "btn--filtered" : ""}`.trim()}
        onClick={() => setFiltersOpen(!filtersOpen)}
      >
        <Icon name="filter" size={13} /> Filtros
        {filtersCount > 0 && <span className="btn__badge mono">{filtersCount}</span>}
      </button>
      <button
        type="button"
        className="topbar__ai"
        onClick={() => openAI()}
        title="Pedir informe IA"
      >
        <Icon name="sparkles" size={13} /> Pedir a la IA
      </button>
      <button type="button" className="btn btn--primary" onClick={openNewLead}>
        <Icon name="plus" size={13} /> Nuevo lead
      </button>
      <button type="button" className="btn btn--icon" title="Configuración">
        <Icon name="settings" size={14} />
      </button>
    </header>
  );
}
