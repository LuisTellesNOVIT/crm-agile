import { useMemo, useState } from "react";
import { fmtMoney } from "../../lib/format";
import { STAGES } from "../../lib/stages";
import { Icon } from "../shell/Icon";
import { Card } from "../ui/Card";
import type { Deal, StageId } from "../../lib/types";
import type { Currency } from "../../lib/store";

type Horizon = 12 | 24 | 36;
type Mode = "monthly" | "timeline";

const STAGES_ORDER: StageId[] = ["discovery", "qualified", "proposal", "negotiation", "signing"];

function stageColorById(id: StageId): string {
  return STAGES.find((s) => s.id === id)?.color ?? "#94a3b8";
}

const MONTH_SHORT_ES = ["E", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
const MONTH_LONG_ES = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
];

export function ForecastHorizons({
  deals,
  today,
  currency,
  onOpenDeal,
  defaultHorizon = 36,
  defaultMode = "timeline",
}: {
  deals: Deal[];
  today: Date;
  currency: Currency;
  onOpenDeal: (id: string) => void;
  defaultHorizon?: Horizon;
  defaultMode?: Mode;
}) {
  const [horizon, setHorizon] = useState<Horizon>(defaultHorizon);
  const [mode, setMode] = useState<Mode>(defaultMode);

  const open = useMemo(
    () => deals.filter((d) => d.stage !== "won" && d.stage !== "lost"),
    [deals],
  );

  const buckets = useMemo(() => {
    const startMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const out: { month: Date; total: number; byStage: Partial<Record<StageId, number>> }[] = [];
    for (let i = 0; i < horizon; i++) {
      const m = new Date(startMonth.getFullYear(), startMonth.getMonth() + i, 1);
      out.push({ month: m, total: 0, byStage: {} });
    }
    const idxOf = (date: Date) =>
      (date.getFullYear() - startMonth.getFullYear()) * 12 +
      (date.getMonth() - startMonth.getMonth());

    open.forEach((d) => {
      const closeIdx = idxOf(new Date(d.estimatedCloseAt));
      if (d.isRecurring && d.arr) {
        const monthly = (d.arr / 12) * d.probability;
        for (let i = Math.max(0, closeIdx); i < horizon; i++) {
          out[i].total += monthly;
          out[i].byStage[d.stage] = (out[i].byStage[d.stage] || 0) + monthly;
        }
      } else if (closeIdx >= 0 && closeIdx < horizon) {
        const weighted = d.value * d.probability;
        out[closeIdx].total += weighted;
        out[closeIdx].byStage[d.stage] = (out[closeIdx].byStage[d.stage] || 0) + weighted;
      }
    });
    return out;
  }, [open, today, horizon]);

  const grand = buckets.reduce((a, b) => a + b.total, 0);
  const monthlyAvg = grand / Math.max(1, horizon);
  const peak = buckets.reduce(
    (acc, b, i) => (b.total > acc.total ? { ...b, i } : acc),
    { total: 0, i: 0, month: today },
  );
  const maxBar = Math.max(1, ...buckets.map((b) => b.total));

  // SaaS POST-PROYECTO: el recurrente arranca el mes siguiente al fin del proyecto.
  // - ARR activo: ARR anualizado de los proyectos que terminan dentro del horizonte.
  // - SaaS facturado: MRR × meses facturados (desde fin de proyecto+1 hasta el fin del horizonte).
  const { saasArrRunRate, saasAccrued } = useMemo(() => {
    const startMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthIdxOf = (d: Date) =>
      (d.getFullYear() - startMonth.getFullYear()) * 12 + (d.getMonth() - startMonth.getMonth());
    const projEnd = (d: Deal) => {
      if (d.projectEndAt) return new Date(d.projectEndAt);
      const s = d.projectStartAt ? new Date(d.projectStartAt) : new Date(d.estimatedCloseAt);
      const e = new Date(s);
      e.setMonth(e.getMonth() + 2);
      return e;
    };
    let runRate = 0; // ARR anual activo (proyectos terminados en el horizonte)
    let accrued = 0; // SaaS facturado acumulado post-proyecto
    open.forEach((d) => {
      if (!d.isRecurring || !d.arr) return;
      const endIdx = monthIdxOf(projEnd(d));
      if (endIdx < horizon) {
        runRate += d.arr * d.probability;
        const monthly = (d.arr / 12) * d.probability;
        accrued += monthly * Math.max(0, horizon - 1 - endIdx); // meses facturando
      }
    });
    return { saasArrRunRate: runRate, saasAccrued: accrued };
  }, [open, today, horizon]);

  return (
    <Card>
      <Card.Header label="Forecast por horizonte" sub="Pipeline ponderado por probabilidad IA + ARR recurrente">
        <Icon name="trending" size={14} style={{ color: "var(--accent)" }} />
        <span style={{ fontWeight: 600 }}>Forecast por horizonte</span>
      </Card.Header>
      <Card.Body style={{ padding: "12px 16px 16px" }}>
        <div className="fc-horizons">
          {([12, 24, 36] as Horizon[]).map((h) => (
            <button
              key={h}
              type="button"
              className={horizon === h ? "is-active" : ""}
              onClick={() => setHorizon(h)}
            >
              {h} meses
            </button>
          ))}
          <span style={{ width: 1, height: 18, background: "var(--border)", margin: "0 6px" }} />
          <div
            style={{
              display: "flex",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius)",
              overflow: "hidden",
              background: "var(--bg-2)",
            }}
          >
            <button
              type="button"
              onClick={() => setMode("monthly")}
              style={{
                padding: "5px 10px",
                fontSize: 11,
                fontFamily: "var(--font-mono)",
                borderRight: "1px solid var(--border)",
                color: mode === "monthly" ? "var(--fg)" : "var(--fg-3)",
                background: mode === "monthly" ? "var(--bg)" : "transparent",
                border: "none",
                cursor: "pointer",
              }}
            >
              <Icon name="dashboard" size={11} style={{ verticalAlign: "middle", marginRight: 4 }} />
              Mensual
            </button>
            <button
              type="button"
              onClick={() => setMode("timeline")}
              style={{
                padding: "5px 10px",
                fontSize: 11,
                fontFamily: "var(--font-mono)",
                color: mode === "timeline" ? "var(--fg)" : "var(--fg-3)",
                background: mode === "timeline" ? "var(--bg)" : "transparent",
                border: "none",
                cursor: "pointer",
              }}
            >
              <Icon name="gantt" size={11} style={{ verticalAlign: "middle", marginRight: 4 }} />
              Timeline + SaaS
            </button>
          </div>
          <span style={{ flex: 1 }} />
          <div style={{ display: "flex", gap: 10, fontSize: 11 }}>
            {STAGES_ORDER.map((s) => (
              <span key={s} style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "var(--fg-3)" }}>
                <span className="dot" style={{ background: stageColorById(s), width: 6, height: 6 }} />
                {STAGES.find((x) => x.id === s)?.label ?? s}
              </span>
            ))}
          </div>
        </div>

        {mode === "monthly" ? (
          <div className="fc-chart" style={{ height: horizon > 12 ? 140 : 180 }}>
            {buckets.map((b, i) => {
              const monthLbl = MONTH_SHORT_ES[b.month.getMonth()];
              const showLbl = horizon <= 12 || i % 3 === 0;
              return (
                <div key={i} className="fc-bar">
                  <div className="fc-bar__total">
                    {fmtMoney(b.total, currency)} · {monthLbl}{b.month.getFullYear() % 100}
                  </div>
                  <div
                    className="fc-bar__stack"
                    style={{ height: (b.total / maxBar) * 100 + "%", minHeight: b.total > 0 ? 2 : 0 }}
                  >
                    {STAGES_ORDER.map((s) => {
                      const v = b.byStage[s] || 0;
                      if (!v) return null;
                      return (
                        <div
                          key={s}
                          className="fc-bar__seg"
                          style={{ background: stageColorById(s), flex: v }}
                        />
                      );
                    })}
                  </div>
                  {showLbl && (
                    <div className="fc-bar__label">
                      {monthLbl}
                      {horizon > 12 ? "'" + (b.month.getFullYear() % 100) : ""}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <TimelineChart open={open} today={today} horizon={horizon} currency={currency} onOpenDeal={onOpenDeal} view="band" />
        )}

        <div className="fc-summary">
          <div>
            <small>Forecast total · {horizon}m</small>
            <b>{fmtMoney(grand, currency)}</b>
          </div>
          <div>
            <small>Promedio mensual</small>
            <b>{fmtMoney(monthlyAvg, currency)}</b>
          </div>
          <div>
            <small>Pico</small>
            <b>
              {fmtMoney(peak.total, currency)}{" "}
              <span style={{ color: "var(--fg-3)", fontSize: 11, fontWeight: 400 }}>
                · {MONTH_LONG_ES[peak.month.getMonth()]} {peak.month.getFullYear()}
              </span>
            </b>
          </div>
          <div className="fc-summary__saas">
            <small>SaaS ARR activo · anual</small>
            <b style={{ color: "var(--info)" }}>{fmtMoney(saasArrRunRate, currency)}</b>
          </div>
          <div className="fc-summary__saas">
            <small>SaaS facturado · {horizon}m</small>
            <b style={{ color: "var(--info)" }}>{fmtMoney(saasAccrued, currency)}</b>
          </div>
        </div>
      </Card.Body>
    </Card>
  );
}

function TimelineChart({
  open,
  today,
  horizon,
  currency,
  onOpenDeal,
  view = "band",
}: {
  open: Deal[];
  today: Date;
  horizon: Horizon;
  currency: Currency;
  onOpenDeal: (id: string) => void;
  view?: "band" | "gantt";
}) {
  const startMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const months = Array.from(
    { length: horizon },
    (_, i) => new Date(startMonth.getFullYear(), startMonth.getMonth() + i, 1),
  );
  const endMonth = new Date(today.getFullYear(), today.getMonth() + horizon, 1);
  const totalMs = endMonth.getTime() - startMonth.getTime();
  const dayToPct = (d: Date | string) => {
    const date = typeof d === "string" ? new Date(d) : d;
    return ((date.getTime() - startMonth.getTime()) / totalMs) * 100;
  };

  // Ventana de proyecto: usa projectStartAt/projectEndAt. Si faltan, cae al
  // cierre estimado como inicio + 2 meses de duración por default.
  const projectWindow = (d: Deal) => {
    const start = d.projectStartAt ? new Date(d.projectStartAt) : new Date(d.estimatedCloseAt);
    let end: Date;
    if (d.projectEndAt) end = new Date(d.projectEndAt);
    else {
      end = new Date(start);
      end.setMonth(end.getMonth() + 2);
    }
    return { start, end };
  };

  // El Gantt grafica en función a las FECHAS DEL PROYECTO (inicio → fin),
  // no a la recurrencia. Mostramos los proyectos que solapan el horizonte.
  const windowed = useMemo(
    () =>
      open
        .map((d) => ({ d, ...projectWindow(d) }))
        .filter(({ end, start }) => end >= startMonth && start < endMonth)
        .sort((a, b) => a.start.getTime() - b.start.getTime()),
    [open, startMonth, endMonth],
  );
  const visible = windowed.slice(0, 14);
  const hidden = Math.max(0, windowed.length - visible.length);

  const saasH = 96;
  const monthIdxOf = (d: Date) =>
    (d.getFullYear() - startMonth.getFullYear()) * 12 + (d.getMonth() - startMonth.getMonth());

  // Dos series ACUMULADAS, ponderadas por prob:
  // - SETUP: el costo del proyecto se REPARTE entre los meses del proyecto
  //   (se reconoce mes a mes desde el inicio hasta el fin del proyecto).
  // - SaaS: recurrente, arranca el mes SIGUIENTE al fin del proyecto y se acumula.
  const { setupSeries, saasSeries, billingSeries } = useMemo(() => {
    const setup: number[] = new Array(horizon).fill(0);
    const saas: number[] = new Array(horizon).fill(0);
    open.forEach((d) => {
      const { start, end } = projectWindow(d);
      const startIdx = monthIdxOf(start);
      const endIdx = monthIdxOf(end);
      const durMonths = Math.max(1, endIdx - startIdx); // meses del proyecto
      const w = d.probability;
      const monthlySetup = (d.value * w) / durMonths; // setup repartido por mes
      const mrr = d.isRecurring && d.arr > 0 ? (d.arr / 12) * w : 0;
      for (let i = 0; i < horizon; i++) {
        // SETUP: se reconoce mes a mes durante el proyecto (start..end)
        const elapsed = Math.max(0, Math.min(i - startIdx + 1, durMonths));
        setup[i] += monthlySetup * elapsed;
        // SaaS: arranca el mes siguiente al fin del proyecto
        if (mrr && i > endIdx) saas[i] += mrr * (i - endIdx);
      }
    });
    return { setupSeries: setup, saasSeries: saas, billingSeries: setup.map((s, i) => s + saas[i]) };
  }, [open, horizon, startMonth]);
  const maxBilling = Math.max(1, ...setupSeries, ...saasSeries);
  const SETUP_COLOR = "#7c3aed"; // violeta = Setup
  const SAAS_COLOR = "#0ea5e9"; // azul = SaaS recurrente

  // Construye un path de línea suave (cubic) a partir de una serie.
  const buildLine = (series: number[]) => {
    if (!series.length) return "";
    const pts = series.map((v, i) => {
      const x = (i / (horizon - 1)) * 100;
      const y = saasH - (v / maxBilling) * saasH;
      return [x, y] as const;
    });
    let dStr = `M${pts[0][0]},${pts[0][1]}`;
    for (let i = 1; i < pts.length; i++) {
      const [x1, y1] = pts[i - 1];
      const [x2, y2] = pts[i];
      const cx = (x1 + x2) / 2;
      dStr += ` C${cx},${y1} ${cx},${y2} ${x2},${y2}`;
    }
    return dStr;
  };
  const setupLine = buildLine(setupSeries);
  const saasLine = buildLine(saasSeries);

  const todayPct = dayToPct(today);
  const rowH = 22;
  const chartH = Math.max(60, visible.length * rowH + 8);

  if (view === "band") {
  return (
    <div style={{ marginTop: 14 }}>
      <div
        style={{
          position: "relative",
          height: saasH,
          marginBottom: 4,
          border: "1px solid var(--border-2)",
          borderRadius: "var(--radius)",
          background: "var(--bg-2)",
          padding: "8px 0 0",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 8, left: 12,
            fontSize: 10, fontFamily: "var(--font-mono)",
            textTransform: "uppercase", letterSpacing: "0.06em",
            color: "var(--fg-3)",
            zIndex: 3,
            display: "flex", alignItems: "center", gap: 6,
          }}
        >
          <Icon name="dollar" size={11} style={{ color: "var(--info)" }} />
          Facturación proyectada · {fmtMoney(billingSeries[billingSeries.length - 1] || 0, currency)} acum. al mes {horizon}
          <span style={{ display: "inline-flex", gap: 10, textTransform: "none", letterSpacing: 0, marginLeft: 6 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 3, color: SETUP_COLOR }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: SETUP_COLOR }} /> Setup
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 3, color: SAAS_COLOR }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: SAAS_COLOR }} /> SaaS
            </span>
          </span>
        </div>

        {/* Dos líneas acumuladas: SETUP (violeta, repartido en el proyecto)
            + SaaS (azul, post-proyecto). */}
        <div style={{ position: "absolute", left: 12, right: 58, bottom: 14, top: 30 }}>
          <svg viewBox={`0 0 100 ${saasH}`} preserveAspectRatio="none" style={{ width: "100%", height: "100%", overflow: "visible" }}>
            <path d={`${setupLine} L100,${saasH} L0,${saasH} Z`} fill={SETUP_COLOR} opacity="0.07" />
            <path d={`${saasLine} L100,${saasH} L0,${saasH} Z`} fill={SAAS_COLOR} opacity="0.07" />
            <path d={setupLine} fill="none" stroke={SETUP_COLOR} strokeWidth="1.8" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
            <path d={saasLine} fill="none" stroke={SAAS_COLOR} strokeWidth="1.8" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
          </svg>
        </div>

        {/* Escala numérica (eje Y) de lo que se cobrará */}
        <div
          style={{
            position: "absolute",
            right: 8, top: 28, bottom: 14,
            display: "flex", flexDirection: "column",
            justifyContent: "space-between", alignItems: "flex-end",
            fontFamily: "var(--font-mono)", fontSize: 9,
          }}
        >
          <span style={{ color: "var(--info)", fontWeight: 600 }}>{fmtMoney(maxBilling, currency)}</span>
          <span style={{ color: "var(--fg-3)" }}>{fmtMoney(maxBilling / 2, currency)}</span>
          <span style={{ color: "var(--fg-4)" }}>0</span>
        </div>

        {/* Línea de hoy */}
        <div
          style={{
            position: "absolute",
            left: `calc(12px + (100% - 70px) * ${todayPct / 100})`, top: 24, bottom: 14,
            width: 1, background: "var(--accent)", opacity: 0.5, zIndex: 2,
          }}
        />

        {/* eje X: mes inicial → mes final */}
        <div style={{ position: "absolute", left: 12, bottom: 2, fontFamily: "var(--font-mono)", fontSize: 8.5, color: "var(--fg-4)" }}>
          {MONTH_SHORT_ES[months[0]?.getMonth() ?? 0]}'{months[0]?.getFullYear() % 100}
        </div>
        <div style={{ position: "absolute", right: 58, bottom: 2, fontFamily: "var(--font-mono)", fontSize: 8.5, color: "var(--fg-4)" }}>
          {MONTH_SHORT_ES[months[horizon - 1]?.getMonth() ?? 0]}'{months[horizon - 1]?.getFullYear() % 100}
        </div>
      </div>
    </div>
  );
  }

  // view === "gantt" — línea de tiempo de proyectos
  return (
    <div>
      {/* Leyenda: cómo leer las barras del Gantt */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 14,
          fontSize: 10.5,
          color: "var(--fg-3)",
          margin: "8px 2px 4px",
          alignItems: "center",
        }}
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
          <span style={{ width: 26, height: 9, borderRadius: 3, background: "var(--accent)" }} />
          Cada barra = duración del proyecto (inicio → fin)
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
          🔁 Recurrente (etiqueta = ARR/año) · resto = valor de setup
        </span>
      </div>

      <div
        style={{
          position: "relative",
          height: chartH,
          border: "1px solid var(--border-2)",
          borderRadius: "var(--radius)",
          background:
            `linear-gradient(to right, transparent calc(${todayPct}% - 1px), var(--accent) ${todayPct}%, transparent calc(${todayPct}% + 1px)),` +
            `repeating-linear-gradient(to right, transparent, transparent calc(100% / ${horizon} - 1px), var(--border-2) calc(100% / ${horizon} - 1px), var(--border-2) calc(100% / ${horizon}))`,
          backgroundColor: "var(--bg-2)",
          overflow: "hidden",
        }}
      >
        {visible.length === 0 && (
          <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "var(--fg-3)", fontSize: 12 }}>
            Sin proyectos en este horizonte
          </div>
        )}
        {visible.map(({ d, start, end }, i) => {
          // Barra = ventana del proyecto (inicio → fin), recortada al horizonte.
          const left = Math.max(0, dayToPct(start));
          const endPct = Math.min(100, dayToPct(end));
          const width = Math.max(2, endPct - left);
          const isRec = d.isRecurring && d.arr > 0;
          const color = stageColorById(d.stage);
          const chip = isRec ? `${fmtMoney(d.arr, currency)}/año` : fmtMoney(d.value, currency);
          const fmtD = (dt: Date) => dt.toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "2-digit" });
          return (
            <div
              key={d.id}
              onClick={() => onOpenDeal(d.id)}
              title={`${d.name} · ${d.company} · proyecto ${fmtD(start)} → ${fmtD(end)} · ${fmtMoney(d.value, currency)}${isRec ? ` · ARR ${fmtMoney(d.arr, currency)}/año` : ""}`}
              style={{
                position: "absolute",
                left: left + "%",
                top: 4 + i * rowH,
                height: rowH - 4,
                width: width + "%",
                background: isRec
                  ? `linear-gradient(to right, ${color} 0%, ${color} 70%, ${color}cc 100%)`
                  : color,
                borderRadius: 3,
                fontSize: 10,
                fontFamily: "var(--font-mono)",
                color: "#fff",
                padding: "0 6px",
                display: "flex", alignItems: "center",
                gap: 5,
                whiteSpace: "nowrap",
                overflow: "hidden",
                cursor: "pointer",
              }}
            >
              <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                {isRec && "🔁 "}
                {d.name}
              </span>
              <span style={{ marginLeft: "auto", background: "rgba(255,255,255,.22)", padding: "0 4px", borderRadius: 2, flexShrink: 0 }}>
                {chip}
              </span>
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", marginTop: 4 }}>
        {months.map((m, i) => {
          const monthLbl = MONTH_SHORT_ES[m.getMonth()];
          return (
            <div
              key={i}
              style={{
                flex: 1,
                textAlign: "center",
                fontFamily: "var(--font-mono)",
                fontSize: 9,
                color: "var(--fg-3)",
              }}
            >
              {horizon <= 12 || i % 3 === 0 ? `${monthLbl}'${m.getFullYear() % 100}` : ""}
            </div>
          );
        })}
      </div>

      {hidden > 0 && (
        <div style={{ fontSize: 11, color: "var(--fg-3)", marginTop: 8, textAlign: "center" }}>
          + {hidden} proyectos más en este horizonte (no mostrados)
        </div>
      )}
    </div>
  );
}

/* ============================================================
   MonthlyBillingChart — facturación MENSUAL (columnas por mes)
   kind="setup": costo del proyecto repartido por su duración.
   kind="saas":  MRR recurrente que arranca al terminar el proyecto.
   ============================================================ */
export function MonthlyBillingChart({
  deals,
  today,
  currency,
  kind,
}: {
  deals: Deal[];
  today: Date;
  currency: Currency;
  kind: "setup" | "saas";
}) {
  const HORIZON = 12;
  const startMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const monthIdxOf = (d: Date) =>
    (d.getFullYear() - startMonth.getFullYear()) * 12 + (d.getMonth() - startMonth.getMonth());
  const projectWindow = (d: Deal) => {
    const start = d.projectStartAt ? new Date(d.projectStartAt) : new Date(d.estimatedCloseAt);
    let end: Date;
    if (d.projectEndAt) end = new Date(d.projectEndAt);
    else {
      end = new Date(start);
      end.setMonth(end.getMonth() + 2);
    }
    return { start, end };
  };

  const open = useMemo(
    () => deals.filter((d) => d.stage !== "won" && d.stage !== "lost"),
    [deals],
  );

  // Serie mensual (lo que se factura ESE mes, no acumulado), ponderado por prob.
  const series = useMemo(() => {
    const arr: number[] = new Array(HORIZON).fill(0);
    open.forEach((d) => {
      const { start, end } = projectWindow(d);
      const startIdx = monthIdxOf(start);
      const endIdx = monthIdxOf(end);
      const dur = Math.max(1, endIdx - startIdx);
      const w = d.probability;
      if (kind === "setup") {
        const monthly = (d.value * w) / dur; // setup repartido por la duración
        for (let i = Math.max(0, startIdx); i < Math.min(HORIZON, startIdx + dur); i++) arr[i] += monthly;
      } else {
        if (!d.isRecurring || !d.arr) return;
        const mrr = (d.arr / 12) * w; // SaaS mensual desde el fin del proyecto
        for (let i = Math.max(0, endIdx + 1); i < HORIZON; i++) arr[i] += mrr;
      }
    });
    return arr;
  }, [open, kind]);

  const max = Math.max(1, ...series);
  const total = series.reduce((a, b) => a + b, 0);
  const peak = Math.max(...series);
  const months = Array.from(
    { length: HORIZON },
    (_, i) => new Date(startMonth.getFullYear(), startMonth.getMonth() + i, 1),
  );
  const color = kind === "setup" ? "#7c3aed" : "#0ea5e9";
  const title = kind === "setup" ? "Facturación SETUP · mes a mes" : "Facturación SaaS · mes a mes";
  const sub =
    kind === "setup"
      ? "Costo del proyecto repartido por su duración"
      : "MRR recurrente desde el fin del proyecto";
  const chartH = 150;

  return (
    <div className="card">
      <div className="card__h">
        <Icon name="dollar" size={14} style={{ color }} />
        <span style={{ fontWeight: 600 }}>{title}</span>
        <span className="card__sub">{sub} · pico {fmtMoney(peak, currency)}/mes</span>
      </div>
      <div className="card__b">
        <div style={{ display: "flex", gap: 8 }}>
          {/* Eje Y — escala de plata */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              height: chartH - 16,
              fontFamily: "var(--font-mono)",
              fontSize: 9.5,
              color: "var(--fg-3)",
              textAlign: "right",
              minWidth: 46,
            }}
          >
            <span style={{ color, fontWeight: 600 }}>{fmtMoney(max, currency)}</span>
            <span>{fmtMoney(max * 0.66, currency)}</span>
            <span>{fmtMoney(max * 0.33, currency)}</span>
            <span style={{ color: "var(--fg-4)" }}>0</span>
          </div>
          {/* Columnas por mes + gridlines */}
          <div style={{ flex: 1 }}>
            <div
              style={{
                position: "relative",
                height: chartH - 16,
                backgroundImage:
                  "repeating-linear-gradient(to top, transparent, transparent calc(33.33% - 1px), var(--border-2) calc(33.33% - 1px), var(--border-2) 33.33%)",
              }}
            >
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "flex-end", gap: 2 }}>
                {series.map((v, i) => (
                  <div
                    key={i}
                    title={`${MONTH_LONG_ES[months[i].getMonth()]} '${months[i].getFullYear() % 100} · ${fmtMoney(v, currency)}`}
                    style={{
                      flex: 1,
                      height: `${(v / max) * 100}%`,
                      minHeight: v > 0 ? 2 : 0,
                      background: color,
                      borderRadius: "2px 2px 0 0",
                      opacity: 0.92,
                    }}
                  />
                ))}
              </div>
            </div>
            {/* Eje X — meses */}
            <div style={{ display: "flex", marginTop: 5 }}>
              {months.map((m, i) => (
                <div
                  key={i}
                  style={{
                    flex: 1,
                    textAlign: "center",
                    fontFamily: "var(--font-mono)",
                    fontSize: 8.5,
                    color: "var(--fg-4)",
                  }}
                >
                  {i % 3 === 0 ? `${MONTH_SHORT_ES[m.getMonth()]}'${m.getFullYear() % 100}` : ""}
                </div>
              ))}
            </div>
          </div>
        </div>
        <div style={{ marginTop: 10, fontSize: 11, color: "var(--fg-3)" }}>
          Total {HORIZON}m: <b className="mono" style={{ color: "var(--fg-2)" }}>{fmtMoney(total, currency)}</b>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   ProjectGanttCard — Gantt de proyectos (card independiente, al final).
   Línea de tiempo por fechas de proyecto (inicio → fin), con toggle 12/24/36.
   ============================================================ */
export function ProjectGanttCard({
  deals,
  today,
  currency,
  onOpenDeal,
}: {
  deals: Deal[];
  today: Date;
  currency: Currency;
  onOpenDeal: (id: string) => void;
}) {
  const [horizon, setHorizon] = useState<Horizon>(36);
  const open = useMemo(
    () => deals.filter((d) => d.stage !== "won" && d.stage !== "lost"),
    [deals],
  );

  return (
    <Card>
      <Card.Header label="Gantt de proyectos" sub="Línea de tiempo por fechas de proyecto (inicio → fin)">
        <Icon name="gantt" size={14} style={{ color: "var(--accent)" }} />
        <span style={{ fontWeight: 600 }}>Gantt de proyectos</span>
      </Card.Header>
      <Card.Body style={{ padding: "12px 16px 16px" }}>
        <div className="fc-horizons">
          {([12, 24, 36] as Horizon[]).map((h) => (
            <button
              key={h}
              type="button"
              className={horizon === h ? "is-active" : ""}
              onClick={() => setHorizon(h)}
            >
              {h} meses
            </button>
          ))}
        </div>
        <TimelineChart
          open={open}
          today={today}
          horizon={horizon}
          currency={currency}
          onOpenDeal={onOpenDeal}
          view="gantt"
        />
      </Card.Body>
    </Card>
  );
}

/* ============================================================
   SetupByStageMonthlyChart — facturación SETUP mensual, una LÍNEA por etapa.
   Cada proyecto reparte su setup por la duración; se agrupa por la etapa
   actual del trato (líneas de color por etapa).
   ============================================================ */
export function SetupByStageMonthlyChart({
  stages,
  deals,
  today,
  currency,
}: {
  stages: { id: StageId; label: string; color: string }[];
  deals: Deal[];
  today: Date;
  currency: Currency;
}) {
  const HORIZON = 12;
  const H = 80;
  const startMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const monthIdxOf = (d: Date) =>
    (d.getFullYear() - startMonth.getFullYear()) * 12 + (d.getMonth() - startMonth.getMonth());
  const projectWindow = (d: Deal) => {
    const start = d.projectStartAt ? new Date(d.projectStartAt) : new Date(d.estimatedCloseAt);
    let end: Date;
    if (d.projectEndAt) end = new Date(d.projectEndAt);
    else {
      end = new Date(start);
      end.setMonth(end.getMonth() + 2);
    }
    return { start, end };
  };

  const open = useMemo(
    () => deals.filter((d) => d.stage !== "won" && d.stage !== "lost"),
    [deals],
  );
  const openStages = stages.filter((s) => s.id !== "won" && s.id !== "lost");

  // Una serie mensual por etapa (setup repartido por duración), ponderada por prob.
  const series = useMemo(() => {
    const map = new Map<string, number[]>();
    openStages.forEach((s) => map.set(s.id, new Array(HORIZON).fill(0)));
    open.forEach((d) => {
      const arr = map.get(d.stage);
      if (!arr) return;
      const { start, end } = projectWindow(d);
      const startIdx = monthIdxOf(start);
      const endIdx = monthIdxOf(end);
      const dur = Math.max(1, endIdx - startIdx);
      const monthly = (d.value * d.probability) / dur;
      for (let i = Math.max(0, startIdx); i < Math.min(HORIZON, startIdx + dur); i++) arr[i] += monthly;
    });
    return openStages
      .map((s) => ({ stage: s, data: map.get(s.id)!, total: map.get(s.id)!.reduce((a, b) => a + b, 0) }))
      .filter((s) => s.total > 0);
  }, [open, openStages]);

  const max = Math.max(1, ...series.flatMap((s) => s.data));
  const grandTotal = series.reduce((a, s) => a + s.total, 0);
  const months = Array.from(
    { length: HORIZON },
    (_, i) => new Date(startMonth.getFullYear(), startMonth.getMonth() + i, 1),
  );

  const buildLine = (data: number[]) => {
    const pts = data.map((v, i) => [(i / (HORIZON - 1)) * 100, H - (v / max) * H] as const);
    let dStr = `M${pts[0][0]},${pts[0][1]}`;
    for (let i = 1; i < pts.length; i++) {
      const [x1, y1] = pts[i - 1];
      const [x2, y2] = pts[i];
      const cx = (x1 + x2) / 2;
      dStr += ` C${cx},${y1} ${cx},${y2} ${x2},${y2}`;
    }
    return dStr;
  };

  return (
    <div className="card">
      <div className="card__h">
        <Icon name="dollar" size={14} style={{ color: "#7c3aed" }} />
        <span style={{ fontWeight: 600 }}>Facturación SETUP por etapa · mes a mes</span>
        <span className="card__sub">Setup repartido por duración · agrupado por etapa</span>
      </div>
      <div className="card__b">
        <div style={{ display: "flex", gap: 8 }}>
          {/* Eje Y — escala de plata */}
          <div
            style={{
              display: "flex", flexDirection: "column", justifyContent: "space-between",
              height: H, fontFamily: "var(--font-mono)", fontSize: 9.5,
              color: "var(--fg-3)", textAlign: "right", minWidth: 46,
            }}
          >
            <span style={{ color: "#7c3aed", fontWeight: 600 }}>{fmtMoney(max, currency)}</span>
            <span>{fmtMoney(max * 0.66, currency)}</span>
            <span>{fmtMoney(max * 0.33, currency)}</span>
            <span style={{ color: "var(--fg-4)" }}>0</span>
          </div>
          {/* Líneas por etapa */}
          <div style={{ flex: 1 }}>
            <div
              style={{
                position: "relative",
                height: H,
                backgroundImage:
                  "repeating-linear-gradient(to top, transparent, transparent calc(33.33% - 1px), var(--border-2) calc(33.33% - 1px), var(--border-2) 33.33%)",
              }}
            >
              <svg viewBox={`0 0 100 ${H}`} preserveAspectRatio="none" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", overflow: "visible" }}>
                {series.map((s) => (
                  <path
                    key={s.stage.id}
                    d={buildLine(s.data)}
                    fill="none"
                    stroke={s.stage.color}
                    strokeWidth="1.8"
                    vectorEffect="non-scaling-stroke"
                    strokeLinejoin="round"
                  />
                ))}
              </svg>
            </div>
            {/* Eje X — meses */}
            <div style={{ display: "flex", marginTop: 5 }}>
              {months.map((m, i) => (
                <div key={i} style={{ flex: 1, textAlign: "center", fontFamily: "var(--font-mono)", fontSize: 8.5, color: "var(--fg-4)" }}>
                  {i % 3 === 0 ? `${MONTH_SHORT_ES[m.getMonth()]}'${m.getFullYear() % 100}` : ""}
                </div>
              ))}
            </div>
          </div>
        </div>
        {/* Leyenda por etapa */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 14px", marginTop: 10, fontSize: 11 }}>
          {series.map((s) => (
            <span key={s.stage.id} style={{ display: "inline-flex", alignItems: "center", gap: 5, color: "var(--fg-2)" }}>
              <span style={{ width: 12, height: 3, borderRadius: 2, background: s.stage.color }} />
              {s.stage.label}
              <b className="mono" style={{ color: "var(--fg)" }}>{fmtMoney(s.total, currency)}</b>
            </span>
          ))}
          <span style={{ marginLeft: "auto", color: "var(--fg-3)" }}>
            Total {HORIZON}m: <b className="mono" style={{ color: "var(--fg-2)" }}>{fmtMoney(grandTotal, currency)}</b>
          </span>
        </div>
      </div>
    </div>
  );
}
