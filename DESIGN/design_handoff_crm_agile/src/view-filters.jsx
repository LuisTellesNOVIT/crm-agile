// Global filters — popover + active-chips bar + applyFilters helper.
// Lives at App level. Filtered deals flow into Pipeline, Forecast, Dashboard.

const FILTER_DEFAULTS = {
  owners: [],
  stages: [],
  client: "",
  closeRange: "all",   // all | 7d | 30d | 90d | overdue | quarter
  minValue: 0,
  minAI: 0,
  recurring: "all"     // all | saas | one-time
};

function applyFilters(deals, filters, ws) {
  if (!filters) return deals;
  return deals.filter(d => {
    if (filters.owners.length && !filters.owners.includes(d.owner)) return false;
    if (filters.stages.length && !filters.stages.includes(d.stage)) return false;
    if (filters.client) {
      const q = filters.client.toLowerCase();
      const hay = `${d.company} ${d.name}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (filters.minValue && d.value < filters.minValue) return false;
    if (filters.minAI && d.ai < filters.minAI) return false;
    if (filters.recurring === "saas" && !d.isRecurring) return false;
    if (filters.recurring === "one-time" && d.isRecurring) return false;
    if (filters.closeRange !== "all") {
      const eta = new Date(d.estimatedCloseAt);
      const today = ws?.today || new Date();
      const diffDays = (eta - today) / 86400000;
      if (filters.closeRange === "7d" && (diffDays < 0 || diffDays > 7)) return false;
      if (filters.closeRange === "30d" && (diffDays < 0 || diffDays > 30)) return false;
      if (filters.closeRange === "90d" && (diffDays < 0 || diffDays > 90)) return false;
      if (filters.closeRange === "quarter" && (diffDays < 0 || diffDays > 92)) return false;
      if (filters.closeRange === "overdue" && diffDays >= 0) return false;
    }
    return true;
  });
}

function countActiveFilters(filters) {
  if (!filters) return 0;
  let n = 0;
  if (filters.owners.length) n++;
  if (filters.stages.length) n++;
  if (filters.client) n++;
  if (filters.closeRange !== "all") n++;
  if (filters.minValue) n++;
  if (filters.minAI) n++;
  if (filters.recurring !== "all") n++;
  return n;
}

const CLOSE_RANGE_LABELS = {
  "all": "Cualquier fecha",
  "7d": "Cierra ≤ 7 días",
  "30d": "Cierra ≤ 30 días",
  "90d": "Cierra ≤ 90 días",
  "quarter": "Este trimestre",
  "overdue": "Vencidos"
};

const RECURRING_LABELS = {
  "all": "Todos",
  "saas": "Solo SaaS",
  "one-time": "Solo one-time"
};

/* ---------- Popover ---------- */
function FiltersPopover({ filters, setFilters, ws, workspace, onClose }) {
  const ownerKeys = Object.keys(ws.owners);
  const stages = window.CRM_DATA.stages;
  const popRef = useRef(null);

  useEffect(() => {
    const onDoc = (e) => {
      if (popRef.current && !popRef.current.contains(e.target)) {
        // Skip when clicking the trigger itself (button has data-filter-trigger)
        if (e.target.closest("[data-filter-trigger]")) return;
        onClose();
      }
    };
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    const t = setTimeout(() => document.addEventListener("mousedown", onDoc), 0);
    document.addEventListener("keydown", onKey);
    return () => { clearTimeout(t); document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [onClose]);

  const toggle = (key, value) => {
    setFilters(f => {
      const arr = f[key];
      return { ...f, [key]: arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value] };
    });
  };

  const set = (patch) => setFilters(f => ({ ...f, ...patch }));
  const clearAll = () => setFilters(FILTER_DEFAULTS);
  const active = countActiveFilters(filters);

  // Quick presets
  const me = workspace === "novit" ? "MP" : "AV";
  const applyPreset = (name) => {
    if (name === "mine")   set({ owners: [me] });
    if (name === "hot")    set({ minAI: 70, stages: stages.filter(s => s.id !== "won" && s.id !== "lost").map(s => s.id) });
    if (name === "week")   set({ closeRange: "7d" });
    if (name === "month")  set({ closeRange: "30d" });
    if (name === "high")   set({ minValue: 200000 });
    if (name === "saas")   set({ recurring: "saas" });
    if (name === "overdue") set({ closeRange: "overdue" });
    if (name === "active") set({ stages: stages.filter(s => s.id !== "won" && s.id !== "lost").map(s => s.id) });
  };

  return (
    <div className="filters-pop" ref={popRef} onClick={(e) => e.stopPropagation()}>
      <div className="filters-pop__h">
        <Icon name="filter" size={13} />
        <span className="filters-pop__title">Filtrar tratos</span>
        {active > 0 && <span className="filters-pop__active mono">{active} {active === 1 ? "filtro" : "filtros"}</span>}
        <button className="filters-pop__close" onClick={onClose} title="Cerrar (Esc)"><Icon name="x" size={12} /></button>
      </div>

      {/* Quick presets */}
      <div className="filters-section">
        <div className="filters-label">Presets rápidos</div>
        <div className="filters-presets">
          <button className="filters-preset" onClick={() => applyPreset("mine")}>👤 Mis tratos</button>
          <button className="filters-preset" onClick={() => applyPreset("hot")}>🔥 Calientes (AI ≥70)</button>
          <button className="filters-preset" onClick={() => applyPreset("week")}>📅 Cierran esta semana</button>
          <button className="filters-preset" onClick={() => applyPreset("month")}>📆 Cierran este mes</button>
          <button className="filters-preset" onClick={() => applyPreset("high")}>💰 Alto valor ≥$200k</button>
          <button className="filters-preset" onClick={() => applyPreset("saas")}>♻ Solo SaaS</button>
          <button className="filters-preset" onClick={() => applyPreset("overdue")}>⚠ Vencidos</button>
          <button className="filters-preset" onClick={() => applyPreset("active")}>● Solo abiertos</button>
        </div>
      </div>

      {/* Client search */}
      <div className="filters-section">
        <div className="filters-label">Cliente o trato</div>
        <div className="filters-search">
          <Icon name="search" size={12} />
          <input
            placeholder="Buscar por nombre de trato o empresa…"
            value={filters.client}
            onChange={(e) => set({ client: e.target.value })}
            autoFocus
          />
          {filters.client && (
            <button onClick={() => set({ client: "" })} className="filters-search__clear" title="Limpiar">
              <Icon name="x" size={11} />
            </button>
          )}
        </div>
      </div>

      {/* Ejecutivo */}
      <div className="filters-section">
        <div className="filters-label">Ejecutivo</div>
        <div className="filters-chips">
          {ownerKeys.map(k => {
            const o = ws.owners[k];
            const sel = filters.owners.includes(k);
            return (
              <button
                key={k}
                className={`filters-chip filters-chip--owner ${sel ? "is-selected" : ""}`}
                onClick={() => toggle("owners", k)}
                style={sel ? { borderColor: o.color, background: `${o.color}14`, color: o.color } : null}
              >
                <span className="avatar avatar--xs" style={{ background: `linear-gradient(135deg, ${o.color}aa, ${o.color})`, width: 18, height: 18, fontSize: 8 }}>{k}</span>
                {o.name.split(" ")[0]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Etapa */}
      <div className="filters-section">
        <div className="filters-label">Etapa</div>
        <div className="filters-chips">
          {stages.map(s => {
            const sel = filters.stages.includes(s.id);
            return (
              <button
                key={s.id}
                className={`filters-chip ${sel ? "is-selected" : ""}`}
                onClick={() => toggle("stages", s.id)}
                style={sel ? { borderColor: s.color, background: `${s.color}18`, color: s.color } : null}
              >
                <span className="dot" style={{ background: s.color, width: 7, height: 7, borderRadius: 50 }} />
                {s.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Fecha de cierre */}
      <div className="filters-section">
        <div className="filters-label">Fecha estimada de cierre</div>
        <div className="filters-chips">
          {Object.entries(CLOSE_RANGE_LABELS).map(([k, label]) => (
            <button
              key={k}
              className={`filters-chip ${filters.closeRange === k ? "is-selected" : ""}`}
              onClick={() => set({ closeRange: k })}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Valor + AI sliders */}
      <div className="filters-section">
        <div className="filters-label">
          Valor mínimo
          <span className="mono filters-label__v">{filters.minValue ? `$${(filters.minValue / 1000).toFixed(0)}k` : "—"}</span>
        </div>
        <input
          type="range" min="0" max="1000000" step="10000"
          value={filters.minValue}
          onChange={(e) => set({ minValue: Number(e.target.value) })}
          className="filters-range"
        />
      </div>

      <div className="filters-section">
        <div className="filters-label">
          AI score mínimo
          <span className="mono filters-label__v">{filters.minAI ? `${filters.minAI}%` : "—"}</span>
        </div>
        <input
          type="range" min="0" max="100" step="5"
          value={filters.minAI}
          onChange={(e) => set({ minAI: Number(e.target.value) })}
          className="filters-range"
        />
      </div>

      {/* Tipo de trato */}
      <div className="filters-section">
        <div className="filters-label">Tipo de trato</div>
        <div className="filters-chips">
          {Object.entries(RECURRING_LABELS).map(([k, label]) => (
            <button
              key={k}
              className={`filters-chip ${filters.recurring === k ? "is-selected" : ""}`}
              onClick={() => set({ recurring: k })}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="filters-pop__foot">
        <button className="btn btn--ghost" onClick={clearAll} disabled={active === 0}>
          Limpiar todo
        </button>
        <button className="btn btn--primary" onClick={onClose}>
          Listo
        </button>
      </div>
    </div>
  );
}

/* ---------- Active filters chip bar (below topbar) ---------- */
function FiltersBar({ filters, setFilters, ws, totalDeals, filteredCount }) {
  const active = countActiveFilters(filters);
  if (active === 0) return null;

  const set = (patch) => setFilters(f => ({ ...f, ...patch }));
  const removeOwner = (k) => set({ owners: filters.owners.filter(o => o !== k) });
  const removeStage = (k) => set({ stages: filters.stages.filter(s => s !== k) });
  const stages = window.CRM_DATA.stages;

  return (
    <div className="filters-bar">
      <span className="filters-bar__label mono">
        <Icon name="filter" size={11} />
        FILTRANDO · {filteredCount} de {totalDeals} tratos
      </span>

      {filters.client && (
        <span className="filters-bar__chip">
          Cliente: <b>{filters.client}</b>
          <button onClick={() => set({ client: "" })}><Icon name="x" size={10} /></button>
        </span>
      )}
      {filters.owners.map(k => {
        const o = ws.owners[k];
        if (!o) return null;
        return (
          <span key={k} className="filters-bar__chip" style={{ borderColor: `${o.color}66`, background: `${o.color}10` }}>
            <span className="avatar avatar--xs" style={{ background: `linear-gradient(135deg, ${o.color}aa, ${o.color})`, width: 14, height: 14, fontSize: 7 }}>{k}</span>
            {o.name.split(" ")[0]}
            <button onClick={() => removeOwner(k)}><Icon name="x" size={10} /></button>
          </span>
        );
      })}
      {filters.stages.map(sId => {
        const s = stages.find(x => x.id === sId);
        if (!s) return null;
        return (
          <span key={sId} className="filters-bar__chip" style={{ borderColor: `${s.color}66` }}>
            <span className="dot" style={{ background: s.color, width: 6, height: 6, borderRadius: 50 }} />
            {s.label}
            <button onClick={() => removeStage(sId)}><Icon name="x" size={10} /></button>
          </span>
        );
      })}
      {filters.closeRange !== "all" && (
        <span className="filters-bar__chip">
          {CLOSE_RANGE_LABELS[filters.closeRange]}
          <button onClick={() => set({ closeRange: "all" })}><Icon name="x" size={10} /></button>
        </span>
      )}
      {filters.minValue > 0 && (
        <span className="filters-bar__chip">
          Valor ≥ ${(filters.minValue / 1000).toFixed(0)}k
          <button onClick={() => set({ minValue: 0 })}><Icon name="x" size={10} /></button>
        </span>
      )}
      {filters.minAI > 0 && (
        <span className="filters-bar__chip">
          AI ≥ {filters.minAI}%
          <button onClick={() => set({ minAI: 0 })}><Icon name="x" size={10} /></button>
        </span>
      )}
      {filters.recurring !== "all" && (
        <span className="filters-bar__chip">
          {RECURRING_LABELS[filters.recurring]}
          <button onClick={() => set({ recurring: "all" })}><Icon name="x" size={10} /></button>
        </span>
      )}

      <button className="filters-bar__clear" onClick={() => setFilters(FILTER_DEFAULTS)}>
        Limpiar todo
      </button>
    </div>
  );
}

window.FILTER_DEFAULTS = FILTER_DEFAULTS;
window.applyFilters = applyFilters;
window.countActiveFilters = countActiveFilters;
window.FiltersPopover = FiltersPopover;
window.FiltersBar = FiltersBar;
