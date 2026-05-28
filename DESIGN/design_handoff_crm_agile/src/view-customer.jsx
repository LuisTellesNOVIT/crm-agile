// Customer 360 — Odoo-style unified customer record
// Header with smart-button counters, tabs (Resumen · Tratos · Tareas · Notas · Archivos · Conversaciones)
// and a right "chatter" rail with activity log + AI score.

function CustomerView({ ws, workspace, onOpenDeal, initialCompany }) {
  const featured = window.CRM_RICH.featured[workspace];
  const allCompanies = useMemo(() => {
    const map = {};
    ws.deals.forEach(d => {
      if (!map[d.company]) {
        map[d.company] = { name: d.company, deals: [], totalValue: 0, won: 0, arr: 0 };
      }
      map[d.company].deals.push(d);
      map[d.company].totalValue += d.value;
      if (d.stage === "won") map[d.company].won++;
      if (d.stage === "won" && d.isRecurring) map[d.company].arr += d.arr;
    });
    // Featured first, then by total value
    return Object.values(map).sort((a, b) => {
      if (a.name === featured.name) return -1;
      if (b.name === featured.name) return 1;
      return b.totalValue - a.totalValue;
    });
  }, [ws, featured]);

  const initialName = initialCompany?.name || null;
  const initialNonce = initialCompany?.nonce || 0;
  const [selectedCompany, setSelectedCompany] = useState(initialName || featured.name);
  const [tab, setTab] = useState("overview");
  const [picker, setPicker] = useState(false);
  const [following, setFollowing] = useState(true);

  // Reset on workspace switch
  useEffect(() => { setSelectedCompany(initialName || featured.name); setTab("overview"); }, [workspace]);

  // Respond to external navigation (e.g. clicking a company from a Kanban card)
  useEffect(() => {
    if (initialName) {
      setSelectedCompany(initialName);
      setTab("overview");
    }
  }, [initialName, initialNonce]);

  const isFeatured = selectedCompany === featured.name;
  const company = isFeatured ? featured : synthCompany(allCompanies.find(c => c.name === selectedCompany), ws, workspace);
  const customerDeals = ws.deals.filter(d => d.company === selectedCompany);
  const openDeals = customerDeals.filter(d => d.stage !== "won" && d.stage !== "lost");
  const wonDeals = customerDeals.filter(d => d.stage === "won");
  const lostDeals = customerDeals.filter(d => d.stage === "lost");
  const totalPipeline = openDeals.reduce((a, d) => a + d.value, 0);
  const totalWon = wonDeals.reduce((a, d) => a + d.value, 0);
  const ownerObj = ws.owners[company.owner] || ws.owners[customerDeals[0]?.owner] || Object.values(ws.owners)[0];

  // Synthesize tasks tied to this customer
  const tasks = useMemo(() => buildTasks(selectedCompany, ws, ownerObj), [selectedCompany, ws.today]);
  // Build proposals for this customer based on their deals
  const proposals = useMemo(() => buildProposals(customerDeals, company, ws), [customerDeals, ws.today]);
  // Notes log: pull note-type events from timeline + synthesize a couple more
  const notes = useMemo(() => buildNotes(company), [company]);
  // Files: aggregate files across this customer's deals
  const filesAll = useMemo(() => {
    const acc = [];
    customerDeals.forEach(d => {
      const fs = (window.__dealFiles?.[d.id]) || [];
      fs.forEach(f => acc.push({ ...f, dealId: d.id, dealName: d.name }));
    });
    return acc;
  }, [customerDeals, ws]);

  const counts = {
    deals: openDeals.length,
    tasks: tasks.filter(t => !t.done).length,
    notes: notes.length,
    files: filesAll.length,
    convs: (company.timeline || []).reduce((a, d) => a + d.events.length, 0),
    contacts: (company.contacts || []).length
  };

  return (
    <div className="cust360" data-screen-label="Cliente 360 · Odoo style">
      {/* Header strip */}
      <div className="cust360__header">
        <div className="cust360__brand">
          <div className="cust__logo" style={{ width: 56, height: 56 }}>{company.logo || company.name.slice(0, 2).toUpperCase()}</div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="cust360__title-row">
              <h1>{company.name}</h1>
              <button className={`cust360__follow ${following ? "is-on" : ""}`} onClick={() => setFollowing(f => !f)}>
                <Icon name={following ? "check" : "plus"} size={12} />
                {following ? "Siguiendo" : "Seguir"}
              </button>
              <div className="cust360__picker">
                <button className="btn btn--ghost" onClick={() => setPicker(p => !p)}>
                  <Icon name="users" size={13} /> Cambiar cliente <Icon name="chevron-down" size={11} />
                </button>
                {picker && (
                  <div className="cust360__picker-menu" onMouseLeave={() => setPicker(false)}>
                    {allCompanies.map(c => (
                      <div
                        key={c.name}
                        className={`cust360__picker-item ${c.name === selectedCompany ? "is-active" : ""}`}
                        onClick={() => { setSelectedCompany(c.name); setPicker(false); setTab("overview"); }}
                      >
                        <span className="cust__logo" style={{ width: 24, height: 24, fontSize: 10 }}>
                          {c.name.split(" ").map(s => s[0]).slice(0, 2).join("")}
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 500 }}>{c.name}</div>
                          <div style={{ fontSize: 10, color: "var(--fg-3)", fontFamily: "var(--font-mono)" }}>
                            {c.deals.length} trato{c.deals.length !== 1 ? "s" : ""} · {fmtMoney(c.totalValue, true)}
                          </div>
                        </div>
                        {c.name === featured.name && <span className="chip chip--accent" style={{ fontSize: 9 }}>360</span>}
                        {c.name === selectedCompany && <Icon name="check" size={12} />}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="cust360__meta">
              <span>{company.industry}</span>
              <span>·</span>
              <span><Icon name="external" size={10} /> {company.website}</span>
              <span>·</span>
              <span>{company.employees || "—"} empleados</span>
              <span>·</span>
              <span className="mono" style={{ color: "var(--fg-4)" }}>{company.id || ("CUS-" + selectedCompany.replace(/\s+/g, "").slice(0, 6).toUpperCase())}</span>
            </div>
          </div>
        </div>

        <div className="cust360__actions">
          <span className={`chip ${company.tier === "Strategic" ? "chip--accent" : ""}`}>{company.tier || "Standard"}</span>
          <button className="btn"><Icon name="wa" size={13} /> WhatsApp</button>
          <button className="btn"><Icon name="mail" size={13} /> Email</button>
          <button className="btn"><Icon name="phone" size={13} /></button>
          <button className="btn btn--primary"><Icon name="plus" size={13} /> Trato</button>
          <button className="btn btn--icon"><Icon name="more" size={14} /></button>
        </div>
      </div>

      {/* Smart buttons */}
      <div className="cust360__smart">
        <SmartButton icon="dollar" label="Pipeline" value={fmtMoney(totalPipeline, true)} sub={`${openDeals.length} abiertos`} onClick={() => setTab("deals")} />
        <SmartButton icon="trending" label="ARR" value={fmtMoney(company.arr || 0, true)} sub={`MRR ${fmtMoney(company.mrr || 0, true)}`} onClick={() => setTab("deals")} />
        <SmartButton icon="check" label="Tratos ganados" value={wonDeals.length} sub={fmtMoney(totalWon, true)} accent="var(--success)" onClick={() => setTab("deals")} />
        <SmartButton icon="users" label="Contactos" value={counts.contacts} sub={`${(company.contacts || []).filter(c => /CTO|CEO|VP|Head/i.test(c.role)).length} c-level`} onClick={() => setTab("overview")} />
        <SmartButton icon="note" label="Tareas" value={counts.tasks} sub={tasks.filter(t => isOverdue(t, ws.today)).length + " vencidas"} accent={tasks.some(t => isOverdue(t, ws.today)) ? "var(--warning)" : null} onClick={() => setTab("tasks")} />
        <SmartButton icon="doc" label="Propuestas" value={proposals.length} sub={proposals.filter(p => p.status === "signed").length + " firmadas · " + proposals.filter(p => p.status === "negotiating" || p.status === "viewed").length + " activas"} accent="var(--accent)" onClick={() => setTab("proposals")} />
        <SmartButton icon="chat" label="Conversaciones" value={counts.convs} sub="últimos 30d" onClick={() => setTab("activity")} />
        <SmartButton icon="sparkles" label="AI Score" value={(company.aiScore || 60) + "%"} sub={"+6 esta semana"} accent="var(--accent)" onClick={() => setTab("overview")} />
      </div>

      {/* Body: 2-col with tabs + chatter */}
      <div className="cust360__body">
        <div className="cust360__main">
          <div className="cust360__tabs">
            {[
              { id: "overview", l: "Resumen", icon: "database" },
              { id: "deals",    l: `Tratos · ${customerDeals.length}`, icon: "dollar" },
              { id: "proposals",l: `Propuestas · ${proposals.length}`, icon: "doc" },
              { id: "tasks",    l: `Tareas · ${counts.tasks}`, icon: "check" },
              { id: "notes",    l: `Notas · ${counts.notes}`, icon: "note" },
              { id: "files",    l: `Archivos · ${counts.files}`, icon: "doc" },
              { id: "activity", l: "Timeline", icon: "clock" }
            ].map(t => (
              <div key={t.id} className={`tab ${tab === t.id ? "is-active" : ""}`} onClick={() => setTab(t.id)}>
                <Icon name={t.icon} size={11} />
                {t.l}
              </div>
            ))}
          </div>

          <div className="cust360__panel">
            {tab === "overview" && (
              <OverviewTab company={company} customerDeals={customerDeals} ownerObj={ownerObj} ws={ws} workspace={workspace} />
            )}
            {tab === "deals" && (
              <DealsTab open={openDeals} won={wonDeals} lost={lostDeals} onOpenDeal={onOpenDeal} ws={ws} />
            )}
            {tab === "proposals" && (
              <ProposalsTab proposals={proposals} onOpenDeal={onOpenDeal} ws={ws} />
            )}
            {tab === "tasks" && (
              <TasksTab tasks={tasks} ws={ws} />
            )}
            {tab === "notes" && (
              <NotesTab notes={notes} ownerObj={ownerObj} />
            )}
            {tab === "files" && (
              <FilesTab files={filesAll} onOpenDeal={onOpenDeal} ws={ws} />
            )}
            {tab === "activity" && (
              <TimelineTab company={company} />
            )}
          </div>
        </div>

        {/* Chatter rail */}
        <aside className="cust360__chatter">
          <div className="chatter__composer">
            <div className="chatter__tabs">
              <button className="is-active">Registrar nota</button>
              <button>Enviar mensaje</button>
              <button>Programar actividad</button>
            </div>
            <textarea placeholder={`Registrar una nota sobre ${company.name}…`} rows={3} />
            <div className="chatter__composer-foot">
              <div className="chatter__attach">
                <button title="Adjuntar"><Icon name="doc" size={12} /></button>
                <button title="Mencionar"><Icon name="users" size={12} /></button>
                <button title="Emoji">🙂</button>
              </div>
              <button className="btn btn--primary">Registrar</button>
            </div>
          </div>

          <div className="chatter__section">
            <div className="chatter__section-h">
              <Icon name="clock" size={11} />
              Próximas actividades
              <span className="chip" style={{ fontSize: 9, marginLeft: "auto" }}>{tasks.filter(t => !t.done).length}</span>
            </div>
            {tasks.filter(t => !t.done).slice(0, 3).map(t => (
              <div key={t.id} className="chatter__activity">
                <div className={`activity-dot ${isOverdue(t, ws.today) ? "is-overdue" : ""}`} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 500 }}>{t.title}</div>
                  <div style={{ fontSize: 10, color: "var(--fg-3)", fontFamily: "var(--font-mono)" }}>
                    {t.kind} · vence {fmtDate(t.due, { format: "short" })} {isOverdue(t, ws.today) && <span style={{ color: "var(--warning)" }}>· vencida</span>}
                  </div>
                </div>
                <span className="avatar" style={{ width: 18, height: 18, fontSize: 8 }}>{t.byInitials}</span>
              </div>
            ))}
          </div>

          <div className="chatter__section">
            <div className="chatter__section-h">
              <Icon name="users" size={11} />
              Followers
              <span className="chip" style={{ fontSize: 9, marginLeft: "auto" }}>{Object.keys(ws.owners).length + 1}</span>
            </div>
            <div className="chatter__followers">
              {Object.entries(ws.owners).map(([k, o]) => (
                <span key={k} className="avatar" title={o.name} style={{ width: 26, height: 26, fontSize: 10, background: `linear-gradient(135deg, ${o.color}aa, ${o.color})` }}>{k}</span>
              ))}
              <button className="chatter__follow-add">+</button>
            </div>
          </div>

          <div className="chatter__section">
            <div className="chatter__section-h">
              <Icon name="clock" size={11} />
              Actividad reciente
            </div>
            <div className="chatter__feed">
              {(company.timeline || []).slice(0, 2).flatMap(day =>
                day.events.map((ev, i) => {
                  const meta = channelMeta[ev.type] || channelMeta.note;
                  return (
                    <div key={day.day + i} className="chatter__feed-item">
                      <div className="icon-tile" style={{ background: meta.color, width: 22, height: 22 }}>
                        <Icon name={meta.icon} size={10} />
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 11, color: "var(--fg-3)" }}>
                          <b style={{ color: "var(--fg-2)" }}>{ev.who}</b> · {ev.at}
                        </div>
                        <div style={{ fontSize: 12, color: "var(--fg)", marginTop: 2, lineHeight: 1.45 }}>
                          {ev.text}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

/* ========== Smart button ========== */
function SmartButton({ icon, label, value, sub, accent, onClick }) {
  return (
    <button className="smart-btn" onClick={onClick} style={accent ? { "--accent-color": accent } : null}>
      <div className="smart-btn__icon"><Icon name={icon} size={14} /></div>
      <div style={{ minWidth: 0, textAlign: "left" }}>
        <div className="smart-btn__label">{label}</div>
        <div className="smart-btn__value">{value}</div>
        <div className="smart-btn__sub">{sub}</div>
      </div>
    </button>
  );
}

/* ========== Resumen ========== */
function OverviewTab({ company, customerDeals, ownerObj, ws, workspace }) {
  const stack = ["AWS", "Snowflake", "Salesforce", "Slack"];
  return (
    <div className="ovw">
      <div className="ovw__col">
        <div className="ovw__section">
          <div className="ovw__section-h"><Icon name="database" size={12} /> Datos de la empresa</div>
          <div className="ovw__form">
            <FormRow k="Razón social" v={company.name} />
            <FormRow k="Industria" v={<span className="chip">{(company.industry || "").split(" · ")[0]}</span>} />
            <FormRow k="Sitio web" v={<a href={`https://${company.website}`} className="lnk">{company.website}</a>} />
            <FormRow k="Empleados" v={company.employees || "—"} />
            <FormRow k="Región" v={(company.industry || "").split(" · ")[1] || "—"} />
            <FormRow k="Owner" v={
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <span className="avatar" style={{ width: 18, height: 18, fontSize: 9, background: `linear-gradient(135deg, ${ownerObj?.color}aa, ${ownerObj?.color})` }}>{company.owner || ownerObj?.name?.split(" ").map(s => s[0]).join("")}</span>
                {ownerObj?.name}
              </span>
            } />
            <FormRow k="ID" v={<span className="mono">{company.id || "—"}</span>} />
          </div>
        </div>

        <div className="ovw__section">
          <div className="ovw__section-h"><Icon name="dollar" size={12} /> Salud comercial</div>
          <div className="ovw__form">
            <FormRow k="ARR" v={<span className="mono">{fmtMoney(company.arr || 0, true)}</span>} />
            <FormRow k="MRR" v={<span className="mono">{fmtMoney(company.mrr || 0, true)}</span>} />
            <FormRow k="Tier" v={<span className="chip chip--accent">{company.tier || "Standard"}</span>} />
            <FormRow k="NPS último" v={(company.nps != null ? company.nps : "—") + ""} />
            <FormRow k="Churn risk" v={<span style={{ color: company.churnRisk === "Low" ? "var(--success)" : "var(--warning)" }}>{company.churnRisk || "—"}</span>} />
            <FormRow k="Renueva" v="Dic 2026" />
            <FormRow k="Procurement" v="90d net" />
          </div>
        </div>

        <div className="ovw__section">
          <div className="ovw__section-h"><Icon name="code" size={12} /> Stack tecnológico</div>
          <div className="ovw__chips">
            {stack.map(s => <span key={s} className="chip">{s}</span>)}
            <button className="chip chip--ghost"><Icon name="plus" size={10} /> Agregar</button>
          </div>
        </div>
      </div>

      <div className="ovw__col">
        <div className="ovw__section">
          <div className="ovw__section-h">
            <Icon name="users" size={12} /> Stakeholders
            <span style={{ marginLeft: "auto", color: "var(--fg-3)", fontFamily: "var(--font-mono)", fontSize: 10 }}>
              {(company.contacts || []).length} · {(company.contacts || []).filter(c => /CTO|CEO|VP|Head/i.test(c.role)).length} c-level
            </span>
          </div>
          <div className="ovw__stakeholders">
            {(company.contacts || []).map(ct => (
              <div key={ct.email} className="stk">
                <span className="avatar" style={{ width: 36, height: 36, fontSize: 13 }}>
                  {ct.name.split(" ").map(s => s[0]).slice(0, 2).join("")}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{ct.name}</div>
                  <div style={{ fontSize: 11, color: "var(--fg-3)" }}>{ct.role}</div>
                  <div style={{ fontSize: 10, color: "var(--fg-4)", fontFamily: "var(--font-mono)", marginTop: 2 }}>{ct.email}</div>
                </div>
                <div className="stk__actions">
                  <button title="WhatsApp"><Icon name="wa" size={12} /></button>
                  <button title="Email"><Icon name="mail" size={12} /></button>
                  <button title="Llamar"><Icon name="phone" size={12} /></button>
                </div>
              </div>
            ))}
            <button className="stk stk--add">
              <Icon name="plus" size={14} />
              Agregar stakeholder
            </button>
          </div>
        </div>

        <div className="ovw__section">
          <div className="ovw__section-h"><Icon name="trending" size={12} /> AI insights</div>
          <div className="ovw__factors">
            <div className="ai-factor"><span>Tamaño cuenta</span><span className="bar"><span style={{ width: "90%" }} /></span><b className="mono">+22</b></div>
            <div className="ai-factor"><span>Engagement WA</span><span className="bar"><span style={{ width: "85%" }} /></span><b className="mono">+24</b></div>
            <div className="ai-factor"><span>Stakeholders activos</span><span className="bar"><span style={{ width: "70%" }} /></span><b className="mono">+18</b></div>
            <div className="ai-factor"><span>Tiempo en etapa</span><span className="bar"><span style={{ width: "30%", background: "var(--warning)" }} /></span><b className="mono" style={{ color: "var(--warning)" }}>−8</b></div>
            <div className="ai-factor"><span>Fit ICP</span><span className="bar"><span style={{ width: "75%" }} /></span><b className="mono">+16</b></div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FormRow({ k, v }) {
  return (
    <div className="form-row">
      <span className="k">{k}</span>
      <span className="v">{v}</span>
    </div>
  );
}

/* ========== Tratos ========== */
function DealsTab({ open, won, lost, onOpenDeal, ws }) {
  return (
    <div className="deals-tab">
      <DealsGroup title="En curso" deals={open} onOpenDeal={onOpenDeal} ws={ws} />
      <DealsGroup title="Ganados" deals={won} onOpenDeal={onOpenDeal} ws={ws} accent="var(--success)" />
      <DealsGroup title="Perdidos" deals={lost} onOpenDeal={onOpenDeal} ws={ws} accent="var(--danger)" muted />
      {open.length + won.length + lost.length === 0 && (
        <div className="empty-hint">No hay tratos para este cliente.</div>
      )}
    </div>
  );
}

function DealsGroup({ title, deals, onOpenDeal, ws, accent, muted }) {
  if (deals.length === 0) return null;
  const total = deals.reduce((a, d) => a + d.value, 0);
  return (
    <div className="deals-group">
      <div className="deals-group__h">
        <span style={{ color: accent }}>{title}</span>
        <span className="mono">{deals.length}</span>
        <span style={{ marginLeft: "auto" }} className="mono">{fmtMoney(total, true)}</span>
      </div>
      <div className="deals-group__list" style={muted ? { opacity: 0.7 } : null}>
        {deals.map(d => (
          <div key={d.id} className="deal-row" onClick={() => onOpenDeal?.(d.id)}>
            <span className="dot" style={{ background: stageColor(d.stage), width: 8, height: 8 }} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{d.name}</div>
              <div style={{ fontSize: 11, color: "var(--fg-3)", fontFamily: "var(--font-mono)", marginTop: 2, display: "flex", gap: 8, flexWrap: "wrap" }}>
                <span>{d.id}</span>
                <span>{stageLabel(d.stage)}</span>
                <span>AI {d.ai}%</span>
                {d.isRecurring && <span style={{ color: "var(--accent)" }}>ARR {fmtMoney(d.arr, true)}</span>}
                <span>cierre {fmtDate(d.estimatedCloseAt, { format: "short" })}</span>
              </div>
            </div>
            <span className="avatar" style={{ width: 22, height: 22, fontSize: 9 }}>{ws.owners[d.owner]?.name?.split(" ").map(s => s[0]).slice(0,2).join("") || d.owner}</span>
            <div className="mono" style={{ fontSize: 14, fontWeight: 500, width: 80, textAlign: "right" }}>{fmtMoney(d.value, true)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ========== Tareas ========== */
function TasksTab({ tasks, ws }) {
  const [items, setItems] = useState(tasks);
  useEffect(() => setItems(tasks), [tasks]);
  const toggle = (id) => setItems(prev => prev.map(t => t.id === id ? { ...t, done: !t.done } : t));
  const pending = items.filter(t => !t.done);
  const completed = items.filter(t => t.done);
  return (
    <div className="tasks-tab">
      <div className="tasks-tab__head">
        <span>{pending.length} pendientes · {completed.length} completadas</span>
        <button className="btn btn--primary"><Icon name="plus" size={12} /> Nueva tarea</button>
      </div>
      <div className="tasks-tab__list">
        {pending.map(t => <TaskRow key={t.id} task={t} ws={ws} onToggle={toggle} />)}
        {completed.length > 0 && (
          <>
            <div className="tasks-tab__divider">Completadas</div>
            {completed.map(t => <TaskRow key={t.id} task={t} ws={ws} onToggle={toggle} />)}
          </>
        )}
      </div>
    </div>
  );
}

function TaskRow({ task, ws, onToggle }) {
  const overdue = isOverdue(task, ws.today);
  return (
    <div className={`task-row ${task.done ? "is-done" : ""} ${overdue ? "is-overdue" : ""}`}>
      <button className="task-row__check" onClick={() => onToggle(task.id)}>
        {task.done && <Icon name="check" size={11} />}
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="task-row__title">{task.title}</div>
        <div className="task-row__meta">
          <span className="chip" style={{ fontSize: 9, padding: "1px 5px" }}>{task.kind}</span>
          <span>vence {fmtDate(task.due, { format: "short" })}</span>
          {overdue && !task.done && <span style={{ color: "var(--warning)" }}>· vencida hace {daysBetween(task.due, ws.today)}d</span>}
        </div>
      </div>
      <span className="avatar" style={{ width: 22, height: 22, fontSize: 9 }}>{task.byInitials}</span>
    </div>
  );
}

/* ========== Notas (chatter-style) ========== */
function NotesTab({ notes, ownerObj }) {
  return (
    <div className="notes-tab">
      {notes.map((n, i) => (
        <div key={i} className="note-card">
          <div className="note-card__h">
            <span className="avatar" style={{ width: 28, height: 28, fontSize: 10, background: n.kind === "ai" ? "linear-gradient(135deg, #8b5cf6, #2563eb)" : `linear-gradient(135deg, ${ownerObj?.color}aa, ${ownerObj?.color})` }}>
              {n.kind === "ai" ? "AI" : (n.by || "MP").split(" ").map(s => s[0]).slice(0, 2).join("")}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 500 }}>
                {n.by || (n.kind === "ai" ? "AI · Recap" : "Nota interna")}
                {n.kind === "ai" && <span className="ai-tag" style={{ marginLeft: 6 }}><Icon name="sparkles" size={9} /> AI</span>}
              </div>
              <div style={{ fontSize: 10, color: "var(--fg-3)", fontFamily: "var(--font-mono)" }}>{n.at}</div>
            </div>
            <button className="btn btn--icon btn--ghost"><Icon name="more" size={13} /></button>
          </div>
          <div className="note-card__body">{n.text}</div>
          {n.tags && (
            <div className="note-card__tags">
              {n.tags.map(t => <span key={t} className="chip">{t}</span>)}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ========== Archivos (cross-deal) ========== */
function FilesTab({ files, onOpenDeal, ws }) {
  if (files.length === 0) {
    return (
      <div className="empty-hint" style={{ padding: 30 }}>
        No hay archivos todavía.<br />
        Los archivos cargados desde los tratos aparecerán acá.
      </div>
    );
  }
  return (
    <div className="files-tab">
      <div className="odoo-files__head" style={{ padding: "0 0 12px" }}>
        <span>Documentos del cliente</span>
        <span className="odoo-files__count">{files.length}</span>
        <span style={{ marginLeft: "auto", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-3)" }}>
          {fmtBytesSimple(files.reduce((a, f) => a + (f.size || 0), 0))} total
        </span>
      </div>
      <div className="odoo-files__grid">
        {files.map(f => {
          const meta = window.getFileMeta ? window.getFileMeta(f.ext) : { label: f.ext.toUpperCase(), color: "#64748b", bg: "#eef1f5" };
          return (
            <div key={f.id + f.dealId} className="odoo-file-tile" onClick={() => onOpenDeal?.(f.dealId)}>
              <div className="odoo-file-tile__thumb" style={{ background: meta.bg }}>
                {window.FileThumbnail ? <window.FileThumbnail file={f} meta={meta} /> : null}
                <span className="odoo-file-tile__ext" style={{ color: meta.color, borderColor: meta.color }}>{meta.label}</span>
              </div>
              <div className="odoo-file-tile__meta">
                <div className="odoo-file-tile__name" title={f.name}>{f.name}</div>
                <div className="odoo-file-tile__sub">
                  <span>{fmtBytesSimple(f.size)}</span>
                  <span style={{ color: "var(--fg-4)" }}>·</span>
                  <span style={{ color: "var(--accent)" }}>{f.dealName}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ========== Timeline ========== */
function TimelineTab({ company }) {
  return (
    <div className="cust__timeline" style={{ padding: "0 4px" }}>
      <div className="tl">
        {(company.timeline || []).map(day => (
          <React.Fragment key={day.day}>
            <div className="tl__day">{day.day}</div>
            {day.events.map((ev, j) => {
              const meta = channelMeta[ev.type] || channelMeta.note;
              return (
                <div key={j} className="tl__item">
                  <div className="tl__item-h">
                    <div className="icon-tile" style={{ background: meta.color }}>
                      <Icon name={meta.icon} size={12} />
                    </div>
                    <span style={{ fontWeight: 500 }}>{meta.label}</span>
                    <span style={{ fontSize: 11, color: "var(--fg-3)" }}>· {ev.who}</span>
                    <span className="when">{ev.at}</span>
                  </div>
                  <div className="tl__item-body">
                    {ev.text}
                    {ev.type === "ai" && <span className="ai-tag"><Icon name="sparkles" size={9} /> AI</span>}
                  </div>
                </div>
              );
            })}
          </React.Fragment>
        ))}
        <div style={{ textAlign: "center", marginTop: 16, fontSize: 11, color: "var(--fg-3)" }}>
          · cargar histórico completo (147 eventos) ·
        </div>
      </div>
    </div>
  );
}

/* ========== Helpers ========== */
function fmtBytesSimple(n) {
  if (!n) return "0 KB";
  if (n < 1024 * 1024) return Math.round(n / 1024) + " KB";
  return (n / (1024 * 1024)).toFixed(1) + " MB";
}

function isOverdue(task, today) {
  if (task.done) return false;
  return new Date(task.due).getTime() < today.getTime();
}

/* ========== Propuestas ========== */
const PROPOSAL_STATUS = {
  draft:       { label: "Borrador",      color: "#64748b", bg: "#eef1f5", icon: "doc" },
  sent:        { label: "Enviada",       color: "#2563eb", bg: "#e0eaff", icon: "mail" },
  viewed:      { label: "Vista",         color: "#0891b2", bg: "#dff4f9", icon: "eye" },
  negotiating: { label: "Negociando",    color: "#d97706", bg: "#fef3c7", icon: "chat" },
  signed:      { label: "Firmada",       color: "#16a34a", bg: "#e0f5e6", icon: "check" },
  rejected:    { label: "Rechazada",     color: "#dc2626", bg: "#fdecec", icon: "x" },
  expired:     { label: "Vencida",       color: "#64748b", bg: "#eef1f5", icon: "clock" }
};

function buildProposals(customerDeals, company, ws) {
  if (!customerDeals?.length) return [];
  const today = ws.today;
  const day = (n) => new Date(today.getTime() - n * 86400000);
  const props = [];

  customerDeals.forEach(d => {
    const stage = d.stage;
    if (stage === "discovery" || stage === "qualified") return; // No proposals at early stages

    const seed = (d.id || "x").split("").reduce((a, c) => a + c.charCodeAt(0), 0);
    const recipient = company.contacts?.[seed % Math.max(1, company.contacts.length)];
    const ownerName = ws.owners[d.owner]?.name || "—";

    // Always include the latest current proposal
    const baseValue = d.value;

    if (stage === "won") {
      // v1 sent → viewed → negotiating → v2 signed
      props.push({
        id: d.id + "-p1", dealId: d.id, dealName: d.name, version: 1,
        title: `Propuesta inicial — ${d.name}`,
        value: Math.round(baseValue * 1.08),  // started higher
        sentAt: day(45).toISOString(),
        viewedAt: day(44).toISOString(),
        status: "negotiating",
        replacedBy: 2,
        sentBy: ownerName,
        recipient: recipient?.name || "—",
        recipientRole: recipient?.role || "—",
        validityDays: 30,
        term: d.isRecurring ? "12 meses" : "Único pago",
        notes: "Cliente pidió descuento + extender plazo de pago a 90d."
      });
      props.push({
        id: d.id + "-p2", dealId: d.id, dealName: d.name, version: 2,
        title: `Propuesta final — ${d.name}`,
        value: baseValue,
        sentAt: day(20).toISOString(),
        viewedAt: day(19).toISOString(),
        signedAt: day(7).toISOString(),
        status: "signed",
        sentBy: ownerName,
        recipient: recipient?.name || "—",
        recipientRole: recipient?.role || "—",
        validityDays: 30,
        term: d.isRecurring ? `${[12, 18, 24][seed % 3]} meses` : "Único pago",
        notes: "Firmado vía DocuSign. Onboarding agendado."
      });
    } else if (stage === "lost") {
      props.push({
        id: d.id + "-p1", dealId: d.id, dealName: d.name, version: 1,
        title: `Propuesta — ${d.name}`,
        value: baseValue,
        sentAt: day(35).toISOString(),
        viewedAt: day(34).toISOString(),
        status: (seed % 3 === 0) ? "expired" : "rejected",
        sentBy: ownerName,
        recipient: recipient?.name || "—",
        recipientRole: recipient?.role || "—",
        validityDays: 30,
        term: d.isRecurring ? "12 meses" : "Único pago",
        notes: (seed % 3 === 0) ? "Cliente no respondió antes de la fecha de vencimiento." : "Eligieron a la competencia por precio."
      });
    } else if (stage === "negotiation") {
      // v1 sent, currently negotiating; sometimes a v2 draft
      props.push({
        id: d.id + "-p1", dealId: d.id, dealName: d.name, version: 1,
        title: `Propuesta v1 — ${d.name}`,
        value: Math.round(baseValue * 1.06),
        sentAt: day(18).toISOString(),
        viewedAt: day(17).toISOString(),
        status: "negotiating",
        sentBy: ownerName,
        recipient: recipient?.name || "—",
        recipientRole: recipient?.role || "—",
        validityDays: 30,
        term: d.isRecurring ? "12 meses" : "Único pago",
        notes: "En revisión por procurement. Pidieron 8% descuento + términos 60d."
      });
      if (seed % 2 === 0) {
        props.push({
          id: d.id + "-p2", dealId: d.id, dealName: d.name, version: 2,
          title: `Propuesta v2 — ${d.name}`,
          value: baseValue,
          sentAt: null,
          status: "draft",
          sentBy: ownerName,
          recipient: recipient?.name || "—",
          recipientRole: recipient?.role || "—",
          validityDays: 30,
          term: d.isRecurring ? "12 meses" : "Único pago",
          notes: "Ajuste con descuento aplicado + términos a 60d. Pendiente de revisión interna."
        });
      }
    } else if (stage === "proposal") {
      const isViewed = seed % 3 !== 0;
      props.push({
        id: d.id + "-p1", dealId: d.id, dealName: d.name, version: 1,
        title: `Propuesta inicial — ${d.name}`,
        value: baseValue,
        sentAt: day(6).toISOString(),
        viewedAt: isViewed ? day(5).toISOString() : null,
        status: isViewed ? "viewed" : "sent",
        sentBy: ownerName,
        recipient: recipient?.name || "—",
        recipientRole: recipient?.role || "—",
        validityDays: 30,
        term: d.isRecurring ? "12 meses" : "Único pago",
        notes: isViewed ? "Vista 4 veces · última visita ayer 18:30." : "Pendiente de apertura."
      });
    }
  });

  // Sort by sentAt desc, drafts first
  return props.sort((a, b) => {
    if (a.status === "draft" && b.status !== "draft") return -1;
    if (b.status === "draft" && a.status !== "draft") return 1;
    const at = a.sentAt ? new Date(a.sentAt).getTime() : 0;
    const bt = b.sentAt ? new Date(b.sentAt).getTime() : 0;
    return bt - at;
  });
}

function ProposalsTab({ proposals, onOpenDeal, ws }) {
  if (proposals.length === 0) {
    return (
      <div className="empty-hint" style={{ padding: 40 }}>
        Aún no se enviaron propuestas para este cliente.<br />
        Las propuestas se generan automáticamente al avanzar tratos a etapa Proposal+.
      </div>
    );
  }
  // Summary stats
  const active = proposals.filter(p => p.status === "negotiating" || p.status === "viewed" || p.status === "sent");
  const signed = proposals.filter(p => p.status === "signed");
  const lost   = proposals.filter(p => p.status === "rejected" || p.status === "expired");
  const totalSigned = signed.reduce((a, p) => a + p.value, 0);
  const totalActive = active.reduce((a, p) => a + p.value, 0);
  const totalLost   = lost.reduce((a, p) => a + p.value, 0);

  return (
    <div className="proposals-tab">
      <div className="proposals-summary">
        <div className="proposals-summary__card">
          <small>Firmadas</small>
          <b>{fmtMoney(totalSigned, true)}</b>
          <span>{signed.length} propuestas</span>
        </div>
        <div className="proposals-summary__card">
          <small>En negociación</small>
          <b>{fmtMoney(totalActive, true)}</b>
          <span>{active.length} propuestas</span>
        </div>
        <div className="proposals-summary__card">
          <small>Rechazadas / Vencidas</small>
          <b>{fmtMoney(totalLost, true)}</b>
          <span>{lost.length} propuestas</span>
        </div>
        <div className="proposals-summary__card">
          <small>Hit rate</small>
          <b>{signed.length + lost.length === 0 ? "—" : Math.round((signed.length / (signed.length + lost.length)) * 100) + "%"}</b>
          <span>firmadas / cerradas</span>
        </div>
      </div>

      <div className="proposals-list">
        {proposals.map(p => <ProposalCard key={p.id} p={p} ws={ws} onOpenDeal={onOpenDeal} />)}
      </div>
    </div>
  );
}

function ProposalCard({ p, ws, onOpenDeal }) {
  const meta = PROPOSAL_STATUS[p.status] || PROPOSAL_STATUS.draft;
  const stages = [
    { id: "draft",       label: "Borrador",   reached: !!p.id },
    { id: "sent",        label: "Enviada",    reached: !!p.sentAt },
    { id: "viewed",      label: "Vista",      reached: !!p.viewedAt },
    { id: "signed",      label: "Firmada",    reached: !!p.signedAt }
  ];
  const isRejected = p.status === "rejected" || p.status === "expired";
  return (
    <div className={`proposal-card ${isRejected ? "is-rejected" : ""}`}>
      <div className="proposal-card__head">
        <div className="proposal-card__icon" style={{ background: meta.bg, color: meta.color }}>
          <Icon name="doc" size={18} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="proposal-card__title-row">
            <span className="proposal-card__title">{p.title}</span>
            <span className="proposal-card__version">v{p.version}</span>
            <span className="proposal-card__status" style={{ color: meta.color, background: meta.bg, borderColor: meta.color }}>
              <Icon name={meta.icon} size={10} />
              {meta.label}
            </span>
            {p.replacedBy && (
              <span className="chip" style={{ fontSize: 9, padding: "1px 5px" }}>reemplazada por v{p.replacedBy}</span>
            )}
          </div>
          <div className="proposal-card__sub">
            <span><Icon name="dollar" size={10} /> {fmtMoney(p.value, true)}</span>
            <span>· {p.term}</span>
            <span>· <span style={{ color: "var(--accent)", cursor: "pointer" }} onClick={() => onOpenDeal?.(p.dealId)}>{p.dealName}</span></span>
          </div>
        </div>
        <div className="proposal-card__actions">
          <button title="Ver propuesta"><Icon name="eye" size={13} /></button>
          <button title="Descargar PDF"><Icon name="download" size={13} /></button>
          {p.status !== "signed" && p.status !== "rejected" && p.status !== "expired" && (
            <button title="Reenviar" className="is-primary"><Icon name="mail" size={13} /></button>
          )}
        </div>
      </div>

      {/* Status pipeline */}
      <div className="proposal-card__timeline">
        {stages.map((s, i) => {
          const isReached = isRejected ? (i <= 2 && s.reached) : s.reached;
          return (
            <React.Fragment key={s.id}>
              <div className={`prop-step ${isReached ? "is-done" : ""} ${isRejected && i === 3 ? "is-blocked" : ""}`}>
                <span className="prop-step__dot" />
                <span className="prop-step__label">{s.label}</span>
                {s.id === "sent" && p.sentAt && <span className="prop-step__when">{fmtDate(p.sentAt, { format: "short" })}</span>}
                {s.id === "viewed" && p.viewedAt && <span className="prop-step__when">{fmtDate(p.viewedAt, { format: "short" })}</span>}
                {s.id === "signed" && p.signedAt && <span className="prop-step__when">{fmtDate(p.signedAt, { format: "short" })}</span>}
              </div>
              {i < stages.length - 1 && <div className={`prop-line ${stages[i + 1].reached && !isRejected ? "is-done" : ""} ${isRejected && i === 2 ? "is-blocked" : ""}`} />}
            </React.Fragment>
          );
        })}
      </div>

      {/* Footer */}
      <div className="proposal-card__foot">
        <div className="proposal-card__foot-col">
          <small>Enviado por</small>
          <span>{p.sentBy}</span>
        </div>
        <div className="proposal-card__foot-col">
          <small>Destinatario</small>
          <span>{p.recipient} · {p.recipientRole}</span>
        </div>
        <div className="proposal-card__foot-col">
          <small>Validez</small>
          <span>{p.sentAt ? fmtDate(new Date(new Date(p.sentAt).getTime() + p.validityDays * 86400000), { format: "short" }) : "—"}</span>
        </div>
        {p.notes && (
          <div className="proposal-card__notes">
            <Icon name="note" size={10} />
            {p.notes}
          </div>
        )}
      </div>
    </div>
  );
}

function buildTasks(companyName, ws, ownerObj) {
  const today = ws.today;
  const day = (n) => new Date(today.getTime() + n * 86400000).toISOString();
  const owner = ownerObj?.name?.split(" ").map(s => s[0]).slice(0, 2).join("") || "—";
  return [
    { id: "ts1", title: `Enviar caso de éxito + referencias a ${companyName}`, kind: "follow-up", due: day(-2), byInitials: owner, done: false },
    { id: "ts2", title: "Confirmar reunión técnica con CTO", kind: "meeting", due: day(1), byInitials: owner, done: false },
    { id: "ts3", title: "Revisar contrato con Legal antes del envío", kind: "internal", due: day(3), byInitials: "JL", done: false },
    { id: "ts4", title: "Propuesta v3 enviada", kind: "send-proposal", due: day(-5), byInitials: owner, done: true },
    { id: "ts5", title: "Discovery técnica completada", kind: "meeting", due: day(-12), byInitials: owner, done: true },
    { id: "ts6", title: "Preparar deck para reunión board", kind: "internal", due: day(7), byInitials: owner, done: false }
  ];
}

function buildNotes(company) {
  const notes = [];
  (company.timeline || []).forEach(day => {
    day.events.forEach(ev => {
      if (ev.type === "note" || ev.type === "ai") {
        notes.push({
          kind: ev.type === "ai" ? "ai" : "note",
          by: ev.who,
          at: `${day.day.replace(/^\D+/, "")} · ${ev.at}`,
          text: ev.text,
          tags: ev.type === "ai" ? ["meeting-recap", "auto"] : null
        });
      }
    });
  });
  // Synthesize one or two extra
  notes.push({
    kind: "note",
    by: "María Paz",
    at: "5 May 2026 · 11:00",
    text: `Cliente con buena tracción interna — Lucía (VP Data) está empujando el caso desde adentro. Mantener cadencia semanal y preparar opciones de pricing para escalar más tarde.`,
    tags: ["pricing", "champion"]
  });
  return notes;
}

function synthCompany(c, ws, workspace) {
  if (!c) return { name: "—", contacts: [], timeline: [] };
  const firstDeal = c.deals[0];
  const today = ws.today;
  const day = (n) => new Date(today.getTime() - n * 86400000);

  // Build deterministic stakeholders based on company name
  const seed = c.name.split("").reduce((a, ch) => a + ch.charCodeAt(0), 0);
  const firstNames = ["Sofía", "Lucía", "Diego", "Martín", "Federico", "Carolina", "Joaquín", "Valentina", "Mariano", "Camila", "Tomás", "Agustina"];
  const lastNames  = ["Martínez", "García", "Rodríguez", "López", "Fernández", "Sánchez", "Quiroga", "Ferreyra", "Vélez", "Cabrera"];
  const pick = (arr, off) => arr[(seed + off) % arr.length];
  const slug = c.name.toLowerCase().replace(/\s+/g, "").replace(/[^a-z0-9]/g, "");
  const isEnterprise = c.totalValue > 300000;
  const baseContacts = [
    { name: `${pick(firstNames, 0)} ${pick(lastNames, 1)}`, role: isEnterprise ? "CTO" : "Head of Operations", email: `${pick(firstNames, 0).toLowerCase()}@${slug}.com`, phone: "+54 11 5555-" + (1000 + seed % 9000) },
    { name: `${pick(firstNames, 3)} ${pick(lastNames, 4)}`, role: isEnterprise ? "VP Engineering" : "Head of Growth", email: `${pick(firstNames, 3).toLowerCase()}@${slug}.com`, phone: "+54 11 5555-" + (2000 + seed % 8000) },
    { name: `${pick(firstNames, 6)} ${pick(lastNames, 7)}`, role: "Procurement Lead", email: `procurement@${slug}.com`, phone: "+54 11 5555-" + (3000 + seed % 7000) }
  ];
  if (isEnterprise) {
    baseContacts.unshift({ name: `${pick(firstNames, 9)} ${pick(lastNames, 2)}`, role: "CEO", email: `${pick(firstNames, 9).toLowerCase()}@${slug}.com`, phone: "+54 11 5555-" + (4000 + seed % 6000) });
  }

  // Build a richer timeline from this customer's deals
  const ownerName = ws.owners[firstDeal?.owner]?.name || "—";
  const dealName = firstDeal?.name || "trato";
  const tl = [];
  tl.push({ day: "Hoy · " + fmtDate(today, { format: "long" }), events: [
    { type: "ai",   text: `AI Score actualizado por engagement reciente y patrón de respuesta de ${baseContacts[0].name.split(" ")[0]}.`, who: "AI", at: "09:12" },
    { type: "wa",   text: `${baseContacts[0].name.split(" ")[0]} confirmó la próxima reunión.`, who: baseContacts[0].name, at: "10:30" }
  ]});
  tl.push({ day: "Ayer · " + fmtDate(day(1), { format: "long" }), events: [
    { type: "email", text: `Propuesta v${(seed % 3) + 1} enviada — ${dealName}, ${fmtMoney(firstDeal?.value || 0)} · plazo ${[6, 12, 18, 24][seed % 4]} meses.`, who: ownerName, at: "16:42" },
    { type: "note",  text: `Nota IA del meeting: dolor principal mencionado fue tiempo de respuesta. ${baseContacts[1].name.split(" ")[0]} pidió referencias de clientes en el mismo vertical.`, who: "AI · Meeting recap", at: "14:55" }
  ]});
  tl.push({ day: fmtDate(day(3), { format: "long" }), events: [
    { type: "call", text: `Discovery técnica · 38 min con ${baseContacts[0].name}. Identificamos 3 stakeholders adicionales en el comité de decisión.`, who: baseContacts[0].name, at: "11:20" }
  ]});
  tl.push({ day: fmtDate(day(7), { format: "long" }), events: [
    { type: "wa",   text: `${baseContacts[2]?.name.split(" ")[0] || "Procurement"} pidió términos de pago a 90 días y un descuento por compromiso anual.`, who: baseContacts[2]?.name || "—", at: "15:08" },
    { type: "deal", text: `Trato avanzó: ${stageLabel(firstDeal?.stage) || "—"}. Probabilidad IA recalculada.`, who: ownerName, at: "10:00" }
  ]});
  tl.push({ day: fmtDate(day(14), { format: "long" }), events: [
    { type: "task", text: `Tarea creada: preparar caso comparativo vs competidor directo antes de la próxima reunión.`, who: ownerName, at: "09:15" }
  ]});
  tl.push({ day: fmtDate(day(22), { format: "long" }), events: [
    { type: "email", text: `Primer contacto inbound — ${baseContacts[1].name.split(" ")[0]} llegó vía LinkedIn pidiendo demo del producto.`, who: baseContacts[1].name, at: "13:00" }
  ]});

  return {
    id: "CUS-" + slug.slice(0, 6).toUpperCase(),
    name: c.name,
    industry: isEnterprise ? "Enterprise · LATAM" : (workspace === "novit" ? "Tech · LATAM" : "Growth · LATAM"),
    logo: c.name.split(" ").map(s => s[0]).slice(0, 2).join(""),
    website: slug + ".com",
    employees: isEnterprise ? "500+" : (workspace === "novit" ? "120+" : "60+"),
    tier: c.totalValue > 400000 ? "Strategic" : "Growth",
    arr: c.arr,
    mrr: Math.round(c.arr / 12),
    churnRisk: c.won > 0 ? "Low" : "—",
    nps: 50 + (seed % 30),
    aiScore: Math.min(94, 55 + Math.round(c.totalValue / 18000)),
    owner: firstDeal?.owner,
    contacts: baseContacts,
    timeline: tl
  };
}

window.CustomerView = CustomerView;
