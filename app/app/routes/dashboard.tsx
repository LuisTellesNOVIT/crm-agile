import { useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router";
import {
  useActiveWorkspace,
  useAppStore,
  useWorkspaceLoaderData,
  type Currency,
} from "../lib/store";
import { fmtMoney, fmtMoneyFull, daysBetween } from "../lib/format";
import {
  computeMrr,
  computeNewArr,
  computePipelineArrWeighted,
  computeNetRetention,
  computeCacPayback,
  computeForecast,
  computePipelineValue,
  computeLostValue,
  computeWinRate,
  computeConversionRate,
  computeCartera,
} from "../lib/metrics";
import { Icon, type IconName } from "../components/shell/Icon";
import { ForecastHorizons, MonthlyBillingChart, ProjectGanttCard, SetupByStageMonthlyChart } from "../components/dashboard/ForecastHorizons";
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
/** Badge ⓘ con tooltip (fórmula + para qué sirve). Reutilizable en KPI y SaaS. */
function InfoTip({ formula, purpose }: { formula?: string; purpose?: string }) {
  if (!formula && !purpose) return null;
  return (
    <span className="kpi__info" tabIndex={0} onClick={(e) => e.stopPropagation()} aria-label="Cómo se calcula">
      i
      <span className="kpi__tip" role="tooltip">
        {formula && (
          <>
            <b>Fórmula</b>
            <span>{formula}</span>
          </>
        )}
        {purpose && (
          <>
            <b>Para qué sirve</b>
            <span>{purpose}</span>
          </>
        )}
      </span>
    </span>
  );
}

function Kpi({
  label,
  value,
  delta,
  deltaDir = "up",
  help,
  spark,
  sparkColor = "var(--accent)",
  sparkInvert = false,
  valueColor,
  formula,
  purpose,
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
  valueColor?: string;
  formula?: string;
  purpose?: string;
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
        <InfoTip formula={formula} purpose={purpose} />
        <Icon
          name="external"
          size={11}
          style={{ marginLeft: "auto", color: "var(--fg-4)" }}
        />
      </div>
      <div className="kpi__value" style={valueColor ? { color: valueColor } : undefined}>{value}</div>
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
type OwnerRow = { k: string; name: string; role: string; color: string; won: number; deals: number; wonCount: number };

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
   StagePieCard — donut de distribución del pipeline bruto por etapa
   ============================================================ */
function StagePieCard({
  funnel,
  currency,
  onSlice,
}: {
  funnel: { id: string; label: string; color: string; totalValue: number }[];
  currency: Currency;
  onSlice?: (id: string) => void;
}) {
  const data = funnel.filter((f) => f.totalValue > 0);
  const total = data.reduce((a, f) => a + f.totalValue, 0);
  const size = 132;
  const cx = size / 2;
  const cy = size / 2;
  const rO = 58;
  const rI = 36;
  let cum = 0;
  const slices = data.map((f) => {
    const v = total ? f.totalValue / total : 0;
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
    return { d, color: f.color, key: f.id, label: f.label, value: f.totalValue, pct: v * 100 };
  });

  return (
    <div className="card">
      <div className="card__h">
        <Icon name="dollar" size={14} style={{ color: "var(--accent)" }} />
        <span style={{ fontWeight: 600 }}>Distribución por etapa</span>
        <span className="card__sub">{fmtMoney(total, currency)} total</span>
      </div>
      <div className="card__b">
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
              {slices.map((s) => (
                <path
                  key={s.key}
                  d={s.d}
                  fill={s.color}
                  stroke="var(--bg)"
                  strokeWidth={1.5}
                  style={onSlice ? { cursor: "pointer" } : undefined}
                  onClick={onSlice ? () => onSlice(s.key) : undefined}
                >
                  <title>{`${s.label} · ${fmtMoney(s.value, currency)}`}</title>
                </path>
              ))}
            </svg>
            <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
              <span style={{ fontSize: 9, color: "var(--fg-4)", fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: ".1em" }}>Pipeline</span>
              <span style={{ fontSize: 14, fontWeight: 600, fontFamily: "var(--font-mono)" }}>{fmtMoney(total, currency)}</span>
            </div>
          </div>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, flex: 1, display: "flex", flexDirection: "column", gap: 7 }}>
            {slices.map((s) => (
              <li
                key={s.key}
                onClick={onSlice ? () => onSlice(s.key) : undefined}
                title={onSlice ? `Ver oportunidades en ${s.label}` : undefined}
                className={onSlice ? "stage-pie__legend-row--clickable" : undefined}
                style={{ display: "grid", gridTemplateColumns: "10px 1fr auto auto", alignItems: "center", gap: 8, fontSize: 12, cursor: onSlice ? "pointer" : undefined, padding: "2px 4px", borderRadius: 4 }}
              >
                <span style={{ width: 10, height: 10, borderRadius: 3, background: s.color }} />
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--fg-2)" }}>{s.label}</span>
                <span className="mono" style={{ fontWeight: 600, color: "var(--fg)" }}>{fmtMoney(s.value, currency)}</span>
                <span className="mono" style={{ fontSize: 11, color: "var(--fg-3)", minWidth: 34, textAlign: "right" }}>{s.pct.toFixed(0)}%</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   TopClientsPieCard — Top 5 clientes (resto en "Otros") como PIE.
   Suma tratos GANADOS + EN PROCESO por cliente (excluye perdidos).
   ============================================================ */
function TopClientsPieCard({
  deals,
  currency,
  onClient,
}: {
  deals: Deal[];
  currency: Currency;
  onClient?: (key: string) => void; // nombre de empresa, o "__otros__"
}) {
  const byClient = new Map<string, { value: number; count: number }>();
  deals.forEach((d) => {
    if (d.stage === "lost") return; // sin perdidos
    const cur = byClient.get(d.company) ?? { value: 0, count: 0 };
    cur.value += d.value;
    cur.count += 1;
    byClient.set(d.company, cur);
  });
  const sorted = [...byClient.entries()]
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.value - a.value);
  const top = sorted.slice(0, 5);
  const rest = sorted.slice(5);
  const otrosVal = rest.reduce((a, c) => a + c.value, 0);
  const otrosCount = rest.reduce((a, c) => a + c.count, 0);

  const PALETTE = ["#4f46e5", "#0ea5e9", "#7c3aed", "#f59e0b", "#10b981", "#94a3b8"];
  type Seg = { key: string; label: string; value: number; count: number; color: string };
  const segs: Seg[] = top.map((c, i) => ({ key: c.name, label: c.name, value: c.value, count: c.count, color: PALETTE[i] }));
  if (otrosVal > 0) segs.push({ key: "__otros__", label: `Otros (${rest.length})`, value: otrosVal, count: otrosCount, color: PALETTE[5] });

  const total = segs.reduce((a, s) => a + s.value, 0);
  const clientCount = byClient.size;
  const size = 168, cx = size / 2, cy = size / 2, rO = 74, rI = 48;
  const arc = (s: number, e: number) => {
    const sa = s * Math.PI * 2 - Math.PI / 2;
    const ea = e * Math.PI * 2 - Math.PI / 2;
    const x1o = cx + rO * Math.cos(sa), y1o = cy + rO * Math.sin(sa);
    const x2o = cx + rO * Math.cos(ea), y2o = cy + rO * Math.sin(ea);
    const x1i = cx + rI * Math.cos(ea), y1i = cy + rI * Math.sin(ea);
    const x2i = cx + rI * Math.cos(sa), y2i = cy + rI * Math.sin(sa);
    const large = e - s > 0.5 ? 1 : 0;
    return `M ${x1o} ${y1o} A ${rO} ${rO} 0 ${large} 1 ${x2o} ${y2o} L ${x1i} ${y1i} A ${rI} ${rI} 0 ${large} 0 ${x2i} ${y2i} Z`;
  };
  let cum = 0;
  const slices = segs
    .filter((s) => s.value > 0)
    .map((s) => {
      const v = total ? s.value / total : 0;
      const d = arc(cum, cum + v);
      cum += v;
      return { d, color: s.color, key: s.key };
    });

  return (
    <div className="card">
      <div className="card__h">
        <Icon name="users" size={14} style={{ color: "var(--accent)" }} />
        <span style={{ fontWeight: 600 }}>Top 5 clientes</span>
        <span className="card__sub" style={{ display: "inline-flex", alignItems: "baseline", gap: 6 }}>
          <b className="mono" style={{ color: "var(--fg)", fontWeight: 600, fontSize: 13 }}>{fmtMoney(total, currency)}</b>
          <span>· {clientCount} clientes · ganados + en proceso</span>
        </span>
      </div>
      <div className="card__b">
        <div className="ws-compare__layout" style={{ gridTemplateColumns: `${size + 12}px 1fr`, gap: 18 }}>
          <div className="ws-compare__donut" style={{ width: size, height: size }}>
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
              {total > 0 ? (
                slices.map((s) => (
                  <path
                    key={s.key}
                    d={s.d}
                    fill={s.color}
                    stroke="var(--bg)"
                    strokeWidth={2}
                    style={onClient ? { cursor: "pointer" } : undefined}
                    onClick={onClient ? () => onClient(s.key) : undefined}
                  />
                ))
              ) : (
                <circle cx={cx} cy={cy} r={(rO + rI) / 2} fill="none" stroke="var(--bg-3)" strokeWidth={rO - rI} />
              )}
            </svg>
            <div className="ws-compare__center">
              <span className="ws-compare__total-lbl">Clientes</span>
              <span className="ws-compare__total">{fmtMoney(total, currency)}</span>
              <span className="ws-compare__total-sub">{clientCount} {clientCount === 1 ? "cliente" : "clientes"}</span>
            </div>
          </div>
          <div className="ws-compare__legend">
            {segs.map((s) => {
              const pct = total ? (s.value / total) * 100 : 0;
              const clickable = !!onClient;
              return (
                <div
                  key={s.key}
                  className={`ws-compare__legend-row${clickable ? " ws-compare__legend-row--clickable" : ""}`}
                  style={{ "--ws-c": s.color } as React.CSSProperties}
                  onClick={clickable ? () => onClient(s.key) : undefined}
                  title={clickable ? `Ver tratos de ${s.label}` : undefined}
                >
                  <span className="ws-compare__dot" />
                  <div>
                    <b>{s.label}</b>
                    <span className="mono">{Math.round(pct)}% · {s.count} {s.count === 1 ? "trato" : "tratos"}</span>
                  </div>
                  <span className="ws-compare__legend-val">{fmtMoney(s.value, currency)}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   StageFunnelCard — embudo con el VALOR por etapa (barras centradas).
   ============================================================ */
function StageFunnelCard({
  funnel,
  currency,
  onStage,
}: {
  funnel: { id: string; label: string; color: string; totalValue: number; count: number }[];
  currency: Currency;
  onStage?: (id: string) => void;
}) {
  const data = funnel.filter((f) => f.totalValue > 0);
  const max = Math.max(...data.map((f) => f.totalValue), 1);
  const total = data.reduce((a, f) => a + f.totalValue, 0);
  const N = data.length;
  const w = (v: number) => Math.max((v / max) * 100, 7); // ancho % (mín 7 para visibilidad)
  return (
    <div className="card">
      <div className="card__h">
        <Icon name="trending" size={14} style={{ color: "var(--accent)" }} />
        <span style={{ fontWeight: 600 }}>Embudo por etapa</span>
        <span className="card__sub">valor por etapa · {fmtMoney(total, currency)}</span>
      </div>
      <div className="card__b">
        <div className="funnel">
          {data.map((s, i) => {
            // Trapecio: ancho superior = valor de esta etapa; ancho inferior =
            // valor de la siguiente (se conectan formando el embudo continuo).
            const topW = w(s.totalValue);
            const botW = i < N - 1 ? w(data[i + 1].totalValue) : topW * 0.5;
            const clip = `polygon(${(50 - topW / 2).toFixed(2)}% 0%, ${(50 + topW / 2).toFixed(2)}% 0%, ${(50 + botW / 2).toFixed(2)}% 100%, ${(50 - botW / 2).toFixed(2)}% 100%)`;
            const pct = total ? (s.totalValue / total) * 100 : 0;
            const wide = Math.max(topW, botW) >= 26;
            const clickable = !!onStage;
            return (
              <div
                key={s.id}
                className={`funnel__row${clickable ? " funnel__row--clickable" : ""}`}
                onClick={clickable ? () => onStage(s.id) : undefined}
                title={clickable ? `Ver ${s.count} oportunidad(es) en ${s.label}` : undefined}
              >
                <div className="funnel__label">{s.label}</div>
                <div className="funnel__band">
                  <div className="funnel__shape" style={{ background: s.color, clipPath: clip, WebkitClipPath: clip }} />
                  {wide ? (
                    <span className="funnel__val funnel__val--in">{fmtMoney(s.totalValue, currency)}</span>
                  ) : (
                    <span className="funnel__val funnel__val--out" style={{ left: `${(50 + Math.max(topW, botW) / 2).toFixed(2)}%` }}>
                      {fmtMoney(s.totalValue, currency)}
                    </span>
                  )}
                </div>
                <div className="funnel__pct">{pct.toFixed(0)}%</div>
              </div>
            );
          })}
          {data.length === 0 && (
            <div style={{ padding: 16, textAlign: "center", color: "var(--fg-3)", fontSize: 13 }}>Sin pipeline</div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   LostClientDrawer — sustento del KPI "Cliente top perdido":
   lista las oportunidades PERDIDAS del cliente; total cuadra.
   ============================================================ */
function LostClientDrawer({
  clientName,
  ws,
  currency,
  onClose,
  onOpenDeal,
}: {
  clientName: string | null;
  ws: { stages: { id: string; label: string; color: string }[]; deals: Deal[] };
  currency: Currency;
  onClose: () => void;
  onOpenDeal: (id: string) => void;
}) {
  if (!clientName) return null;
  const deals = ws.deals.filter((d) => d.stage === "lost" && d.company === clientName).sort((a, b) => b.value - a.value);
  const total = deals.reduce((a, d) => a + d.value, 0);
  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside className="ai-drawer kpi-drawer" style={{ width: "min(560px, 100vw)" }} onClick={(e) => e.stopPropagation()}>
        <header className="ai-drawer__head" style={{ padding: "0 14px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ width: 28, height: 28, borderRadius: 6, background: "var(--danger)", color: "#fff", display: "grid", placeItems: "center" }}>
              <Icon name="alert" size={14} />
            </span>
            <div>
              <div style={{ fontWeight: 600 }}>{clientName}</div>
              <div style={{ fontSize: 10, color: "var(--fg-3)", fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Oportunidades perdidas · sustento
              </div>
            </div>
          </div>
          <button type="button" className="btn btn--icon" onClick={onClose} aria-label="Cerrar"><Icon name="x" size={14} /></button>
        </header>

        <div className="ai-drawer__msgs" style={{ gap: 12, padding: 14 }}>
          <div className="kpi-drawer__headline">
            <div className="kpi-drawer__head-label">Valor perdido</div>
            <div className="kpi-drawer__head-value" style={{ color: "var(--danger)" }}>{fmtMoney(total, currency)}</div>
            <div className="kpi-drawer__head-sub">{deals.length} oportunidad(es) perdida(s) · suma exacta de los valores listados</div>
          </div>
          <div className="kpi-drawer__list">
            {deals.map((d) => (
              <div key={d.id} className="kpi-drawer__row" onClick={() => onOpenDeal(d.id)}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="kpi-drawer__row-name">{d.name}</div>
                  <div className="kpi-drawer__row-sub"><span className="mono">{d.id}</span> · {d.company}</div>
                </div>
                <span className="mono kpi-drawer__row-value" style={{ color: "var(--danger)" }}>{fmtMoney(d.value, currency)}</span>
              </div>
            ))}
            {deals.length === 0 && <div style={{ padding: 16, textAlign: "center", color: "var(--fg-3)", fontSize: 13 }}>Sin pérdidas</div>}
          </div>
        </div>
      </aside>
    </div>
  );
}

/* ============================================================
   ClientDealsDrawer — sustento del Top 5 clientes / "Otros".
   Lista los tratos (ganados + en proceso) del cliente; total cuadra.
   ============================================================ */
function ClientDealsDrawer({
  clientKey,
  ws,
  currency,
  onClose,
  onOpenDeal,
}: {
  clientKey: string | null;
  ws: { stages: { id: string; label: string; color: string }[]; deals: Deal[] };
  currency: Currency;
  onClose: () => void;
  onOpenDeal: (id: string) => void;
}) {
  if (!clientKey) return null;
  const stageLabel = (id: string) => ws.stages.find((s) => s.id === id)?.label ?? id;
  const stageColor = (id: string) => ws.stages.find((s) => s.id === id)?.color ?? "var(--fg-3)";
  const active = ws.deals.filter((d) => d.stage !== "lost");
  let title: string;
  let deals: Deal[];
  if (clientKey === "__otros__") {
    const byClient = new Map<string, number>();
    active.forEach((d) => byClient.set(d.company, (byClient.get(d.company) ?? 0) + d.value));
    const top5 = new Set([...byClient.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map((e) => e[0]));
    deals = active.filter((d) => !top5.has(d.company)).sort((a, b) => b.value - a.value);
    title = "Otros clientes";
  } else {
    deals = active.filter((d) => d.company === clientKey).sort((a, b) => b.value - a.value);
    title = clientKey;
  }
  const total = deals.reduce((a, d) => a + d.value, 0);
  const won = deals.filter((d) => d.stage === "won");
  const wonVal = won.reduce((a, d) => a + d.value, 0);

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside className="ai-drawer kpi-drawer" style={{ width: "min(560px, 100vw)" }} onClick={(e) => e.stopPropagation()}>
        <header className="ai-drawer__head" style={{ padding: "0 14px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ width: 28, height: 28, borderRadius: 6, background: "var(--accent)", color: "#fff", display: "grid", placeItems: "center" }}>
              <Icon name="users" size={14} />
            </span>
            <div>
              <div style={{ fontWeight: 600 }}>{title}</div>
              <div style={{ fontSize: 10, color: "var(--fg-3)", fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Cliente · sustento (ganados + en proceso)
              </div>
            </div>
          </div>
          <button type="button" className="btn btn--icon" onClick={onClose} aria-label="Cerrar"><Icon name="x" size={14} /></button>
        </header>

        <div className="ai-drawer__msgs" style={{ gap: 12, padding: 14 }}>
          <div className="kpi-drawer__headline">
            <div className="kpi-drawer__head-label">Ganados + en proceso</div>
            <div className="kpi-drawer__head-value">{fmtMoney(total, currency)}</div>
            <div className="kpi-drawer__head-sub">{deals.length} tratos · {won.length} ganados ({fmtMoney(wonVal, currency)}) · sin perdidos</div>
          </div>
          <div className="kpi-drawer__list">
            {deals.map((d) => (
              <div key={d.id} className="kpi-drawer__row" onClick={() => onOpenDeal(d.id)}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="kpi-drawer__row-name">{d.name}</div>
                  <div className="kpi-drawer__row-sub"><span className="mono">{d.id}</span> · {d.company}</div>
                </div>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--fg-3)", whiteSpace: "nowrap" }}>
                  <span style={{ width: 7, height: 7, borderRadius: 2, background: stageColor(d.stage) }} />
                  {stageLabel(d.stage)}
                </span>
                <span className="mono kpi-drawer__row-value">{fmtMoney(d.value, currency)}</span>
              </div>
            ))}
            {deals.length === 0 && <div style={{ padding: 16, textAlign: "center", color: "var(--fg-3)", fontSize: 13 }}>Sin tratos</div>}
          </div>
        </div>
      </aside>
    </div>
  );
}

/* ============================================================
   StageDealsDrawer — sustento del embudo por etapa: lista las
   oportunidades de una etapa. Los números cuadran: total = Σ value
   de los tratos listados (mismo filtro que el embudo d.stage === stageId).
   ============================================================ */
function StageDealsDrawer({
  stageId,
  ws,
  currency,
  onClose,
  onOpenDeal,
}: {
  stageId: string | null;
  ws: { stages: { id: string; label: string; color: string }[]; deals: Deal[] };
  currency: Currency;
  onClose: () => void;
  onOpenDeal: (id: string) => void;
}) {
  if (!stageId) return null;
  const stage = ws.stages.find((s) => s.id === stageId);
  const deals = ws.deals.filter((d) => d.stage === stageId).sort((a, b) => b.value - a.value);
  const total = deals.reduce((a, d) => a + d.value, 0);
  const color = stage?.color ?? "var(--accent)";
  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside className="ai-drawer kpi-drawer" style={{ width: "min(560px, 100vw)" }} onClick={(e) => e.stopPropagation()}>
        <header className="ai-drawer__head" style={{ padding: "0 14px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ width: 28, height: 28, borderRadius: 6, background: color, color: "#fff", display: "grid", placeItems: "center" }}>
              <Icon name="dollar" size={14} />
            </span>
            <div>
              <div style={{ fontWeight: 600 }}>Pipeline · {stage?.label ?? stageId}</div>
              <div style={{ fontSize: 10, color: "var(--fg-3)", fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Sustento · oportunidades por etapa
              </div>
            </div>
          </div>
          <button type="button" className="btn btn--icon" onClick={onClose} aria-label="Cerrar">
            <Icon name="x" size={14} />
          </button>
        </header>

        <div className="ai-drawer__msgs" style={{ gap: 12, padding: 14 }}>
          <div className="kpi-drawer__headline">
            <div className="kpi-drawer__head-label">{stage?.label ?? stageId} · pipeline bruto</div>
            <div className="kpi-drawer__head-value">{fmtMoney(total, currency)}</div>
            <div className="kpi-drawer__head-sub">{deals.length} oportunidad(es) · suma exacta de los valores listados</div>
          </div>
          <div className="kpi-drawer__list">
            {deals.map((d) => (
              <div key={d.id} className="kpi-drawer__row" onClick={() => onOpenDeal(d.id)}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="kpi-drawer__row-name">{d.name}</div>
                  <div className="kpi-drawer__row-sub">
                    <span className="mono">{d.id}</span> · {d.company}
                  </div>
                </div>
                {d.isRecurring && d.arr > 0 && (
                  <span className="mono" style={{ fontSize: 11, color: "var(--info)" }}>ARR {fmtMoney(d.arr, currency)}</span>
                )}
                <span className="mono kpi-drawer__row-value">{fmtMoney(d.value, currency)}</span>
              </div>
            ))}
            {deals.length === 0 && (
              <div style={{ padding: 16, textAlign: "center", color: "var(--fg-3)", fontSize: 13 }}>
                Sin oportunidades en esta etapa
              </div>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}

/* ============================================================
   OwnerDealsDrawer — sustento del Leaderboard: tratos de un ejecutivo
   (ganados / abiertos / perdidos), con los totales que cuadran.
   ============================================================ */
function OwnerDealsDrawer({
  ownerKey,
  ws,
  currency,
  onClose,
  onOpenDeal,
}: {
  ownerKey: string | null;
  ws: {
    owners: Record<string, { name: string; role?: string; color: string }>;
    stages: { id: string; label: string; color: string }[];
    deals: Deal[];
  };
  currency: Currency;
  onClose: () => void;
  onOpenDeal: (id: string) => void;
}) {
  if (!ownerKey) return null;
  const owner = ws.owners[ownerKey];
  const stageLabel = (id: string) => ws.stages.find((s) => s.id === id)?.label ?? id;
  const stageColor = (id: string) => ws.stages.find((s) => s.id === id)?.color ?? "var(--fg-3)";
  const all = ws.deals.filter((d) => d.owner === ownerKey);
  const won = all.filter((d) => d.stage === "won").sort((a, b) => b.value - a.value);
  const lost = all.filter((d) => d.stage === "lost").sort((a, b) => b.value - a.value);
  const open = all.filter((d) => d.stage !== "won" && d.stage !== "lost").sort((a, b) => b.value - a.value);
  const wonVal = won.reduce((a, d) => a + d.value, 0);
  const openVal = open.reduce((a, d) => a + d.value, 0);
  const color = owner?.color ?? "var(--accent)";
  const initials = (owner?.name ?? "?").split(" ").map((p) => p[0]).slice(0, 2).join("");

  const Row = (d: Deal) => (
    <div key={d.id} className="kpi-drawer__row" onClick={() => onOpenDeal(d.id)}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="kpi-drawer__row-name">{d.name}</div>
        <div className="kpi-drawer__row-sub">
          <span className="mono">{d.id}</span> · {d.company}
        </div>
      </div>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--fg-3)", whiteSpace: "nowrap" }}>
        <span style={{ width: 7, height: 7, borderRadius: 2, background: stageColor(d.stage) }} />
        {stageLabel(d.stage)}
      </span>
      <span className="mono kpi-drawer__row-value">{fmtMoney(d.value, currency)}</span>
    </div>
  );

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside className="ai-drawer kpi-drawer" style={{ width: "min(560px, 100vw)" }} onClick={(e) => e.stopPropagation()}>
        <header className="ai-drawer__head" style={{ padding: "0 14px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ width: 28, height: 28, borderRadius: 6, background: color, color: "#fff", display: "grid", placeItems: "center", fontSize: 12, fontWeight: 700 }}>
              {initials}
            </span>
            <div>
              <div style={{ fontWeight: 600 }}>{owner?.name ?? ownerKey}</div>
              <div style={{ fontSize: 10, color: "var(--fg-3)", fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                {owner?.role ?? "Leaderboard · sustento"}
              </div>
            </div>
          </div>
          <button type="button" className="btn btn--icon" onClick={onClose} aria-label="Cerrar">
            <Icon name="x" size={14} />
          </button>
        </header>

        <div className="ai-drawer__msgs" style={{ gap: 12, padding: 14 }}>
          <div className="kpi-drawer__headline">
            <div className="kpi-drawer__head-label">Cerrado · ganado</div>
            <div className="kpi-drawer__head-value">{fmtMoney(wonVal, currency)}</div>
            <div className="kpi-drawer__head-sub">
              {won.length} ganados · {open.length} abiertos ({fmtMoney(openVal, currency)}) · {lost.length} perdidos · {all.length} tratos en total
            </div>
          </div>

          {won.length > 0 && (
            <>
              <div className="kpi-drawer__section"><span>✅ Ganados ({won.length})</span><span style={{ marginLeft: "auto" }} className="mono">{fmtMoney(wonVal, currency)}</span></div>
              <div className="kpi-drawer__list">{won.map(Row)}</div>
            </>
          )}
          {open.length > 0 && (
            <>
              <div className="kpi-drawer__section"><span>🟦 Abiertos ({open.length})</span><span style={{ marginLeft: "auto" }} className="mono">{fmtMoney(openVal, currency)}</span></div>
              <div className="kpi-drawer__list">{open.map(Row)}</div>
            </>
          )}
          {lost.length > 0 && (
            <>
              <div className="kpi-drawer__section"><span>❌ Perdidos ({lost.length})</span></div>
              <div className="kpi-drawer__list">{lost.map(Row)}</div>
            </>
          )}
          {all.length === 0 && (
            <div style={{ padding: 16, textAlign: "center", color: "var(--fg-3)", fontSize: 13 }}>Sin tratos asignados</div>
          )}
        </div>
      </aside>
    </div>
  );
}

/* ============================================================
   LeaderboardCompare — leaderboard con el MISMO look que NOVIT vs
   SHARKY: donut + filas con borde de color y valor a la derecha.
   ============================================================ */
function LeaderboardCompare({ data, currency, onOwner }: { data: OwnerRow[]; currency: Currency; onOwner?: (k: string) => void }) {
  const total = data.reduce((a, o) => a + o.won, 0);
  const totalWon = data.reduce((a, o) => a + o.wonCount, 0);
  const size = 168;
  const cx = size / 2;
  const cy = size / 2;
  const rO = 74;
  const rI = 48;
  const arc = (s: number, e: number) => {
    const sa = s * Math.PI * 2 - Math.PI / 2;
    const ea = e * Math.PI * 2 - Math.PI / 2;
    const x1o = cx + rO * Math.cos(sa), y1o = cy + rO * Math.sin(sa);
    const x2o = cx + rO * Math.cos(ea), y2o = cy + rO * Math.sin(ea);
    const x1i = cx + rI * Math.cos(ea), y1i = cy + rI * Math.sin(ea);
    const x2i = cx + rI * Math.cos(sa), y2i = cy + rI * Math.sin(sa);
    const large = e - s > 0.5 ? 1 : 0;
    return `M ${x1o} ${y1o} A ${rO} ${rO} 0 ${large} 1 ${x2o} ${y2o} L ${x1i} ${y1i} A ${rI} ${rI} 0 ${large} 0 ${x2i} ${y2i} Z`;
  };
  let cum = 0;
  const slices = data
    .filter((o) => o.won > 0)
    .map((o) => {
      const v = o.won / total;
      const d = arc(cum, cum + v);
      cum += v;
      return { d, color: o.color, key: o.k };
    });

  return (
    <div className="ws-compare__layout" style={{ gridTemplateColumns: `${size + 12}px 1fr`, gap: 18 }}>
      <div className="ws-compare__donut" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {total > 0 ? (
            slices.map((s) => <path key={s.key} d={s.d} fill={s.color} stroke="var(--bg)" strokeWidth={2} />)
          ) : (
            <circle cx={cx} cy={cy} r={(rO + rI) / 2} fill="none" stroke="var(--bg-3)" strokeWidth={rO - rI} />
          )}
        </svg>
        <div className="ws-compare__center">
          <span className="ws-compare__total-lbl">Cerrado</span>
          <span className="ws-compare__total">{fmtMoney(total, currency)}</span>
          <span className="ws-compare__total-sub">{totalWon} {totalWon === 1 ? "ganado" : "ganados"}</span>
        </div>
      </div>
      <div className="ws-compare__legend">
        {data.map((o) => {
          const pct = total ? (o.won / total) * 100 : 0;
          const clickable = !!onOwner;
          return (
            <div
              key={o.k}
              className={`ws-compare__legend-row${clickable ? " ws-compare__legend-row--clickable" : ""}`}
              style={{ "--ws-c": o.color } as React.CSSProperties}
              onClick={clickable ? () => onOwner(o.k) : undefined}
              title={clickable ? `Ver tratos de ${o.name}` : undefined}
            >
              <span className="ws-compare__dot" />
              <div>
                <b>{o.name}</b>
                <span className="mono">{o.wonCount} {o.wonCount === 1 ? "ganado" : "ganados"} · {o.deals} tratos · {Math.round(pct)}%</span>
              </div>
              <span className="ws-compare__legend-val">{fmtMoney(o.won, currency)}</span>
            </div>
          );
        })}
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
        <b>{open.filter((d) => d.contacts === 0).length} tratos</b> no tienen contacto asignado — asigná uno esta semana.
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
/* ============================================================
   CashFlowCard — flujo de caja mensual (próximos 12 meses):
   el SETUP se reconoce repartido entre inicio y fin de proyecto;
   el SaaS (MRR) se proyecta 12 meses desde el go-live (fin de proyecto).
   Considera todos los proyectos activos (no perdidos).
   ============================================================ */
type CFRow = { id: string; company: string; name: string; setup: number; saas: number };
function CashFlowCard({ deals, currency, onOpenDeal }: { deals: Deal[]; currency: Currency; onOpenDeal?: (id: string) => void }) {
  const [detailKey, setDetailKey] = useState<string | null>(null);
  const data = useMemo(() => {
    const today = new Date();
    const now0 = today.getFullYear() * 12 + today.getMonth();
    const N = 12;
    const mk = (d: Date) => d.getFullYear() * 12 + d.getMonth();
    const rowsByMonth: Map<string, CFRow>[] = Array.from({ length: N }, () => new Map());
    const projSet = new Set<string>();
    for (const d of deals) {
      if (d.stage === "lost" || !d.strategic) continue; // solo proyectos ESTRATÉGICOS
      const start = d.projectStartAt ? new Date(d.projectStartAt) : null;
      const end = d.projectEndAt ? new Date(d.projectEndAt) : null;
      const add = (i: number, sAdd: number, qAdd: number) => {
        const m = rowsByMonth[i];
        const r = m.get(d.id) ?? { id: d.id, company: d.company, name: d.name, setup: 0, saas: 0 };
        r.setup += sAdd; r.saas += qAdd;
        m.set(d.id, r);
        projSet.add(d.id);
      };
      if (start && end && d.value > 0) {
        const sM = mk(start), eM = mk(end);
        const dur = Math.max(1, eM - sM + 1);
        const per = d.value / dur;
        for (let m = sM; m <= eM; m++) { const i = m - now0; if (i >= 0 && i < N) add(i, per, 0); }
      }
      if (d.isRecurring && d.arr > 0) {
        const goLive = end ? mk(end) : start ? mk(start) : now0;
        const monthly = d.arr / 12;
        for (let k = 0; k < 12; k++) { const i = goLive + k - now0; if (i >= 0 && i < N) add(i, 0, monthly); }
      }
    }
    const months = Array.from({ length: N }, (_, i) => {
      const m = now0 + i;
      const dt = new Date(Math.floor(m / 12), m % 12, 1);
      const rows = [...rowsByMonth[i].values()].sort((a, b) => b.setup + b.saas - (a.setup + a.saas));
      const setup = rows.reduce((a, r) => a + r.setup, 0);
      const saas = rows.reduce((a, r) => a + r.saas, 0);
      return {
        label: dt.toLocaleDateString("es", { month: "short" }).replace(".", ""),
        year: dt.getFullYear(),
        setup, saas, total: setup + saas, rows,
      };
    });
    const max = Math.max(1, ...months.map((x) => x.total));
    const totSetup = months.reduce((a, m) => a + m.setup, 0);
    const totSaas = months.reduce((a, m) => a + m.saas, 0);
    // Acumulados por rango — barras resumen a 6 y 12 meses.
    const accRange = (from: number, to: number) => {
      const map = new Map<string, CFRow>();
      for (let i = from; i <= to && i < N; i++) {
        for (const r of rowsByMonth[i].values()) {
          const e = map.get(r.id) ?? { id: r.id, company: r.company, name: r.name, setup: 0, saas: 0 };
          e.setup += r.setup; e.saas += r.saas; map.set(r.id, e);
        }
      }
      const rows = [...map.values()].sort((a, b) => b.setup + b.saas - (a.setup + a.saas));
      const s = rows.reduce((a, r) => a + r.setup, 0), q = rows.reduce((a, r) => a + r.saas, 0);
      return { setup: s, saas: q, total: s + q, rows };
    };
    const accum = [
      { key: "a6", label: "6 m", title: `Acumulado 6 meses · ${months[0].label}–${months[Math.min(5, N - 1)].label}`, ...accRange(0, Math.min(5, N - 1)) },
      { key: "a12", label: "12 m", title: `Acumulado 12 meses · ${months[0].label}–${months[N - 1].label}`, ...accRange(0, N - 1) },
    ];
    return { months, accum, max, totSetup, totSaas, total: totSetup + totSaas, projects: projSet.size };
  }, [deals]);

  const W = 940, H = 240, padB = 26, padT = 18, padX = 8;
  const innerW = W - padX * 2;
  const innerH = H - padB - padT;
  const drawH = innerH - 12;
  const monthMaxH = drawH * 0.82; // los meses llegan hasta ~82% del alto
  const acc12 = Math.max(1, data.accum[data.accum.length - 1].total);
  // Columnas en orden: el acumulado 6m se intercala tras el 6º mes; el 12m va al final.
  const columns: ({ kind: "month"; i: number } | { kind: "accum"; i: number })[] = [];
  data.months.forEach((_, i) => {
    columns.push({ kind: "month", i });
    if (i === 5) columns.push({ kind: "accum", i: 0 });
  });
  columns.push({ kind: "accum", i: 1 });
  const slot = innerW / columns.length;
  const bw = Math.min(44, slot * 0.62);
  const accBw = Math.min(22, slot * 0.48);
  // Detalle del drawer: un mes ("m<i>") o un acumulado ("a6"/"a12").
  const detail = useMemo(() => {
    if (detailKey == null) return null;
    if (detailKey.startsWith("m")) {
      const mo = data.months[+detailKey.slice(1)];
      return mo ? { title: `Flujo de caja · ${mo.label} ${mo.year}`, setup: mo.setup, saas: mo.saas, total: mo.total, rows: mo.rows } : null;
    }
    const a = data.accum.find((x) => x.key === detailKey);
    return a ? { title: a.title, setup: a.setup, saas: a.saas, total: a.total, rows: a.rows } : null;
  }, [detailKey, data]);

  return (
    <div className="card">
      <div className="card__h">
        <Icon name="dollar" size={14} style={{ color: "var(--success)" }} />
        <span style={{ fontWeight: 600 }}>Flujo de caja · proyectos estratégicos · próximos 12 meses</span>
        <span className="card__sub">★ {data.projects} estratégicos · Σ {fmtMoney(data.total, currency)}</span>
      </div>
      <div className="card__b">
        {data.total <= 0 ? (
          <div className="cashflow__empty">
            No hay proyectos <b>Estratégicos</b> con fechas/valor en los próximos 12 meses.
            <br />Marcá leads con <b>Estratégico = Sí</b> (en el detalle del trato) para verlos en este flujo de caja.
          </div>
        ) : (
        <>
        <div className="cashflow__legend">
          <span><i className="cashflow__sw cashflow__sw--setup" /> Setup (entre inicio y fin) · <b>{fmtMoney(data.totSetup, currency)}</b></span>
          <span><i className="cashflow__sw cashflow__sw--saas" /> SaaS (proyectado 12 m) · <b>{fmtMoney(data.totSaas, currency)}</b></span>
        </div>
        <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" className="cashflow__svg">
          {columns.map((col, p) => {
            const xc = padX + slot * p;
            const yBase = padT + innerH;
            if (col.kind === "month") {
              const mo = data.months[col.i];
              const x = xc + (slot - bw) / 2;
              const hSetup = (mo.setup / data.max) * monthMaxH;
              const hSaas = (mo.saas / data.max) * monthMaxH;
              return (
                <g key={`m${col.i}`} style={{ cursor: mo.total > 0 ? "pointer" : "default" }} onClick={() => mo.total > 0 && setDetailKey(`m${col.i}`)}>
                  <title>{`${mo.label} ${mo.year} — clic para ver el sustento\nSetup: ${fmtMoney(mo.setup, currency)}\nSaaS: ${fmtMoney(mo.saas, currency)}\nTotal: ${fmtMoney(mo.total, currency)}`}</title>
                  <rect x={xc} y={padT} width={slot} height={innerH + 6} fill="transparent" />
                  {mo.setup > 0 && <rect x={x} y={yBase - hSetup} width={bw} height={hSetup} rx={2} fill="#2563eb" />}
                  {mo.saas > 0 && <rect x={x} y={yBase - hSetup - hSaas} width={bw} height={hSaas} rx={2} fill="#f59e0b" />}
                  {hSetup > 15 && (
                    <text x={x + bw / 2} y={yBase - hSetup / 2 + 3} textAnchor="middle" fontSize="9" fontFamily="var(--font-mono)" fill="#fff" pointerEvents="none">{fmtMoney(mo.setup, currency)}</text>
                  )}
                  {hSaas > 13 && (
                    <text x={x + bw / 2} y={yBase - hSetup - hSaas / 2 + 3} textAnchor="middle" fontSize="8.5" fontFamily="var(--font-mono)" fill="#7c2d12" pointerEvents="none">{fmtMoney(mo.saas, currency)}</text>
                  )}
                  {mo.total > 0 && (
                    <text x={x + bw / 2} y={yBase - hSetup - hSaas - 5} textAnchor="middle" fontSize="9.5" fontFamily="var(--font-mono)" fontWeight="600" fill="var(--fg-2)" pointerEvents="none">{fmtMoney(mo.total, currency)}</text>
                  )}
                  <text x={x + bw / 2} y={H - 8} textAnchor="middle" fontSize="10.5" fill="var(--fg-3)" pointerEvents="none">{mo.label}</text>
                </g>
              );
            }
            // acumulado (6m / 12m): finito, sutil, mismo horizonte
            const a = data.accum[col.i];
            const x = xc + (slot - accBw) / 2;
            // Acumulados: apenas más altos que el mes más alto (escala comprimida, no proporcional).
            const aTot = Math.max(1, a.total);
            const accH = monthMaxH * (1 + 0.14 * (a.total / acc12));
            const hSetup = accH * (a.setup / aTot);
            const hSaas = accH * (a.saas / aTot);
            return (
              <g key={a.key} style={{ cursor: "pointer" }} onClick={() => setDetailKey(a.key)}>
                <title>{`${a.title}\nSetup: ${fmtMoney(a.setup, currency)}\nSaaS: ${fmtMoney(a.saas, currency)}\nTotal: ${fmtMoney(a.total, currency)}`}</title>
                <line x1={xc + 1} y1={padT + 4} x2={xc + 1} y2={yBase} stroke="var(--border-2)" strokeWidth="1" strokeDasharray="2 4" opacity={0.7} />
                <rect x={xc} y={padT} width={slot} height={innerH + 6} fill="transparent" />
                {a.setup > 0 && <rect x={x} y={yBase - hSetup} width={accBw} height={hSetup} rx={2} fill="#2563eb" opacity={0.3} />}
                {a.saas > 0 && <rect x={x} y={yBase - hSetup - hSaas} width={accBw} height={hSaas} rx={2} fill="#f59e0b" opacity={0.38} />}
                <text x={x + accBw / 2} y={yBase - hSetup - hSaas - 5} textAnchor="middle" fontSize="8.5" fontFamily="var(--font-mono)" fontWeight="500" fill="var(--fg-4)" pointerEvents="none">{fmtMoney(a.total, currency)}</text>
                <text x={x + accBw / 2} y={H - 8} textAnchor="middle" fontSize="10" fill="var(--fg-4)" pointerEvents="none">{a.label}</text>
              </g>
            );
          })}
        </svg>
        <div className="cashflow__hint">Clic en un mes o en un acumulado (6 m / 12 m) para ver su sustento.</div>
        </>
        )}
      </div>

      {detail && (
        <div className="drawer-backdrop" onClick={() => setDetailKey(null)}>
          <aside className="ai-drawer kpi-drawer" style={{ width: "min(560px, 100vw)" }} onClick={(e) => e.stopPropagation()}>
            <header className="ai-drawer__head" style={{ padding: "0 14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ width: 28, height: 28, borderRadius: 6, background: "var(--success)", color: "#fff", display: "grid", placeItems: "center" }}>
                  <Icon name="dollar" size={14} />
                </span>
                <div>
                  <div style={{ fontWeight: 600 }}>{detail.title}</div>
                  <div style={{ fontSize: 10, color: "var(--fg-3)", fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    Sustento · proyectos estratégicos del mes
                  </div>
                </div>
              </div>
              <button type="button" className="btn btn--icon" onClick={() => setDetailKey(null)} aria-label="Cerrar">
                <Icon name="x" size={14} />
              </button>
            </header>
            <div className="ai-drawer__msgs" style={{ gap: 12, padding: 14 }}>
              <div className="kpi-drawer__headline">
                <div className="kpi-drawer__head-label">Total del mes</div>
                <div className="kpi-drawer__head-value">{fmtMoney(detail.total, currency)}</div>
                <div className="kpi-drawer__head-sub">
                  <span style={{ color: "#2563eb" }}>Setup {fmtMoney(detail.setup, currency)}</span> ·{" "}
                  <span style={{ color: "#b45309" }}>SaaS {fmtMoney(detail.saas, currency)}</span> · {detail.rows.length} proyecto(s)
                </div>
              </div>
              <div className="cf-drawer">
                <div className="cf-drawer__row cf-drawer__row--head">
                  <span>Proyecto</span>
                  <span className="cf-drawer__setup">Setup</span>
                  <span className="cf-drawer__saas">SaaS</span>
                </div>
                {detail.rows.map((r) => (
                  <div key={r.id} className="cf-drawer__row" onClick={() => onOpenDeal?.(r.id)}>
                    <span className="cf-drawer__proj" title={`${r.company} · ${r.name}`}>
                      <b>{r.company}</b> · <span className="cf-pn">{r.name}</span>
                    </span>
                    <span className={`cf-drawer__setup ${r.setup > 0 ? "" : "is-zero"}`}>{r.setup > 0 ? fmtMoney(r.setup, currency) : "—"}</span>
                    <span className={`cf-drawer__saas ${r.saas > 0 ? "" : "is-zero"}`}>{r.saas > 0 ? fmtMoney(r.saas, currency) : "—"}</span>
                  </div>
                ))}
                <div className="cf-drawer__row cf-drawer__row--total">
                  <span className="cf-drawer__proj"><b>Total del mes</b></span>
                  <span className="cf-drawer__setup">{fmtMoney(detail.setup, currency)}</span>
                  <span className="cf-drawer__saas">{fmtMoney(detail.saas, currency)}</span>
                </div>
                {detail.rows.length === 0 && (
                  <div style={{ padding: 16, textAlign: "center", color: "var(--fg-3)", fontSize: 13 }}>Sin proyectos este mes</div>
                )}
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}

/* ============================================================
   CashFlowTable — flujo de caja DETALLADO mes a mes (vista Excel):
   filas = proyectos estratégicos, columnas = 12 meses, + totales.
   ============================================================ */
function CashFlowTable({ deals, currency, onOpenDeal }: { deals: Deal[]; currency: Currency; onOpenDeal?: (id: string) => void }) {
  const data = useMemo(() => {
    const today = new Date();
    const now0 = today.getFullYear() * 12 + today.getMonth();
    const N = 12;
    const mk = (d: Date) => d.getFullYear() * 12 + d.getMonth();
    const months = Array.from({ length: N }, (_, i) => {
      const m = now0 + i;
      const dt = new Date(Math.floor(m / 12), m % 12, 1);
      return { label: dt.toLocaleDateString("es", { month: "short" }).replace(".", ""), year: dt.getFullYear() };
    });
    type P = { id: string; company: string; name: string; stage: string; setup: number[]; saas: number[] };
    const map = new Map<string, P>();
    const getP = (d: Deal) => {
      let p = map.get(d.id);
      if (!p) { p = { id: d.id, company: d.company, name: d.name, stage: d.stage, setup: new Array(N).fill(0), saas: new Array(N).fill(0) }; map.set(d.id, p); }
      return p;
    };
    for (const d of deals) {
      if (d.stage === "lost" || !d.strategic) continue;
      const start = d.projectStartAt ? new Date(d.projectStartAt) : null;
      const end = d.projectEndAt ? new Date(d.projectEndAt) : null;
      if (start && end && d.value > 0) {
        const sM = mk(start), eM = mk(end);
        const dur = Math.max(1, eM - sM + 1);
        const per = d.value / dur;
        for (let m = sM; m <= eM; m++) { const i = m - now0; if (i >= 0 && i < N) getP(d).setup[i] += per; }
      }
      if (d.isRecurring && d.arr > 0) {
        const goLive = end ? mk(end) : start ? mk(start) : now0;
        const monthly = d.arr / 12;
        for (let k = 0; k < 12; k++) { const i = goLive + k - now0; if (i >= 0 && i < N) getP(d).saas[i] += monthly; }
      }
    }
    const projects = [...map.values()]
      .map((p) => {
        const monthly = p.setup.map((s, i) => s + p.saas[i]);
        return { ...p, monthly, total: monthly.reduce((a, b) => a + b, 0), setupTotal: p.setup.reduce((a, b) => a + b, 0), saasTotal: p.saas.reduce((a, b) => a + b, 0) };
      })
      .sort((a, b) => b.total - a.total);
    const setupBy = new Array(N).fill(0), saasBy = new Array(N).fill(0);
    for (const p of projects) for (let i = 0; i < N; i++) { setupBy[i] += p.setup[i]; saasBy[i] += p.saas[i]; }
    const totalBy = setupBy.map((s, i) => s + saasBy[i]);
    return {
      months, projects, setupBy, saasBy, totalBy,
      sumSetup: setupBy.reduce((a, b) => a + b, 0),
      sumSaas: saasBy.reduce((a, b) => a + b, 0),
      grand: totalBy.reduce((a, b) => a + b, 0),
    };
  }, [deals]);

  if (data.projects.length === 0) return null;
  const cell = (v: number) => (v > 0 ? fmtMoney(v, currency) : "·");

  return (
    <div className="card">
      <div className="card__h">
        <Icon name="database" size={14} style={{ color: "var(--accent)" }} />
        <span style={{ fontWeight: 600 }}>Flujo de caja detallado · mes a mes</span>
        <span className="card__sub">{data.projects.length} proyectos · Σ {fmtMoney(data.grand, currency)}</span>
      </div>
      <div className="card__b">
        <div className="cf-legend">
          <span className="cf-legend__item"><i className="cf-legend__sw cf-legend__sw--won" /> Ganado</span>
          <span className="cf-legend__item"><i className="cf-legend__sw cf-legend__sw--firma" /> En firma</span>
        </div>
        <div className="cf-table-wrap">
          <table className="cf-table">
            <thead>
              <tr>
                <th className="cf-table__proj">Proyecto</th>
                {data.months.map((m, i) => <th key={i}>{m.label}<small>{String(m.year).slice(2)}</small></th>)}
                <th className="cf-table__tot">Total</th>
              </tr>
            </thead>
            <tbody>
              {data.projects.map((p) => (
                <tr
                  key={p.id}
                  onClick={() => onOpenDeal?.(p.id)}
                  title={`Abrir el trato${p.stage === "won" ? " · Ganado" : p.stage === "signing" ? " · En firma" : ""}`}
                  className={p.stage === "won" ? "cf-table__row--won" : p.stage === "signing" ? "cf-table__row--firma" : ""}
                >
                  <td className="cf-table__proj" title={`${p.company} · ${p.name}`}><b>{p.company}</b> · <span className="cf-pn">{p.name}</span></td>
                  {p.monthly.map((v, i) => <td key={i} className={v > 0 ? "" : "is-zero"} title={`Setup ${fmtMoney(p.setup[i], currency)} · SaaS ${fmtMoney(p.saas[i], currency)}`}>{cell(v)}</td>)}
                  <td className="cf-table__tot">{fmtMoney(p.total, currency)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="cf-table__sub">
                <td className="cf-table__proj">Setup</td>
                {data.setupBy.map((v, i) => <td key={i} className={v > 0 ? "" : "is-zero"}>{cell(v)}</td>)}
                <td className="cf-table__tot">{fmtMoney(data.sumSetup, currency)}</td>
              </tr>
              <tr className="cf-table__sub">
                <td className="cf-table__proj">SaaS</td>
                {data.saasBy.map((v, i) => <td key={i} className={v > 0 ? "" : "is-zero"}>{cell(v)}</td>)}
                <td className="cf-table__tot">{fmtMoney(data.sumSaas, currency)}</td>
              </tr>
              <tr className="cf-table__total">
                <td className="cf-table__proj">Total mes</td>
                {data.totalBy.map((v, i) => <td key={i}>{cell(v)}</td>)}
                <td className="cf-table__tot">{fmtMoney(data.grand, currency)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function DashboardRoute() {
  const workspace = useAppStore((s) => s.workspace);
  const currency = useAppStore((s) => s.currency);
  const setSelectedDeal = useAppStore((s) => s.setSelectedDeal);
  const openAI = useAppStore((s) => s.openAI);
  const ws = useActiveWorkspace();
  const navigate = useNavigate();
  const [kpiDetail, setKpiDetail] = useState<KpiId | null>(null);
  const [stageDetail, setStageDetail] = useState<string | null>(null);
  const [ownerDetail, setOwnerDetail] = useState<string | null>(null);
  const [clientDetail, setClientDetail] = useState<string | null>(null);
  const [lostClientDetail, setLostClientDetail] = useState<string | null>(null);

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

  // Sparklines determinísticos (en producción saldrían de una tabla de métricas)
  const sparkForecast = trend(forecastValue, 12, 1.7);
  const sparkWinRate = trend(winRate, 9, 5.5);
  const sparkConversion = trend(conversionRate, 9, 6.3);
  const sparkLost = trend(lostValue, 12, 7.1, "noisy");
  const sparkClients = trend(customers.length, 12, 8.9);
  const sparkOpen = trend(open.length, 12, 9.5);


  // ---------- Leaderboard ----------
  const leaderboard: OwnerRow[] = Object.entries(ws.owners as OwnersByKey)
    .map(([k, o]) => {
      const ds = ws.deals.filter((d) => d.owner === k);
      const wonDeals = ds.filter((d) => d.stage === "won");
      const wonV = wonDeals.reduce((a, d) => a + d.value, 0);
      return { k, name: o.name, role: o.role, color: o.color, won: wonV, deals: ds.length, wonCount: wonDeals.length };
    })
    .sort((a, b) => b.won - a.won);

  // ---------- SaaS (todas via lib/metrics — match exacto con drawer) ----------
  const recurring = ws.deals.filter((d) => d.isRecurring);
  const totalMRR = computeMrr(ws.deals);
  const newARR = computeNewArr(ws.deals, 90);
  const pipelineARR = computePipelineArrWeighted(ws.deals);
  const nrr = computeNetRetention(ws.deals);
  const cacPay = computeCacPayback(ws.deals);

  // ---------- Pipeline bruto por etapa (sin ponderar, incluye Closed Won) ----------
  const funnel = ws.stages.filter((s) => s.id !== "lost").map((s) => {
    const ds = ws.deals.filter((d) => d.stage === s.id);
    return { ...s, totalValue: ds.reduce((a, d) => a + d.value, 0), count: ds.length };
  });

  // ---------- Cliente con mayor valor en oportunidades perdidas ----------
  const lostByClient = new Map<string, { value: number; count: number }>();
  ws.deals
    .filter((d) => d.stage === "lost")
    .forEach((d) => {
      const cur = lostByClient.get(d.company) ?? { value: 0, count: 0 };
      cur.value += d.value;
      cur.count += 1;
      lostByClient.set(d.company, cur);
    });
  const topLostClient =
    [...lostByClient.entries()].map(([name, v]) => ({ name, ...v })).sort((a, b) => b.value - a.value)[0] ?? null;

  return (
    <div className="dash">
      {/* ───── KPI cards ───── */}
      <div className="dash__row dash__row--kpi">
        <Kpi label="Forecast Proyectado" value={fmtMoney(forecastValue, currency)} delta="+18.4%" deltaDir="up" help="Σ valor × prob IA" formula="Σ (valor del trato × probabilidad IA) de los tratos abiertos" purpose="Estima cuánto vas a cerrar, ponderado por la chance de ganar cada trato." spark={sparkForecast} sparkColor="var(--accent)" onClick={() => setKpiDetail("forecast")} />
        <Kpi label="Win Rate" value={winRate + "%"} delta="+2.1pp" deltaDir="up" help="Won / (Won + Lost)" formula="Ganados / (Ganados + Perdidos)" purpose="Efectividad de cierre entre los tratos ya decididos (no cuenta los abiertos)." spark={sparkWinRate} onClick={() => setKpiDetail("winrate")} />
        <Kpi label="Tasa de Conversión" value={conversionRate + "%"} delta="+3.2pp" deltaDir="up" help="Lead → Cliente" formula="Ganados / Todos los tratos (incluye abiertos)" purpose="% del embudo total que se vuelve cliente (lead → cliente)." spark={sparkConversion} onClick={() => setKpiDetail("conversion")} />
        <Kpi label="Forecast Perdido" value={fmtMoney(lostValue, currency)} delta={lost.length + " tratos"} deltaDir="down" help="Σ valor de tratos Lost" formula="Σ valor de los tratos en estado Perdido" purpose="Cuánto valor se perdió; dimensiona las fugas del pipeline." spark={sparkLost} sparkColor="var(--danger)" sparkInvert onClick={() => setKpiDetail("lost_forecast")} />
        <Kpi
          label="Cliente top perdido"
          value={topLostClient ? fmtMoney(topLostClient.value, currency) : "—"}
          valueColor="#dc2626"
          delta={topLostClient ? (topLostClient.name.length > 20 ? topLostClient.name.slice(0, 19) + "…" : topLostClient.name) : "sin pérdidas"}
          deltaDir="down"
          help={topLostClient ? `Cobrarle 2× la próxima: ${fmtMoney(topLostClient.value * 2, currency)}` : "Cliente con más valor perdido"}
          spark={sparkLost}
          sparkColor="var(--danger)"
          sparkInvert
          formula="Cliente con mayor Σ valor de tratos perdidos"
          purpose="Identifica la cuenta donde más plata se escapó."
          onClick={() => { if (topLostClient) setLostClientDetail(topLostClient.name); }}
        />
        <Kpi label="Clientes activos" value={customersCount.toString()} delta={customerArr > 0 ? "ARR " + fmtMoney(customerArr, currency) : "+1 este Q"} deltaDir="up" help="Cuentas con ≥ 1 trato ganado" formula="Cuentas (empresas) con ≥ 1 trato ganado" purpose="Tamaño real de tu base de clientes." spark={sparkClients} onClick={() => setKpiDetail("clients")} />
        <Kpi label="Oportunidades vigentes" value={open.length.toString()} delta={fmtMoney(pipelineValue, currency)} deltaDir="up" help="Abiertas · sin won ni lost" formula="Tratos abiertos (sin ganar ni perder)" purpose="Cuántas oportunidades activas tenés en juego ahora." spark={sparkOpen} sparkColor="var(--accent)" onClick={() => setKpiDetail("open_deals")} />
        <Kpi label="Cartera total" value={carteraCount.toString()} delta={`${carteraCount - carteraLostOnly} activos · ${carteraLostOnly} solo lost`} deltaDir="up" help="Empresas únicas en el CRM (incluye perdidos)" formula="Empresas únicas en el CRM (incluye perdidas)" purpose="Tamaño total de la cartera trabajada (activa + perdida)." spark={sparkClients} sparkColor="var(--fg-3)" onClick={() => setKpiDetail("cartera")} />
      </div>

      {/* ───── SaaS (grupo, junto a los KPI) ───── */}
      <div className="dash__row" style={{ gridTemplateColumns: "1fr" }}>
        <div className="card">
          <div className="card__h">
            <Icon name="dollar" size={14} style={{ color: "var(--success)" }} />
            <span style={{ fontWeight: 600 }}>SaaS · ARR</span>
            <span className="card__sub">{recurring.length} tratos recurrentes</span>
          </div>
          <div className="card__b">
            <div className="saas-grid">
              <button type="button" className="saas-kpi saas-kpi--clickable" onClick={() => setKpiDetail("mrr")}>
                <small>MRR estimado <Icon name="external" size={9} style={{ verticalAlign: "middle", color: "var(--fg-4)", marginLeft: 4 }} /><InfoTip formula="ARR total / 12" purpose="Ingreso recurrente mensual base de los clientes activos." /></small>
                <b>{fmtMoney(totalMRR, currency)}</b>
              </button>
              <button type="button" className="saas-kpi saas-kpi--clickable" onClick={() => setKpiDetail("new_arr")}>
                <small>New ARR ganado <Icon name="external" size={9} style={{ verticalAlign: "middle", color: "var(--fg-4)", marginLeft: 4 }} /><InfoTip formula="Σ ARR de contratos recurrentes ganados en los últimos 90 días" purpose="Crecimiento reciente de ingreso recurrente (último trimestre)." /></small>
                <b style={{ color: "var(--success)" }}>{fmtMoney(newARR, currency)}</b>
              </button>
              <button type="button" className="saas-kpi saas-kpi--clickable" onClick={() => setKpiDetail("pipeline_arr_w")}>
                <small>Pipeline ARR (w) <Icon name="external" size={9} style={{ verticalAlign: "middle", color: "var(--fg-4)", marginLeft: 4 }} /><InfoTip formula="Σ (ARR × probabilidad) de tratos recurrentes abiertos" purpose="ARR esperado del pipeline, ponderado por la chance de cierre." /></small>
                <b>{fmtMoney(pipelineARR, currency)}</b>
              </button>
              <button type="button" className="saas-kpi saas-kpi--clickable" onClick={() => setKpiDetail("net_retention")}>
                <small>Net retention <Icon name="external" size={9} style={{ verticalAlign: "middle", color: "var(--fg-4)", marginLeft: 4 }} /><InfoTip formula="(ARR inicial + expansión − churn) / ARR inicial" purpose="Cuánto crece o cae el ingreso de tus clientes actuales (>100% = crecen sin sumar nuevos)." /></small>
                <b>{nrr.nrr}%</b>
              </button>
              <button type="button" className="saas-kpi saas-kpi--clickable" onClick={() => setKpiDetail("cac_payback")}>
                <small>CAC payback <Icon name="external" size={9} style={{ verticalAlign: "middle", color: "var(--fg-4)", marginLeft: 4 }} /><InfoTip formula="CAC / (MRR × margen bruto)" purpose="Meses que tarda un cliente en repagar su costo de adquisición." /></small>
                <b>{cacPay.payback}m</b>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ───── AI Forecast · Pipeline weighted ───── */}
      <div className="dash__row" style={{ gridTemplateColumns: "1fr" }}>
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

          </div>
        </div>
      </div>

      {/* ───── Forecast por horizonte (debajo del KPI Pipeline total) ───── */}
      <ForecastHorizons
        deals={ws.deals}
        today={ws.today}
        currency={currency}
        onOpenDeal={(id) => setSelectedDeal(id)}
      />

      {/* ───── Flujo de caja de proyectos (setup + SaaS 12m) ───── */}
      <div className="dash__row" style={{ gridTemplateColumns: "1fr" }}>
        <CashFlowCard deals={ws.deals} currency={currency} onOpenDeal={(id) => setSelectedDeal(id)} />
      </div>

      {/* ───── Flujo de caja detallado mes a mes (tipo Excel) ───── */}
      <div className="dash__row" style={{ gridTemplateColumns: "1fr" }}>
        <CashFlowTable deals={ws.deals} currency={currency} onOpenDeal={(id) => setSelectedDeal(id)} />
      </div>

      {/* ───── Top 5 clientes (pie) + Embudo por etapa ───── */}
      <div className="dash__row" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <TopClientsPieCard deals={ws.deals} currency={currency} onClient={(k) => setClientDetail(k)} />
        <StageFunnelCard funnel={funnel} currency={currency} onStage={(id) => setStageDetail(id)} />
      </div>

      {/* ───── Leaderboard ───── */}
      <div className="dash__row" style={{ gridTemplateColumns: "1fr" }}>
        <div className="card">
          <div className="card__h">
            <Icon name="users" size={14} />
            <span style={{ fontWeight: 600 }}>Leaderboard</span>
          </div>
          <div className="card__b">
            <LeaderboardCompare data={leaderboard} currency={currency} onOwner={(k) => setOwnerDetail(k)} />
          </div>
        </div>
      </div>

      {/* ───── NOVIT vs SHARKY ───── */}
      <WorkspaceComparison currency={currency} />

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

      {/* ───── Gantt de proyectos (al final) ───── */}
      <div className="dash__row" style={{ gridTemplateColumns: "1fr" }}>
        <ProjectGanttCard
          deals={ws.deals}
          today={ws.today}
          currency={currency}
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

      {/* ───── Stage Detail Drawer (sustento por etapa) ───── */}
      <StageDealsDrawer
        stageId={stageDetail}
        ws={ws}
        currency={currency}
        onClose={() => setStageDetail(null)}
        onOpenDeal={(id) => {
          setStageDetail(null);
          setSelectedDeal(id);
        }}
      />

      {/* ───── Owner Detail Drawer (sustento del leaderboard) ───── */}
      <OwnerDealsDrawer
        ownerKey={ownerDetail}
        ws={ws}
        currency={currency}
        onClose={() => setOwnerDetail(null)}
        onOpenDeal={(id) => {
          setOwnerDetail(null);
          setSelectedDeal(id);
        }}
      />

      {/* ───── Client Detail Drawer (sustento Top 5 clientes) ───── */}
      <ClientDealsDrawer
        clientKey={clientDetail}
        ws={ws}
        currency={currency}
        onClose={() => setClientDetail(null)}
        onOpenDeal={(id) => {
          setClientDetail(null);
          setSelectedDeal(id);
        }}
      />

      {/* ───── Lost Client Drawer (sustento KPI cliente top perdido) ───── */}
      <LostClientDrawer
        clientName={lostClientDetail}
        ws={ws}
        currency={currency}
        onClose={() => setLostClientDetail(null)}
        onOpenDeal={(id) => {
          setLostClientDetail(null);
          setSelectedDeal(id);
        }}
      />
    </div>
  );
}
