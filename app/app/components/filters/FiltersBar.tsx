import { useAppStore } from "../../lib/store";
import { STAGES } from "../../lib/stages";
import { Icon } from "../shell/Icon";

export function FiltersBar({ totalDeals, filteredCount }: { totalDeals: number; filteredCount: number }) {
  const filters = useAppStore((s) => s.filters);
  const setFilters = useAppStore((s) => s.setFilters);
  const resetFilters = useAppStore((s) => s.resetFilters);

  const chips: { label: string; clear: () => void }[] = [];
  for (const id of filters.stages) {
    const st = STAGES.find((s) => s.id === id);
    chips.push({
      label: `stage: ${st?.label ?? id}`,
      clear: () => setFilters({ stages: filters.stages.filter((s) => s !== id) }),
    });
  }
  for (const o of filters.owners) {
    chips.push({
      label: `owner: ${o}`,
      clear: () => setFilters({ owners: filters.owners.filter((s) => s !== o) }),
    });
  }
  if (filters.minValue != null || filters.maxValue != null) {
    chips.push({
      label: `valor: ${filters.minValue ?? "0"} → ${filters.maxValue ?? "∞"}`,
      clear: () => setFilters({ minValue: null, maxValue: null }),
    });
  }
  if (filters.minAI != null || filters.maxAI != null) {
    chips.push({
      label: `AI: ${filters.minAI ?? "0"} → ${filters.maxAI ?? "100"}`,
      clear: () => setFilters({ minAI: null, maxAI: null }),
    });
  }

  if (chips.length === 0) return null;

  return (
    <div className="filters-bar">
      <span className="filters-bar__label">
        <Icon name="filter" size={11} /> Filtros activos
      </span>
      {chips.map((c, i) => (
        <span key={i} className="filters-bar__chip">
          <b>{c.label}</b>
          <button type="button" onClick={c.clear} aria-label="quitar">×</button>
        </span>
      ))}
      <span style={{ marginLeft: "auto", color: "var(--accent)", fontFamily: "var(--font-mono)", fontSize: 11 }}>
        {filteredCount} / {totalDeals} deals
      </span>
      <button type="button" className="btn btn--ghost" onClick={resetFilters}>
        Limpiar todo
      </button>
    </div>
  );
}
