// Dashboard view — "360 Negocio"
function DashboardView({ ws, workspace, onOpenDeal, onOpenAI }) {
  const [kpiDetail, setKpiDetail] = useState(null);
  const [stageDetail, setStageDetail] = useState(null);
  const stages = window.CRM_DATA.stages;
  const open = ws.deals.filter(d => d.stage !== "won" && d.stage !== "lost");
  const won = ws.deals.filter(d => d.stage === "won");

  // Forecast: sum of (value * probability) for open deals
  const forecastValue = open.reduce((acc, d) => acc + d.value * d.probability, 0);
  const pipelineValue = open.reduce((acc, d) => acc + d.value, 0);
  const wonValue = won.reduce((acc, d) => acc + d.value, 0);

  // KPIs
  const avgSalesVelocity = workspace === "novit" ? 47 : 22; // days
  const avgResponseTime  = workspace === "novit" ? 3.2 : 1.4; // hours
  const avgDealSize = Math.round(wonValue / Math.max(1, won.length));

  // Conversion & lost forecast
  const lost = ws.deals.filter(d => d.stage === "lost");
  const lostValue = lost.reduce((a, d) => a + d.value, 0);
  const closedCount = won.length + lost.length;
  const winRate = Math.round((won.length / Math.max(1, closedCount)) * 100);
  const conversionRate = Math.round((won.length / Math.max(1, ws.deals.length)) * 100);

  // Sparklines
  const sparkForecast = workspace === "novit"
    ? [820, 905, 990, 1100, 1240, 1180, 1350, 1420, 1380, 1495, 1580, 1650]
    : [120, 145, 138, 162, 184, 175, 198, 214, 226, 245, 268, 290];
  const sparkVelocity = workspace === "novit" ? [62, 58, 54, 52, 50, 49, 48, 47] : [34, 30, 28, 26, 24, 23, 22, 22];
  const sparkResponse = workspace === "novit" ? [8, 6.5, 5.2, 4.8, 4.2, 3.8, 3.5, 3.2] : [4.2, 3.6, 2.8, 2.4, 2.0, 1.8, 1.6, 1.4];
  const sparkWinRate  = workspace === "novit" ? [12, 14, 13, 15, 17, 18, 16, 19, 21] : [15, 18, 17, 21, 24, 26, 25, 29, 32];
  const sparkConversion = workspace === "novit" ? [8, 10, 11, 13, 12, 14, 15, 16, 17] : [11, 13, 14, 16, 18, 19, 20, 22, 24];
  const sparkLost = workspace === "novit" ? [180, 220, 360, 290, 410, 380, 450, 520, 600, 720, 850, 1000] : [40, 55, 70, 85, 110, 140, 170, 200, 240, 280, 310];

  // # Clientes activos (únicas empresas con al menos un trato ganado)
  const customers = useMemo(() => {
    const byCo = {};
    ws.deals.forEach(d => { byCo[d.company] = byCo[d.company] || { won: 0, arr: 0 }; if (d.stage === "won") byCo[d.company].won++; if (d.stage === "won" && d.isRecurring) byCo[d.company].arr += d.arr; });
    return Object.values(byCo).filter(c => c.won > 0);
  }, [ws]);
  const totalArr = customers.reduce((a, c) => a + c.arr, 0);
  const sparkClients = workspace === "novit" ? [2, 2, 3, 3, 4, 4, 5, 6, 6, 7, 8, customers.length] : [1, 2, 2, 3, 3, 3, 4, 4, 5, 5, 6, customers.length];

  // Forecast bar (by stage)
  const stageBreakdown = stages.filter(s => s.id !== "won" && s.id !== "lost").map(s => {
    const ds = open.filter(d => d.stage === s.id);
    const sum = ds.reduce((acc, d) => acc + d.value * d.probability, 0);
    return { ...s, sum, count: ds.length };
  });

  // Stage funnel
  const funnel = stages.filter(s => s.id !== "lost").map(s => {
    const ds = ws.deals.filter(d => d.stage === s.id);
    const totalValue = ds.reduce((acc, d) => acc + d.value, 0);
    return { ...s, count: ds.length, totalValue };
  });
  const maxFunnel = Math.max(...funnel.map(f => f.totalValue), 1);

  // Leaderboard by owner
  const ownerKeys = Object.keys(ws.owners);
  const leaderboard = ownerKeys.map(k => {
    const ds = ws.deals.filter(d => d.owner === k);
    const ownerWon = ds.filter(d => d.stage === "won").reduce((acc, d) => acc + d.value, 0);
    return { k, ...ws.owners[k], deals: ds.length, won: ownerWon };
  }).sort((a, b) => b.won - a.won);
  const maxLB = Math.max(...leaderboard.map(l => l.won), 1);

  // SaaS-specific (if workspace has recurring deals)
  const recurringDeals = ws.deals.filter(d => d.arr > 0);
  const totalARR = recurringDeals.reduce((acc, d) => acc + d.arr, 0);
  const totalMRR = Math.round(totalARR / 12);
  const newARR = recurringDeals.filter(d => d.stage === "won").reduce((acc, d) => acc + d.arr, 0);
  const pipelineARR = recurringDeals.filter(d => d.stage !== "won" && d.stage !== "lost").reduce((acc, d) => acc + d.arr * d.probability, 0);

  // Sales Velocity calc per stage avg time
  const timeInStage = stages.filter(s => s.id !== "won" && s.id !== "lost").map(s => ({
    ...s, avg: workspace === "novit" ? [8, 14, 22, 18][stages.findIndex(x => x.id === s.id)] || 12 : [4, 8, 12, 10][stages.findIndex(x => x.id === s.id)] || 6
  }));

  return (
    <div className="dash">
      <div className="dash__row" style={{ gridTemplateColumns: "repeat(7, 1fr)" }}>
        <Kpi
          label="Forecast Proyectado"
          value={fmtMoney(forecastValue, true)}
          delta="+18.4%"
          deltaDir="up"
          help="Σ valor × probabilidad IA"
          spark={sparkForecast}
          onClick={() => setKpiDetail("forecast")}
        />
        <Kpi
          label="Sales Velocity"
          value={avgSalesVelocity + "d"}
          delta="-3d"
          deltaDir="up"
          help="Lead → Cierre"
          spark={sparkVelocity}
          sparkColor="#16a34a"
          sparkInvert
          onClick={() => setKpiDetail("velocity")}
        />
        <Kpi
          label="Lead Response Time"
          value={avgResponseTime + "h"}
          delta="-22m"
          deltaDir="up"
          help="Primer toque WhatsApp"
          spark={sparkResponse}
          sparkColor="#16a34a"
          sparkInvert
          onClick={() => setKpiDetail("response")}
        />
        <Kpi
          label="Win Rate"
          value={winRate + "%"}
          delta="+2.1pp"
          deltaDir="up"
          help="Won / (Won + Lost)"
          spark={sparkWinRate}
          onClick={() => setKpiDetail("winrate")}
        />
        <Kpi
          label="Tasa de Conversión"
          value={conversionRate + "%"}
          delta="+3.2pp"
          deltaDir="up"
          help="Lead → Cliente"
          spark={sparkConversion}
          sparkColor="var(--accent)"
          onClick={() => setKpiDetail("conversion")}
        />
        <Kpi
          label="Forecast Perdido"
          value={fmtMoney(lostValue, true)}
          delta={lost.length + " tratos"}
          deltaDir="down"
          help="Σ valor de tratos Lost"
          spark={sparkLost}
          sparkColor="var(--danger)"
          sparkInvert
          onClick={() => setKpiDetail("lost_forecast")}
        />
        <Kpi
          label="Clientes activos"
          value={customers.length.toString()}
          delta={totalArr > 0 ? "ARR " + fmtMoney(totalArr, true) : "+" + Math.max(1, Math.floor(customers.length * 0.15)) + " este Q"}
          deltaDir="up"
          help="Cuentas con ≥ 1 trato ganado"
          spark={sparkClients}
          sparkColor="var(--accent)"
          onClick={() => setKpiDetail("clients")}
        />
      </div>

      <div className="dash__row dash__row--split">
        <div className="card">
          <div className="card__h">
            <Icon name="trending" size={14} style={{ color: "var(--accent)" }} />
            Forecast por etapa
            <span className="card__sub">Σ ponderado {fmtMoney(forecastValue, true)} · Σ pipeline {fmtMoney(pipelineValue, true)}</span>
          </div>
          <div className="card__b">
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, fontSize: 11, color: "var(--fg-3)", fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              <Icon name="sparkles" size={11} style={{ color: "var(--accent)" }} />
              Forecast ponderado · Σ (valor × probabilidad IA)
              <span style={{ marginLeft: "auto", color: "var(--fg-2)" }}>{fmtMoney(forecastValue, true)}</span>
            </div>
            <div className="forecast-bar">
              {stageBreakdown.map(s => {
                const pct = (s.sum / Math.max(1, forecastValue)) * 100;
                return (
                  <div
                    key={s.id}
                    style={{ background: s.color, width: pct + "%", cursor: "pointer" }}
                    title={`${s.label}: ${fmtMoney(s.sum, true)} ponderado · clic para ver propuestas`}
                    onClick={() => setStageDetail(s.id)}
                  >
                    {pct > 8 ? fmtMoney(s.sum, true) : ""}
                  </div>
                );
              })}
            </div>
            <div style={{ display: "flex", gap: 14, marginTop: 12, flexWrap: "wrap" }}>
              {stageBreakdown.map(s => (
                <div
                  key={s.id}
                  className="forecast-legend"
                  onClick={() => setStageDetail(s.id)}
                  style={{ cursor: "pointer" }}
                >
                  <span className="dot" style={{ background: s.color }} />
                  <span style={{ color: "var(--fg-2)" }}>{s.label}</span>
                  <span className="mono" style={{ color: "var(--fg-3)" }}>{s.count}</span>
                </div>
              ))}
            </div>

            <div style={{ height: 1, background: "var(--border-2)", margin: "16px 0 12px" }} />

            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, fontSize: 11, color: "var(--fg-3)", fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              <Icon name="dollar" size={11} />
              Pipeline bruto · sin ponderar (incluye Closed Won)
              <span style={{ marginLeft: "auto", color: "var(--fg-2)" }}>{fmtMoney(funnel.reduce((a, s) => a + s.totalValue, 0), true)}</span>
            </div>
            <div className="stage-funnel">
              {funnel.map(s => (
                <div
                  key={s.id}
                  className="stage-funnel__row stage-funnel__row--clickable"
                  onClick={() => setStageDetail(s.id)}
                >
                  <span style={{ color: "var(--fg-2)" }}>{s.label}</span>
                  <div className="stage-funnel__bar">
                    <div style={{ width: (s.totalValue / maxFunnel * 100) + "%", background: s.color }} />
                  </div>
                  <span className="stage-funnel__val">{fmtMoney(s.totalValue, true)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card__h">
            <Icon name="sparkles" size={14} style={{ color: "var(--accent)" }} />
            AI Forecast · Pipeline weighted
          </div>
          <div className="card__b" style={{ padding: 16 }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-3)", textTransform: "uppercase", letterSpacing: ".08em" }}>
              Pipeline total
            </div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 30, fontWeight: 500, letterSpacing: "-.02em", marginTop: 4 }}>
              {fmtMoney(pipelineValue, true)}
            </div>
            <div style={{ fontSize: 12, color: "var(--fg-3)", marginTop: 2 }}>
              {open.length} tratos abiertos · Confianza IA <b style={{ color: "var(--accent)" }}>{workspace === "novit" ? "84%" : "78%"}</b>
            </div>

            <div style={{ marginTop: 14, padding: 12, background: "var(--accent-soft)", border: "1px solid var(--accent-border)", borderRadius: 6 }}>
              <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--accent)", textTransform: "uppercase", letterSpacing: ".06em" }}>
                Modelo · gradient-boost v3
              </div>
              <div style={{ fontSize: 13, marginTop: 4 }}>
                Forecast a 90 días: <b className="mono">{fmtMoney(forecastValue, true)}</b>
              </div>
              <div style={{ fontSize: 11, color: "var(--fg-2)", marginTop: 4 }}>
                Mejora vs forecast manual: <b style={{ color: "var(--success)" }}>+12.4%</b>
              </div>
            </div>

            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--fg-3)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 6 }}>
                Top features (SHAP)
              </div>
              {[
                { f: "Tiempo en etapa", w: 0.92, dir: "down" },
                { f: "Tamaño cuenta",   w: 0.78, dir: "up" },
                { f: "Engagement WA",   w: 0.71, dir: "up" },
                { f: "# stakeholders",  w: 0.58, dir: "up" },
                { f: "Industria fit",   w: 0.42, dir: "up" }
              ].map(f => (
                <div key={f.f} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: "var(--fg-2)", flex: 1 }}>{f.f}</span>
                  <div style={{ flex: 2, height: 4, background: "var(--bg-3)", borderRadius: 999 }}>
                    <div style={{ width: (f.w * 100) + "%", height: "100%", background: f.dir === "up" ? "var(--success)" : "var(--warning)", borderRadius: 999 }} />
                  </div>
                  <span className="mono" style={{ fontSize: 10, color: "var(--fg-3)", width: 32, textAlign: "right" }}>{f.w.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="dash__row dash__row--3">
        <div className="card">
          <div className="card__h">
            <Icon name="dollar" size={14} style={{ color: "var(--success)" }} />
            Métricas SaaS · ARR
            <span className="card__sub">{recurringDeals.length} tratos recurrentes</span>
          </div>
          <div className="card__b">
            <div className="saas-grid">
              <div className="saas-kpi saas-kpi--clickable" onClick={() => setKpiDetail("arr_total")}>
                <small>ARR total</small>
                <b>{fmtMoney(totalARR, true)}</b>
              </div>
              <div className="saas-kpi saas-kpi--clickable" onClick={() => setKpiDetail("mrr")}>
                <small>MRR estimado</small>
                <b>{fmtMoney(totalMRR, true)}</b>
              </div>
              <div className="saas-kpi saas-kpi--clickable" onClick={() => setKpiDetail("new_arr")}>
                <small>New ARR ganado</small>
                <b style={{ color: "var(--success)" }}>{fmtMoney(newARR, true)}</b>
              </div>
              <div className="saas-kpi saas-kpi--clickable" onClick={() => setKpiDetail("pipeline_arr")}>
                <small>Pipeline ARR (w)</small>
                <b>{fmtMoney(pipelineARR, true)}</b>
              </div>
              <div className="saas-kpi saas-kpi--clickable" onClick={() => setKpiDetail("net_retention")}>
                <small>Net retention</small>
                <b>{workspace === "novit" ? "112%" : "104%"}</b>
              </div>
              <div className="saas-kpi saas-kpi--clickable" onClick={() => setKpiDetail("logo_churn")}>
                <small>Logo churn</small>
                <b>{workspace === "novit" ? "2.1%" : "4.8%"}</b>
              </div>
              <div className="saas-kpi saas-kpi--clickable" onClick={() => setKpiDetail("cac_payback")}>
                <small>CAC payback</small>
                <b>{workspace === "novit" ? "11m" : "6m"}</b>
              </div>
              <div className="saas-kpi saas-kpi--clickable" onClick={() => setKpiDetail("ltv_cac")}>
                <small>LTV / CAC</small>
                <b>{workspace === "novit" ? "4.2x" : "5.8x"}</b>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card__h">
            <Icon name="clock" size={14} />
            Time in Stage
          </div>
          <div className="card__b">
            <div className="stage-funnel">
              {timeInStage.map(s => (
                <div key={s.id} className="stage-funnel__row">
                  <span style={{ color: "var(--fg-2)" }}>{s.label}</span>
                  <div className="stage-funnel__bar">
                    <div style={{ width: clamp(s.avg / 30 * 100, 6, 100) + "%", background: s.avg > 18 ? "var(--warning)" : s.color }} />
                  </div>
                  <span className="stage-funnel__val">{s.avg}d</span>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 11, color: "var(--warning)", marginTop: 12, display: "flex", alignItems: "center", gap: 6 }}>
              <Icon name="alert" size={12} />
              <span>2 tratos llevan +25d en Proposal — riesgo de stalling</span>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card__h">
            <Icon name="users" size={14} />
            Leaderboard
          </div>
          <div className="card__b">
            <div className="leaderboard-layout">
              <div className="leaderboard">
                {leaderboard.map((o, i) => (
                  <div key={o.k} className="leaderboard__row">
                    <span className="avatar" style={{ width: 22, height: 22, fontSize: 10, background: `linear-gradient(135deg, ${o.color}aa, ${o.color})` }}>{o.k}</span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13 }}>{o.name}</div>
                      <div style={{ fontSize: 10, color: "var(--fg-3)", fontFamily: "var(--font-mono)" }}>{o.role}</div>
                    </div>
                    <div className="leaderboard__bar">
                      <div style={{ width: (o.won / maxLB * 100) + "%", background: o.color }} />
                    </div>
                    <div className="mono" style={{ fontSize: 12, textAlign: "right" }}>{fmtMoney(o.won, true)}</div>
                  </div>
                ))}
              </div>
              <LeaderboardPie data={leaderboard} />
            </div>
          </div>
        </div>
      </div>

      {/* ─── NOVIT vs SHARKY comparison ─── */}
      <WorkspaceComparison onOpenAI={onOpenAI} />

      {/* ─── Forecast horizons 12/24/36 ─── */}
      <ForecastHorizons ws={ws} workspace={workspace} />

      {/* ─── Top 10 + AI Recommendations ─── */}
      <div className="dash__row dash__row--split">
        <Top10Card ws={ws} workspace={workspace} onOpenDeal={onOpenDeal} />
        <AIRecsCard ws={ws} workspace={workspace} onOpenAI={onOpenAI} onOpenDeal={onOpenDeal} />
      </div>

      <KpiDetailDrawer
        open={!!kpiDetail}
        kpi={kpiDetail}
        onClose={() => setKpiDetail(null)}
        ws={ws}
        workspace={workspace}
        onOpenDeal={onOpenDeal}
      />

      <StageForecastDrawer
        open={!!stageDetail}
        stageId={stageDetail}
        onClose={() => setStageDetail(null)}
        ws={ws}
        workspace={workspace}
        onOpenDeal={onOpenDeal}
      />
    </div>
  );
}

/* ============================================================
   Stage forecast drawer — drills into a single pipeline stage,
   shows weighted/unweighted breakdown, lists every deal with
   its proposal status, value and probability.
   ============================================================ */
function StageForecastDrawer({ open, stageId, onClose, ws, workspace, onOpenDeal }) {
  if (!open || !stageId) return null;
  const stages = window.CRM_DATA.stages;
  const stage = stages.find(s => s.id === stageId);
  if (!stage) return null;

  const deals = ws.deals
    .filter(d => d.stage === stageId)
    .sort((a, b) => b.value - a.value);
  const totalRaw = deals.reduce((a, d) => a + d.value, 0);
  const totalWeighted = deals.reduce((a, d) => a + d.value * d.probability, 0);
  const probPct = Math.round(stage.prob * 100);

  // Proposal status by deal stage (mirrors buildProposals logic)
  const proposalStatusForDeal = (deal) => {
    const seed = (deal.id || "x").split("").reduce((a, c) => a + c.charCodeAt(0), 0);
    if (stageId === "discovery")   return { label: "Sin propuesta",     color: "var(--fg-3)",   icon: "doc",   note: "Etapa de descubrimiento" };
    if (stageId === "qualified")   return { label: "En preparación",    color: "var(--accent)", icon: "doc",   note: "Próximo envío estimado" };
    if (stageId === "proposal")    return seed % 3 === 0
      ? { label: "Enviada", color: "#2563eb", icon: "mail", note: "Sin apertura aún" }
      : { label: "Vista",   color: "#0891b2", icon: "eye",  note: `Vista ${1 + (seed % 5)} veces` };
    if (stageId === "negotiation") return { label: "Negociando",         color: "#d97706",       icon: "chat",  note: "Procurement revisando" };
    if (stageId === "won")         return { label: "Firmada",            color: "#16a34a",       icon: "check", note: "DocuSign confirmado" };
    if (stageId === "lost")        return seed % 3 === 0
      ? { label: "Vencida",   color: "#64748b", icon: "clock", note: "No se respondió a tiempo" }
      : { label: "Rechazada", color: "#dc2626", icon: "x",     note: "Competencia / precio" };
    return { label: "—", color: "var(--fg-3)", icon: "doc", note: "" };
  };

  return (
    <div className="ai-drawer" data-screen-label={`Forecast · ${stage.label}`}>
      <div className="ai-drawer__h">
        <h3>
          <span className="dot" style={{ background: stage.color, width: 10, height: 10 }} />
          Forecast · {stage.label}
          <span className="badge" style={{ background: "var(--bg-3)", color: "var(--fg-3)" }}>{workspace.toUpperCase()}</span>
        </h3>
        <div className="actions">
          <button className="btn btn--ghost btn--icon" onClick={onClose}><Icon name="x" size={14} /></button>
        </div>
      </div>

      {/* Headline */}
      <div style={{ padding: "16px 18px 12px", borderBottom: "1px solid var(--border-2)", flexShrink: 0 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          <div>
            <div style={{ fontSize: 10, fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--fg-3)", marginBottom: 4 }}>Tratos en etapa</div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 22, fontWeight: 500, letterSpacing: "-0.02em" }}>{deals.length}</div>
          </div>
          <div>
            <div style={{ fontSize: 10, fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--fg-3)", marginBottom: 4 }}>Valor bruto</div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 22, fontWeight: 500, letterSpacing: "-0.02em" }}>{fmtMoney(totalRaw, true)}</div>
          </div>
          <div>
            <div style={{ fontSize: 10, fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--fg-3)", marginBottom: 4 }}>Ponderado ({probPct}%)</div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 22, fontWeight: 500, letterSpacing: "-0.02em", color: stage.color }}>{fmtMoney(totalWeighted, true)}</div>
          </div>
        </div>
        <div style={{ marginTop: 12, padding: 10, background: "var(--bg-2)", border: "1px solid var(--border-2)", borderRadius: "var(--radius)", fontSize: 11, color: "var(--fg-2)", lineHeight: 1.5, fontFamily: "var(--font-mono)" }}>
          <div style={{ color: "var(--fg-3)", marginBottom: 3 }}>cálculo</div>
          <b>Valor bruto</b> = Σ valor de los tratos en esta etapa<br/>
          <b>Ponderado</b> = Σ (valor × probabilidad de etapa {probPct}%) — alimenta el forecast del dashboard
        </div>
      </div>

      {/* Deals list */}
      <div style={{ flex: 1, overflow: "auto" }}>
        <div style={{
          padding: "10px 18px 6px",
          fontSize: 10, fontFamily: "var(--font-mono)",
          textTransform: "uppercase", letterSpacing: "0.08em",
          color: "var(--fg-3)", background: "var(--bg)",
          position: "sticky", top: 0,
          borderBottom: "1px solid var(--border-2)",
          zIndex: 1,
          display: "flex", alignItems: "center", gap: 6
        }}>
          <span>Tratos · propuestas</span>
          <span style={{ color: "var(--fg-4)" }}>· {deals.length}</span>
          <span style={{ marginLeft: "auto", color: "var(--fg-2)" }}>{fmtMoney(totalWeighted, true)} ponderado</span>
        </div>
        {deals.map(d => {
          const ps = proposalStatusForDeal(d);
          const owner = ws.owners[d.owner];
          return (
            <div
              key={d.id}
              onClick={() => { onOpenDeal?.(d.id); onClose(); }}
              style={{
                padding: "12px 18px",
                borderBottom: "1px solid var(--border-2)",
                cursor: "pointer",
                display: "grid",
                gridTemplateColumns: "1fr auto",
                gap: 10,
                alignItems: "center"
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-2)"}
              onMouseLeave={(e) => e.currentTarget.style.background = ""}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                  <span className="dot" style={{ background: stage.color, width: 7, height: 7 }} />
                  <span style={{ fontSize: 13, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.name}</span>
                </div>
                <div style={{ fontSize: 11, color: "var(--fg-3)", fontFamily: "var(--font-mono)", display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <span>{d.id}</span>
                  <span>{d.company}</span>
                  <span style={{ color: owner?.color || "var(--fg-3)" }}>{owner?.name?.split(" ").map(s => s[0]).slice(0, 2).join("")}</span>
                  {d.isRecurring && <span style={{ color: "var(--accent)" }}>ARR {fmtMoney(d.arr, true)}</span>}
                  <span>cierre {fmtDate(d.estimatedCloseAt, { format: "short" })}</span>
                </div>
                <div style={{ marginTop: 6, display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, padding: "2px 7px", borderRadius: 4, border: "1px solid", borderColor: ps.color, color: ps.color, fontFamily: "var(--font-mono)" }}>
                  <Icon name={ps.icon} size={10} />
                  Propuesta · {ps.label}
                  <span style={{ color: "var(--fg-3)", borderLeft: "1px solid var(--border-2)", marginLeft: 4, paddingLeft: 6 }}>{ps.note}</span>
                </div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 500 }}>{fmtMoney(d.value, true)}</div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: stage.color, marginTop: 2 }}>
                  × {probPct}% = {fmtMoney(Math.round(d.value * d.probability), true)}
                </div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--accent)", marginTop: 2 }}>AI {d.ai}%</div>
              </div>
            </div>
          );
        })}
        {deals.length === 0 && (
          <div className="empty-hint" style={{ padding: 30 }}>No hay tratos en esta etapa.</div>
        )}
      </div>
    </div>
  );
}

function Kpi({ label, value, delta, deltaDir, help, spark, sparkColor = "var(--accent)", sparkInvert = false, onClick }) {
  return (
    <div className="kpi" onClick={onClick} style={onClick ? { cursor: "pointer" } : null}>
      <div className="kpi__label">
        <span>{label}</span>
        {onClick && <Icon name="external" size={11} style={{ marginLeft: "auto", color: "var(--fg-4)" }} />}
      </div>
      <div className="kpi__value">{value}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span className={`kpi__delta kpi__delta--${deltaDir}`}>
          <Icon name={deltaDir === "up" ? "arrow-up" : "arrow-down"} size={11} />
          {delta}
        </span>
        <span style={{ fontSize: 11, color: "var(--fg-3)" }}>{help}</span>
      </div>
      {spark && (
        <div className="kpi__spark">
          <Sparkline values={sparkInvert ? spark.slice().reverse() : spark} color={sparkColor} />
        </div>
      )}
    </div>
  );
}

window.DashboardView = DashboardView;

/* ============================================================
   WorkspaceComparison — NOVIT vs SHARKY donut + metrics
   ============================================================ */
function WorkspaceComparison({ onOpenAI }) {
  const novitWs  = window.CRM_DATA.workspaces.novit;
  const sharkyWs = window.CRM_DATA.workspaces.sharky;
  const novitColor  = getComputedStyle(document.documentElement).getPropertyValue("--ws-color-novit").trim()  || "#4f46e5";
  const sharkyColor = getComputedStyle(document.documentElement).getPropertyValue("--ws-color-sharky").trim() || "#0d9488";

  const calc = (ws) => {
    const open  = ws.deals.filter(d => d.stage !== "won" && d.stage !== "lost");
    const won   = ws.deals.filter(d => d.stage === "won");
    const lost  = ws.deals.filter(d => d.stage === "lost");
    const closed = won.length + lost.length;
    return {
      open,
      won,
      lost,
      pipe:     open.reduce((a, d) => a + d.value, 0),
      forecast: open.reduce((a, d) => a + d.value * d.probability, 0),
      wonValue: won.reduce((a, d) => a + d.value, 0),
      aiAvg:    open.length ? Math.round(open.reduce((a, d) => a + d.ai, 0) / open.length) : 0,
      conv:     closed ? (won.length / closed) * 100 : 0,
      ticket:   open.length ? open.reduce((a, d) => a + d.value, 0) / open.length : 0,
      arr:      won.filter(d => d.isRecurring).reduce((a, d) => a + (d.arr || 0), 0)
    };
  };

  const N = calc(novitWs);
  const S = calc(sharkyWs);
  const total = N.pipe + S.pipe;
  const novitPct  = total ? (N.pipe / total) * 100 : 50;
  const sharkyPct = 100 - novitPct;

  // Donut math (annular sectors)
  const size = 200, cx = size / 2, cy = size / 2, rOuter = 88, rInner = 58;
  const arc = (startFrac, endFrac) => {
    const sa = startFrac * Math.PI * 2 - Math.PI / 2;
    const ea = endFrac   * Math.PI * 2 - Math.PI / 2;
    const x1o = cx + rOuter * Math.cos(sa), y1o = cy + rOuter * Math.sin(sa);
    const x2o = cx + rOuter * Math.cos(ea), y2o = cy + rOuter * Math.sin(ea);
    const x1i = cx + rInner * Math.cos(ea), y1i = cy + rInner * Math.sin(ea);
    const x2i = cx + rInner * Math.cos(sa), y2i = cy + rInner * Math.sin(sa);
    const large = (endFrac - startFrac) > 0.5 ? 1 : 0;
    return `M ${x1o} ${y1o} A ${rOuter} ${rOuter} 0 ${large} 1 ${x2o} ${y2o} L ${x1i} ${y1i} A ${rInner} ${rInner} 0 ${large} 0 ${x2i} ${y2i} Z`;
  };
  const novitArc  = arc(0, novitPct / 100);
  const sharkyArc = arc(novitPct / 100, 1);

  // Comparison metrics
  const metrics = [
    { label: "Pipeline activo",      novit: N.pipe,     sharky: S.pipe,     hint: "Suma de valor bruto de tratos abiertos" },
    { label: "Forecast ponderado",   novit: N.forecast, sharky: S.forecast, hint: "Valor × probabilidad IA" },
    { label: "Cerrado · won",        novit: N.wonValue, sharky: S.wonValue, hint: "Valor de tratos ganados" }
  ];
  const maxV = Math.max(...metrics.flatMap(m => [m.novit, m.sharky]), 1);

  const winner = (n, s) => n === s ? "tie" : n > s ? "novit" : "sharky";

  return (
    <div className="dash__row dash__row--split ws-compare-row">
      {/* Card 1 — Distribution donut */}
      <div className="card">
        <div className="card__h">
          <Icon name="users" size={14} />
          NOVIT vs SHARKY
          <span className="card__sub">Distribución del pipeline activo</span>
        </div>
        <div className="card__b">
          <div className="ws-compare__layout">
            <div className="ws-compare__donut">
              <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                {N.pipe > 0 && <path d={novitArc}  fill={novitColor}  stroke="var(--bg)" strokeWidth={2} />}
                {S.pipe > 0 && <path d={sharkyArc} fill={sharkyColor} stroke="var(--bg)" strokeWidth={2} />}
                {(!total) && <circle cx={cx} cy={cy} r={rOuter} fill="none" stroke="var(--bg-3)" strokeWidth={rOuter - rInner} />}
              </svg>
              <div className="ws-compare__center">
                <span className="ws-compare__total-lbl mono">Total pipeline</span>
                <span className="ws-compare__total">{fmtMoney(total, true)}</span>
                <span className="ws-compare__total-sub mono">{N.open.length + S.open.length} oportunidades</span>
              </div>
            </div>

            <div className="ws-compare__legend">
              <div className="ws-compare__legend-row" style={{ "--ws-c": novitColor }}>
                <span className="ws-compare__dot" />
                <div>
                  <b>NOVIT</b>
                  <span className="mono">{N.open.length} opp · {Math.round(novitPct)}%</span>
                </div>
                <span className="mono ws-compare__legend-val">{fmtMoney(N.pipe, true)}</span>
              </div>
              <div className="ws-compare__legend-row" style={{ "--ws-c": sharkyColor }}>
                <span className="ws-compare__dot" />
                <div>
                  <b>SHARKY</b>
                  <span className="mono">{S.open.length} opp · {Math.round(sharkyPct)}%</span>
                </div>
                <span className="mono ws-compare__legend-val">{fmtMoney(S.pipe, true)}</span>
              </div>
              <div className="ws-compare__legend-hint">
                {novitPct > sharkyPct
                  ? <>NOVIT representa el <b>{Math.round(novitPct)}%</b> del pipeline activo combinado. Liderando por <b>{fmtMoney(N.pipe - S.pipe, true)}</b>.</>
                  : <>SHARKY representa el <b>{Math.round(sharkyPct)}%</b> del pipeline activo combinado. Liderando por <b>{fmtMoney(S.pipe - N.pipe, true)}</b>.</>
                }
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Card 2 — Comparison bars + metrics table */}
      <div className="card">
        <div className="card__h">
          <Icon name="trending" size={14} />
          Comparación de métricas
          <span className="card__sub">Pipeline · Forecast · Cerrado</span>
        </div>
        <div className="card__b">
          <div className="ws-compare-bars">
            {metrics.map(m => {
              const w = winner(m.novit, m.sharky);
              return (
                <div key={m.label} className="ws-compare-bar">
                  <div className="ws-compare-bar__lbl">
                    {m.label}
                    <span className="ws-compare-bar__hint">{m.hint}</span>
                  </div>
                  <div className={`ws-compare-bar__row ${w === "novit" ? "is-winner" : ""}`}>
                    <span className="ws-compare-bar__name" style={{ color: novitColor }}>NOVIT</span>
                    <span className="ws-compare-bar__track">
                      <span className="ws-compare-bar__fill" style={{ background: novitColor, width: `${(m.novit / maxV) * 100}%` }} />
                    </span>
                    <span className="mono ws-compare-bar__val">{fmtMoney(m.novit, true)}</span>
                  </div>
                  <div className={`ws-compare-bar__row ${w === "sharky" ? "is-winner" : ""}`}>
                    <span className="ws-compare-bar__name" style={{ color: sharkyColor }}>SHARKY</span>
                    <span className="ws-compare-bar__track">
                      <span className="ws-compare-bar__fill" style={{ background: sharkyColor, width: `${(m.sharky / maxV) * 100}%` }} />
                    </span>
                    <span className="mono ws-compare-bar__val">{fmtMoney(m.sharky, true)}</span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="ws-compare-grid">
            <span className="ws-compare-grid__h">Métrica</span>
            <span className="ws-compare-grid__h" style={{ color: novitColor }}>NOVIT</span>
            <span className="ws-compare-grid__h" style={{ color: sharkyColor }}>SHARKY</span>
            <span className="ws-compare-grid__h">Δ</span>

            <span>AI score promedio</span>
            <span className={`mono ${winner(N.aiAvg, S.aiAvg) === "novit"  ? "is-w" : ""}`}>{N.aiAvg}%</span>
            <span className={`mono ${winner(N.aiAvg, S.aiAvg) === "sharky" ? "is-w" : ""}`}>{S.aiAvg}%</span>
            <span className="mono ws-compare-grid__delta">{N.aiAvg - S.aiAvg > 0 ? "+" : ""}{N.aiAvg - S.aiAvg}</span>

            <span>Conversión Won / Closed</span>
            <span className={`mono ${winner(N.conv, S.conv) === "novit"  ? "is-w" : ""}`}>{N.conv.toFixed(0)}%</span>
            <span className={`mono ${winner(N.conv, S.conv) === "sharky" ? "is-w" : ""}`}>{S.conv.toFixed(0)}%</span>
            <span className="mono ws-compare-grid__delta">{(N.conv - S.conv).toFixed(0)}pp</span>

            <span>Ticket promedio (abierto)</span>
            <span className={`mono ${winner(N.ticket, S.ticket) === "novit"  ? "is-w" : ""}`}>{fmtMoney(N.ticket, true)}</span>
            <span className={`mono ${winner(N.ticket, S.ticket) === "sharky" ? "is-w" : ""}`}>{fmtMoney(S.ticket, true)}</span>
            <span className="mono ws-compare-grid__delta">{fmtMoney(N.ticket - S.ticket, true)}</span>

            <span>ARR recurrente</span>
            <span className={`mono ${winner(N.arr, S.arr) === "novit"  ? "is-w" : ""}`}>{fmtMoney(N.arr, true)}</span>
            <span className={`mono ${winner(N.arr, S.arr) === "sharky" ? "is-w" : ""}`}>{fmtMoney(S.arr, true)}</span>
            <span className="mono ws-compare-grid__delta">{fmtMoney(N.arr - S.arr, true)}</span>

            <span>Tratos abiertos</span>
            <span className={`mono ${winner(N.open.length, S.open.length) === "novit"  ? "is-w" : ""}`}>{N.open.length}</span>
            <span className={`mono ${winner(N.open.length, S.open.length) === "sharky" ? "is-w" : ""}`}>{S.open.length}</span>
            <span className="mono ws-compare-grid__delta">{N.open.length - S.open.length > 0 ? "+" : ""}{N.open.length - S.open.length}</span>

            <span>Tratos ganados</span>
            <span className={`mono ${winner(N.won.length, S.won.length) === "novit"  ? "is-w" : ""}`}>{N.won.length}</span>
            <span className={`mono ${winner(N.won.length, S.won.length) === "sharky" ? "is-w" : ""}`}>{S.won.length}</span>
            <span className="mono ws-compare-grid__delta">{N.won.length - S.won.length > 0 ? "+" : ""}{N.won.length - S.won.length}</span>
          </div>

          <button className="btn btn--ghost ws-compare__ai" onClick={() => onOpenAI?.()}>
            <Icon name="sparkles" size={12} /> Pedir análisis comparativo a la IA
          </button>
        </div>
      </div>
    </div>
  );
}

window.WorkspaceComparison = WorkspaceComparison;

/* ---------- Leaderboard donut pie ---------- */
function LeaderboardPie({ data }) {
  const total = data.reduce((a, o) => a + o.won, 0);
  const size = 124;
  const cx = size / 2, cy = size / 2;
  const rOuter = 54;
  const rInner = 34;

  if (!total) {
    return (
      <div className="leaderboard-pie">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle cx={cx} cy={cy} r={rOuter} fill="none" stroke="var(--bg-3)" strokeWidth={rOuter - rInner} />
        </svg>
        <div className="leaderboard-pie__center">
          <span className="leaderboard-pie__label mono">TOTAL</span>
          <span className="leaderboard-pie__total mono">$0</span>
        </div>
      </div>
    );
  }

  // Build arc paths
  let cumulative = 0;
  const slices = data.filter(o => o.won > 0).map((o) => {
    const value = o.won / total;
    const start = cumulative;
    cumulative += value;
    const end = cumulative;
    const startAngle = start * Math.PI * 2 - Math.PI / 2;
    const endAngle   = end   * Math.PI * 2 - Math.PI / 2;
    const x1o = cx + rOuter * Math.cos(startAngle);
    const y1o = cy + rOuter * Math.sin(startAngle);
    const x2o = cx + rOuter * Math.cos(endAngle);
    const y2o = cy + rOuter * Math.sin(endAngle);
    const x1i = cx + rInner * Math.cos(endAngle);
    const y1i = cy + rInner * Math.sin(endAngle);
    const x2i = cx + rInner * Math.cos(startAngle);
    const y2i = cy + rInner * Math.sin(startAngle);
    const large = value > 0.5 ? 1 : 0;
    // Annular sector
    const d = [
      `M ${x1o} ${y1o}`,
      `A ${rOuter} ${rOuter} 0 ${large} 1 ${x2o} ${y2o}`,
      `L ${x1i} ${y1i}`,
      `A ${rInner} ${rInner} 0 ${large} 0 ${x2i} ${y2i}`,
      "Z"
    ].join(" ");
    // Mid-angle label position
    const midAngle = (start + end) / 2 * Math.PI * 2 - Math.PI / 2;
    const labelR = (rOuter + rInner) / 2;
    const lx = cx + labelR * Math.cos(midAngle);
    const ly = cy + labelR * Math.sin(midAngle);
    const pct = Math.round(value * 100);
    return { o, d, lx, ly, pct };
  });

  return (
    <div className="leaderboard-pie">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <g>
          {slices.map((s, i) => (
            <path
              key={s.o.k}
              d={s.d}
              fill={s.o.color}
              stroke="var(--bg)"
              strokeWidth={2}
            />
          ))}
        </g>
        {/* Slice % labels — only show on slices ≥ 8% to avoid crowding */}
        <g>
          {slices.filter(s => s.pct >= 8).map(s => (
            <text
              key={`l-${s.o.k}`}
              x={s.lx}
              y={s.ly + 3}
              textAnchor="middle"
              fontSize="9.5"
              fontWeight="600"
              fill="#fff"
              fontFamily="var(--font-mono)"
              style={{ pointerEvents: "none" }}
            >
              {s.pct}%
            </text>
          ))}
        </g>
      </svg>
      <div className="leaderboard-pie__center">
        <span className="leaderboard-pie__label mono">CERRADO</span>
        <span className="leaderboard-pie__total mono">{fmtMoney(total, true)}</span>
      </div>
    </div>
  );
}
