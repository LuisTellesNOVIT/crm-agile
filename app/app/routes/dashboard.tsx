import { useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router";
import {
  useActiveWorkspace,
  useAppStore,
  useWorkspaceLoaderData,
  type Currency,
} from "../lib/store";
import { fmtMoney, fmtMoneyFull, clamp, daysBetween } from "../lib/format";
import {
  computeArrTotal,
  computeMrr,
  computeNewArr,
  computePipelineArrWeighted,
  computeNetRetention,
  computeLogoChurn,
  computeCacPayback,
  computeLtvCac,
  computeSalesVelocity,
  leadResponseTime,
  computeForecast,
  computePipelineValue,
  computeLostValue,
  computeWinRate,
  computeConversionRate,
  computeCartera,
} from "../lib/metrics";
import { Icon, type IconName } from "../components/shell/Icon";
import { ForecastHorizons } from "../components/dashboard/ForecastHorizons";
import { KpiDetailDrawer, type KpiId } from "../components/dashboard/KpiDetailDrawer";
import type { Deal, OwnersByKey, Workspace } from "../lib/types";

/* ============================================================
   Sparkline
   ============================================================ */
function Sparkline({
  values,
  color = "var(--accent)",
  width = 80,
  height = 32,
}: {
  values: number[];
  color?: string;
  width?: number;
  height?: number;
}) {
  if (!values || values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pts = values.map((v, i) => [
    (i / (values.length - 1)) * width,
    height - ((v - min) / range) * height,
  ]);
  const path = pts
    .map((p, i) => (i === 0 ? "M" : "L") + p[0].toFixed(1) + "," + p[1].toFixed(1))
    .join(" ");
  const area = path + ` L${width},${height} L0,${height} Z`;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <path d={area} fill={color} opacity="0.12" />
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

/* ============================================================
   KPI card with delta + sparkline
   ============================================================ */
function Kpi({
  label,
  value,
  delta,
  deltaDir = "up",
  help,
  spark,
  sparkColor = "var(--accent)",
  sparkInvert = false,
  onClick,
}: {
  label: string;
  value: string;
  delta: string;
  deltaDir?: "up" | "down";
  help?: string;
  spark: number[];
  sparkColor?: string;
  sparkInvert?: boolean;
  onClick?: () => void;
}) {
  return (
    <div
      className="kpi"
      onClick={onClick}
      style={onClick ? { cursor: "pointer" } : undefined}
    >
      <div className="kpi__label">
        <span>{label}</span>
        <Icon
          name="external"
          size={11}
          style={{ marginLeft: "auto", color: "var(--fg-4)" }}
        />
      </div>
      <div className="kpi__value">{value}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span className={`kpi__delta kpi__delta--${deltaDir}`}>
          <Icon name={deltaDir === "up" ? "arrow-up" : "arrow-down"} size={11} />
          {delta}
        </span>
        {help && <span style={{ fontSize: 11, color: "var(--fg-3)" }}>{help}</span>}
      </div>
      <div className="kpi__spark">
        <Sparkline values={sparkInvert ? spark.slice().reverse() : spark} color={sparkColor} />
      </div>
    </div>
  );
}

/* ============================================================
   Pseudo-trend para sparklines — determinístico por seed
   ============================================================ */
function trend(end: number, count: number, salt: number, mode: "up" | "noisy" = "up"): number[] {
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    const noise = (Math.sin(i * 7.3 + salt) + Math.sin(i * 2.1 + salt * 1.5)) * 0.12;
    const t = i / Math.max(1, count - 1);
    const base = mode === "up" ? end * (0.5 + t * 0.6) : end * (0.7 + noise);
    out.push(Math.max(0, base * (1 + noise)));
  }
  // Asegurar último valor coincide aproximadamente con `end`
  out[out.length - 1] = end || 0.01;
  return out;
}

/* ============================================================
   Leaderboard donut pie
   ============================================================ */
type OwnerRow = { k: string; name: string; role: string; color: string; won: number; deals: number };

function LeaderboardPie({ data }: { data: OwnerRow[] }) {
  const total = data.reduce((a, o) => a + o.won, 0);
  const size = 124;
  const cx = size / 2;
  const cy = size / 2;
  const rO = 54;
  const rI = 34;

  if (!total) {
    return (
      <div className="leaderboard-pie">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle cx={cx} cy={cy} r={rO} fill="none" stroke="var(--bg-3)" strokeWidth={rO - rI} />
        </svg>
        <div className="leaderboard-pie__center">
          <span className="leaderboard-pie__label mono">CERRADO</span>
          <span className="leaderboard-pie__total mono">$0</span>
        </div>
      </div>
    );
  }

  let cum = 0;
  const slices = data
    .filter((o) => o.won > 0)
    .map((o) => {
      const v = o.won / total;
      const s = cum;
      cum += v;
      const e = cum;
      const sa = s * Math.PI * 2 - Math.PI / 2;
      const ea = e * Math.PI * 2 - Math.PI / 2;
      const x1o = cx + rO * Math.cos(sa);
      const y1o = cy + rO * Math.sin(sa);
      const x2o = cx + rO * Math.cos(ea);
      const y2o = cy + rO * Math.sin(ea);
      const x1i = cx + rI * Math.cos(ea);
      const y1i = cy + rI * Math.sin(ea);
      const x2i = cx + rI * Math.cos(sa);
      const y2i = cy + rI * Math.sin(sa);
      const large = v > 0.5 ? 1 : 0;
      const d = `M ${x1o} ${y1o} A ${rO} ${rO} 0 ${large} 1 ${x2o} ${y2o} L ${x1i} ${y1i} A ${rI} ${rI} 0 ${large} 0 ${x2i} ${y2i} Z`;
      return { d, color: o.color, key: o.k };
    });

  return (
    <div className="leaderboard-pie">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {slices.map((s) => (
          <path key={s.key} d={s.d} fill={s.color} stroke="var(--bg)" strokeWidth={1.5} />
        ))}
      </svg>
      <div className="leaderboard-pie__center">
        <span className="leaderboard-pie__label mono">CERRADO</span>
        <span className="leaderboard-pie__total mono">{fmtMoney(total, "USD")}</span>
      </div>
    </div>
  );
}

/* ============================================================
   WorkspaceComparison — NOVIT vs SHARKY (lee ambos del loader)
   ============================================================ */
function WorkspaceComparison({ currency }: { currency: Currency }) {
  const data = useWorkspaceLoaderData();
  const novitColor = "#4f46e5";
  const sharkyColor = "#0d9488";

  const calc = (deals: Deal[]) => {
    const open = deals.filter((d) => d.stage !== "won" && d.stage !== "lost");
    const won = deals.filter((d) => d.stage === "won");
    const lost = deals.filter((d) => d.stage === "lost");
    const closed = won.length + lost.length;
    return {
      open,
      won,
      lost,
      pipe: open.reduce((a, d) => a + d.value, 0),
      forecast: open.reduce((a, d) => a + d.value * d.probability, 0),
      wonValue: won.reduce((a, d) => a + d.value, 0),
      aiAvg: open.length ? Math.round(open.reduce((a, d) => a + d.ai, 0) / open.length) : 0,
      conv: closed ? (won.length / closed) * 100 : 0,
      ticket: open.length ? open.reduce((a, d) => a + d.value, 0) / open.length : 0,
      arr: won.filter((d) => d.isRecurring).reduce((a, d) => a + d.arr, 0),
    };
  };

  const N = calc(data.novit.deals);
  const S = calc(data.sharky.deals);
  const total = N.pipe + S.pipe;
  const novitPct = total ? (N.pipe / total) * 100 : 50;
  const sharkyPct = 100 - novitPct;

  // Donut (annular)
  const size = 200;
  const cx = size / 2;
  const cy = size / 2;
  const rO = 88;
  const rI = 58;
  const arc = (s: number, e: number) => {
    const sa = s * Math.PI * 2 - Math.PI / 2;
    const ea = e * Math.PI * 2 - Math.PI / 2;
    const x1o = cx + rO * Math.cos(sa),
      y1o = cy + rO * Math.sin(sa);
    const x2o = cx + rO * Math.cos(ea),
      y2o = cy + rO * Math.sin(ea);
    const x1i = cx + rI * Math.cos(ea),
      y1i = cy + rI * Math.sin(ea);
    const x2i = cx + rI * Math.cos(sa),
      y2i = cy + rI * Math.sin(sa);
    const large = e - s > 0.5 ? 1 : 0;
    return `M ${x1o} ${y1o} A ${rO} ${rO} 0 ${large} 1 ${x2o} ${y2o} L ${x1i} ${y1i} A ${rI} ${rI} 0 ${large} 0 ${x2i} ${y2i} Z`;
  };
  const novitArc = arc(0, novitPct / 100);
  const sharkyArc = arc(novitPct / 100, 1);

  const metrics = [
    { label: "Pipeline activo", n: N.pipe, s: S.pipe, hint: "Suma de valor bruto de tratos abiertos" },
    { label: "Forecast ponderado", n: N.forecast, s: S.forecast, hint: "Valor × probabilidad IA" },
    { label: "Cerrado · won", n: N.wonValue, s: S.wonValue, hint: "Valor de tratos ganados" },
  ];
  const maxV = Math.max(...metrics.flatMap((m) => [m.n, m.s]), 1);
  const winner = (n: number, s: number) => (n === s ? "tie" : n > s ? "novit" : "sharky");

  return (
    <div className="dash__row dash__row--split ws-compare-row">
      <div className="card">
        <div className="card__h">
          <Icon name="users" size={14} />
          <span style={{ fontWeight: 600 }}>NOVIT vs SHARKY</span>
          <span className="card__sub">Distribución del pipeline activo</span>
        </div>
        <div className="card__b">
          <div className="ws-compare__layout">
            <div className="ws-compare__donut">
              <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                {N.pipe > 0 && <path d={novitArc} fill={novitColor} stroke="var(--bg)" strokeWidth={2} />}
                {S.pipe > 0 && <path d={sharkyArc} fill={sharkyColor} stroke="var(--bg)" strokeWidth={2} />}
              </svg>
              <div className="ws-compare__center">
                <span className="ws-compare__total-lbl">Total pipeline</span>
                <span className="ws-compare__total">{fmtMoney(total, currency)}</span>
                <span className="ws-compare__total-sub">{N.open.length + S.open.length} oportunidades</span>
              </div>
            </div>
            <div className="ws-compare__legend">
              <div className="ws-compare__legend-row" style={{ "--ws-c": novitColor } as React.CSSProperties}>
                <span className="ws-compare__dot" />
                <div>
                  <b>NOVIT</b>
                  <span className="mono">{N.open.length} opp · {Math.round(novitPct)}%</span>
                </div>
                <span className="ws-compare__legend-val">{fmtMoney(N.pipe, currency)}</span>
              </div>
              <div className="ws-compare__legend-row" style={{ "--ws-c": sharkyColor } as React.CSSProperties}>
                <span className="ws-compare__dot" />
                <div>
                  <b>SHARKY</b>
                  <span className="mono">{S.open.length} opp · {Math.round(sharkyPct)}%</span>
                </div>
                <span className="ws-compare__legend-val">{fmtMoney(S.pipe, currency)}</span>
              </div>
              <div className="ws-compare__legend-hint">
                {novitPct >= sharkyPct ? (
                  <>NOVIT representa el <b>{Math.round(novitPct)}%</b> del pipeline activo combinado. Liderando por <b>{fmtMoney(N.pipe - S.pipe, currency)}</b>.</>
                ) : (
                  <>SHARKY representa el <b>{Math.round(sharkyPct)}%</b> del pipeline activo combinado. Liderando por <b>{fmtMoney(S.pipe - N.pipe, currency)}</b>.</>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card__h">
          <Icon name="trending" size={14} />
          <span style={{ fontWeight: 600 }}>Comparación de métricas</span>
          <span className="card__sub">Pipeline · Forecast · Cerrado</span>
        </div>
        <div className="card__b">
          <div className="ws-compare-bars">
            {metrics.map((m) => {
              const w = winner(m.n, m.s);
              return (
                <div key={m.label} className="ws-compare-bar">
                  <div className="ws-compare-bar__lbl">
                    {m.label}
                    <span className="ws-compare-bar__hint">{m.hint}</span>
                  </div>
                  <div className={`ws-compare-bar__row ${w === "novit" ? "is-winner" : ""}`.trim()}>
                    <span className="ws-compare-bar__name" style={{ color: novitColor }}>NOVIT</span>
                    <span className="ws-compare-bar__track">
                      <span className="ws-compare-bar__fill" style={{ background: novitColor, width: `${(m.n / maxV) * 100}%` }} />
                    </span>
                    <span className="ws-compare-bar__val">{fmtMoney(m.n, currency)}</span>
                  </div>
                  <div className={`ws-compare-bar__row ${w === "sharky" ? "is-winner" : ""}`.trim()}>
                    <span className="ws-compare-bar__name" style={{ color: sharkyColor }}>SHARKY</span>
                    <span className="ws-compare-bar__track">
                      <span className="ws-compare-bar__fill" style={{ background: sharkyColor, width: `${(m.s / maxV) * 100}%` }} />
                    </span>
                    <span className="ws-compare-bar__val">{fmtMoney(m.s, currency)}</span>
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
            <span className={winner(N.aiAvg, S.aiAvg) === "novit" ? "is-w" : ""}>{N.aiAvg}%</span>
            <span className={winner(N.aiAvg, S.aiAvg) === "sharky" ? "is-w" : ""}>{S.aiAvg}%</span>
            <span className="ws-compare-grid__delta">{N.aiAvg - S.aiAvg > 0 ? "+" : ""}{N.aiAvg - S.aiAvg}</span>

            <span>Conversión Won / Closed</span>
            <span className={winner(N.conv, S.conv) === "novit" ? "is-w" : ""}>{N.conv.toFixed(0)}%</span>
            <span className={winner(N.conv, S.conv) === "sharky" ? "is-w" : ""}>{S.conv.toFixed(0)}%</span>
            <span className="ws-compare-grid__delta">{(N.conv - S.conv).toFixed(0)}pp</span>

            <span>Ticket promedio (abierto)</span>
            <span className={winner(N.ticket, S.ticket) === "novit" ? "is-w" : ""}>{fmtMoney(N.ticket, currency)}</span>
            <span className={winner(N.ticket, S.ticket) === "sharky" ? "is-w" : ""}>{fmtMoney(S.ticket, currency)}</span>
            <span className="ws-compare-grid__delta">{fmtMoney(N.ticket - S.ticket, currency)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   Top 10 + AI Recommendations (computed from real DB data)
   ============================================================ */
function Top10Card({
  ws,
  currency,
  onOpenDeal,
}: {
  ws: Workspace;
  currency: Currency;
  onOpenDeal: (id: string) => void;
}) {
  const top = useMemo(
    () =>
      [...ws.deals]
        .filter((d) => d.stage !== "lost")
        .sort((a, b) => b.value - a.value)
        .slice(0, 10),
    [ws.deals],
  );
  const grand = top.reduce((a, d) => a + d.value, 0);

  const stageBg = (id: Deal["stage"]) => {
    const c = ws.stages.find((s) => s.id === id)?.color ?? "#94a3b8";
    return { background: c + "22", color: c, border: `1px solid ${c}55` };
  };

  return (
    <div className="card">
      <div className="card__h">
        <Icon name="trending" size={14} />
        <span style={{ fontWeight: 600 }}>Top 10 oportunidades</span>
        <span className="card__sub">
          Σ {fmtMoney(grand, currency)} · ordenadas por valor
        </span>
      </div>
      <div className="card__b" style={{ padding: 8 }}>
        <div className="top10">
          {top.map((d, i) => (
            <div key={d.id} className="top10__row" onClick={() => onOpenDeal(d.id)}>
              <span className="top10__rank">#{i + 1}</span>
              <div style={{ minWidth: 0 }}>
                <div className="top10__name">{d.name}</div>
                <div className="top10__co">{d.company}</div>
              </div>
              <div>
                <span className="top10__stage" style={stageBg(d.stage)}>
                  {ws.stages.find((s) => s.id === d.stage)?.label}
                </span>
              </div>
              <div className="top10__value">{fmtMoney(d.value, currency)}</div>
              <div>
                <div className="top10__ai">{d.ai}% IA</div>
                <div className="top10__ai-bar"><div style={{ width: d.ai + "%" }} /></div>
              </div>
              <Icon
                name="chevron-right"
                size={13}
                style={{ color: "var(--fg-4)", justifySelf: "end" }}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AIRecsCard({
  ws,
  currency,
  onOpenAI,
  onOpenDeal,
}: {
  ws: Workspace;
  currency: Currency;
  onOpenAI: () => void;
  onOpenDeal: (id: string) => void;
}) {
  const open = ws.deals.filter((d) => d.stage !== "won" && d.stage !== "lost");
  const ready = open.filter((d) => d.ai >= 75).sort((a, b) => b.value - a.value);
  const stalling = open
    .filter((d) => daysBetween(d.createdAt, ws.today) > 30)
    .sort((a, b) => b.value - a.value);
  const risk = open.filter((d) => d.ai < 40).sort((a, b) => b.value - a.value);

  const recs: { color: string; icon: IconName; title: string; body: ReactNode; cta?: string; action?: () => void }[] = [];

  if (ready.length) {
    recs.push({
      color: "var(--success)",
      icon: "trending",
      title: `Cerrar esta semana · ${ready.length} tratos`,
      body: (
        <>
          AI Score ≥ 75% y engagement reciente. Top: <b>{ready[0].name}</b> ({fmtMoney(ready[0].value, currency)})
          {ready[1] && (<>, <b>{ready[1].name}</b> ({fmtMoney(ready[1].value, currency)})</>)}.
        </>
      ),
      cta: "Generar contratos en lote",
      action: () => onOpenDeal(ready[0].id),
    });
  }
  if (stalling.length) {
    recs.push({
      color: "var(--warning)",
      icon: "clock",
      title: `${stalling.length} tratos estancados +30 días`,
      body: (
        <>
          Ocupan <b>{fmtMoney(stalling.reduce((a, d) => a + d.value, 0), currency)}</b> de pipeline. Más
          antiguo: <b>{stalling[0].name}</b>. Activá secuencia de re-engagement.
        </>
      ),
      cta: "Activar secuencia",
      action: () => onOpenDeal(stalling[0].id),
    });
  }
  if (risk.length) {
    recs.push({
      color: "var(--danger)",
      icon: "alert",
      title: `${risk.length} tratos en riesgo de pérdida`,
      body: (
        <>
          AI Score &lt; 40%. Pipeline en riesgo:{" "}
          <b>{fmtMoney(risk.reduce((a, d) => a + d.value, 0), currency)}</b>. Recomendación: re-calificar o pedir intro a nivel ejecutivo.
        </>
      ),
      cta: "Ver lista",
      action: () => onOpenDeal(risk[0].id),
    });
  }
  recs.push({
    color: "var(--accent)",
    icon: "sparkles",
    title: "Insight semanal",
    body: (
      <>
        Tratos con <b>3+ stakeholders activos</b> cierran 2.4× más rápido.{" "}
        <b>{open.filter((d) => d.contacts < 2).length} tratos</b> tienen 1 solo contacto — pedí intros esta semana.
      </>
    ),
    cta: "Hablar con la IA",
    action: onOpenAI,
  });

  return (
    <div className="card">
      <div className="card__h">
        <Icon name="sparkles" size={14} style={{ color: "var(--accent)" }} />
        <span style={{ fontWeight: 600 }}>Recomendaciones IA</span>
        <span style={{ marginLeft: "auto" }}>
          <button type="button" className="btn btn--ghost" onClick={onOpenAI} style={{ fontSize: 11 }}>
            <Icon name="chat" size={12} /> Pedir informe
          </button>
        </span>
      </div>
      <div className="card__b" style={{ padding: 12 }}>
        <div className="ai-recs">
          {recs.slice(0, 5).map((r, i) => (
            <div
              key={i}
              className="ai-rec"
              style={{ "--rec-color": r.color } as React.CSSProperties}
              onClick={r.action}
            >
              <div className="ai-rec__icon"><Icon name={r.icon} size={13} /></div>
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

/* ============================================================
   ROUTE
   ============================================================ */
export default function DashboardRoute() {
  const workspace = useAppStore((s) => s.workspace);
  const currency = useAppStore((s) => s.currency);
  const setSelectedDeal = useAppStore((s) => s.setSelectedDeal);
  const openAI = useAppStore((s) => s.openAI);
  const ws = useActiveWorkspace();
  const navigate = useNavigate();
  const [kpiDetail, setKpiDetail] = useState<KpiId | null>(null);

  // ---------- métricas base (todas via lib/metrics — fuente única) ----------
  const open = ws.deals.filter((d) => d.stage !== "won" && d.stage !== "lost");
  const won = ws.deals.filter((d) => d.stage === "won");
  const lost = ws.deals.filter((d) => d.stage === "lost");

  const forecastValue = computeForecast(ws.deals);
  const pipelineValue = computePipelineValue(ws.deals);
  const lostValue = computeLostValue(ws.deals);
  const wonValue = won.reduce((a, d) => a + d.value, 0);

  const winRate = computeWinRate(ws.deals);
  const conversionRate = computeConversionRate(ws.deals);

  // Clientes activos + Cartera total via helper compartido
  const carteraSummary = useMemo(() => computeCartera(ws.deals), [ws.deals]);
  const { customers: customersCount, cartera: carteraCount, customerArr, lostOnly: carteraLostOnly } = carteraSummary;
  // (mantenemos `customers` y `cartera` como objetos para los charts existentes)
  const { customers, cartera } = useMemo(() => {
    const byCo = new Map<string, { won: number; open: number; lost: number; arr: number }>();
    for (const d of ws.deals) {
      const c = byCo.get(d.company) ?? { won: 0, open: 0, lost: 0, arr: 0 };
      if (d.stage === "won") {
        c.won++;
        if (d.isRecurring) c.arr += d.arr;
      } else if (d.stage === "lost") {
        c.lost++;
      } else {
        c.open++;
      }
      byCo.set(d.company, c);
    }
    const all = Array.from(byCo.values());
    return { customers: all.filter((c) => c.won > 0), cartera: all };
  }, [ws.deals]);

  // Sales Velocity: si hay data won real, computar; sino fallback decorativo
  const computedVelocity = computeSalesVelocity(ws.deals);
  const avgSalesVelocity = computedVelocity > 0 ? computedVelocity : (workspace === "sharky" ? 22 : 47);
  const avgResponseTime = leadResponseTime(workspace);

  // Sparklines determinísticos (en producción saldrían de una tabla de métricas)
  const sparkForecast = trend(forecastValue, 12, 1.7);
  const sparkVelocity = trend(avgSalesVelocity, 8, 3.2, "noisy");
  const sparkResponse = trend(avgResponseTime, 8, 4.5, "noisy");
  const sparkWinRate = trend(winRate, 9, 5.5);
  const sparkConversion = trend(conversionRate, 9, 6.3);
  const sparkLost = trend(lostValue, 12, 7.1, "noisy");
  const sparkClients = trend(customers.length, 12, 8.9);

  // ---------- Forecast por etapa (weighted bar + funnel) ----------
  // IMPORTANTE: usar ws.stages (dinámicos del workspace, editables) — no STAGES const.
  const stageBreakdown = ws.stages.filter((s) => s.id !== "won" && s.id !== "lost").map((s) => {
    const ds = open.filter((d) => d.stage === s.id);
    return {
      ...s,
      sum: ds.reduce((a, d) => a + d.value * d.probability, 0),
      count: ds.length,
    };
  });
  const funnel = ws.stages.filter((s) => s.id !== "lost").map((s) => {
    const ds = ws.deals.filter((d) => d.stage === s.id);
    return {
      ...s,
      totalValue: ds.reduce((a, d) => a + d.value, 0),
      count: ds.length,
    };
  });
  const maxFunnel = Math.max(...funnel.map((f) => f.totalValue), 1);

  // ---------- Leaderboard ----------
  const leaderboard: OwnerRow[] = Object.entries(ws.owners as OwnersByKey)
    .map(([k, o]) => {
      const ds = ws.deals.filter((d) => d.owner === k);
      const wonV = ds.filter((d) => d.stage === "won").reduce((a, d) => a + d.value, 0);
      return { k, name: o.name, role: o.role, color: o.color, won: wonV, deals: ds.length };
    })
    .sort((a, b) => b.won - a.won);
  const maxLB = Math.max(...leaderboard.map((l) => l.won), 1);

  // ---------- SaaS (todas via lib/metrics — match exacto con drawer) ----------
  const recurring = ws.deals.filter((d) => d.isRecurring);
  const totalARR = computeArrTotal(ws.deals);
  const totalMRR = computeMrr(ws.deals);
  const newARR = computeNewArr(ws.deals, 90);
  const pipelineARR = computePipelineArrWeighted(ws.deals);
  const nrr = computeNetRetention(ws.deals);
  const churn = computeLogoChurn(ws.deals);
  const cacPay = computeCacPayback(ws.deals);
  const ltvCac = computeLtvCac(ws.deals);

  // ---------- Time in Stage (decorativo: no hay event log real) ----------
  // Usa ws.stages (dinámicos) — si el admin agrega/renombra etapas, se reflejan acá.
  const timeInStage = ws.stages.filter((s) => s.id !== "won" && s.id !== "lost").map((s, i) => ({
    ...s,
    avg: workspace === "sharky" ? [4, 8, 12, 10, 8][i] || 6 : [8, 14, 22, 18, 14][i] || 12,
  }));

  return (
    <div className="dash">
      {/* ───── 8 KPI cards ───── */}
      <div className="dash__row dash__row--kpi">
        <Kpi label="Forecast Proyectado" value={fmtMoney(forecastValue, currency)} delta="+18.4%" deltaDir="up" help="Σ valor × prob IA" spark={sparkForecast} sparkColor="var(--accent)" onClick={() => setKpiDetail("forecast")} />
        <Kpi label="Sales Velocity" value={avgSalesVelocity + "d"} delta="-3d" deltaDir="up" help="Lead → Cierre" spark={sparkVelocity} sparkColor="#16a34a" sparkInvert onClick={() => setKpiDetail("velocity")} />
        <Kpi label="Lead Response Time" value={avgResponseTime + "h"} delta="-22m" deltaDir="up" help="Primer toque WhatsApp" spark={sparkResponse} sparkColor="#16a34a" sparkInvert onClick={() => setKpiDetail("response")} />
        <Kpi label="Win Rate" value={winRate + "%"} delta="+2.1pp" deltaDir="up" help="Won / (Won + Lost)" spark={sparkWinRate} onClick={() => setKpiDetail("winrate")} />
        <Kpi label="Tasa de Conversión" value={conversionRate + "%"} delta="+3.2pp" deltaDir="up" help="Lead → Cliente" spark={sparkConversion} onClick={() => setKpiDetail("conversion")} />
        <Kpi label="Forecast Perdido" value={fmtMoney(lostValue, currency)} delta={lost.length + " tratos"} deltaDir="down" help="Σ valor de tratos Lost" spark={sparkLost} sparkColor="var(--danger)" sparkInvert onClick={() => setKpiDetail("lost_forecast")} />
        <Kpi label="Clientes activos" value={customersCount.toString()} delta={customerArr > 0 ? "ARR " + fmtMoney(customerArr, currency) : "+1 este Q"} deltaDir="up" help="Cuentas con ≥ 1 trato ganado" spark={sparkClients} onClick={() => setKpiDetail("clients")} />
        <Kpi label="Cartera total" value={carteraCount.toString()} delta={`${carteraCount - carteraLostOnly} activos · ${carteraLostOnly} solo lost`} deltaDir="up" help="Empresas únicas en el CRM (incluye perdidos)" spark={sparkClients} sparkColor="var(--fg-3)" onClick={() => setKpiDetail("cartera")} />
      </div>

      {/* ───── Forecast por etapa + AI Forecast ───── */}
      <div className="dash__row dash__row--split">
        <div className="card">
          <div className="card__h">
            <Icon name="trending" size={14} style={{ color: "var(--accent)" }} />
            <span style={{ fontWeight: 600 }}>Forecast por etapa</span>
            <span className="card__sub">Σ ponderado {fmtMoney(forecastValue, currency)} · Σ pipeline {fmtMoney(pipelineValue, currency)}</span>
          </div>
          <div className="card__b">
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, fontSize: 11, color: "var(--fg-3)", fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              <Icon name="sparkles" size={11} style={{ color: "var(--accent)" }} />
              Forecast ponderado · Σ (valor × prob IA)
              <span style={{ marginLeft: "auto", color: "var(--fg-2)" }}>{fmtMoney(forecastValue, currency)}</span>
            </div>
            <div className="forecast-bar">
              {stageBreakdown.map((s) => {
                const pct = (s.sum / Math.max(1, forecastValue)) * 100;
                if (pct < 0.5) return null;
                return (
                  <div key={s.id} style={{ background: s.color, width: pct + "%" }}>
                    {pct > 8 ? fmtMoney(s.sum, currency) : ""}
                  </div>
                );
              })}
            </div>
            <div style={{ display: "flex", gap: 14, marginTop: 12, flexWrap: "wrap" }}>
              {stageBreakdown.map((s) => (
                <div key={s.id} className="forecast-legend">
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
              <span style={{ marginLeft: "auto", color: "var(--fg-2)" }}>{fmtMoney(funnel.reduce((a, s) => a + s.totalValue, 0), currency)}</span>
            </div>
            <div className="stage-funnel">
              {funnel.map((s) => (
                <div key={s.id} className="stage-funnel__row">
                  <span style={{ color: "var(--fg-2)" }}>{s.label}</span>
                  <div className="stage-funnel__bar">
                    <div style={{ width: (s.totalValue / maxFunnel) * 100 + "%", background: s.color }} />
                  </div>
                  <span className="stage-funnel__val">{fmtMoney(s.totalValue, currency)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card__h">
            <Icon name="sparkles" size={14} style={{ color: "var(--accent)" }} />
            <span style={{ fontWeight: 600 }}>AI Forecast · Pipeline weighted</span>
          </div>
          <div className="card__b" style={{ padding: 16 }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-3)", textTransform: "uppercase", letterSpacing: ".08em" }}>
              Pipeline total
            </div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 30, fontWeight: 500, letterSpacing: "-.02em", marginTop: 4 }}>
              {fmtMoney(pipelineValue, currency)}
            </div>
            <div style={{ fontSize: 12, color: "var(--fg-3)", marginTop: 2 }}>
              {open.length} tratos abiertos · Confianza IA <b style={{ color: "var(--accent)" }}>{workspace === "sharky" ? "78%" : "84%"}</b>
            </div>

            <div style={{ marginTop: 14, padding: 12, background: "var(--accent-soft)", border: "1px solid var(--accent-border)", borderRadius: 6 }}>
              <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--accent)", textTransform: "uppercase", letterSpacing: ".06em" }}>
                Modelo · gradient-boost v3
              </div>
              <div style={{ fontSize: 13, marginTop: 4 }}>
                Forecast a 90 días: <b className="mono">{fmtMoney(forecastValue, currency)}</b>
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
                { f: "Tiempo en etapa", w: 0.92, dir: "down" as const },
                { f: "Tamaño cuenta", w: 0.78, dir: "up" as const },
                { f: "Engagement WA", w: 0.71, dir: "up" as const },
                { f: "# stakeholders", w: 0.58, dir: "up" as const },
                { f: "Industria fit", w: 0.42, dir: "up" as const },
              ].map((f) => (
                <div key={f.f} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: "var(--fg-2)", flex: 1 }}>{f.f}</span>
                  <div style={{ flex: 2, height: 4, background: "var(--bg-3)", borderRadius: 999 }}>
                    <div style={{ width: f.w * 100 + "%", height: "100%", background: f.dir === "up" ? "var(--success)" : "var(--warning)", borderRadius: 999 }} />
                  </div>
                  <span className="mono" style={{ fontSize: 10, color: "var(--fg-3)", width: 32, textAlign: "right" }}>{f.w.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ───── SaaS · Time in Stage · Leaderboard ───── */}
      <div className="dash__row dash__row--3">
        <div className="card">
          <div className="card__h">
            <Icon name="dollar" size={14} style={{ color: "var(--success)" }} />
            <span style={{ fontWeight: 600 }}>Métricas SaaS · ARR</span>
            <span className="card__sub">{recurring.length} tratos recurrentes</span>
          </div>
          <div className="card__b">
            <div className="saas-grid">
              <button type="button" className="saas-kpi saas-kpi--clickable" onClick={() => setKpiDetail("arr_total")}>
                <small>ARR total <Icon name="external" size={9} style={{ verticalAlign: "middle", color: "var(--fg-4)", marginLeft: 4 }} /></small>
                <b>{fmtMoney(totalARR, currency)}</b>
              </button>
              <button type="button" className="saas-kpi saas-kpi--clickable" onClick={() => setKpiDetail("mrr")}>
                <small>MRR estimado <Icon name="external" size={9} style={{ verticalAlign: "middle", color: "var(--fg-4)", marginLeft: 4 }} /></small>
                <b>{fmtMoney(totalMRR, currency)}</b>
              </button>
              <button type="button" className="saas-kpi saas-kpi--clickable" onClick={() => setKpiDetail("new_arr")}>
                <small>New ARR ganado <Icon name="external" size={9} style={{ verticalAlign: "middle", color: "var(--fg-4)", marginLeft: 4 }} /></small>
                <b style={{ color: "var(--success)" }}>{fmtMoney(newARR, currency)}</b>
              </button>
              <button type="button" className="saas-kpi saas-kpi--clickable" onClick={() => setKpiDetail("pipeline_arr_w")}>
                <small>Pipeline ARR (w) <Icon name="external" size={9} style={{ verticalAlign: "middle", color: "var(--fg-4)", marginLeft: 4 }} /></small>
                <b>{fmtMoney(pipelineARR, currency)}</b>
              </button>
              <button type="button" className="saas-kpi saas-kpi--clickable" onClick={() => setKpiDetail("net_retention")}>
                <small>Net retention <Icon name="external" size={9} style={{ verticalAlign: "middle", color: "var(--fg-4)", marginLeft: 4 }} /></small>
                <b>{nrr.nrr}%</b>
              </button>
              <button type="button" className="saas-kpi saas-kpi--clickable" onClick={() => setKpiDetail("logo_churn")}>
                <small>Logo churn <Icon name="external" size={9} style={{ verticalAlign: "middle", color: "var(--fg-4)", marginLeft: 4 }} /></small>
                <b>{churn.churn}%</b>
              </button>
              <button type="button" className="saas-kpi saas-kpi--clickable" onClick={() => setKpiDetail("cac_payback")}>
                <small>CAC payback <Icon name="external" size={9} style={{ verticalAlign: "middle", color: "var(--fg-4)", marginLeft: 4 }} /></small>
                <b>{cacPay.payback}m</b>
              </button>
              <button type="button" className="saas-kpi saas-kpi--clickable" onClick={() => setKpiDetail("ltv_cac")}>
                <small>LTV / CAC <Icon name="external" size={9} style={{ verticalAlign: "middle", color: "var(--fg-4)", marginLeft: 4 }} /></small>
                <b>{ltvCac.ratio}x</b>
              </button>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card__h">
            <Icon name="clock" size={14} />
            <span style={{ fontWeight: 600 }}>Time in Stage</span>
          </div>
          <div className="card__b">
            <div className="stage-funnel">
              {timeInStage.map((s) => (
                <div key={s.id} className="stage-funnel__row">
                  <span style={{ color: "var(--fg-2)" }}>{s.label}</span>
                  <div className="stage-funnel__bar">
                    <div style={{ width: clamp((s.avg / 30) * 100, 6, 100) + "%", background: s.avg > 18 ? "var(--warning)" : s.color }} />
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
            <span style={{ fontWeight: 600 }}>Leaderboard</span>
          </div>
          <div className="card__b">
            <div className="leaderboard-layout">
              <div className="leaderboard">
                {leaderboard.map((o) => (
                  <div key={o.k} className="leaderboard__row">
                    <span style={{ width: 22, height: 22, borderRadius: 11, display: "inline-grid", placeItems: "center", fontSize: 10, fontWeight: 600, fontFamily: "var(--font-mono)", color: "#fff", background: `linear-gradient(135deg, ${o.color}aa, ${o.color})` }}>
                      {o.k}
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13 }}>{o.name}</div>
                      <div style={{ fontSize: 10, color: "var(--fg-3)", fontFamily: "var(--font-mono)" }}>{o.role}</div>
                    </div>
                    <div className="leaderboard__bar">
                      <div style={{ width: (o.won / maxLB) * 100 + "%", background: o.color }} />
                    </div>
                    <div className="mono" style={{ fontSize: 12, textAlign: "right" }}>{fmtMoney(o.won, currency)}</div>
                  </div>
                ))}
              </div>
              <LeaderboardPie data={leaderboard} />
            </div>
          </div>
        </div>
      </div>

      {/* ───── NOVIT vs SHARKY ───── */}
      <WorkspaceComparison currency={currency} />

      {/* ───── ForecastHorizons (12/24/36 meses + Timeline+SaaS) ───── */}
      <ForecastHorizons
        deals={ws.deals}
        today={ws.today}
        currency={currency}
        onOpenDeal={(id) => setSelectedDeal(id)}
      />

      {/* ───── Top 10 + AI Recommendations ───── */}
      <div className="dash__row dash__row--split">
        <Top10Card ws={ws} currency={currency} onOpenDeal={(id) => setSelectedDeal(id)} />
        <AIRecsCard
          ws={ws}
          currency={currency}
          onOpenAI={() => openAI()}
          onOpenDeal={(id) => setSelectedDeal(id)}
        />
      </div>

      {/* ───── KPI Detail Drawer (overlay) ───── */}
      <KpiDetailDrawer
        kpiId={kpiDetail}
        ws={ws}
        currency={currency}
        onClose={() => setKpiDetail(null)}
        onOpenDeal={(id) => {
          setKpiDetail(null);
          setSelectedDeal(id);
        }}
      />
    </div>
  );
}
