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
          <TimelineChart open={open} today={today} horizon={horizon} buckets={buckets} currency={currency} onOpenDeal={onOpenDeal} />
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
        </div>
      </Card.Body>
    </Card>
  );
}

function TimelineChart({
  open,
  today,
  horizon,
  buckets,
  currency,
  onOpenDeal,
}: {
  open: Deal[];
  today: Date;
  horizon: Horizon;
  buckets: { month: Date; total: number }[];
  currency: Currency;
  onOpenDeal: (id: string) => void;
}) {
  const startMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const endMonth = new Date(today.getFullYear(), today.getMonth() + horizon, 1);
  const totalMs = endMonth.getTime() - startMonth.getTime();
  const dayToPct = (d: Date | string) => {
    const date = typeof d === "string" ? new Date(d) : d;
    return ((date.getTime() - startMonth.getTime()) / totalMs) * 100;
  };

  const visible = useMemo(() => {
    return open
      .filter((d) => {
        const close = new Date(d.estimatedCloseAt);
        return close >= today && close < endMonth;
      })
      .sort(
        (a, b) =>
          new Date(a.estimatedCloseAt).getTime() -
          new Date(b.estimatedCloseAt).getTime(),
      )
      .slice(0, 14);
  }, [open, today, endMonth]);
  const hidden = Math.max(
    0,
    open.filter((d) => {
      const close = new Date(d.estimatedCloseAt);
      return close >= today && close < endMonth;
    }).length - visible.length,
  );

  const saasH = 80;
  const saasSeries = useMemo(() => {
    const series: number[] = new Array(horizon).fill(0);
    const recurring = open.filter((d) => d.isRecurring && d.arr > 0);
    recurring.forEach((d) => {
      const closeIdx = Math.floor(
        (new Date(d.estimatedCloseAt).getTime() - startMonth.getTime()) /
          (1000 * 60 * 60 * 24 * 30.44),
      );
      const mrr = (d.arr / 12) * d.probability;
      for (let i = Math.max(0, closeIdx); i < horizon; i++) series[i] += mrr;
    });
    return series;
  }, [open, horizon, startMonth]);
  const maxSaas = Math.max(1, ...saasSeries);

  const saasPath = useMemo(() => {
    if (!saasSeries.length) return "";
    const pts = saasSeries.map((v, i) => {
      const x = ((i + 0.5) / horizon) * 100;
      const y = saasH - (v / maxSaas) * saasH;
      return [x, y] as const;
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
  }, [saasSeries, horizon, maxSaas]);
  const saasArea = saasPath + ` L100,${saasH} L0,${saasH} Z`;

  const todayPct = dayToPct(today);
  const rowH = 22;
  const chartH = Math.max(60, visible.length * rowH + 8);

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
            zIndex: 2,
            display: "flex", alignItems: "center", gap: 6,
          }}
        >
          <Icon name="dollar" size={11} style={{ color: "var(--info)" }} />
          SaaS MRR proyectado · {fmtMoney(saasSeries[saasSeries.length - 1] || 0, currency)} run-rate al mes {horizon}
        </div>
        <svg viewBox={`0 0 100 ${saasH}`} preserveAspectRatio="none" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
          <defs>
            <linearGradient id={`saas-grad-${horizon}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--info)" stopOpacity="0.35" />
              <stop offset="100%" stopColor="var(--info)" stopOpacity="0.02" />
            </linearGradient>
          </defs>
          <path d={saasArea} fill={`url(#saas-grad-${horizon})`} />
          <path d={saasPath} fill="none" stroke="var(--info)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
        </svg>
        <div
          style={{
            position: "absolute",
            left: todayPct + "%", top: 0, bottom: 0,
            width: 1, background: "var(--accent)",
            opacity: 0.6,
          }}
        />
        <div style={{ position: "absolute", top: 8, right: 8, fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--info)" }}>
          {fmtMoney(maxSaas, currency)}
        </div>
        <div style={{ position: "absolute", bottom: 4, right: 8, fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-3)" }}>
          0
        </div>
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
            Sin deals cerrando en este horizonte
          </div>
        )}
        {visible.map((d, i) => {
          const startPct = Math.max(0, dayToPct(d.createdAt));
          const endPct = Math.min(100, dayToPct(d.estimatedCloseAt));
          const widthPct = Math.max(2, endPct - startPct);
          const color = stageColorById(d.stage);
          return (
            <div
              key={d.id}
              onClick={() => onOpenDeal(d.id)}
              title={`${d.name} · ${d.company} · ${fmtMoney(d.value, currency)} · cierre ${new Date(d.estimatedCloseAt).toLocaleDateString("es-PE")}`}
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
                cursor: "pointer",
              }}
            >
              <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                {d.isRecurring && "🔁 "}
                {d.name}
              </span>
              <span style={{ marginLeft: "auto", background: "rgba(255,255,255,.2)", padding: "0 4px", borderRadius: 2, flexShrink: 0 }}>
                {fmtMoney(d.value, currency)}
              </span>
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", marginTop: 4 }}>
        {buckets.map((b, i) => {
          const monthLbl = MONTH_SHORT_ES[b.month.getMonth()];
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
              {horizon <= 12 || i % 3 === 0 ? `${monthLbl}'${b.month.getFullYear() % 100}` : ""}
            </div>
          );
        })}
      </div>

      {hidden > 0 && (
        <div style={{ fontSize: 11, color: "var(--fg-3)", marginTop: 8, textAlign: "center" }}>
          + {hidden} tratos más cerrando en este horizonte (no mostrados)
        </div>
      )}
    </div>
  );
}
