// KPI detail drawer — shows the opportunities/data composing each dashboard KPI

function KpiDetailDrawer({ open, onClose, kpi, ws, workspace, onOpenDeal }) {
  if (!open || !kpi) return null;

  const config = getKpiConfig(kpi, ws, workspace);

  return (
    <div className="ai-drawer" data-screen-label={`KPI · ${config.title}`}>
      <div className="ai-drawer__h">
        <h3>
          <Icon name={config.icon} size={16} style={{ color: config.color }} />
          {config.title}
          <span className="badge" style={{ background: "var(--bg-3)", color: "var(--fg-3)" }}>
            {workspace.toUpperCase()}
          </span>
        </h3>
        <div className="actions">
          <button className="btn btn--ghost btn--icon" onClick={onClose}><Icon name="x" size={14} /></button>
        </div>
      </div>

      {/* Headline */}
      <div style={{ padding: "16px 18px 12px", borderBottom: "1px solid var(--border-2)", flexShrink: 0 }}>
        <div style={{
          fontSize: 10, fontFamily: "var(--font-mono)",
          textTransform: "uppercase", letterSpacing: "0.08em",
          color: "var(--fg-3)", marginBottom: 4
        }}>
          {config.label}
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 28, fontWeight: 500, letterSpacing: "-0.02em" }}>
            {config.value}
          </span>
          {config.delta && (
            <span style={{
              fontSize: 12, fontFamily: "var(--font-mono)",
              color: config.deltaDir === "up" ? "var(--success)" : "var(--danger)",
              display: "inline-flex", alignItems: "center", gap: 3
            }}>
              <Icon name={config.deltaDir === "up" ? "arrow-up" : "arrow-down"} size={11} />
              {config.delta}
            </span>
          )}
        </div>
        <div style={{ marginTop: 10, padding: 10, background: "var(--bg-2)", border: "1px solid var(--border-2)", borderRadius: "var(--radius)", fontSize: 11, color: "var(--fg-2)", lineHeight: 1.5, fontFamily: "var(--font-mono)" }}>
          <div style={{ color: "var(--fg-3)", marginBottom: 3 }}>fórmula</div>
          {config.formula}
        </div>
      </div>

      {/* List body */}
      <div style={{ flex: 1, overflow: "auto" }}>
        {config.sections.map((sec, si) => (
          <div key={si}>
            <div style={{
              padding: "10px 18px 6px",
              fontSize: 10, fontFamily: "var(--font-mono)",
              textTransform: "uppercase", letterSpacing: "0.08em",
              color: "var(--fg-3)",
              background: "var(--bg)",
              position: "sticky", top: 0,
              borderBottom: "1px solid var(--border-2)",
              zIndex: 1,
              display: "flex", alignItems: "center", gap: 6
            }}>
              <span>{sec.title}</span>
              <span style={{ color: "var(--fg-4)" }}>· {sec.rows.length}</span>
              <span style={{ marginLeft: "auto", color: "var(--fg-2)" }}>{sec.summary}</span>
            </div>
            {sec.rows.map((row, ri) => (
              <KpiRow key={ri} row={row} onOpenDeal={onOpenDeal} onClose={onClose} kind={kpi} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function KpiRow({ row, onOpenDeal, onClose, kind }) {
  const handle = () => {
    if (row.dealId) {
      onOpenDeal?.(row.dealId);
      onClose?.();
    }
  };
  return (
    <div onClick={handle}
      style={{
        display: "grid",
        gridTemplateColumns: row.kind === "customer" ? "32px 1fr auto" : "20px 1fr auto",
        gap: 12,
        alignItems: "center",
        padding: "10px 18px",
        borderBottom: "1px solid var(--border-2)",
        cursor: row.dealId || row.company ? "pointer" : "default"
      }}
      onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-2)"}
      onMouseLeave={(e) => e.currentTarget.style.background = ""}
    >
      {row.kind === "customer" ? (
        <div className="cust__logo" style={{ width: 32, height: 32, fontSize: 12, borderRadius: 6 }}>
          {row.company.split(" ").map(s => s[0]).slice(0, 2).join("")}
        </div>
      ) : (
        <span className="dot" style={{ background: row.stageColor || "var(--accent)", width: 8, height: 8, justifySelf: "center" }} />
      )}
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {row.title}
        </div>
        <div style={{ fontSize: 11, color: "var(--fg-3)", marginTop: 2, fontFamily: "var(--font-mono)", display: "flex", gap: 8, flexWrap: "wrap" }}>
          {row.tags.map((t, i) => <span key={i}>{t}</span>)}
        </div>
      </div>
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 500 }}>{row.primary}</div>
        {row.secondary && (
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: row.secondaryColor || "var(--fg-3)", marginTop: 2 }}>
            {row.secondary}
          </div>
        )}
      </div>
    </div>
  );
}

function getKpiConfig(kpi, ws, workspace) {
  const stages = window.CRM_DATA.stages;
  const open = ws.deals.filter(d => d.stage !== "won" && d.stage !== "lost");
  const won = ws.deals.filter(d => d.stage === "won");
  const lost = ws.deals.filter(d => d.stage === "lost");
  const closed = ws.deals.filter(d => d.stage === "won" || d.stage === "lost");

  if (kpi === "forecast") {
    const total = open.reduce((acc, d) => acc + d.value * d.probability, 0);
    const sorted = [...open].sort((a, b) => (b.value * b.probability) - (a.value * a.probability));
    const stageGroups = stages
      .filter(s => s.id !== "won" && s.id !== "lost")
      .map(s => {
        const ds = sorted.filter(d => d.stage === s.id);
        return {
          title: s.label,
          summary: fmtMoney(ds.reduce((a, d) => a + d.value * d.probability, 0), true),
          rows: ds.map(d => ({
            kind: "deal",
            dealId: d.id,
            stageColor: s.color,
            title: d.name,
            tags: [d.company, fmtMoney(d.value, true), `× ${(d.probability * 100).toFixed(0)}%`, `cierre ${fmtDate(d.estimatedCloseAt, { format: "short" })}`],
            primary: fmtMoney(Math.round(d.value * d.probability), true),
            secondary: `AI ${d.ai}%`,
            secondaryColor: "var(--accent)"
          }))
        };
      });
    return {
      title: "Forecast Proyectado",
      label: "Forecast ponderado por IA · próximos 90 días",
      value: fmtMoney(total, true),
      delta: "+18.4%",
      deltaDir: "up",
      icon: "trending",
      color: "var(--accent)",
      formula: "Σ (Valor del trato × Probabilidad IA) en tratos abiertos",
      sections: stageGroups.filter(g => g.rows.length > 0)
    };
  }

  if (kpi === "velocity") {
    // Cycle time per won deal: createdAt → closedAt (estimated as ws.today - some days based on `since` baseline)
    const wonWithCycle = won.map(d => {
      const cycleDays = Math.max(1, daysBetween(d.createdAt, ws.today));
      return { d, cycleDays };
    }).sort((a, b) => b.cycleDays - a.cycleDays);
    const avg = Math.round(wonWithCycle.reduce((acc, x) => acc + x.cycleDays, 0) / Math.max(1, wonWithCycle.length));
    return {
      title: "Sales Velocity",
      label: "Tiempo promedio desde Lead hasta Cierre",
      value: avg + "d",
      delta: "-3d",
      deltaDir: "up",
      icon: "clock",
      color: "var(--success)",
      formula: "AVG(closedAt − createdAt) WHERE stage = WON · últimos 90 días",
      sections: [{
        title: "Tratos ganados",
        summary: `Promedio ${avg}d · más lento ${wonWithCycle[0]?.cycleDays}d · más rápido ${wonWithCycle[wonWithCycle.length - 1]?.cycleDays}d`,
        rows: wonWithCycle.map(({ d, cycleDays }) => ({
          kind: "deal",
          dealId: d.id,
          stageColor: "#16a34a",
          title: d.name,
          tags: [d.company, fmtMoney(d.value, true), d.isRecurring ? "SaaS" : "One-shot"],
          primary: cycleDays + "d",
          secondary: cycleDays > avg ? `+${cycleDays - avg}d vs avg` : cycleDays < avg ? `−${avg - cycleDays}d vs avg` : "= avg",
          secondaryColor: cycleDays > avg ? "var(--warning)" : "var(--success)"
        }))
      }]
    };
  }

  if (kpi === "response") {
    // Synthesize lead response times
    const rich = window.CRM_RICH;
    const inboxItems = rich.inbox[workspace];
    const responses = inboxItems.map((it, i) => {
      const mins = [12, 38, 71, 95, 130, 184, 220, 295, 380, 420][i % 10];
      const channel = it.ch === "wa" ? "WhatsApp" : it.ch === "email" ? "Email" : it.ch === "call" ? "Call" : "Form";
      return { it, mins, channel };
    });
    const totalMins = responses.reduce((acc, x) => acc + x.mins, 0);
    const avgH = (totalMins / responses.length / 60).toFixed(1);
    const under4h = responses.filter(x => x.mins < 240).length;
    return {
      title: "Lead Response Time",
      label: "Tiempo entre primer toque inbound y primera respuesta del equipo",
      value: avgH + "h",
      delta: "-22m",
      deltaDir: "up",
      icon: "clock",
      color: "var(--success)",
      formula: "AVG(first_reply_at − first_touch_at) por canal · SLA objetivo: < 4h",
      sections: [
        {
          title: "Cumplió SLA (<4h)",
          summary: `${under4h} de ${responses.length}`,
          rows: responses.filter(x => x.mins < 240).map(({ it, mins, channel }) => ({
            kind: "lead",
            stageColor: "#16a34a",
            title: it.from,
            tags: [it.co || "—", channel, it.subj],
            primary: mins < 60 ? `${mins}m` : `${(mins / 60).toFixed(1)}h`,
            secondary: "Dentro de SLA",
            secondaryColor: "var(--success)"
          }))
        },
        {
          title: "Fuera de SLA",
          summary: `${responses.length - under4h} de ${responses.length}`,
          rows: responses.filter(x => x.mins >= 240).map(({ it, mins, channel }) => ({
            kind: "lead",
            stageColor: "#d97706",
            title: it.from,
            tags: [it.co || "—", channel, it.subj],
            primary: `${(mins / 60).toFixed(1)}h`,
            secondary: "Excedió SLA",
            secondaryColor: "var(--warning)"
          }))
        }
      ].filter(s => s.rows.length > 0)
    };
  }

  if (kpi === "winrate") {
    const total = closed.length;
    const rate = Math.round((won.length / Math.max(1, total)) * 100);
    return {
      title: "Win Rate",
      label: "Tratos ganados sobre el total cerrado",
      value: rate + "%",
      delta: "+2.1pp",
      deltaDir: "up",
      icon: "trending",
      color: "var(--success)",
      formula: "WON / (WON + LOST) × 100 · últimos 90 días",
      sections: [
        {
          title: "Ganados",
          summary: `${won.length} · ${fmtMoney(won.reduce((a, d) => a + d.value, 0), true)}`,
          rows: won.map(d => ({
            kind: "deal",
            dealId: d.id,
            stageColor: "#16a34a",
            title: d.name,
            tags: [d.company, d.isRecurring ? `ARR ${fmtMoney(d.arr, true)}` : "One-shot"],
            primary: fmtMoney(d.value, true),
            secondary: "Won",
            secondaryColor: "var(--success)"
          }))
        },
        {
          title: "Perdidos",
          summary: lost.length === 0 ? "Ninguno (¡bien!)" : `${lost.length}`,
          rows: lost.map(d => ({
            kind: "deal",
            dealId: d.id,
            stageColor: "#94a3b8",
            title: d.name,
            tags: [d.company],
            primary: fmtMoney(d.value, true),
            secondary: "Lost",
            secondaryColor: "var(--danger)"
          }))
        }
      ].filter(s => s.rows.length > 0)
    };
  }

  if (kpi === "clients") {
    // Build per-company aggregates from won deals (active customers)
    const byCompany = {};
    ws.deals.forEach(d => {
      const c = byCompany[d.company] = byCompany[d.company] || { name: d.company, deals: [], won: 0, totalValue: 0, totalArr: 0 };
      c.deals.push(d);
      c.totalValue += d.value;
      if (d.stage === "won") c.won++;
      if (d.isRecurring && d.stage === "won") c.totalArr += d.arr;
    });
    const customers = Object.values(byCompany).filter(c => c.won > 0).sort((a, b) => b.totalValue - a.totalValue);
    const prospects = Object.values(byCompany).filter(c => c.won === 0).sort((a, b) => b.totalValue - a.totalValue);
    const totalArr = customers.reduce((acc, c) => acc + c.totalArr, 0);
    return {
      title: "Clientes activos",
      label: "Cuentas con al menos un trato ganado",
      value: customers.length.toString(),
      delta: "+" + Math.max(1, Math.floor(customers.length * 0.15)) + " este Q",
      deltaDir: "up",
      icon: "users",
      color: "var(--accent)",
      formula: `DISTINCT companies WHERE EXISTS(deals WHERE stage = WON) · ARR total = ${fmtMoney(totalArr, true)}`,
      sections: [
        {
          title: "Clientes activos",
          summary: `${customers.length} cuentas · ${fmtMoney(customers.reduce((a, c) => a + c.totalValue, 0), true)} contratado`,
          rows: customers.map(c => {
            const featured = window.CRM_RICH.featured[workspace];
            return {
              kind: "customer",
              dealId: c.deals.find(d => d.stage === "won")?.id,
              company: c.name,
              title: c.name,
              tags: [
                `${c.won} ganado${c.won > 1 ? "s" : ""}`,
                `${c.deals.length - c.won} activo${c.deals.length - c.won === 1 ? "" : "s"}`,
                c.totalArr > 0 ? `ARR ${fmtMoney(c.totalArr, true)}` : "One-shot",
                c.name === featured?.name ? "Featured 360" : ""
              ].filter(Boolean),
              primary: fmtMoney(c.totalValue, true),
              secondary: c.totalArr > 0 ? "Recurrente" : "Project",
              secondaryColor: c.totalArr > 0 ? "var(--accent)" : "var(--fg-3)"
            };
          })
        },
        {
          title: "Prospects (sin ganar todavía)",
          summary: `${prospects.length} cuentas`,
          rows: prospects.slice(0, 12).map(c => ({
            kind: "customer",
            dealId: c.deals[0]?.id,
            company: c.name,
            title: c.name,
            tags: [`${c.deals.length} trato${c.deals.length > 1 ? "s" : ""} abierto${c.deals.length > 1 ? "s" : ""}`],
            primary: fmtMoney(c.totalValue, true),
            secondary: "Pipeline",
            secondaryColor: "var(--fg-3)"
          }))
        }
      ].filter(s => s.rows.length > 0)
    };
  }

  // ─── SaaS Metrics — ARR family ─────────────────────────────────
  const recurring = ws.deals.filter(d => d.arr > 0);
  const recurringWon = recurring.filter(d => d.stage === "won");
  const recurringOpen = recurring.filter(d => d.stage !== "won" && d.stage !== "lost");
  const recurringLost = recurring.filter(d => d.stage === "lost");
  const totalARR = recurringWon.reduce((a, d) => a + d.arr, 0);
  const pipelineARRw = recurringOpen.reduce((a, d) => a + d.arr * d.probability, 0);

  // Stage colors lookup
  const stageColor = (id) => stages.find(s => s.id === id)?.color || "var(--accent)";
  const stageLabel = (id) => stages.find(s => s.id === id)?.label || id;

  if (kpi === "arr_total") {
    const sortedWon = [...recurringWon].sort((a, b) => b.arr - a.arr);
    return {
      title: "ARR Total",
      label: "Annual Recurring Revenue de clientes activos",
      value: fmtMoney(totalARR, true),
      delta: "+24%",
      deltaDir: "up",
      icon: "dollar",
      color: "var(--success)",
      formula: "Σ ARR de tratos ganados con contrato recurrente · snapshot actual",
      sections: [{
        title: "Contratos activos",
        summary: `${sortedWon.length} clientes · ${fmtMoney(totalARR, true)}`,
        rows: sortedWon.map(d => ({
          kind: "deal", dealId: d.id, stageColor: "#16a34a",
          title: d.name,
          tags: [d.company, `Plan ${fmtMoney(Math.round(d.arr / 12), true)}/mes`, `Won`],
          primary: fmtMoney(d.arr, true),
          secondary: `${((d.arr / totalARR) * 100).toFixed(1)}%`,
          secondaryColor: "var(--fg-3)"
        }))
      }].filter(s => s.rows.length > 0)
    };
  }

  if (kpi === "mrr") {
    const sortedWon = [...recurringWon].sort((a, b) => b.arr - a.arr);
    const totalMRR = Math.round(totalARR / 12);
    return {
      title: "MRR Estimado",
      label: "Monthly Recurring Revenue · ingreso mensual contratado",
      value: fmtMoney(totalMRR, true),
      delta: "+2.1%",
      deltaDir: "up",
      icon: "dollar",
      color: "var(--success)",
      formula: "ARR / 12 por contrato · suma sobre clientes activos",
      sections: [{
        title: "MRR por cliente",
        summary: `${sortedWon.length} clientes · ${fmtMoney(totalMRR, true)}/mes`,
        rows: sortedWon.map(d => {
          const mrr = Math.round(d.arr / 12);
          return {
            kind: "deal", dealId: d.id, stageColor: "#16a34a",
            title: d.name,
            tags: [d.company, `ARR ${fmtMoney(d.arr, true)}`, "Mensual"],
            primary: fmtMoney(mrr, true),
            secondary: "/mes",
            secondaryColor: "var(--fg-3)"
          };
        })
      }].filter(s => s.rows.length > 0)
    };
  }

  if (kpi === "new_arr") {
    const sortedWon = [...recurringWon].sort((a, b) => b.arr - a.arr);
    return {
      title: "New ARR ganado",
      label: "ARR neto incorporado en el período",
      value: fmtMoney(totalARR, true),
      delta: "+18%",
      deltaDir: "up",
      icon: "trending",
      color: "var(--success)",
      formula: "Σ ARR de tratos WHERE stage = WON AND isRecurring · período actual",
      sections: [{
        title: "Tratos cerrados",
        summary: `${sortedWon.length} · ${fmtMoney(totalARR, true)}`,
        rows: sortedWon.map(d => ({
          kind: "deal", dealId: d.id, stageColor: "#16a34a",
          title: d.name,
          tags: [d.company, `Cerrado ${fmtDate(d.estimatedCloseAt, { format: "short" })}`, `Owner ${ws.owners[d.owner]?.name || d.owner}`],
          primary: fmtMoney(d.arr, true),
          secondary: "New ARR",
          secondaryColor: "var(--success)"
        }))
      }].filter(s => s.rows.length > 0)
    };
  }

  if (kpi === "pipeline_arr") {
    const stageGroups = stages.filter(s => s.id !== "won" && s.id !== "lost").map(s => {
      const ds = recurringOpen.filter(d => d.stage === s.id).sort((a, b) => (b.arr * b.probability) - (a.arr * a.probability));
      return {
        title: s.label,
        summary: fmtMoney(ds.reduce((a, d) => a + d.arr * d.probability, 0), true),
        rows: ds.map(d => ({
          kind: "deal", dealId: d.id, stageColor: s.color,
          title: d.name,
          tags: [d.company, `ARR ${fmtMoney(d.arr, true)}`, `× ${(d.probability * 100).toFixed(0)}%`],
          primary: fmtMoney(Math.round(d.arr * d.probability), true),
          secondary: `AI ${d.ai}%`,
          secondaryColor: "var(--accent)"
        }))
      };
    });
    return {
      title: "Pipeline ARR (weighted)",
      label: "ARR potencial en pipeline ponderado por probabilidad",
      value: fmtMoney(pipelineARRw, true),
      delta: "+12%",
      deltaDir: "up",
      icon: "trending",
      color: "var(--accent)",
      formula: "Σ (ARR × Probabilidad IA) WHERE isRecurring AND stage NOT IN (WON, LOST)",
      sections: stageGroups.filter(g => g.rows.length > 0)
    };
  }

  if (kpi === "net_retention") {
    // Synthesize per-customer NRR: expansion (upsell/usage), contraction (downgrade), churn
    const customers = recurringWon.map((d, i) => {
      // Deterministic mock movement based on deal id hash
      const seed = (d.id || "x").charCodeAt(0) + (d.id || "xx").charCodeAt(1 % d.id.length);
      const r = (seed % 100) / 100;
      let type, deltaPct;
      if (r < 0.55) { type = "expansion"; deltaPct = 8 + Math.floor(r * 30); }
      else if (r < 0.85) { type = "flat"; deltaPct = 0; }
      else { type = "contraction"; deltaPct = -(4 + Math.floor((1 - r) * 80)); }
      return { d, type, deltaPct, deltaArr: Math.round(d.arr * (deltaPct / 100)) };
    });
    const exp = customers.filter(c => c.type === "expansion");
    const con = customers.filter(c => c.type === "contraction");
    const flat = customers.filter(c => c.type === "flat");
    const nrrNum = totalARR + customers.reduce((a, c) => a + c.deltaArr, 0);
    return {
      title: "Net Revenue Retention",
      label: "Retención neta de ingreso recurrente · cohorte 12m",
      value: workspace === "novit" ? "112%" : "104%",
      delta: "+4pp",
      deltaDir: "up",
      icon: "trending",
      color: "var(--success)",
      formula: "(ARR inicio + Expansión − Contracción − Churn) / ARR inicio · cohorte 12m",
      sections: [
        {
          title: "Expansión (upsell · cross-sell)",
          summary: `+${fmtMoney(exp.reduce((a, c) => a + c.deltaArr, 0), true)}`,
          rows: exp.sort((a, b) => b.deltaArr - a.deltaArr).map(({ d, deltaPct, deltaArr }) => ({
            kind: "deal", dealId: d.id, stageColor: "#16a34a",
            title: d.name,
            tags: [d.company, `ARR ${fmtMoney(d.arr, true)}`, "Expansion"],
            primary: `+${fmtMoney(deltaArr, true)}`,
            secondary: `+${deltaPct}%`,
            secondaryColor: "var(--success)"
          }))
        },
        {
          title: "Estables",
          summary: `${flat.length} clientes`,
          rows: flat.map(({ d }) => ({
            kind: "deal", dealId: d.id, stageColor: "#94a3b8",
            title: d.name,
            tags: [d.company, `ARR ${fmtMoney(d.arr, true)}`, "Sin cambio"],
            primary: fmtMoney(d.arr, true),
            secondary: "Flat",
            secondaryColor: "var(--fg-3)"
          }))
        },
        {
          title: "Contracción (downgrade)",
          summary: con.length === 0 ? "Ninguna" : fmtMoney(con.reduce((a, c) => a + c.deltaArr, 0), true),
          rows: con.sort((a, b) => a.deltaArr - b.deltaArr).map(({ d, deltaPct, deltaArr }) => ({
            kind: "deal", dealId: d.id, stageColor: "#d97706",
            title: d.name,
            tags: [d.company, `ARR ${fmtMoney(d.arr, true)}`, "Downgrade"],
            primary: fmtMoney(deltaArr, true),
            secondary: `${deltaPct}%`,
            secondaryColor: "var(--warning)"
          }))
        }
      ].filter(s => s.rows.length > 0)
    };
  }

  if (kpi === "logo_churn") {
    // Synthesize at-risk and churned customers
    const sortedWon = [...recurringWon].sort((a, b) => a.arr - b.arr);
    // First 1-2 are "churned" (lost logos in the period)
    const churned = sortedWon.slice(0, Math.min(1, sortedWon.length)).map(d => ({ d, reason: "Reducción de equipo" }));
    const atRisk = sortedWon.slice(churned.length, churned.length + 3).map(d => {
      const reasons = ["Bajo uso (-42% MAU)", "Sin renovación en 60d", "NPS detractor", "Champion salió de la cuenta"];
      const seed = (d.id || "x").charCodeAt(0);
      return { d, reason: reasons[seed % reasons.length], score: 60 + (seed % 30) };
    });
    return {
      title: "Logo Churn",
      label: "Tasa de pérdida de clientes recurrentes · 12m rolling",
      value: workspace === "novit" ? "2.1%" : "4.8%",
      delta: "-0.6pp",
      deltaDir: "up",
      icon: "alert",
      color: "var(--warning)",
      formula: "Logos perdidos / Logos activos al inicio del período × 100",
      sections: [
        {
          title: "Logos perdidos (período)",
          summary: churned.length === 0 ? "Ninguno" : `${churned.length} · ${fmtMoney(churned.reduce((a, c) => a + c.d.arr, 0), true)} ARR`,
          rows: churned.map(({ d, reason }) => ({
            kind: "deal", dealId: d.id, stageColor: "#dc2626",
            title: d.name,
            tags: [d.company, reason, `ARR perdido ${fmtMoney(d.arr, true)}`],
            primary: fmtMoney(d.arr, true),
            secondary: "Churned",
            secondaryColor: "var(--danger)"
          }))
        },
        {
          title: "En riesgo (health < 70)",
          summary: `${atRisk.length} cuentas · ${fmtMoney(atRisk.reduce((a, c) => a + c.d.arr, 0), true)} ARR`,
          rows: atRisk.map(({ d, reason, score }) => ({
            kind: "deal", dealId: d.id, stageColor: "#d97706",
            title: d.name,
            tags: [d.company, reason, `Health ${score}/100`],
            primary: fmtMoney(d.arr, true),
            secondary: "At risk",
            secondaryColor: "var(--warning)"
          }))
        }
      ].filter(s => s.rows.length > 0)
    };
  }

  if (kpi === "cac_payback") {
    // CAC payback per customer: CAC (mock 15-25% of ARR) / Gross-margin MRR
    const cacPct = workspace === "novit" ? 0.22 : 0.14;
    const gm = 0.75; // gross margin
    const rows = recurringWon.map(d => {
      const cac = Math.round(d.arr * cacPct);
      const monthly = (d.arr * gm) / 12;
      const months = monthly > 0 ? Math.round(cac / monthly) : 0;
      return { d, cac, months };
    }).sort((a, b) => b.months - a.months);
    const avgMonths = Math.round(rows.reduce((a, r) => a + r.months, 0) / Math.max(1, rows.length));
    return {
      title: "CAC Payback",
      label: "Meses para recuperar el costo de adquisición",
      value: workspace === "novit" ? "11m" : "6m",
      delta: "-2m",
      deltaDir: "up",
      icon: "clock",
      color: "var(--accent)",
      formula: "CAC / (MRR × Gross Margin) · margen bruto asumido 75%",
      sections: [{
        title: "Por cliente",
        summary: `Promedio ${avgMonths}m · más rápido ${rows[rows.length - 1]?.months}m · más lento ${rows[0]?.months}m`,
        rows: rows.map(({ d, cac, months }) => ({
          kind: "deal", dealId: d.id, stageColor: "#16a34a",
          title: d.name,
          tags: [d.company, `CAC ${fmtMoney(cac, true)}`, `ARR ${fmtMoney(d.arr, true)}`],
          primary: months + "m",
          secondary: months > avgMonths ? `+${months - avgMonths}m vs avg` : months < avgMonths ? `−${avgMonths - months}m vs avg` : "= avg",
          secondaryColor: months > avgMonths ? "var(--warning)" : "var(--success)"
        }))
      }].filter(s => s.rows.length > 0)
    };
  }

  if (kpi === "ltv_cac") {
    // LTV = ARR × Gross Margin / Churn ; CAC = % of ARR
    const cacPct = workspace === "novit" ? 0.22 : 0.14;
    const gm = 0.75;
    const churn = workspace === "novit" ? 0.021 : 0.048;
    const rows = recurringWon.map(d => {
      const cac = Math.round(d.arr * cacPct);
      const ltv = Math.round((d.arr * gm) / churn);
      const ratio = cac > 0 ? (ltv / cac) : 0;
      return { d, cac, ltv, ratio };
    }).sort((a, b) => b.ratio - a.ratio);
    const avgRatio = rows.reduce((a, r) => a + r.ratio, 0) / Math.max(1, rows.length);
    return {
      title: "LTV / CAC",
      label: "Valor de vida del cliente sobre costo de adquisición",
      value: workspace === "novit" ? "4.2x" : "5.8x",
      delta: "+0.4x",
      deltaDir: "up",
      icon: "trending",
      color: "var(--success)",
      formula: "(ARR × Gross Margin / Churn) / CAC · benchmark saludable ≥ 3x",
      sections: [{
        title: "Por cliente",
        summary: `Promedio ${avgRatio.toFixed(1)}x · ${rows.filter(r => r.ratio >= 3).length}/${rows.length} sobre benchmark`,
        rows: rows.map(({ d, cac, ltv, ratio }) => ({
          kind: "deal", dealId: d.id, stageColor: "#16a34a",
          title: d.name,
          tags: [d.company, `LTV ${fmtMoney(ltv, true)}`, `CAC ${fmtMoney(cac, true)}`],
          primary: ratio.toFixed(1) + "x",
          secondary: ratio >= 3 ? "Saludable" : "Bajo benchmark",
          secondaryColor: ratio >= 3 ? "var(--success)" : "var(--warning)"
        }))
      }].filter(s => s.rows.length > 0)
    };
  }

  if (kpi === "conversion") {
    const total = ws.deals.length;
    const rate = Math.round((won.length / Math.max(1, total)) * 100);
    const openByStage = stages.filter(s => s.id !== "won" && s.id !== "lost").map(s => {
      const ds = open.filter(d => d.stage === s.id);
      return { stage: s, rows: ds.sort((a, b) => b.value - a.value) };
    }).filter(g => g.rows.length > 0);
    return {
      title: "Tasa de Conversión",
      label: "Conversión de lead a cliente · todo el funnel",
      value: rate + "%",
      delta: "+3.2pp",
      deltaDir: "up",
      icon: "trending",
      color: "var(--accent)",
      formula: `WON / (WON + LOST + OPEN) × 100 · ${won.length}/${total} tratos`,
      sections: [
        {
          title: "Convirtieron",
          summary: `${won.length} · ${fmtMoney(won.reduce((a, d) => a + d.value, 0), true)}`,
          rows: won.map(d => ({
            kind: "deal", dealId: d.id, stageColor: "#16a34a",
            title: d.name,
            tags: [d.company, `${daysBetween(d.createdAt, ws.today)}d en pipeline`, ws.owners[d.owner]?.name || d.owner],
            primary: fmtMoney(d.value, true),
            secondary: "Won",
            secondaryColor: "var(--success)"
          }))
        },
        ...openByStage.map(g => ({
          title: `En curso · ${g.stage.label}`,
          summary: `${g.rows.length} · ${fmtMoney(g.rows.reduce((a, d) => a + d.value, 0), true)}`,
          rows: g.rows.map(d => ({
            kind: "deal", dealId: d.id, stageColor: g.stage.color,
            title: d.name,
            tags: [d.company, `${(d.probability * 100).toFixed(0)}%`, ws.owners[d.owner]?.name || d.owner],
            primary: fmtMoney(d.value, true),
            secondary: `AI ${d.ai}%`,
            secondaryColor: "var(--accent)"
          }))
        })),
        {
          title: "No convirtieron",
          summary: lost.length === 0 ? "Ninguno" : `${lost.length} · ${fmtMoney(lost.reduce((a, d) => a + d.value, 0), true)}`,
          rows: lost.map(d => ({
            kind: "deal", dealId: d.id, stageColor: "#dc2626",
            title: d.name,
            tags: [d.company, `${daysBetween(d.createdAt, ws.today)}d en pipeline`, ws.owners[d.owner]?.name || d.owner],
            primary: fmtMoney(d.value, true),
            secondary: "Lost",
            secondaryColor: "var(--danger)"
          }))
        }
      ].filter(s => s.rows.length > 0)
    };
  }

  if (kpi === "lost_forecast") {
    const lostValue = lost.reduce((a, d) => a + d.value, 0);
    // Synthesize loss reasons deterministically
    const reasons = ["Precio", "Timing / presupuesto", "Competencia", "Sin sponsor", "Ghosting", "Fit técnico"];
    const enriched = lost.map(d => {
      const seed = (d.id || "x").split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
      const reason = reasons[seed % reasons.length];
      return { d, reason };
    });
    // Group by reason
    const byReason = {};
    enriched.forEach(({ d, reason }) => {
      byReason[reason] = byReason[reason] || { reason, deals: [], value: 0 };
      byReason[reason].deals.push(d);
      byReason[reason].value += d.value;
    });
    const groups = Object.values(byReason).sort((a, b) => b.value - a.value);
    return {
      title: "Forecast Perdido",
      label: "Valor total de tratos cerrados como Lost",
      value: fmtMoney(lostValue, true),
      delta: lost.length + " tratos",
      deltaDir: "down",
      icon: "alert",
      color: "var(--danger)",
      formula: "Σ Valor WHERE stage = LOST · agrupado por razón de pérdida",
      sections: groups.map(g => ({
        title: g.reason,
        summary: `${g.deals.length} · ${fmtMoney(g.value, true)}`,
        rows: g.deals.sort((a, b) => b.value - a.value).map(d => ({
          kind: "deal", dealId: d.id, stageColor: "#dc2626",
          title: d.name,
          tags: [d.company, `${daysBetween(d.createdAt, ws.today)}d en pipeline`, ws.owners[d.owner]?.name || d.owner],
          primary: fmtMoney(d.value, true),
          secondary: "Lost",
          secondaryColor: "var(--danger)"
        }))
      }))
    };
  }

  // Fallback
  return { title: "KPI", label: "—", value: "—", icon: "alert", color: "var(--fg-3)", formula: "—", sections: [] };
}

window.KpiDetailDrawer = KpiDetailDrawer;
