// Dashboard add-ons: Forecast 12/24/36, Top 10, AI Recommendations

function ForecastHorizons({ ws, workspace }) {
  const [horizon, setHorizon] = useState(36);
  const [mode, setMode] = useState("timeline"); // monthly | timeline
  const open = ws.deals.filter(d => d.stage !== "won" && d.stage !== "lost");
  const stages = window.CRM_DATA.stages;

  // Compute month-by-month forecast for given horizon.
  // Strategy: use deal's estimatedCloseAt directly, and for deals beyond their
  // close date, extend SaaS recurring revenue as MRR for subsequent months.
  // For non-recurring deals: book one-shot at estimatedCloseAt × probability.
  // For recurring: book MRR (arr/12) starting at estimatedCloseAt for horizon months.
  const buckets = useMemo(() => {
    const today = ws.today;
    const startMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const out = [];
    for (let i = 0; i < horizon; i++) {
      const m = new Date(startMonth.getFullYear(), startMonth.getMonth() + i, 1);
      out.push({ month: m, total: 0, byStage: {} });
    }
    const idxOf = (date) => {
      const dt = typeof date === "string" ? new Date(date) : date;
      return (dt.getFullYear() - startMonth.getFullYear()) * 12 + (dt.getMonth() - startMonth.getMonth());
    };

    open.forEach(d => {
      const closeIdx = idxOf(d.estimatedCloseAt);
      if (d.isRecurring && d.arr) {
        const monthly = (d.arr / 12) * d.probability;
        for (let i = Math.max(0, closeIdx); i < horizon; i++) {
          out[i].total += monthly;
          out[i].byStage[d.stage] = (out[i].byStage[d.stage] || 0) + monthly;
        }
      } else {
        if (closeIdx >= 0 && closeIdx < horizon) {
          const weighted = d.value * d.probability;
          out[closeIdx].total += weighted;
          out[closeIdx].byStage[d.stage] = (out[closeIdx].byStage[d.stage] || 0) + weighted;
        }
      }
    });
    return out;
  }, [ws, horizon]);

  const grand = buckets.reduce((acc, b) => acc + b.total, 0);
  const monthlyAvg = grand / Math.max(1, horizon);
  const peak = buckets.reduce((acc, b, i) => b.total > acc.total ? { ...b, i } : acc, { total: 0, i: 0 });
  const maxBar = Math.max(1, ...buckets.map(b => b.total));

  const stagesOrder = ["discovery", "qualified", "proposal", "negotiation"];
  const stageColorById = (id) => stages.find(s => s.id === id)?.color || "#94a3b8";

  return (
    <div className="card" style={{ marginTop: 0 }}>
      <div className="card__h">
        <Icon name="trending" size={14} style={{ color: "var(--accent)" }} />
        Forecast por horizonte
        <span className="card__sub">Pipeline ponderado por probabilidad IA, distribuido por fecha estimada de cierre + ARR recurrente</span>
      </div>
      <div className="card__b" style={{ padding: "12px 16px 16px" }}>
        <div className="fc-horizons">
          {[12, 24, 36].map(h => (
            <button key={h} className={horizon === h ? "is-active" : ""} onClick={() => setHorizon(h)}>
              {h} meses
            </button>
          ))}
          <span style={{ width: 1, height: 18, background: "var(--border)", margin: "0 6px" }} />
          <div className="segmented" style={{
            display: "flex",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
            overflow: "hidden",
            background: "var(--bg-2)"
          }}>
            <button
              onClick={() => setMode("monthly")}
              style={{
                padding: "5px 10px",
                fontSize: 11,
                fontFamily: "var(--font-mono)",
                borderRight: "1px solid var(--border)",
                color: mode === "monthly" ? "var(--fg)" : "var(--fg-3)",
                background: mode === "monthly" ? "var(--bg)" : "transparent"
              }}>
              <Icon name="dashboard" size={11} style={{ verticalAlign: "middle", marginRight: 4 }} />
              Mensual
            </button>
            <button
              onClick={() => setMode("timeline")}
              style={{
                padding: "5px 10px",
                fontSize: 11,
                fontFamily: "var(--font-mono)",
                color: mode === "timeline" ? "var(--fg)" : "var(--fg-3)",
                background: mode === "timeline" ? "var(--bg)" : "transparent"
              }}>
              <Icon name="gantt" size={11} style={{ verticalAlign: "middle", marginRight: 4 }} />
              Timeline + SaaS
            </button>
          </div>
          <span style={{ flex: 1 }} />
          <div style={{ display: "flex", gap: 10, fontSize: 11 }}>
            {stagesOrder.map(s => (
              <span key={s} style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "var(--fg-3)" }}>
                <span className="dot" style={{ background: stageColorById(s), width: 6, height: 6 }} />
                {stageLabel(s)}
              </span>
            ))}
          </div>
        </div>

        {mode === "monthly" ? (
          <div className="fc-chart" style={{ height: horizon > 12 ? 110 : 140 }}>
            {buckets.map((b, i) => {
              const monthLbl = ["E","F","M","A","M","J","J","A","S","O","N","D"][b.month.getMonth()];
              const showLbl = horizon <= 12 || i % 3 === 0;
              return (
                <div key={i} className="fc-bar">
                  <div className="fc-bar__total">{fmtMoney(b.total, true)} · {monthLbl}{b.month.getFullYear() % 100}</div>
                  <div className="fc-bar__stack" style={{ height: (b.total / maxBar * 100) + "%", minHeight: b.total > 0 ? 2 : 0 }}>
                    {stagesOrder.map(s => {
                      const v = b.byStage[s] || 0;
                      if (!v) return null;
                      return <div key={s} className="fc-bar__seg" style={{ background: stageColorById(s), flex: v }} />;
                    })}
                  </div>
                  {showLbl && <div className="fc-bar__label">{monthLbl}{horizon > 12 ? "'" + (b.month.getFullYear() % 100) : ""}</div>}
                </div>
              );
            })}
          </div>
        ) : (
          <ForecastTimelineChart ws={ws} horizon={horizon} buckets={buckets} />
        )}

        <div className="fc-summary">
          <div>
            <small>Forecast total · {horizon}m</small>
            <b>{fmtMoney(grand, true)}</b>
          </div>
          <div>
            <small>Promedio mensual</small>
            <b>{fmtMoney(monthlyAvg, true)}</b>
          </div>
          <div>
            <small>Pico</small>
            <b>{fmtMoney(peak.total, true)} <span style={{ color: "var(--fg-3)", fontSize: 11, fontWeight: 400 }}>· {peak.month && ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"][peak.month.getMonth()]} {peak.month?.getFullYear()}</span></b>
          </div>
        </div>
      </div>
    </div>
  );
}

window.ForecastHorizons = ForecastHorizons;

/* ===== Forecast timeline (GANTT-style + SaaS cumulative line) ===== */
function ForecastTimelineChart({ ws, horizon, buckets }) {
  const today = ws.today;
  const stages = window.CRM_DATA.stages;
  const stageColorById = (id) => stages.find(s => s.id === id)?.color || "#94a3b8";

  // Find deals that close in horizon, sorted by close date
  const startMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const endMonth = new Date(today.getFullYear(), today.getMonth() + horizon, 1);
  const open = ws.deals
    .filter(d => d.stage !== "won" && d.stage !== "lost")
    .filter(d => {
      const close = new Date(d.estimatedCloseAt);
      return close >= today && close < endMonth;
    })
    .sort((a, b) => new Date(a.estimatedCloseAt) - new Date(b.estimatedCloseAt));

  // Compute cumulative SaaS MRR over months
  // For each month, sum MRR contributions of deals that closed by that month (weighted by probability).
  const saasSeries = useMemo(() => {
    const series = new Array(horizon).fill(0);
    const recurring = ws.deals.filter(d => d.isRecurring && d.arr > 0 && d.stage !== "lost");
    recurring.forEach(d => {
      const closeIdx = Math.floor(
        (new Date(d.estimatedCloseAt) - startMonth) / (1000 * 60 * 60 * 24 * 30.44)
      );
      const mrr = (d.arr / 12) * (d.stage === "won" ? 1 : d.probability);
      for (let i = Math.max(0, closeIdx); i < horizon; i++) series[i] += mrr;
    });
    // Always include already-won recurring deals as baseline
    return series;
  }, [ws, horizon]);
  const maxSaas = Math.max(1, ...saasSeries);

  // Chart geometry
  const totalDays = (endMonth - startMonth) / 86400000;
  const dayToPct = (d) => {
    const date = typeof d === "string" ? new Date(d) : d;
    return ((date - startMonth) / 86400000 / totalDays) * 100;
  };

  // Limit visible rows (show top N by close date)
  const MAX_ROWS = 14;
  const visible = open.slice(0, MAX_ROWS);
  const hidden = open.length - visible.length;

  const rowH = 22;
  const chartH = visible.length * rowH + 8;
  const saasH = 80;

  // Build smooth path for cumulative SaaS line
  const saasPath = useMemo(() => {
    if (!saasSeries.length) return "";
    const pts = saasSeries.map((v, i) => {
      const x = ((i + 0.5) / horizon) * 100;
      const y = saasH - (v / maxSaas) * saasH;
      return [x, y];
    });
    let d = `M0,${saasH} L${pts[0][0]},${pts[0][1]}`;
    for (let i = 1; i < pts.length; i++) {
      const [x1, y1] = pts[i - 1];
      const [x2, y2] = pts[i];
      const cx = (x1 + x2) / 2;
      d += ` C${cx},${y1} ${cx},${y2} ${x2},${y2}`;
    }
    d += ` L100,${pts[pts.length - 1][1]}`;
    return d;
  }, [saasSeries, horizon]);
  const saasArea = saasPath + ` L100,${saasH} L0,${saasH} Z`;

  const todayPct = dayToPct(today);

  return (
    <div style={{ marginTop: 14 }}>
      {/* SaaS cumulative band (top) */}
      <div style={{
        position: "relative",
        height: saasH,
        marginBottom: 4,
        border: "1px solid var(--border-2)",
        borderRadius: "var(--radius)",
        background: "var(--bg-2)",
        padding: "8px 0 0",
        overflow: "hidden"
      }}>
        <div style={{
          position: "absolute", top: 8, left: 12,
          fontSize: 10, fontFamily: "var(--font-mono)",
          textTransform: "uppercase", letterSpacing: "0.06em",
          color: "var(--fg-3)",
          zIndex: 2,
          display: "flex", alignItems: "center", gap: 6
        }}>
          <Icon name="dollar" size={11} style={{ color: "var(--info)" }} />
          SaaS MRR proyectado · {fmtMoney(saasSeries[saasSeries.length - 1] || 0, true)} run-rate al mes {horizon}
        </div>
        <svg viewBox={`0 0 100 ${saasH}`} preserveAspectRatio="none" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
          <defs>
            <linearGradient id="saas-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--info)" stopOpacity="0.35" />
              <stop offset="100%" stopColor="var(--info)" stopOpacity="0.02" />
            </linearGradient>
          </defs>
          <path d={saasArea} fill="url(#saas-grad)" />
          <path d={saasPath} fill="none" stroke="var(--info)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
        </svg>
        {/* Today marker */}
        <div style={{
          position: "absolute",
          left: todayPct + "%", top: 0, bottom: 0,
          width: 1, background: "var(--accent)",
          opacity: 0.6
        }} />
        {/* Y-axis hint */}
        <div style={{
          position: "absolute", top: 8, right: 8,
          fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--info)"
        }}>
          {fmtMoney(maxSaas, true)}
        </div>
        <div style={{
          position: "absolute", bottom: 4, right: 8,
          fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-3)"
        }}>
          0
        </div>
      </div>

      {/* Pipeline timeline (GANTT-style) */}
      <div style={{
        position: "relative",
        height: chartH,
        border: "1px solid var(--border-2)",
        borderRadius: "var(--radius)",
        background:
          `linear-gradient(to right, transparent calc(${todayPct}% - 1px), var(--accent) ${todayPct}%, transparent calc(${todayPct}% + 1px)),` +
          `repeating-linear-gradient(to right, transparent, transparent calc(100% / ${horizon} - 1px), var(--border-2) calc(100% / ${horizon} - 1px), var(--border-2) calc(100% / ${horizon}))`,
        backgroundColor: "var(--bg-2)",
        overflow: "hidden"
      }}>
        {visible.map((d, i) => {
          const startPct = Math.max(0, dayToPct(d.createdAt));
          const endPct = Math.min(100, dayToPct(d.estimatedCloseAt));
          const widthPct = Math.max(2, endPct - startPct);
          const color = stageColorById(d.stage);
          return (
            <div
              key={d.id}
              title={`${d.name} · ${d.company} · ${fmtMoney(d.value, true)} · cierre ${fmtDate(d.estimatedCloseAt, { format: "short" })}`}
              style={{
                position: "absolute",
                left: `max(${startPct}%, ${todayPct}%)`,
                top: 4 + i * rowH,
                height: rowH - 4,
                width: `calc(${widthPct}% - (max(${startPct}%, ${todayPct}%) - ${startPct}%))`,
                background: color,
                borderRadius: 3,
                fontSize: 10,
                fontFamily: "var(--font-mono)",
                color: "#fff",
                padding: "0 6px",
                display: "flex", alignItems: "center",
                gap: 5,
                whiteSpace: "nowrap",
                overflow: "hidden",
                cursor: "pointer"
              }}
            >
              <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                {d.isRecurring && "🔁 "}{d.name}
              </span>
              <span style={{
                marginLeft: "auto", background: "rgba(255,255,255,.2)", padding: "0 4px",
                borderRadius: 2, flexShrink: 0
              }}>
                {fmtMoney(d.value, true)}
              </span>
            </div>
          );
        })}
      </div>

      {/* X-axis month labels */}
      <div style={{ display: "flex", marginTop: 4 }}>
        {buckets.map((b, i) => {
          const monthLbl = ["E","F","M","A","M","J","J","A","S","O","N","D"][b.month.getMonth()];
          return (
            <div key={i} style={{
              flex: 1, textAlign: "center",
              fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--fg-3)"
            }}>
              {(horizon <= 12 || i % 3 === 0) ? `${monthLbl}'${b.month.getFullYear() % 100}` : ""}
            </div>
          );
        })}
      </div>

      {hidden > 0 && (
        <div style={{ fontSize: 11, color: "var(--fg-3)", marginTop: 8, textAlign: "center" }}>
          + {hidden} tratos más cerrando en este horizonte (ver vista GANTT completa en Forecast)
        </div>
      )}
    </div>
  );
}
window.ForecastTimelineChart = ForecastTimelineChart;

/* ===== Top 10 Opportunities ===== */
function Top10Card({ ws, workspace, onOpenDeal }) {
  const top = useMemo(() => (
    [...ws.deals]
      .filter(d => d.stage !== "lost")
      .sort((a, b) => b.value - a.value)
      .slice(0, 10)
  ), [ws]);
  const grand = top.reduce((acc, d) => acc + d.value, 0);

  return (
    <div className="card">
      <div className="card__h">
        <Icon name="trending" size={14} />
        Top 10 oportunidades
        <span className="card__sub">Σ {fmtMoney(grand, true)} · ordenadas por valor</span>
      </div>
      <div className="card__b" style={{ padding: 8 }}>
        <div className="top10">
          {top.map((d, i) => {
            const sc = stageColor(d.stage);
            return (
              <div key={d.id} className="top10__row" onClick={() => onOpenDeal?.(d.id)} title="Ver Deal 360">
                <span className="top10__rank">#{i + 1}</span>
                <div style={{ minWidth: 0 }}>
                  <div className="top10__name">{d.name}</div>
                  <div className="top10__co">{d.company}</div>
                </div>
                <div>
                  <span className="top10__stage" style={{ background: sc + "22", color: sc, border: "1px solid " + sc + "55" }}>
                    {stageLabel(d.stage)}
                  </span>
                </div>
                <div className="top10__value">{fmtMoney(d.value, true)}</div>
                <div>
                  <div className="top10__ai">{d.ai}% IA</div>
                  <div className="top10__ai-bar"><div style={{ width: d.ai + "%" }} /></div>
                </div>
                <Icon name="chevron-right" size={13} style={{ color: "var(--fg-4)", justifySelf: "end" }} />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
window.Top10Card = Top10Card;

/* ===== AI Recommendations (dashboard-level) ===== */
function AIRecsCard({ ws, workspace, onOpenAI, onOpenDeal }) {
  // Compute recommendations from the deal portfolio
  const open = ws.deals.filter(d => d.stage !== "won" && d.stage !== "lost");
  const ready = open.filter(d => d.ai >= 75).sort((a, b) => b.value - a.value);
  const stalling = open.filter(d => daysBetween(d.createdAt, ws.today) > 30 && d.stage !== "won").sort((a, b) => b.value - a.value);
  const risk = open.filter(d => d.ai < 40).sort((a, b) => b.value - a.value);
  const noResponse = open.filter(d => d.lastActivity >= 4).sort((a, b) => b.value - a.value);
  const upsell = ws.deals.filter(d => d.stage === "won" && d.isRecurring).sort((a, b) => b.arr - a.arr);

  const recs = [];

  if (ready.length) {
    recs.push({
      color: "var(--success)", icon: "trending",
      title: `Cerrar esta semana · ${ready.length} tratos`,
      body: <>AI Score ≥ 75% y engagement reciente. Top: <b>{ready[0].name}</b> ({fmtMoney(ready[0].value, true)}), <b>{ready[1]?.name}</b>{ready[1] && ` (${fmtMoney(ready[1].value, true)})`}.</>,
      cta: "Generar contratos en lote",
      action: () => onOpenDeal?.(ready[0].id)
    });
  }
  if (stalling.length) {
    recs.push({
      color: "var(--warning)", icon: "clock",
      title: `${stalling.length} tratos estancados +30 días`,
      body: <>Ocupan <b>{fmtMoney(stalling.reduce((a, d) => a + d.value, 0), true)}</b> de pipeline. Más antiguo: <b>{stalling[0].name}</b>. Activá secuencia de re-engagement.</>,
      cta: "Activar secuencia",
      action: () => onOpenDeal?.(stalling[0].id)
    });
  }
  if (risk.length) {
    recs.push({
      color: "var(--danger)", icon: "alert",
      title: `${risk.length} tratos en riesgo de pérdida`,
      body: <>AI Score &lt; 40%. Pipeline en riesgo: <b>{fmtMoney(risk.reduce((a, d) => a + d.value, 0), true)}</b>. Recomendación: re-calificar o pedir intro a un nivel ejecutivo más alto.</>,
      cta: "Ver lista",
      action: () => onOpenDeal?.(risk[0].id)
    });
  }
  if (upsell.length) {
    recs.push({
      color: "var(--info)", icon: "dollar",
      title: `${upsell.length} cuentas con potencial de upsell`,
      body: <>Clientes recurrentes con NPS &gt; 50. <b>{upsell[0].company}</b> tiene 92% match con tu módulo de analytics premium ({fmtMoney(upsell[0].arr * 0.4, true)} ARR estimado).</>,
      cta: "Pedir análisis IA",
      action: onOpenAI
    });
  }
  recs.push({
    color: "var(--accent)", icon: "sparkles",
    title: "Insight semanal",
    body: <>Tratos con <b>3+ stakeholders activos</b> cierran 2.4× más rápido. <b>{open.filter(d => d.contacts < 2).length} tratos</b> tienen 1 solo contacto — pedí intros esta semana.</>,
    cta: "Hablar con la IA",
    action: onOpenAI
  });

  return (
    <div className="card">
      <div className="card__h">
        <Icon name="sparkles" size={14} style={{ color: "var(--accent)" }} />
        Recomendaciones IA
        <span style={{ marginLeft: "auto" }}>
          <button className="btn btn--ghost" onClick={onOpenAI} style={{ fontSize: 11 }}>
            <Icon name="chat" size={12} /> Pedir informe
          </button>
        </span>
      </div>
      <div className="card__b" style={{ padding: 12 }}>
        <div className="ai-recs">
          {recs.slice(0, 5).map((r, i) => (
            <div key={i} className="ai-rec" style={{ "--rec-color": r.color }} onClick={r.action}>
              <div className="ai-rec__icon">
                <Icon name={r.icon} size={13} />
              </div>
              <div>
                <div className="ai-rec__title">{r.title}</div>
                <div className="ai-rec__body">{r.body}</div>
                {r.cta && (
                  <div className="ai-rec__cta">
                    {r.cta} <Icon name="arrow-right" size={9} />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
window.AIRecsCard = AIRecsCard;
