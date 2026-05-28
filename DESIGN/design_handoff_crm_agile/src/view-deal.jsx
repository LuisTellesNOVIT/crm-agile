// Deal Detail view — 360° de la oportunidad
function DealDetailView({ ws, workspace, dealId, onBack, onNavigate, onOpenAI, onUpdateDeal, onOpenCustomer }) {
  const deal = ws.deals.find(d => d.id === dealId);
  if (!deal) return <div className="empty-hint">Trato no encontrado.</div>;

  const owner = ws.owners[deal.owner];
  const allStages = window.CRM_DATA.stages;
  const stages = allStages.filter(s => s.id !== "lost");
  const lostStage = allStages.find(s => s.id === "lost");
  const currentIdx = stages.findIndex(s => s.id === deal.stage);
  const isLost = deal.stage === "lost";
  const featuredCust = window.CRM_RICH.featured[workspace];
  const isFeatured = deal.company === featuredCust.name;

  const [tab, setTab] = useState("overview");
  const [composer, setComposer] = useState(null); // null | "wa" | "email"
  const [showSetup, setShowSetup] = useState(false);

  // Derived data
  const daysOpen = Math.max(1, daysBetween(deal.createdAt, ws.today));
  const daysToClose = daysBetween(ws.today, deal.estimatedCloseAt);
  const forecastValue = Math.round(deal.value * deal.probability);

  // AI recommendations per deal (computed)
  const recs = useMemo(() => {
    const r = [];
    if (deal.ai >= 75) {
      r.push({
        sev: "high", color: "var(--success)", icon: "trending",
        title: "Cerrar esta semana",
        body: `AI Score muy alto (${deal.ai}%) y engagement reciente. Sugerencia: enviar versión final del contrato y pedir fecha de firma.`,
        cta: "Generar contrato"
      });
    }
    if (deal.ai < 45 && deal.stage !== "won") {
      r.push({
        sev: "warn", color: "var(--danger)", icon: "alert",
        title: "Riesgo de pérdida",
        body: `AI Score bajo (${deal.ai}%). Considerá involucrar un Senior AE o re-calificar el lead. ${daysOpen}d sin progreso.`,
        cta: "Re-asignar"
      });
    }
    if (daysOpen > 30 && deal.stage !== "won") {
      r.push({
        sev: "warn", color: "var(--warning)", icon: "clock",
        title: `Stalling en ${stageLabel(deal.stage)}`,
        body: `${daysOpen} días desde creación. Promedio histórico en esta etapa: 18 días. Activá secuencia de re-engagement.`,
        cta: "Iniciar secuencia"
      });
    }
    if (deal.contacts < 2) {
      r.push({
        sev: "info", color: "var(--accent)", icon: "users",
        title: "Pocos stakeholders",
        body: `Solo ${deal.contacts} contacto${deal.contacts === 1 ? "" : "s"} activo${deal.contacts === 1 ? "" : "s"}. Los tratos con 3+ stakeholders cierran 2.4× más rápido.`,
        cta: "Pedir intro"
      });
    }
    if (deal.isRecurring) {
      r.push({
        sev: "info", color: "var(--info)", icon: "dollar",
        title: "Oportunidad de upsell",
        body: `Cliente recurrente con ARR ${fmtMoney(deal.arr, true)}. Match alto (84%) con módulos de analytics/integraciones.`,
        cta: "Ver upsells"
      });
    }
    if (r.length === 0) {
      r.push({
        sev: "info", color: "var(--accent)", icon: "sparkles",
        title: "Sin alertas activas",
        body: "El trato evoluciona dentro de los parámetros esperados.",
        cta: null
      });
    }
    return r;
  }, [deal.id]);

  // Live count for the Archivos tab — reads from the shared store maintained by DealFilesPanel
  const filesCount = (window.__dealFiles && window.__dealFiles[deal.id]?.length) ?? 5;
  const history = useMemo(() => {
    const h = [];
    const today = ws.today;
    for (let i = 0; i <= currentIdx; i++) {
      const offset = Math.round((daysOpen / (currentIdx + 1)) * (currentIdx - i));
      const d = addDays(today, -offset);
      h.unshift({ stage: stages[i], at: d, byOwner: owner?.name });
    }
    return h;
  }, [deal.id]);

  // Synthesize timeline (deal-specific)
  const timeline = useMemo(() => buildDealTimeline(deal, ws, owner), [deal.id, workspace]);

  // Synthesize contacts (use featured if matches, otherwise generate)
  const contacts = useMemo(() => {
    if (isFeatured) return featuredCust.contacts;
    return generateContactsForCompany(deal.company, deal.contacts);
  }, [deal.id]);

  return (
    <div className="deal-detail" data-screen-label="Deal 360">
      <div className="deal-detail__main">
        <div className="deal-detail__back" onClick={onBack}>
          <Icon name="arrow-right" size={12} style={{ transform: "rotate(180deg)" }} />
          <span>Volver a {VIEWS.find(v => v.id === (window.__lastView || "pipeline")).label}</span>
          <span style={{ marginLeft: "auto" }}>{deal.id}</span>
        </div>

        <div className="deal-hero">
          <div className="deal-hero__top">
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="deal-hero__id">Trato · {stageLabel(deal.stage)}</div>
              <h1>{deal.name}</h1>
              <div className="deal-hero__co">
                <span className="cust__logo" style={{ width: 22, height: 22, fontSize: 11, borderRadius: 5 }}>
                  {deal.company.split(" ").map(s => s[0]).slice(0, 2).join("")}
                </span>
                <a className="deal-hero__co-link" onClick={() => onOpenCustomer?.(deal.company)}>{deal.company}</a>
                {isFeatured && <span className="chip chip--accent" style={{ fontSize: 9 }}>360 disponible</span>}
                {deal.isRecurring && <span className="chip">SaaS · ARR {fmtMoney(deal.arr, true)}</span>}
                <span style={{ color: "var(--fg-4)" }}>·</span>
                <span className="muted">Owner: <b style={{ color: "var(--fg-2)" }}>{owner?.name || "—"}</b></span>
              </div>
            </div>
            <div className="deal-hero__actions">
              <button className="btn" onClick={() => setComposer("wa")} title="Enviar WhatsApp"><Icon name="wa" size={13} /></button>
              <button className="btn" onClick={() => setComposer("email")} title="Enviar email"><Icon name="mail" size={13} /></button>
              <button className="btn"><Icon name="calendar" size={13} /> Agendar</button>
              <button className="btn btn--accent" onClick={onOpenAI}>
                <Icon name="sparkles" size={13} /> Pedir informe IA
              </button>
              <button className="btn btn--icon"><Icon name="more" size={14} /></button>
            </div>
          </div>

          <div className="deal-stats">
            <div className="deal-stat">
              <small>Valor</small>
              <b>{fmtMoney(deal.value, true)}</b>
            </div>
            <div className="deal-stat">
              <small>AI Score</small>
              <b style={{ color: "var(--accent)" }}>{deal.ai}%</b>
            </div>
            <div className="deal-stat">
              <small>Forecast ponderado</small>
              <b>{fmtMoney(forecastValue, true)}</b>
            </div>
            <div className="deal-stat">
              <small>Días abierto</small>
              <b>{daysOpen}d</b>
            </div>
            <div className="deal-stat">
              <small>Cierre estimado</small>
              <b>{fmtDate(deal.estimatedCloseAt, { format: "short" })}</b>
            </div>
            <div className="deal-stat">
              <small>{daysToClose > 0 ? "En" : "Vencido"}</small>
              <b style={{ color: daysToClose < 0 ? "var(--danger)" : daysToClose < 7 ? "var(--warning)" : "var(--fg)" }}>
                {Math.abs(daysToClose)}d
              </b>
            </div>
          </div>

          <div className="stage-progress">
            {stages.map((s, i) => {
              const cls = !isLost && i < currentIdx ? "is-past" : (!isLost && i === currentIdx ? "is-current" : "");
              return (
                <div
                  key={s.id}
                  className={`stage-progress__step is-clickable ${cls}`}
                  onClick={() => onUpdateDeal?.(deal.id, { stage: s.id })}
                  title={`Mover a ${s.label}`}
                >
                  {s.label}
                </div>
              );
            })}
            <div
              className={`stage-progress__step stage-progress__step--lost is-clickable ${isLost ? "is-current-lost" : ""}`}
              onClick={() => onUpdateDeal?.(deal.id, { stage: "lost" })}
              title="Marcar como Closed Lost"
            >
              <Icon name="x" size={11} style={{ marginRight: 4, verticalAlign: "-1px" }} />
              {lostStage?.label || "Closed Lost"}
            </div>
          </div>
        </div>

        <div className="deal-detail__tabs">
          {[
            { id: "overview", l: "Resumen" },
            { id: "timeline", l: "Timeline · " + timeline.totalEvents },
            { id: "whatsapp", l: "WhatsApp", icon: "wa" },
            { id: "contacts", l: "Contactos · " + contacts.length },
            { id: "files", l: "Archivos · " + filesCount },
            { id: "notes", l: "Notas" }
          ].map(t => (
            <div key={t.id} className={`tab ${tab === t.id ? "is-active" : ""}`} onClick={() => setTab(t.id)}>
              {t.icon && <Icon name={t.icon} size={11} style={{ marginRight: 4, color: "#25D366", verticalAlign: "-1px" }} />}
              {t.l}
            </div>
          ))}
        </div>

        <div className="deal-detail__body">
          {tab === "overview" && (
            <>
              <div className="deal-section">
                <div className="deal-section__h">
                  <Icon name="database" size={12} />
                  Datos del trato
                  <span style={{ marginLeft: "auto", fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--fg-4)" }}>
                    Workspace · {workspace}.deals.{deal.id}
                  </span>
                </div>
                <DealFields deal={deal} workspace={workspace} owner={owner} ws={ws} contacts={contacts} />
              </div>

              <div className="deal-section">
                <div className="deal-section__h">
                  <Icon name="sparkles" size={12} />
                  Próximas acciones sugeridas por IA
                </div>
                <div className="next-actions">
                  {nextActions(deal, daysOpen, daysToClose).map((a, i) => (
                    <div key={i} className="next-action">
                      <div className="next-action__icon"><Icon name={a.icon} size={14} /></div>
                      <div>
                        <div className="next-action__title">{a.title}</div>
                        <div className="next-action__sub">{a.body}</div>
                      </div>
                      <button className="btn btn--ghost">{a.cta || "Hacer"}</button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="deal-section">
                <div className="deal-section__h">
                  <Icon name="users" size={12} />
                  Stakeholders ({contacts.length})
                </div>
                <div className="contacts-grid">
                  {contacts.map((c, i) => (
                    <div key={i} className="contact-card">
                      <div className="top">
                        <div className="avatar" style={{ background: ownerColor(i) }}>
                          {c.name.split(" ").map(s => s[0]).slice(0, 2).join("")}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div className="name">{c.name}</div>
                          <div className="role">{c.role}</div>
                        </div>
                      </div>
                      <div className="meta">
                        <span><Icon name="mail" size={10} /> 12</span>
                        <span><Icon name="wa" size={10} /> {i + 3}</span>
                        <span className="sentiment" style={{ color: i === 0 ? "var(--success)" : i === 1 ? "var(--warning)" : "var(--fg-2)" }}>
                          <span className="dot" style={{ background: "currentColor", width: 6, height: 6 }} />
                          {i === 0 ? "Campeón" : i === 1 ? "Neutral" : "Bloqueador"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="deal-section">
                <div className="deal-section__h">
                  <Icon name="note" size={12} />
                  Resumen ejecutivo (generado por IA)
                </div>
                <div style={{
                  background: "linear-gradient(135deg, var(--bg) 0%, var(--accent-soft) 100%)",
                  border: "1px solid var(--accent-border)",
                  borderRadius: "var(--radius)",
                  padding: "14px 16px",
                  fontSize: 13,
                  lineHeight: 1.6,
                  color: "var(--fg-2)"
                }}>
                  {executiveSummary(deal, daysOpen, daysToClose, workspace)}
                </div>
              </div>
            </>
          )}

          {tab === "timeline" && (
            <div className="tl" style={{ paddingLeft: 32 }}>
              {timeline.days.map(day => (
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
                        <div className="tl__item-body">{ev.text}</div>
                      </div>
                    );
                  })}
                </React.Fragment>
              ))}
            </div>
          )}

          {tab === "whatsapp" && (
            <DealWhatsAppThread
              deal={deal}
              ws={ws}
              workspace={workspace}
              owner={owner}
              contacts={contacts}
              onCompose={(ch) => setComposer(ch)}
              onSetup={() => setShowSetup(true)}
            />
          )}

          {tab === "contacts" && (
            <div className="contacts-grid">
              {contacts.map((c, i) => (
                <div key={i} className="contact-card">
                  <div className="top">
                    <div className="avatar" style={{ background: ownerColor(i) }}>
                      {c.name.split(" ").map(s => s[0]).slice(0, 2).join("")}
                    </div>
                    <div>
                      <div className="name">{c.name}</div>
                      <div className="role">{c.role}</div>
                    </div>
                  </div>
                  <div style={{ fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--fg-3)" }}>{c.email}</div>
                  <div className="meta">
                    <button className="btn" style={{ flex: 1, justifyContent: "center" }}><Icon name="wa" size={12} /></button>
                    <button className="btn" style={{ flex: 1, justifyContent: "center" }}><Icon name="mail" size={12} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === "files" && (
            <DealFilesPanel deal={deal} ws={ws} />
          )}

          {tab === "notes" && (
            <div className="card" style={{ padding: 16 }}>
              <div style={{ fontSize: 13, lineHeight: 1.6, color: "var(--fg-2)" }}>
                <p style={{ marginTop: 0 }}><b>Discovery call · {fmtDate(addDays(ws.today, -daysOpen + 2), { format: "short" })}</b></p>
                <p>El cliente mencionó como dolor principal la fragmentación de datos entre 4 sistemas. Equipo de plataforma está sobrecargado. Decisión recae en CTO + VP Eng + Finance.</p>
                <p><b>Pricing call · {fmtDate(addDays(ws.today, -Math.floor(daysOpen / 2)), { format: "short" })}</b></p>
                <p>Procurement pidió descuento de 8%. Negociamos hasta 5% con commitment de 18 meses. Aceptaron explorar.</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right rail */}
      <aside className="deal-detail__side">
        <div className="ai-score-card">
          <div className="top">
            <Icon name="sparkles" size={12} />
            <span>AI Score · {deal.ai}%</span>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <span className="big">{deal.ai}%</span>
            <span className={`chip ${deal.ai > 60 ? "chip--success" : deal.ai > 40 ? "chip--warn" : "chip--danger"}`} style={{ marginLeft: "auto" }}>
              {deal.ai > 60 ? "↑ Confiable" : deal.ai > 40 ? "→ Vigilar" : "↓ En riesgo"}
            </span>
          </div>
          <div className="meter"><div style={{ width: deal.ai + "%" }} /></div>
          <div className="factors">
            <div>Tamaño cuenta <b>+{Math.min(28, Math.round(deal.value / 20000))}</b></div>
            <div>Engagement reciente <b style={{ color: deal.ai > 60 ? "var(--success)" : "var(--warning)" }}>{deal.ai > 60 ? "+22" : "+8"}</b></div>
            <div>Tiempo en etapa <b style={{ color: daysOpen > 30 ? "var(--warning)" : "var(--success)" }}>{daysOpen > 30 ? "−14" : "+6"}</b></div>
            <div>Stakeholders activos <b>+{deal.contacts * 6}</b></div>
            <div>Industria fit <b>+12</b></div>
          </div>
        </div>

        <div className="cust__side-card">
          <h4>Recomendaciones IA<span style={{ marginLeft: "auto", fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-3)" }}>{recs.length}</span></h4>
          <div style={{ padding: 4 }}>
            <div className="ai-recs">
              {recs.map((r, i) => (
                <div key={i} className="ai-rec" style={{ "--rec-color": r.color }}>
                  <div className="ai-rec__icon">
                    <Icon name={r.icon} size={13} />
                  </div>
                  <div>
                    <div className="ai-rec__title">{r.title}</div>
                    <div className="ai-rec__body">{r.body}</div>
                    {r.cta && <div className="ai-rec__cta">{r.cta} <Icon name="arrow-right" size={9} /></div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="cust__side-card">
          <h4>Historial de etapas</h4>
          <div className="history-list">
            {history.map((h, i) => (
              <div key={i} className="history-item">
                <span className="dot" style={{ background: h.stage.color }} />
                <span className="lbl">{h.stage.label}</span>
                <span className="when">{fmtDate(h.at, { format: "short" })}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="cust__side-card">
          <h4>Atributos custom<span className="add"><Icon name="plus" size={12} /></span></h4>
          <div className="attr-row"><span className="k">Fuente</span><span className="v"><span className="chip">{["Referido","LinkedIn","Web","FB Ads"][Math.abs(deal.id.charCodeAt(deal.id.length-1)) % 4]}</span></span></div>
          <div className="attr-row"><span className="k">Vertical</span><span className="v"><span className="chip">{deal.company.includes("Banco") ? "Banca" : deal.company.includes("YPF") || deal.company.includes("Pampa") ? "Energía" : "Tech"}</span></span></div>
          <div className="attr-row"><span className="k">Es renovación</span><span className="v">{deal.isRecurring ? "Sí" : "No"}</span></div>
          <div className="attr-row"><span className="k">Procurement</span><span className="v">60d net</span></div>
          <div className="attr-row"><span className="k">Competencia</span><span className="v">Accenture · IBM</span></div>
        </div>
      </aside>

      {composer && (
        <DealComposer
          deal={deal}
          ws={ws}
          workspace={workspace}
          owner={owner}
          contacts={contacts}
          initialChannel={composer}
          onClose={() => setComposer(null)}
        />
      )}
      {showSetup && (
        <ChannelSetupModal
          initialChannel={composer || "wa"}
          onClose={() => setShowSetup(false)}
        />
      )}
    </div>
  );
}

// ─── Helpers ───────────────────────────────────────────────
function ownerColor(i) {
  const colors = [
    "linear-gradient(135deg, #93c5fd, #2563eb)",
    "linear-gradient(135deg, #fbbf24, #ea580c)",
    "linear-gradient(135deg, #c4b5fd, #8b5cf6)",
    "linear-gradient(135deg, #6ee7b7, #059669)"
  ];
  return colors[i % colors.length];
}

function generateContactsForCompany(company, n) {
  const first = ["Lucía","Diego","Paula","Mariana","Andrés","Camila","Federico","Sofía","Tomás","Valentina","Joaquín","Renata"];
  const last  = ["Pereyra","González","Romero","Suárez","Klein","Méndez","Aguirre","Fernández","Torres","Vidal","Quiroga","Castro"];
  const roles = ["CTO","VP Eng","Head of Data","Procurement","CFO","COO","Director IT"];
  const arr = [];
  const seed = company.length;
  for (let i = 0; i < Math.max(2, Math.min(4, n)); i++) {
    arr.push({
      name: first[(seed + i * 3) % first.length] + " " + last[(seed + i * 5) % last.length],
      role: roles[(seed + i) % roles.length],
      email: first[(seed + i * 3) % first.length].toLowerCase() + "@" + company.toLowerCase().replace(/[^a-z]/g, "") + ".com"
    });
  }
  return arr;
}

function buildDealTimeline(deal, ws, owner) {
  const days = [];
  const today = ws.today;
  const ownerName = owner?.name || "Owner";
  const co = deal.company;

  days.push({
    day: "Hoy · " + fmtDate(today, { format: "long" }),
    events: [
      { type: "ai", text: `AI Score actualizado: ${deal.ai}%. ${deal.ai > 70 ? "Confianza alta." : "Vigilar engagement."}`, who: "AI Engine", at: "08:00" },
      { type: "wa", text: `${ownerName} envió follow-up con materiales adicionales.`, who: ownerName, at: "10:24" }
    ]
  });
  days.push({
    day: "Ayer · " + fmtDate(addDays(today, -1), { format: "long" }),
    events: [
      { type: "email", text: `Propuesta enviada · ${fmtMoney(deal.value, true)} · ${deal.name}`, who: ownerName, at: "16:42" },
      { type: "note", text: `Nota IA del meeting: el cliente mencionó interés en la fase 2 si los KPIs se cumplen en 90 días.`, who: "AI · Meeting recap", at: "15:00" }
    ]
  });
  days.push({
    day: fmtDate(addDays(today, -3), { format: "long" }),
    events: [
      { type: "call", text: `Llamada · 42min · revisión de alcance con ${co}. Recording disponible.`, who: ownerName, at: "11:00" }
    ]
  });
  days.push({
    day: fmtDate(addDays(today, -7), { format: "long" }),
    events: [
      { type: "wa", text: `Mensaje entrante: pidieron 2 referencias del mismo vertical.`, who: co, at: "14:33" },
      { type: "deal", text: `Trato avanzó a ${stageLabel(deal.stage)}. Valor estimado actualizado.`, who: ownerName, at: "10:15" }
    ]
  });
  days.push({
    day: fmtDate(deal.createdAt, { format: "long" }),
    events: [
      { type: "deal", text: `Trato creado · ${deal.name} · valor inicial ${fmtMoney(deal.value, true)}`, who: ownerName, at: "09:00" }
    ]
  });

  return { days, totalEvents: days.reduce((acc, d) => acc + d.events.length, 0) };
}

function nextActions(deal, daysOpen, daysToClose) {
  const out = [];
  if (deal.ai >= 75) {
    out.push({ icon: "doc", title: "Generar y enviar contrato", body: "El AI Score sugiere alta probabilidad de cierre — bloqueá el SOW.", cta: "Generar PDF" });
  }
  out.push({ icon: "calendar", title: "Agendar reunión de cierre", body: `Cierre estimado en ${daysToClose}d. Slot recomendado: martes 10:00.`, cta: "Agendar" });
  if (deal.contacts < 2) {
    out.push({ icon: "users", title: "Pedir intro al CFO/Procurement", body: "Solo hay 1 stakeholder activo — pedile al campeón un intro al área financiera.", cta: "Plantilla" });
  } else {
    out.push({ icon: "wa", title: "Follow-up al champion", body: "Mandá nudge por WhatsApp con caso similar reciente.", cta: "Enviar WA" });
  }
  return out.slice(0, 3);
}

function executiveSummary(deal, daysOpen, daysToClose, workspace) {
  const wsName = workspace === "novit" ? "NOVIT" : "SHARKY";
  const conf = deal.ai > 70 ? "alta" : deal.ai > 50 ? "media" : "baja";
  return (
    <>
      <b>{deal.name}</b> con <b>{deal.company}</b> está en etapa <b>{stageLabel(deal.stage).toLowerCase()}</b>{" "}
      con valor de <b>{fmtMoney(deal.value)}</b> y probabilidad IA del <b>{deal.ai}%</b> ({conf} confianza).
      Lleva <b>{daysOpen} días abierto</b>; cierre estimado en <b>{daysToClose} días</b>.{" "}
      {deal.isRecurring && <>Tiene componente recurrente de <b>{fmtMoney(deal.arr)}/año</b>. </>}
      {deal.ai > 70
        ? <>El equipo de IA recomienda <b>acelerar el cierre</b> esta semana enviando contrato y agendando llamada de firma.</>
        : deal.ai < 45
          ? <>Hay <b>señales de riesgo</b> — considerá involucrar a un Senior AE o re-calificar el lead.</>
          : <>El trato avanza dentro de los parámetros normales para {wsName}.</>}
    </>
  );
}

window.DealDetailView = DealDetailView;

/* ===== DealFields — editable grid of all deal fields (Prisma model) ===== */
function DealFields({ deal, workspace, owner, ws, contacts }) {
  // Auto-detect inferred vertical and source for display
  const inferredSource = ["Referido", "LinkedIn", "Web", "FB Ads"][Math.abs(deal.id.charCodeAt(deal.id.length - 1)) % 4];
  const inferredVertical = deal.company.includes("Banco") ? "Banca"
    : (deal.company.includes("YPF") || deal.company.includes("Pampa") || deal.company.includes("TGS")) ? "Energía"
    : deal.company.includes("Mercado") ? "E-commerce"
    : deal.company.includes("Arcor") || deal.company.includes("Bagley") || deal.company.includes("Andes") ? "CPG"
    : "Tech";

  const fields = [
    { group: "Identidad", rows: [
      { l: "ID",             v: deal.id,              type: "mono", readOnly: true },
      { l: "Workspace",      v: workspace.toUpperCase(), type: "mono", readOnly: true },
      { l: "Nombre",         v: deal.name,            type: "text" },
      { l: "Compañía",       v: deal.company,         type: "record" },
      { l: "Owner",          v: owner?.name || "—",   type: "user" }
    ]},
    { group: "Valor & forecast", rows: [
      { l: "Valor",                 v: fmtMoney(deal.value), type: "currency" },
      { l: "Etapa",                 v: stageLabel(deal.stage), type: "select", color: stageColor(deal.stage) },
      { l: "AI Probability",        v: deal.ai + "%",        type: "ai" },
      { l: "Forecast ponderado",    v: fmtMoney(Math.round(deal.value * deal.probability)), type: "currency", readOnly: true },
      { l: "Fecha cierre estimada", v: fmtDate(deal.estimatedCloseAt, { format: "long" }), type: "date" },
      { l: "Creado",                v: fmtDate(deal.createdAt, { format: "long" }), type: "date", readOnly: true }
    ]},
    { group: "Modelo de negocio", rows: [
      { l: "Es recurrente (SaaS)",  v: deal.isRecurring ? "Sí" : "No", type: "boolean" },
      { l: "ARR anual",             v: deal.arr ? fmtMoney(deal.arr) : "—",  type: "currency", readOnly: !deal.isRecurring },
      { l: "MRR mensual",           v: deal.arr ? fmtMoney(Math.round(deal.arr / 12)) : "—", type: "currency", readOnly: true }
    ]},
    { group: "Atributos custom", rows: [
      { l: "Fuente",                v: inferredSource,    type: "select" },
      { l: "Vertical",              v: inferredVertical,  type: "select" },
      { l: "Stakeholders activos",  v: contacts.length,   type: "number" },
      { l: "Competencia",           v: "Accenture · IBM", type: "multi-select" },
      { l: "Procurement",           v: "60d net",         type: "text" }
    ]}
  ];

  return (
    <div style={{
      background: "var(--bg)",
      border: "1px solid var(--border)",
      borderRadius: "var(--radius)",
      overflow: "hidden"
    }}>
      {fields.map((grp, gi) => (
        <React.Fragment key={grp.group}>
          <div style={{
            padding: "6px 12px",
            background: "var(--bg-2)",
            borderBottom: "1px solid var(--border-2)",
            borderTop: gi > 0 ? "1px solid var(--border-2)" : "none",
            fontSize: 10,
            fontFamily: "var(--font-mono)",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            color: "var(--fg-3)"
          }}>
            {grp.group}
          </div>
          {grp.rows.map((f, i) => (
            <div key={i} style={{
              display: "grid",
              gridTemplateColumns: "180px 22px 1fr 22px",
              alignItems: "center",
              padding: "7px 12px",
              borderBottom: i < grp.rows.length - 1 ? "1px solid var(--border-2)" : "none",
              fontSize: 13,
              gap: 10
            }}>
              <span style={{ color: "var(--fg-3)", display: "flex", alignItems: "center", gap: 6 }}>
                <FieldTypeBadge type={f.type} />
                <span>{f.l}</span>
              </span>
              <span></span>
              <DealFieldValue f={f} />
              {!f.readOnly && (
                <Icon name="settings" size={12} style={{ color: "var(--fg-4)", cursor: "pointer", justifySelf: "end" }} />
              )}
            </div>
          ))}
        </React.Fragment>
      ))}
    </div>
  );
}

function FieldTypeBadge({ type }) {
  const map = {
    text:         { color: "#64748b" },
    mono:         { color: "#64748b" },
    record:       { color: "#8b5cf6" },
    user:         { color: "#2563eb" },
    currency:     { color: "#16a34a" },
    select:       { color: "#0891b2" },
    "multi-select": { color: "#0891b2" },
    ai:           { color: "#8b5cf6" },
    date:         { color: "#ea580c" },
    boolean:      { color: "#16a34a" },
    number:       { color: "#64748b" }
  };
  const c = map[type] || { color: "#64748b" };
  const letter = type === "currency" ? "$"
    : type === "select" || type === "multi-select" ? "▾"
    : type === "date" ? "📅".slice(0, 1)
    : type === "boolean" ? "✓"
    : type === "record" ? "→"
    : type === "user" ? "@"
    : type === "ai" ? "✨"
    : type === "number" ? "#"
    : "T";
  return (
    <span style={{
      width: 14, height: 14,
      borderRadius: 3,
      background: c.color + "18",
      color: c.color,
      display: "grid", placeItems: "center",
      fontFamily: "var(--font-mono)",
      fontSize: 9,
      fontWeight: 600,
      flexShrink: 0
    }}>
      {letter}
    </span>
  );
}

function DealFieldValue({ f }) {
  if (f.type === "select" && f.color) {
    return (
      <span className="chip" style={{
        background: f.color + "22",
        color: f.color,
        border: `1px solid ${f.color}55`,
        width: "fit-content"
      }}>{f.v}</span>
    );
  }
  if (f.type === "select" || f.type === "multi-select") {
    return (
      <span style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
        {String(f.v).split(" · ").map(v => (
          <span key={v} className="chip" style={{ width: "fit-content" }}>{v}</span>
        ))}
      </span>
    );
  }
  if (f.type === "boolean") {
    const yes = f.v === "Sí" || f.v === true;
    return (
      <span style={{
        display: "inline-flex", alignItems: "center", gap: 4,
        fontFamily: "var(--font-mono)", fontSize: 12,
        color: yes ? "var(--success)" : "var(--fg-3)"
      }}>
        <span className="dot" style={{ background: "currentColor", width: 6, height: 6 }} />
        {f.v}
      </span>
    );
  }
  if (f.type === "user") {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
        <span className="avatar" style={{ width: 18, height: 18, fontSize: 9 }}>
          {String(f.v).split(" ").map(s => s[0]).slice(0, 2).join("")}
        </span>
        {f.v}
      </span>
    );
  }
  if (f.type === "ai") {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
        <Icon name="sparkles" size={11} style={{ color: "var(--accent)" }} />
        <b style={{ fontFamily: "var(--font-mono)", color: "var(--accent)" }}>{f.v}</b>
      </span>
    );
  }
  if (f.type === "record") {
    return (
      <span style={{ color: "var(--accent)", borderBottom: "1px dashed var(--accent-border)" }}>
        {f.v}
      </span>
    );
  }
  if (f.type === "currency" || f.type === "mono" || f.type === "number" || f.type === "date") {
    return <span style={{ fontFamily: "var(--font-mono)" }}>{f.v}</span>;
  }
  return <span>{f.v}</span>;
}
