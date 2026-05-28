import { useActiveWorkspace, useAppStore } from "../../lib/store";
import { STAGES } from "../../lib/stages";
import type { StageId } from "../../lib/types";

export function FiltersPopover({ onClose }: { onClose: () => void }) {
  const filters = useAppStore((s) => s.filters);
  const setFilters = useAppStore((s) => s.setFilters);
  const resetFilters = useAppStore((s) => s.resetFilters);
  const ws = useActiveWorkspace();

  const ownerKeys = Object.keys(ws.owners);

  const toggleStage = (id: StageId) => {
    const has = filters.stages.includes(id);
    setFilters({ stages: has ? filters.stages.filter((s) => s !== id) : [...filters.stages, id] });
  };
  const toggleOwner = (id: string) => {
    const has = filters.owners.includes(id);
    setFilters({ owners: has ? filters.owners.filter((s) => s !== id) : [...filters.owners, id] });
  };

  return (
    <div className="filters-popover">
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderBottom: "1px solid var(--border-2)" }}>
        <span style={{ fontWeight: 600, fontSize: "var(--fs-sm)" }}>Filtros</span>
        <button type="button" className="btn btn--ghost" onClick={() => { resetFilters(); }}>
          Limpiar
        </button>
      </header>
      <div style={{ padding: 14, display: "grid", gap: 14 }}>
        <Section label="Stage">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {STAGES.map((s) => {
              const active = filters.stages.includes(s.id);
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => toggleStage(s.id)}
                  className={`btn ${active ? "btn--accent" : ""}`.trim()}
                  style={{ borderColor: active ? s.color : undefined, background: active ? s.color : undefined, color: active ? "#fff" : undefined }}
                >
                  <span className="dot" style={{ background: s.color }} /> {s.label}
                </button>
              );
            })}
          </div>
        </Section>

        <Section label="Owner">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {ownerKeys.map((k) => {
              const active = filters.owners.includes(k);
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => toggleOwner(k)}
                  className={`btn ${active ? "btn--accent" : ""}`.trim()}
                >
                  <span className="mono">{k}</span>
                </button>
              );
            })}
          </div>
        </Section>

        <Section label="Valor (USD)">
          <div style={{ display: "flex", gap: 6 }}>
            <input
              type="number"
              placeholder="min"
              value={filters.minValue ?? ""}
              onChange={(e) =>
                setFilters({ minValue: e.target.value ? Number(e.target.value) : null })
              }
              style={inputStyle}
            />
            <input
              type="number"
              placeholder="max"
              value={filters.maxValue ?? ""}
              onChange={(e) =>
                setFilters({ maxValue: e.target.value ? Number(e.target.value) : null })
              }
              style={inputStyle}
            />
          </div>
        </Section>

        <Section label="AI Score">
          <div style={{ display: "flex", gap: 6 }}>
            <input
              type="number"
              min={0}
              max={100}
              placeholder="min"
              value={filters.minAI ?? ""}
              onChange={(e) =>
                setFilters({ minAI: e.target.value ? Number(e.target.value) : null })
              }
              style={inputStyle}
            />
            <input
              type="number"
              min={0}
              max={100}
              placeholder="max"
              value={filters.maxAI ?? ""}
              onChange={(e) =>
                setFilters({ maxAI: e.target.value ? Number(e.target.value) : null })
              }
              style={inputStyle}
            />
          </div>
        </Section>
      </div>
      <footer style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: "10px 14px", borderTop: "1px solid var(--border-2)" }}>
        <button type="button" className="btn" onClick={onClose}>Cerrar</button>
      </footer>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div
        style={{
          fontSize: 10,
          fontFamily: "var(--font-mono)",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: "var(--fg-4)",
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  flex: 1,
  padding: "6px 10px",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-sm)",
  fontSize: "var(--fs-sm)",
  fontFamily: "var(--font-mono)",
  background: "var(--bg)",
  color: "var(--fg)",
  width: 0,
};
