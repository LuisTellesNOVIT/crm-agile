// Inbox view + Pipeline view
function InboxView({ ws, workspace, chatOnly }) {
  const rich = window.CRM_RICH;
  const items = rich.inbox[workspace];
  const [filter, setFilter] = useState(chatOnly ? "wa" : "all");
  const [selectedId, setSelectedId] = useState(items[0].id);
  const [composer, setComposer] = useState("");

  const filtered = items.filter(it => {
    if (filter === "all") return true;
    if (filter === "unread") return it.unread;
    if (filter === "mentions") return it.ch === "mention";
    if (filter === "tasks") return it.type === "task";
    if (filter === "wa") return it.ch === "wa";
    if (filter === "email") return it.ch === "email";
    return true;
  });

  const selected = filtered.find(i => i.id === selectedId) || filtered[0];
  const threadKey = selected ? `${workspace}:${selected.id}` : null;
  const thread = rich.conversations[threadKey];

  const filters = [
    { id: "all",      label: "Todos",       icon: "inbox",   count: items.length },
    { id: "unread",   label: "Sin leer",    icon: "circle",  count: items.filter(i => i.unread).length },
    { id: "mentions", label: "Menciones",   icon: "users",   count: items.filter(i => i.ch === "mention").length },
    { id: "tasks",    label: "Tareas IA",   icon: "sparkles", count: items.filter(i => i.type === "task").length },
    { id: "wa",       label: "WhatsApp",    icon: "wa",      count: items.filter(i => i.ch === "wa").length },
    { id: "email",    label: "Email",       icon: "mail",    count: items.filter(i => i.ch === "email").length },
    { id: "call",     label: "Llamadas",    icon: "phone",   count: items.filter(i => i.ch === "call").length }
  ];

  return (
    <div className="inbox" data-screen-label="Inbox">
      <aside className="inbox__rail">
        <div className="nav-group__label" style={{ marginTop: 0 }}>Inbox</div>
        {filters.map(f => (
          <div key={f.id} className={`nav-item ${filter === f.id ? "is-active" : ""}`} onClick={() => setFilter(f.id)}>
            <Icon name={f.icon} className="icon" />
            <span>{f.label}</span>
            <span className="nav-item__badge">{f.count}</span>
          </div>
        ))}

        <div className="nav-group__label">Smart views</div>
        {[
          { l: "🔥 Hot leads",  s: "AI > 80%" },
          { l: "⏰ Stalled",     s: "+15d en etapa" },
          { l: "✨ A responder", s: "SLA < 4h" }
        ].map(v => (
          <div key={v.l} className="nav-item">
            <span style={{ marginLeft: 24 }}>{v.l}</span>
          </div>
        ))}
      </aside>

      <div className="inbox__list">
        {filtered.map(it => {
          const meta = channelMeta[it.ch] || channelMeta.note;
          return (
            <div
              key={it.id}
              className={`inbox__item ${it.unread ? "is-unread" : ""} ${selected?.id === it.id ? "is-selected" : ""}`}
              onClick={() => setSelectedId(it.id)}
            >
              <div className={`inbox__channel inbox__channel--${it.ch}`} title={meta.label}>
                <Icon name={meta.icon} size={11} />
              </div>
              <div style={{ minWidth: 0 }}>
                <div className="inbox__from">
                  {it.from}
                  {it.co && <span className="muted" style={{ marginLeft: 6, fontSize: 11 }}>· {it.co}</span>}
                </div>
                <div className="inbox__subject">{it.subj}</div>
                <div className="inbox__preview">{it.preview}</div>
              </div>
              <div className="inbox__meta">
                <span>{it.t}</span>
                {it.unread && <span className="dot" style={{ background: "var(--accent)", width: 6, height: 6 }} />}
              </div>
            </div>
          );
        })}
      </div>

      <div className="inbox__detail">
        {selected ? (
          <>
            <div className="h">
              <div className={`inbox__channel inbox__channel--${selected.ch}`} style={{ width: 26, height: 26 }}>
                <Icon name={(channelMeta[selected.ch] || channelMeta.note).icon} size={13} />
              </div>
              <div>
                <h2>{selected.subj}</h2>
                <div style={{ fontSize: 12, color: "var(--fg-3)", marginTop: 2 }}>
                  {selected.from} {selected.co && `· ${selected.co}`} · {(channelMeta[selected.ch] || {}).label}
                </div>
              </div>
              <div className="actions">
                <button className="btn"><Icon name="template" size={13} /> Plantilla</button>
                <button className="btn"><Icon name="zap" size={13} /> Secuencia</button>
                <button className="btn btn--icon"><Icon name="more" size={14} /></button>
              </div>
            </div>

            <div className="thread">
              {(thread || demoThread(selected)).map((m, i) => (
                <div key={i} className={`bubble bubble--${m.dir} ${m.ch === "email" ? "is-email" : ""}`}>
                  {m.text}
                  <small>{m.at}</small>
                </div>
              ))}
              {selected.type === "task" && (
                <div style={{
                  background: "var(--accent-soft)", border: "1px solid var(--accent-border)", borderRadius: 8,
                  padding: "12px 14px", display: "flex", alignItems: "center", gap: 10
                }}>
                  <Icon name="sparkles" size={16} style={{ color: "var(--accent)" }} />
                  <div style={{ fontSize: 12 }}>
                    <b style={{ color: "var(--accent)" }}>Tarea sugerida por IA</b><br />
                    {selected.preview}
                  </div>
                  <button className="btn btn--accent" style={{ marginLeft: "auto" }}>Resolver</button>
                </div>
              )}
            </div>

            <div className="composer">
              <Icon name="wa" size={16} style={{ color: "#25D366" }} />
              <input
                placeholder={`Escribí o presioná / para plantillas…`}
                value={composer}
                onChange={(e) => setComposer(e.target.value)}
              />
              <button className="btn"><Icon name="template" size={13} /></button>
              <button className="btn btn--accent">
                Enviar <span className="kbd" style={{ background: "rgba(255,255,255,.18)", borderColor: "rgba(255,255,255,.3)", color: "#fff" }}>⌘ ↵</span>
              </button>
            </div>
          </>
        ) : (
          <div className="empty-hint">Seleccioná un mensaje</div>
        )}
      </div>
    </div>
  );
}

function demoThread(item) {
  return [
    { dir: "in", text: item.preview, at: "Hoy · " + item.t, ch: item.ch }
  ];
}

window.InboxView = InboxView;

/* ==================== Pipeline (Kanban) ==================== */

// Palette of stage colors the editor exposes (matches dashboard funnel hues)
const STAGE_PALETTE = [
  "#94a3b8", // slate
  "#0ea5e9", // sky
  "#6366f1", // indigo
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#f59e0b", // amber
  "#10b981", // emerald
  "#16a34a", // green
  "#dc2626", // red
  "#0d9488"  // teal
];

function PipelineView({ ws, workspace, onOpenDeal, onUpdateDeal, onOpenCustomer }) {
  const [, force] = React.useReducer(x => x + 1, 0);
  const stages = window.CRM_DATA.stages;
  const deals = ws.deals;
  const [draggedId, setDraggedId] = useState(null);
  const [dropTarget, setDropTarget] = useState(null);
  const [editorStageId, setEditorStageId] = useState(null);
  const [renamingId, setRenamingId] = useState(null);
  const [adding, setAdding] = useState(false);

  // Reset selection when workspace changes
  useEffect(() => { setDraggedId(null); }, [ws]);

  // Close popovers on Escape / outside clicks via a single listener
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") { setEditorStageId(null); setRenamingId(null); setAdding(false); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const onDragStart = (id) => (e) => {
    setDraggedId(id);
    e.dataTransfer.effectAllowed = "move";
  };
  const onDragEnd = () => { setDraggedId(null); setDropTarget(null); };
  const onColDragOver = (stage) => (e) => {
    e.preventDefault();
    setDropTarget(stage);
  };
  const onColDrop = (stage) => (e) => {
    e.preventDefault();
    if (draggedId) onUpdateDeal?.(draggedId, { stage });
    setDraggedId(null);
    setDropTarget(null);
  };

  // ---- Stage CRUD (mutates global stages array; forces re-render) ----
  const slugify = (label) => {
    const base = label.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 24) || "stage";
    let id = base, n = 2;
    while (stages.some(s => s.id === id)) { id = `${base}-${n++}`; }
    return id;
  };

  const addStage = (data) => {
    // Insert just before "won" to keep Won / Lost at the end of the funnel
    const wonIdx = stages.findIndex(s => s.id === "won");
    const insertAt = wonIdx >= 0 ? wonIdx : stages.length;
    const stage = {
      id: slugify(data.label),
      label: data.label.trim() || "Nueva etapa",
      color: data.color || STAGE_PALETTE[2],
      prob: data.prob != null ? data.prob : 0.40
    };
    stages.splice(insertAt, 0, stage);
    setAdding(false);
    force();
  };

  const updateStage = (id, patch) => {
    const s = stages.find(s => s.id === id);
    if (!s) return;
    Object.assign(s, patch);
    // Re-apply probability to all deals already in that stage
    if (patch.prob != null) {
      Object.values(window.CRM_DATA.workspaces).forEach(w => {
        w.deals.forEach(d => { if (d.stage === id) d.probability = patch.prob; });
      });
    }
    force();
  };

  const deleteStage = (id) => {
    if (stages.length <= 3) return; // Always keep at least one open + won + lost
    const idx = stages.findIndex(s => s.id === id);
    if (idx < 0) return;
    // Move deals in this stage back to the first non-terminal stage
    const fallback = stages.find(s => s.id !== id && s.id !== "won" && s.id !== "lost") || stages[0];
    Object.values(window.CRM_DATA.workspaces).forEach(w => {
      w.deals.forEach(d => {
        if (d.stage === id) { d.stage = fallback.id; d.probability = fallback.prob; }
      });
    });
    stages.splice(idx, 1);
    setEditorStageId(null);
    force();
  };

  const moveStage = (id, dir) => {
    const idx = stages.findIndex(s => s.id === id);
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= stages.length) return;
    const [s] = stages.splice(idx, 1);
    stages.splice(newIdx, 0, s);
    force();
  };

  // Total open pipeline value for context bar
  const openValue = deals.filter(d => d.stage !== "won" && d.stage !== "lost").reduce((a, d) => a + d.value, 0);
  const openCount = deals.filter(d => d.stage !== "won" && d.stage !== "lost").length;

  // ---- Quick filters ----
  const [quickFilter, setQuickFilter] = useState("all");
  const filterDeal = (d) => {
    if (quickFilter === "all") return true;
    const f = getDealFacts(d, ws);
    const days = daysInStage(d, ws);
    if (quickFilter === "hot")    return d.ai >= 70 && d.stage !== "won" && d.stage !== "lost";
    if (quickFilter === "risk")   return (f.overdue || days > 30) && d.stage !== "won" && d.stage !== "lost";
    if (quickFilter === "mine")   return d.owner === (workspace === "novit" ? "MP" : "AV");
    if (quickFilter === "saas")   return !!d.isRecurring;
    if (quickFilter === "week")   {
      const eta = new Date(d.estimatedCloseAt);
      return Math.abs((eta - ws.today) / 86400000) <= 7 && d.stage !== "won" && d.stage !== "lost";
    }
    return true;
  };

  const filters = [
    { id: "all",  label: "Todos",        n: deals.length },
    { id: "mine", label: "Mis tratos",   n: deals.filter(d => filterDeal({ ...d, _f: "mine" }) && (d.owner === (workspace === "novit" ? "MP" : "AV"))).length },
    { id: "hot",  label: "🔥 Calientes", n: deals.filter(d => d.ai >= 70 && d.stage !== "won" && d.stage !== "lost").length },
    { id: "risk", label: "⚠ En riesgo",  n: deals.filter(d => { const f = getDealFacts(d, ws); const days = daysInStage(d, ws); return (f.overdue || days > 30) && d.stage !== "won" && d.stage !== "lost"; }).length },
    { id: "week", label: "Cierra esta semana", n: deals.filter(d => { const eta = new Date(d.estimatedCloseAt); return Math.abs((eta - ws.today) / 86400000) <= 7 && d.stage !== "won" && d.stage !== "lost"; }).length },
    { id: "saas", label: "SaaS",         n: deals.filter(d => d.isRecurring).length }
  ];

  return (
    <div className="pipeline-wrap" data-screen-label="Pipeline">
      {/* Process strip — visual summary + adds discoverability for stage editing */}
      <div className="pipe-process">
        <div className="pipe-process__title">
          <span className="pipe-process__label">Proceso</span>
          <span className="pipe-process__meta">
            {stages.filter(s => s.id !== "won" && s.id !== "lost").length} etapas activas · {openCount} tratos abiertos · {fmtMoney(openValue, true)}
          </span>
        </div>
        <div className="pipe-process__flow">
          {stages.map((s, i) => {
            const isLast = i === stages.length - 1;
            const isClosed = s.id === "won" || s.id === "lost";
            return (
              <React.Fragment key={s.id}>
                <button
                  className={`pipe-process__node ${isClosed ? "is-closed" : ""}`}
                  onClick={() => setEditorStageId(s.id)}
                  title="Editar etapa"
                >
                  <span className="pipe-process__dot" style={{ background: s.color }} />
                  <span className="pipe-process__name">{s.label}</span>
                  <span className="pipe-process__prob mono">{Math.round(s.prob * 100)}%</span>
                </button>
                {!isLast && <span className="pipe-process__arrow">→</span>}
              </React.Fragment>
            );
          })}
          <button className="pipe-process__add" onClick={() => setAdding(true)}>
            <Icon name="plus" size={11} /> Nueva etapa
          </button>
        </div>
      </div>

      {/* Quick filters row */}
      <div className="pipe-filters">
        {filters.map(f => (
          <button
            key={f.id}
            className={`pipe-filter ${quickFilter === f.id ? "is-active" : ""}`}
            onClick={() => setQuickFilter(f.id)}
          >
            <span>{f.label}</span>
            <span className="pipe-filter__n mono">{f.n}</span>
          </button>
        ))}
        <div className="pipe-filters__spacer" />
        {quickFilter !== "all" && (
          <button className="pipe-filter pipe-filter--clear" onClick={() => setQuickFilter("all")}>
            <Icon name="x" size={11} /> Limpiar
          </button>
        )}
      </div>

      <div className="pipeline">
        {stages.map((stage, idx) => {
          const ds = deals.filter(d => d.stage === stage.id);
          const filtered = ds.filter(filterDeal);
          const sum = filtered.reduce((acc, d) => acc + d.value, 0);
          const totalSum = ds.reduce((acc, d) => acc + d.value, 0);
          const isLostCol = stage.id === "lost";
          const isWonCol = stage.id === "won";
          const isOpen = !isLostCol && !isWonCol;
          const isHovered = dropTarget === stage.id;
          // Health distribution mini-bar (for open columns)
          const healthDist = isOpen ? {
            hot:  ds.filter(d => d.ai >= 70 && daysInStage(d, ws) <= 14).length,
            warm: ds.filter(d => d.ai >= 50 && d.ai < 70).length,
            cold: ds.filter(d => d.ai < 50 && !getDealFacts(d, ws).overdue && daysInStage(d, ws) <= 30).length,
            risk: ds.filter(d => getDealFacts(d, ws).overdue || daysInStage(d, ws) > 30).length
          } : null;
          const totalForHealth = healthDist ? (healthDist.hot + healthDist.warm + healthDist.cold + healthDist.risk) || 1 : 1;
          return (
            <div
              key={stage.id}
              className={`pipe-col ${isLostCol ? "pipe-col--lost" : ""} ${isWonCol ? "pipe-col--won" : ""} ${isHovered ? "is-drop-hover" : ""}`}
              onDragOver={onColDragOver(stage.id)}
              onDrop={onColDrop(stage.id)}
              style={{ "--stage-color": stage.color }}
            >
              <div className="pipe-col__tint" />
              <div className="pipe-col__band" />
              <div className="pipe-col__h">
                {renamingId === stage.id ? (
                  <input
                    autoFocus
                    defaultValue={stage.label}
                    className="pipe-col__rename"
                    onBlur={(e) => { updateStage(stage.id, { label: e.target.value.trim() || stage.label }); setRenamingId(null); }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") e.target.blur();
                      if (e.key === "Escape") setRenamingId(null);
                    }}
                  />
                ) : (
                  <span
                    className="pipe-col__title"
                    onDoubleClick={() => setRenamingId(stage.id)}
                    title="Doble-click para renombrar"
                  >
                    {stage.label}
                  </span>
                )}
                <span className="pipe-col__count mono">{quickFilter === "all" ? ds.length : `${filtered.length}/${ds.length}`}</span>
                <span className="pipe-col__menu" onClick={(e) => { e.stopPropagation(); setEditorStageId(editorStageId === stage.id ? null : stage.id); }} title="Opciones">
                  <Icon name="more" size={13} />
                </span>
              </div>
              <div className="pipe-col__subhead">
                <span className="pipe-col__sum mono">{fmtMoney(sum, true)}</span>
                {isOpen && (
                  <span className="pipe-col__prob" title="Probabilidad de cierre">
                    <span className="pipe-col__prob-track">
                      <span className="pipe-col__prob-fill" style={{ width: `${Math.round(stage.prob * 100)}%`, background: stage.color }} />
                    </span>
                    <span className="mono" style={{ fontSize: 10, color: "var(--fg-3)" }}>{Math.round(stage.prob * 100)}%</span>
                  </span>
                )}
              </div>

              {/* Health distribution mini-bar */}
              {healthDist && totalForHealth > 0 && (
                <div className="pipe-col__health-bar" title={`${healthDist.hot} hot · ${healthDist.warm} warm · ${healthDist.cold} cold · ${healthDist.risk} at risk`}>
                  {healthDist.hot > 0 && <span className="pipe-col__health-seg pipe-col__health-seg--hot" style={{ flex: healthDist.hot }} />}
                  {healthDist.warm > 0 && <span className="pipe-col__health-seg pipe-col__health-seg--warm" style={{ flex: healthDist.warm }} />}
                  {healthDist.cold > 0 && <span className="pipe-col__health-seg pipe-col__health-seg--cold" style={{ flex: healthDist.cold }} />}
                  {healthDist.risk > 0 && <span className="pipe-col__health-seg pipe-col__health-seg--risk" style={{ flex: healthDist.risk }} />}
                </div>
              )}

              {editorStageId === stage.id && (
                <StageEditor
                  stage={stage}
                  index={idx}
                  total={stages.length}
                  dealCount={ds.length}
                  onUpdate={(patch) => updateStage(stage.id, patch)}
                  onDelete={() => deleteStage(stage.id)}
                  onMove={(dir) => moveStage(stage.id, dir)}
                  onClose={() => setEditorStageId(null)}
                  canDelete={isOpen && stages.length > 3}
                />
              )}

              <div className="pipe-col__body">
                {filtered.map(d => (
                  <KanbanCard
                    key={d.id}
                    deal={d}
                    ws={ws}
                    isDragging={draggedId === d.id}
                    onDragStart={onDragStart(d.id)}
                    onDragEnd={onDragEnd}
                    onOpenCustomer={onOpenCustomer}
                    onClick={(e) => {
                      if (draggedId) return;
                      onOpenDeal?.(d.id);
                    }}
                  />
                ))}
                {filtered.length === 0 && quickFilter !== "all" && ds.length > 0 && (
                  <div className="pipe-col__empty">
                    <span style={{ fontSize: 11, color: "var(--fg-3)" }}>
                      {ds.length} {ds.length === 1 ? "trato" : "tratos"} fuera del filtro
                    </span>
                  </div>
                )}
                {!isLostCol && (
                  <button className="pipe-col__add-deal">
                    <Icon name="plus" size={12} /> Nuevo trato
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {/* Add-stage ghost column */}
        <AddStageColumn
          adding={adding}
          setAdding={setAdding}
          onAdd={addStage}
        />
      </div>
    </div>
  );
}

/* ---------- Stage editor popover ---------- */
function StageEditor({ stage, index, total, dealCount, onUpdate, onDelete, onMove, onClose, canDelete }) {
  const [confirmDel, setConfirmDel] = useState(false);
  const popRef = useRef(null);

  useEffect(() => {
    const onDoc = (e) => {
      if (popRef.current && !popRef.current.contains(e.target)) onClose();
    };
    // defer so the opening click doesn't immediately close
    const t = setTimeout(() => document.addEventListener("mousedown", onDoc), 0);
    return () => { clearTimeout(t); document.removeEventListener("mousedown", onDoc); };
  }, [onClose]);

  return (
    <div className="stage-editor" ref={popRef} onClick={(e) => e.stopPropagation()}>
      <div className="stage-editor__h">
        <span className="stage-editor__title">Editar etapa</span>
        <button className="stage-editor__close" onClick={onClose} title="Cerrar"><Icon name="x" size={12} /></button>
      </div>

      <label className="stage-editor__label">Nombre</label>
      <input
        className="stage-editor__input"
        defaultValue={stage.label}
        onBlur={(e) => {
          const v = e.target.value.trim();
          if (v && v !== stage.label) onUpdate({ label: v });
        }}
        onKeyDown={(e) => { if (e.key === "Enter") e.target.blur(); }}
      />

      <label className="stage-editor__label">Color</label>
      <div className="stage-editor__swatches">
        {STAGE_PALETTE.map(c => (
          <button
            key={c}
            className={`stage-swatch ${stage.color === c ? "is-active" : ""}`}
            style={{ background: c }}
            onClick={() => onUpdate({ color: c })}
            title={c}
          />
        ))}
      </div>

      {stage.id !== "won" && stage.id !== "lost" && (
        <>
          <label className="stage-editor__label">
            Probabilidad de cierre
            <span className="mono" style={{ marginLeft: "auto", color: "var(--fg-2)" }}>{Math.round(stage.prob * 100)}%</span>
          </label>
          <input
            type="range"
            min="0" max="100" step="5"
            value={Math.round(stage.prob * 100)}
            onChange={(e) => onUpdate({ prob: Number(e.target.value) / 100 })}
            className="stage-editor__range"
            style={{ accentColor: stage.color }}
          />
        </>
      )}

      <div className="stage-editor__row">
        <button className="btn btn--ghost stage-editor__action" onClick={() => onMove(-1)} disabled={index === 0}>
          <Icon name="chevron-left" size={12} /> Mover
        </button>
        <button className="btn btn--ghost stage-editor__action" onClick={() => onMove(1)} disabled={index === total - 1}>
          Mover <Icon name="chevron-right" size={12} />
        </button>
      </div>

      {canDelete && (
        <div className="stage-editor__delete">
          {!confirmDel ? (
            <button className="stage-editor__del-btn" onClick={() => setConfirmDel(true)}>
              <Icon name="trash" size={12} /> Eliminar etapa
            </button>
          ) : (
            <div className="stage-editor__confirm">
              <div className="stage-editor__warn">
                {dealCount > 0 ? (
                  <>Hay <b>{dealCount}</b> {dealCount === 1 ? "trato" : "tratos"} en esta etapa. Se moverán a la primera etapa abierta.</>
                ) : (
                  <>¿Eliminar definitivamente?</>
                )}
              </div>
              <div className="stage-editor__confirm-actions">
                <button className="btn btn--ghost" onClick={() => setConfirmDel(false)}>Cancelar</button>
                <button className="stage-editor__del-btn stage-editor__del-btn--solid" onClick={onDelete}>Eliminar</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------- New stage column ---------- */
function AddStageColumn({ adding, setAdding, onAdd }) {
  const [label, setLabel] = useState("");
  const [color, setColor] = useState(STAGE_PALETTE[2]);
  const [prob, setProb] = useState(40);

  const reset = () => { setLabel(""); setColor(STAGE_PALETTE[2]); setProb(40); };
  const cancel = () => { reset(); setAdding(false); };
  const submit = () => {
    if (!label.trim()) return;
    onAdd({ label: label.trim(), color, prob: prob / 100 });
    reset();
  };

  if (!adding) {
    return (
      <button className="pipe-col pipe-col--add" onClick={() => setAdding(true)} title="Agregar etapa antes de Closed Won">
        <div className="pipe-col--add__inner">
          <div className="pipe-col--add__icon"><Icon name="plus" size={18} /></div>
          <div className="pipe-col--add__label">Nueva etapa</div>
          <div className="pipe-col--add__hint">Sumá un paso al proceso</div>
        </div>
      </button>
    );
  }

  return (
    <div className="pipe-col pipe-col--add pipe-col--add-active" style={{ "--stage-color": color }}>
      <div className="pipe-col__band" />
      <div className="pipe-col__h" style={{ paddingBottom: 0 }}>
        <span className="pipe-col__title" style={{ color: "var(--fg-3)" }}>Nueva etapa</span>
        <button className="stage-editor__close" onClick={cancel} title="Cancelar"><Icon name="x" size={12} /></button>
      </div>
      <div className="stage-editor" style={{ position: "static", boxShadow: "none", border: "none", marginTop: 0, padding: "10px 12px 12px" }}>
        <label className="stage-editor__label">Nombre</label>
        <input
          autoFocus
          className="stage-editor__input"
          placeholder="ej. Demo agendada"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") submit(); if (e.key === "Escape") cancel(); }}
        />
        <label className="stage-editor__label">Color</label>
        <div className="stage-editor__swatches">
          {STAGE_PALETTE.map(c => (
            <button
              key={c}
              className={`stage-swatch ${color === c ? "is-active" : ""}`}
              style={{ background: c }}
              onClick={() => setColor(c)}
            />
          ))}
        </div>
        <label className="stage-editor__label">
          Probabilidad
          <span className="mono" style={{ marginLeft: "auto", color: "var(--fg-2)" }}>{prob}%</span>
        </label>
        <input
          type="range" min="0" max="100" step="5"
          value={prob}
          onChange={(e) => setProb(Number(e.target.value))}
          className="stage-editor__range"
          style={{ accentColor: color }}
        />
        <div className="stage-editor__row" style={{ marginTop: 10 }}>
          <button className="btn btn--ghost" onClick={cancel} style={{ flex: 1 }}>Cancelar</button>
          <button className="btn btn--primary" onClick={submit} style={{ flex: 1 }} disabled={!label.trim()}>Crear etapa</button>
        </div>
      </div>
    </div>
  );
}

/* ==================== Kanban deal card (Zoho-style) ==================== */

// Deterministic activity facts per deal — counts shown on the kanban card.
// Files come from the real attachment store; the rest are synthesized from the deal id.
function getDealFacts(deal, ws) {
  const seed = (deal.id || "x").split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const stageBoost = { discovery: 0, qualified: 1, proposal: 2, negotiation: 3, won: 4, lost: 2 }[deal.stage] || 0;
  // File count comes from the real attachment store; defaults to 5 (seed) if untouched
  const fileCount = window.__dealFiles?.[deal.id]?.length;
  const files = typeof fileCount === "number" ? fileCount : (stageBoost >= 2 ? 3 + (seed % 3) : (seed % 3));
  return {
    files,
    wa: stageBoost >= 1 ? 1 + (seed % 4) + stageBoost : (seed % 2),
    emails: stageBoost >= 2 ? 2 + (seed % 3) + stageBoost : 1 + (seed % 2),
    calls: stageBoost >= 2 ? 1 + (seed % 3) : 0,
    notes: stageBoost + (seed % 2),
    tasks: stageBoost >= 1 ? 1 + (seed % 3) : (seed % 2),
    nextWaUnread: deal.stage !== "won" && deal.stage !== "lost" && (seed % 3 === 0),
    overdue: deal.stage !== "won" && deal.stage !== "lost" && (seed % 5 === 0)
  };
}

function daysInStage(deal, ws) {
  // Approximation: days since created if stage isn't won/lost
  return Math.max(0, daysBetween(deal.createdAt, ws.today));
}

function KanbanCard({ deal, ws, isDragging, onDragStart, onDragEnd, onClick, onOpenCustomer }) {
  const owner = ws.owners[deal.owner];
  const facts = getDealFacts(deal, ws);
  const days = daysInStage(deal, ws);
  const isClosed = deal.stage === "won" || deal.stage === "lost";
  const ageClass = isClosed ? "is-closed" : days > 30 ? "is-stale" : days > 14 ? "is-warming" : "is-fresh";

  // Derive workspace from deal id prefix ("NOVIT-0001" / "SHARKY-0004"), with a
  // fallback to the deal._ws tag the merged "all" workspace assigns.
  const dealWs = deal._ws || (deal.id && deal.id.startsWith("SHARKY") ? "sharky" : "novit");
  const dealWsLabel = dealWs === "sharky" ? "SHARKY" : "NOVIT";

  // Card health (used for left bar + temperature dot)
  // hot: AI ≥ 70 & fresh ; cold: stale or low AI ; risk: overdue or stale&mid AI
  let healthLevel;
  if (deal.stage === "won") healthLevel = "won";
  else if (deal.stage === "lost") healthLevel = "lost";
  else if (facts.overdue || days > 30) healthLevel = "risk";
  else if (deal.ai >= 70 && days <= 14) healthLevel = "hot";
  else if (deal.ai >= 50) healthLevel = "warm";
  else healthLevel = "cold";

  // Next-action surfacing
  let nextAction = null;
  if (facts.overdue) {
    nextAction = { icon: "alert", label: "Tarea vencida hace 3d", tone: "danger" };
  } else if (facts.nextWaUnread) {
    nextAction = { icon: "wa", label: "WhatsApp sin responder", tone: "wa" };
  } else if (deal.stage === "proposal" && facts.tasks > 0) {
    nextAction = { icon: "check", label: "Enviar propuesta", tone: "accent" };
  } else if (deal.stage === "negotiation") {
    nextAction = { icon: "phone", label: "Cerrar negociación", tone: "warn" };
  } else if (deal.stage === "discovery") {
    nextAction = { icon: "calendar", label: "Agendar discovery call", tone: "muted" };
  } else if (deal.stage === "qualified") {
    nextAction = { icon: "sparkles", label: "Calificar BANT", tone: "muted" };
  }

  // Channel activity summary (most-used)
  const channels = [
    { k: "wa", n: facts.wa, ico: "wa" },
    { k: "email", n: facts.emails, ico: "mail" },
    { k: "call", n: facts.calls, ico: "phone" }
  ].filter(c => c.n > 0);
  const topChannel = channels.sort((a, b) => b.n - a.n)[0];

  const stop = (e) => e.stopPropagation();

  return (
    <div
      className={`deal-card deal-card--health-${healthLevel} ${isDragging ? "is-dragging" : ""}`}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
    >
      {/* Left health bar */}
      <div className="deal-card__health" />

      {/* Quick actions on hover */}
      <div className="deal-card__quick" onClick={stop}>
        <button title="Nota"><Icon name="note" size={12} /></button>
        <button title="Tarea"><Icon name="check" size={12} /></button>
        <button title="WhatsApp"><Icon name="wa" size={12} /></button>
        <button title="Email"><Icon name="mail" size={12} /></button>
      </div>

      <div className="deal-card__body">
        <div className={`deal-card__ws-pill deal-card__ws-pill--${dealWs}`}>
          <span className="deal-card__ws-dot" />
          {dealWsLabel}
        </div>

        <div className="deal-card__top">
          <span className="deal-card__id mono">{deal.id}</span>
          {!isClosed && (
            <span className={`deal-card__age mono ${ageClass}`} title={`${days} días en pipeline`}>
              <Icon name="clock" size={9} /> {days}d
            </span>
          )}
          <span
            className="avatar avatar--xs"
            style={{ background: `linear-gradient(135deg, ${owner?.color}aa, ${owner?.color})` }}
            title={owner?.name}
          >
            {owner?.name.split(" ").map(s => s[0]).slice(0, 2).join("")}
          </span>
        </div>

        <div className="deal-card__name">{deal.name}</div>
        <div className="deal-card__co">
          <a
            className="deal-card__co-link"
            onClick={(e) => {
              e.stopPropagation();
              onOpenCustomer?.(deal.company);
            }}
            title={`Abrir ficha de cliente: ${deal.company}`}
          >
            {deal.company}
          </a>
          {deal.isRecurring && <span className="deal-card__saas">SaaS</span>}
        </div>

        <div className="deal-card__money">
          <span className="deal-card__value mono">{fmtMoney(deal.value, true)}</span>
          <span className="deal-card__ai" title={`AI confidence: ${deal.ai}%`}>
            <span className="deal-card__ai-ring" style={{ "--p": deal.ai }}>
              <span>{deal.ai}</span>
            </span>
          </span>
        </div>

        {/* Slim activity strip — channels + count, only what matters */}
        {!isClosed && (channels.length > 0 || facts.tasks > 0 || facts.files > 0) && (
          <div className="deal-card__activity">
            {topChannel && (
              <span className={`deal-card__chan deal-card__chan--${topChannel.k}`} title={`${topChannel.n} en este canal`}>
                <Icon name={topChannel.ico} size={10} /> {topChannel.n}
              </span>
            )}
            {facts.files > 0 && (
              <span className="deal-card__chip" title={`${facts.files} adjuntos`}>
                <Icon name="doc" size={10} /> {facts.files}
              </span>
            )}
            {facts.tasks > 0 && (
              <span className={`deal-card__chip ${facts.overdue ? "is-overdue" : ""}`} title={`${facts.tasks} tareas`}>
                <Icon name="check" size={10} /> {facts.tasks}
              </span>
            )}
            <span className="deal-card__pulse">
              <span className="deal-card__spark">
                {/* tiny sparkline reflecting deterministic activity */}
                {[3, 5, 2, 6, 4, 7, 5].map((h, i) => (
                  <span key={i} className="deal-card__spark-bar" style={{ height: `${h * 2 + 2}px` }} />
                ))}
              </span>
            </span>
          </div>
        )}

        {/* Next-action pill */}
        {nextAction && !isClosed && (
          <div className={`deal-card__next deal-card__next--${nextAction.tone}`}>
            <Icon name={nextAction.icon} size={10} />
            <span>{nextAction.label}</span>
          </div>
        )}
      </div>
    </div>
  );
}

window.PipelineView = PipelineView;
