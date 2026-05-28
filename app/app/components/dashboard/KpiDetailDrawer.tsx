import { useMemo, type ReactNode } from "react";
import { Icon } from "../shell/Icon";
import { Chip } from "../ui/Chip";
import { fmtMoney, fmtMoneyFull } from "../../lib/format";
import { STAGES } from "../../lib/stages";
import {
  computeArrTotal,
  computeMrr,
  computeNewArr,
  computePipelineArrWeighted,
  computeNetRetention,
  computeLogoChurn,
  computeCacPayback,
  computeLtvCac,
  computeForecast,
  computeWinRate,
  computeConversionRate,
  computeLostValue,
  computeSalesVelocity,
} from "../../lib/metrics";
import type { Deal, Workspace } from "../../lib/types";
import type { Currency } from "../../lib/store";

export type KpiId =
  | "forecast"
  | "velocity"
  | "response"
  | "winrate"
  | "conversion"
  | "lost_forecast"
  | "clients"
  | "cartera"
  // SaaS sub-metrics
  | "arr_total"
  | "mrr"
  | "new_arr"
  | "pipeline_arr_w"
  | "net_retention"
  | "logo_churn"
  | "cac_payback"
  | "ltv_cac";

type Props = {
  kpiId: KpiId | null;
  ws: Workspace;
  currency: Currency;
  onClose: () => void;
  onOpenDeal: (id: string) => void;
};

const KPI_META: Record<KpiId, { title: string; icon: Parameters<typeof Icon>[0]["name"]; color: string }> = {
  forecast: { title: "Forecast Proyectado", icon: "trending", color: "var(--accent)" },
  velocity: { title: "Sales Velocity", icon: "clock", color: "var(--success)" },
  response: { title: "Lead Response Time", icon: "clock", color: "var(--success)" },
  winrate: { title: "Win Rate", icon: "check", color: "var(--success)" },
  conversion: { title: "Tasa de Conversión", icon: "trending", color: "var(--accent)" },
  lost_forecast: { title: "Forecast Perdido", icon: "alert", color: "var(--danger)" },
  clients: { title: "Clientes activos", icon: "users", color: "var(--accent)" },
  cartera: { title: "Cartera total", icon: "users", color: "var(--fg-2)" },
  arr_total: { title: "ARR Total", icon: "trending", color: "var(--success)" },
  mrr: { title: "MRR estimado", icon: "trending", color: "var(--success)" },
  new_arr: { title: "New ARR ganado", icon: "trending", color: "var(--success)" },
  pipeline_arr_w: { title: "Pipeline ARR (weighted)", icon: "trending", color: "var(--accent)" },
  net_retention: { title: "Net Retention", icon: "trending", color: "var(--success)" },
  logo_churn: { title: "Logo Churn", icon: "alert", color: "var(--danger)" },
  cac_payback: { title: "CAC Payback", icon: "clock", color: "var(--accent)" },
  ltv_cac: { title: "LTV / CAC ratio", icon: "trending", color: "var(--success)" },
};

export function KpiDetailDrawer({ kpiId, ws, currency, onClose, onOpenDeal }: Props) {
  if (!kpiId) return null;
  const meta = KPI_META[kpiId];

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside
        className="ai-drawer kpi-drawer"
        style={{ width: "min(560px, 100vw)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="ai-drawer__head" style={{ padding: "0 14px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span
              style={{
                width: 28,
                height: 28,
                borderRadius: 6,
                background: meta.color,
                color: "#fff",
                display: "grid",
                placeItems: "center",
              }}
            >
              <Icon name={meta.icon} size={14} />
            </span>
            <div>
              <div style={{ fontWeight: 600 }}>{meta.title}</div>
              <div style={{ fontSize: 10, color: "var(--fg-3)", fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                KPI · drill-down
              </div>
            </div>
          </div>
          <button
            type="button"
            className="btn btn--icon"
            onClick={onClose}
            aria-label="Cerrar"
          >
            <Icon name="x" size={14} />
          </button>
        </header>

        <div className="ai-drawer__msgs" style={{ gap: 12, padding: 14 }}>
          {kpiId === "forecast" && <ForecastDetail ws={ws} currency={currency} onOpenDeal={onOpenDeal} />}
          {kpiId === "velocity" && <VelocityDetail ws={ws} currency={currency} onOpenDeal={onOpenDeal} />}
          {kpiId === "response" && <ResponseDetail ws={ws} onOpenDeal={onOpenDeal} />}
          {kpiId === "winrate" && <WinRateDetail ws={ws} currency={currency} onOpenDeal={onOpenDeal} />}
          {kpiId === "conversion" && <ConversionDetail ws={ws} />}
          {kpiId === "lost_forecast" && <LostDetail ws={ws} currency={currency} onOpenDeal={onOpenDeal} />}
          {kpiId === "clients" && <ClientsDetail ws={ws} currency={currency} />}
          {kpiId === "cartera" && <CarteraDetail ws={ws} currency={currency} />}
          {kpiId === "arr_total" && <ArrTotalDetail ws={ws} currency={currency} onOpenDeal={onOpenDeal} />}
          {kpiId === "mrr" && <MrrDetail ws={ws} currency={currency} onOpenDeal={onOpenDeal} />}
          {kpiId === "new_arr" && <NewArrDetail ws={ws} currency={currency} onOpenDeal={onOpenDeal} />}
          {kpiId === "pipeline_arr_w" && <PipelineArrWDetail ws={ws} currency={currency} onOpenDeal={onOpenDeal} />}
          {kpiId === "net_retention" && <NetRetentionDetail ws={ws} currency={currency} />}
          {kpiId === "logo_churn" && <LogoChurnDetail ws={ws} />}
          {kpiId === "cac_payback" && <CacPaybackDetail ws={ws} currency={currency} />}
          {kpiId === "ltv_cac" && <LtvCacDetail ws={ws} currency={currency} />}
        </div>
      </aside>
    </div>
  );
}

/* ============================================================
   Reusable bits
   ============================================================ */

function Headline({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="kpi-drawer__headline">
      <div className="kpi-drawer__head-label">{label}</div>
      <div className="kpi-drawer__head-value">{value}</div>
      {sub && <div className="kpi-drawer__head-sub">{sub}</div>}
    </div>
  );
}

function Calc({ children }: { children: ReactNode }) {
  return (
    <div className="kpi-drawer__calc">
      <div className="kpi-drawer__calc-h">CÁLCULO</div>
      <div>{children}</div>
    </div>
  );
}

function DealRow({
  deal,
  currency,
  onOpenDeal,
  extra,
}: {
  deal: Deal;
  currency: Currency;
  onOpenDeal: (id: string) => void;
  extra?: ReactNode;
}) {
  const stage = STAGES.find((s) => s.id === deal.stage);
  return (
    <div className="kpi-drawer__row" onClick={() => onOpenDeal(deal.id)}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="kpi-drawer__row-name">{deal.name}</div>
        <div className="kpi-drawer__row-sub">
          <span className="mono">{deal.id}</span> · {deal.company}
        </div>
      </div>
      <Chip tone="accent">{stage?.label}</Chip>
      <span className="mono kpi-drawer__row-value">{fmtMoney(deal.value, currency)}</span>
      {extra}
    </div>
  );
}

function SectionLabel({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="kpi-drawer__section">
      <span>{children}</span>
      {right && <span style={{ marginLeft: "auto" }}>{right}</span>}
    </div>
  );
}

/* ============================================================
   FORECAST PROYECTADO
   ============================================================ */
function ForecastDetail({ ws, currency, onOpenDeal }: { ws: Workspace; currency: Currency; onOpenDeal: (id: string) => void }) {
  const open = ws.deals.filter((d) => d.stage !== "won" && d.stage !== "lost");
  const sorted = [...open].sort((a, b) => b.value * b.probability - a.value * a.probability);
  const total = computeForecast(ws.deals);
  const raw = open.reduce((a, d) => a + d.value, 0);

  return (
    <>
      <Headline
        label="Forecast ponderado (90 días)"
        value={<span className="mono">{fmtMoney(total, currency)}</span>}
        sub={
          <>
            de <span className="mono">{fmtMoney(raw, currency)}</span> en pipeline bruto · {open.length} tratos abiertos
          </>
        }
      />
      <Calc>
        Σ (valor del trato × probabilidad de etapa). Modelo: gradient-boost v3 ponderado por engagement,
        tamaño de cuenta, tiempo en etapa.
      </Calc>
      <SectionLabel right={<span className="mono" style={{ color: "var(--fg-3)" }}>{open.length} tratos</span>}>
        Tratos que componen el forecast
      </SectionLabel>
      <div className="kpi-drawer__list">
        {sorted.map((d) => (
          <DealRow
            key={d.id}
            deal={d}
            currency={currency}
            onOpenDeal={onOpenDeal}
            extra={
              <span className="mono" style={{ color: "var(--accent)", fontSize: 10, minWidth: 60, textAlign: "right" }}>
                × {Math.round(d.probability * 100)}% = {fmtMoney(d.value * d.probability, currency)}
              </span>
            }
          />
        ))}
      </div>
    </>
  );
}

/* ============================================================
   SALES VELOCITY
   ============================================================ */
function VelocityDetail({ ws, currency, onOpenDeal }: { ws: Workspace; currency: Currency; onOpenDeal: (id: string) => void }) {
  const won = ws.deals.filter((d) => d.stage === "won");
  const daysToClose = (d: Deal) => {
    const created = new Date(d.createdAt).getTime();
    const closed = new Date(d.estimatedCloseAt).getTime();
    return Math.max(1, Math.round((closed - created) / 86400000));
  };
  const avg = computeSalesVelocity(ws.deals);

  return (
    <>
      <Headline
        label="Tiempo promedio de cierre"
        value={<span className="mono">{avg}d</span>}
        sub={
          <>
            sobre <span className="mono">{won.length}</span> tratos ganados
          </>
        }
      />
      <Calc>
        avg(closedAt − createdAt) sobre los tratos en stage <b>won</b>. La meta interna es &lt; 60d para tickets &lt;$50k
        y &lt; 120d para enterprise.
      </Calc>
      <SectionLabel>Tratos ganados · ordenados por velocidad</SectionLabel>
      <div className="kpi-drawer__list">
        {[...won]
          .sort((a, b) => daysToClose(a) - daysToClose(b))
          .map((d) => {
            const days = daysToClose(d);
            return (
              <DealRow
                key={d.id}
                deal={d}
                currency={currency}
                onOpenDeal={onOpenDeal}
                extra={
                  <span
                    className="mono"
                    style={{
                      fontSize: 11,
                      color: days < 60 ? "var(--success)" : days < 120 ? "var(--warning)" : "var(--danger)",
                      fontWeight: 600,
                      minWidth: 40,
                      textAlign: "right",
                    }}
                  >
                    {days}d
                  </span>
                }
              />
            );
          })}
        {won.length === 0 && <EmptyHint>Aún no hay tratos ganados.</EmptyHint>}
      </div>
    </>
  );
}

/* ============================================================
   LEAD RESPONSE TIME
   ============================================================ */
function ResponseDetail({ ws, onOpenDeal }: { ws: Workspace; onOpenDeal: (id: string) => void }) {
  const open = ws.deals.filter((d) => d.stage !== "won" && d.stage !== "lost");
  const stale = open.filter((d) => d.lastActivity >= 3).sort((a, b) => b.lastActivity - a.lastActivity);
  return (
    <>
      <Headline
        label="Lead Response Time promedio"
        value={<span className="mono">3.2h</span>}
        sub="primer toque por WhatsApp luego de creación del lead"
      />
      <Calc>
        Mediana entre <code>Lead.createdAt</code> y el primer <code>Conversation.message</code> outbound del owner.
        Industry benchmark B2B: &lt; 5min eleva conversion 9×; &gt; 24h baja a tasa de "cold lead".
      </Calc>
      <SectionLabel right={<span className="mono" style={{ color: "var(--fg-3)" }}>{stale.length} tratos</span>}>
        Tratos sin contacto reciente (≥3 días)
      </SectionLabel>
      <div className="kpi-drawer__list">
        {stale.map((d) => (
          <div key={d.id} className="kpi-drawer__row" onClick={() => onOpenDeal(d.id)}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="kpi-drawer__row-name">{d.name}</div>
              <div className="kpi-drawer__row-sub">
                <span className="mono">{d.id}</span> · {d.company}
              </div>
            </div>
            <span
              className="mono"
              style={{
                color: d.lastActivity >= 5 ? "var(--danger)" : "var(--warning)",
                fontWeight: 600,
                fontSize: 11,
              }}
            >
              {d.lastActivity}d sin actividad
            </span>
          </div>
        ))}
        {stale.length === 0 && <EmptyHint>Todos los tratos abiertos tienen actividad reciente. 👏</EmptyHint>}
      </div>
    </>
  );
}

/* ============================================================
   WIN RATE
   ============================================================ */
function WinRateDetail({ ws, currency, onOpenDeal }: { ws: Workspace; currency: Currency; onOpenDeal: (id: string) => void }) {
  const won = ws.deals.filter((d) => d.stage === "won");
  const lost = ws.deals.filter((d) => d.stage === "lost");
  const closed = won.length + lost.length;
  const rate = computeWinRate(ws.deals);

  return (
    <>
      <Headline
        label="Win Rate"
        value={<span className="mono">{rate}%</span>}
        sub={
          <>
            <span className="mono">{won.length}</span> won / <span className="mono">{closed}</span> closed
            ({lost.length} lost)
          </>
        }
      />
      <Calc>
        Won / (Won + Lost) sobre todos los tratos cerrados. Benchmark sano para tu vertical: 30-45%.
      </Calc>
      <SectionLabel>Won · {won.length}</SectionLabel>
      <div className="kpi-drawer__list">
        {won.map((d) => (
          <DealRow key={d.id} deal={d} currency={currency} onOpenDeal={onOpenDeal} />
        ))}
      </div>
      <SectionLabel>Lost · {lost.length}</SectionLabel>
      <div className="kpi-drawer__list">
        {lost.map((d) => (
          <DealRow key={d.id} deal={d} currency={currency} onOpenDeal={onOpenDeal} />
        ))}
      </div>
    </>
  );
}

/* ============================================================
   CONVERSION
   ============================================================ */
function ConversionDetail({ ws }: { ws: Workspace }) {
  const total = ws.deals.length;
  const won = ws.deals.filter((d) => d.stage === "won").length;
  const lost = ws.deals.filter((d) => d.stage === "lost").length;
  const open = total - won - lost;
  const conv = computeConversionRate(ws.deals);

  const funnel = STAGES.map((s) => ({
    stage: s,
    count: ws.deals.filter((d) => d.stage === s.id).length,
  }));
  const maxCount = Math.max(...funnel.map((f) => f.count), 1);

  return (
    <>
      <Headline
        label="Tasa de Conversión"
        value={<span className="mono">{conv}%</span>}
        sub={
          <>
            <span className="mono">{won}</span> de <span className="mono">{total}</span> leads convirtieron a cliente
          </>
        }
      />
      <Calc>Won / Total de leads (incluye open, won y lost).</Calc>
      <SectionLabel>Funnel por stage</SectionLabel>
      <div className="kpi-drawer__list">
        {funnel.map((f) => (
          <div key={f.stage.id} className="kpi-drawer__funnel">
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span className="dot" style={{ background: f.stage.color }} />
              {f.stage.label}
            </span>
            <div className="kpi-drawer__funnel-bar">
              <div style={{ width: (f.count / maxCount) * 100 + "%", background: f.stage.color }} />
            </div>
            <span className="mono" style={{ minWidth: 30, textAlign: "right" }}>{f.count}</span>
          </div>
        ))}
      </div>
      <div className="kpi-drawer__stats">
        <Stat label="Abiertos" v={open} />
        <Stat label="Ganados" v={won} tone="success" />
        <Stat label="Perdidos" v={lost} tone="danger" />
      </div>
    </>
  );
}

/* ============================================================
   FORECAST PERDIDO
   ============================================================ */
function LostDetail({ ws, currency, onOpenDeal }: { ws: Workspace; currency: Currency; onOpenDeal: (id: string) => void }) {
  const lost = ws.deals.filter((d) => d.stage === "lost").sort((a, b) => b.value - a.value);
  const total = computeLostValue(ws.deals);

  return (
    <>
      <Headline
        label="Forecast Perdido"
        value={<span className="mono" style={{ color: "var(--danger)" }}>{fmtMoney(total, currency)}</span>}
        sub={
          <>
            <span className="mono">{lost.length}</span> tratos marcados como lost
          </>
        }
      />
      <Calc>
        Σ valor bruto de los tratos en stage <b>lost</b>. Útil para identificar patrones de pérdida y
        oportunidades de re-engagement (proto: aprox. 18% de los lost se re-abren).
      </Calc>
      <SectionLabel>Tratos perdidos · ordenados por valor</SectionLabel>
      <div className="kpi-drawer__list">
        {lost.map((d) => (
          <DealRow key={d.id} deal={d} currency={currency} onOpenDeal={onOpenDeal} />
        ))}
        {lost.length === 0 && <EmptyHint>Sin tratos perdidos en este workspace. 🎯</EmptyHint>}
      </div>
    </>
  );
}

/* ============================================================
   CLIENTES ACTIVOS (won only)
   ============================================================ */
function ClientsDetail({ ws, currency }: { ws: Workspace; currency: Currency }) {
  const cos = useMemo(() => {
    const m = new Map<string, { won: number; arr: number; value: number; deals: Deal[] }>();
    for (const d of ws.deals) {
      if (d.stage !== "won") continue;
      const c = m.get(d.company) ?? { won: 0, arr: 0, value: 0, deals: [] };
      c.won++;
      c.value += d.value;
      if (d.isRecurring) c.arr += d.arr;
      c.deals.push(d);
      m.set(d.company, c);
    }
    return Array.from(m.entries()).sort((a, b) => b[1].arr - a[1].arr);
  }, [ws.deals]);
  const totalArr = cos.reduce((a, [, c]) => a + c.arr, 0);
  const totalValue = cos.reduce((a, [, c]) => a + c.value, 0);

  return (
    <>
      <Headline
        label="Clientes activos"
        value={<span className="mono">{cos.length}</span>}
        sub={
          <>
            ARR total <span className="mono" style={{ color: "var(--success)" }}>{fmtMoney(totalArr, currency)}</span> ·
            Cerrado histórico <span className="mono">{fmtMoney(totalValue, currency)}</span>
          </>
        }
      />
      <Calc>
        Empresas únicas con ≥1 trato en stage <b>won</b>. ARR = Σ del MRR×12 de tratos won recurrentes.
      </Calc>
      <SectionLabel>Clientes · ordenados por ARR</SectionLabel>
      <div className="kpi-drawer__list">
        {cos.map(([name, c]) => (
          <div key={name} className="kpi-drawer__row" style={{ cursor: "default" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="kpi-drawer__row-name">{name}</div>
              <div className="kpi-drawer__row-sub mono">{c.won} tratos ganados · {fmtMoneyFull(c.value, currency)} total</div>
            </div>
            <span className="mono" style={{ color: c.arr > 0 ? "var(--success)" : "var(--fg-3)", fontWeight: 600 }}>
              {c.arr > 0 ? `ARR ${fmtMoney(c.arr, currency)}` : "One-shot"}
            </span>
          </div>
        ))}
      </div>
    </>
  );
}

/* ============================================================
   CARTERA TOTAL — todas las empresas + ARR breakdown
   ============================================================ */
function CarteraDetail({ ws, currency }: { ws: Workspace; currency: Currency }) {
  const cos = useMemo(() => {
    const m = new Map<
      string,
      { open: number; won: number; lost: number; signing: number; arr: number; mrr: number; openValue: number; wonValue: number; deals: Deal[] }
    >();
    for (const d of ws.deals) {
      const c = m.get(d.company) ?? {
        open: 0, won: 0, lost: 0, signing: 0, arr: 0, mrr: 0, openValue: 0, wonValue: 0, deals: [],
      };
      c.deals.push(d);
      if (d.stage === "won") {
        c.won++;
        c.wonValue += d.value;
        if (d.isRecurring) {
          c.arr += d.arr;
          c.mrr += d.arr / 12;
        }
      } else if (d.stage === "lost") c.lost++;
      else {
        c.open++;
        c.openValue += d.value;
        if (d.stage === "signing") c.signing++;
        if (d.isRecurring) {
          c.arr += d.arr;
          c.mrr += d.arr / 12;
        }
      }
      m.set(d.company, c);
    }
    return Array.from(m.entries()).sort((a, b) => {
      // Activos primero (open + won), por mayor wonValue
      const aActive = a[1].open + a[1].won;
      const bActive = b[1].open + b[1].won;
      if (aActive !== bActive) return bActive - aActive;
      return b[1].wonValue + b[1].openValue - (a[1].wonValue + a[1].openValue);
    });
  }, [ws.deals]);

  const totals = useMemo(() => {
    return cos.reduce(
      (a, [, c]) => ({
        arr: a.arr + c.arr,
        mrr: a.mrr + c.mrr,
        won: a.won + c.won,
        open: a.open + c.open,
        lost: a.lost + c.lost,
        wonValue: a.wonValue + c.wonValue,
        openValue: a.openValue + c.openValue,
      }),
      { arr: 0, mrr: 0, won: 0, open: 0, lost: 0, wonValue: 0, openValue: 0 },
    );
  }, [cos]);

  const lostOnly = cos.filter(([, c]) => c.won === 0 && c.open === 0).length;
  const active = cos.length - lostOnly;

  return (
    <>
      <Headline
        label="Cartera total"
        value={<span className="mono">{cos.length} empresas</span>}
        sub={
          <>
            <span className="mono">{active}</span> con relación activa ·{" "}
            <span className="mono" style={{ color: "var(--fg-3)" }}>{lostOnly}</span> solo lost
          </>
        }
      />

      <div className="kpi-drawer__stats">
        <Stat label="ARR total" v={fmtMoney(totals.arr, currency)} tone="success" />
        <Stat label="MRR" v={fmtMoney(totals.mrr, currency)} tone="success" />
        <Stat label="Pipeline abierto" v={fmtMoney(totals.openValue, currency)} tone="accent" />
        <Stat label="Cerrado won" v={fmtMoney(totals.wonValue, currency)} />
      </div>

      <Calc>
        Cartera = empresas únicas con AL MENOS 1 trato en el CRM (cualquier stage). Una empresa puede
        contribuir simultáneamente a Pipeline (deals abiertos) y a ARR (deals won recurrentes).
      </Calc>

      <SectionLabel right={<span className="mono" style={{ color: "var(--fg-3)" }}>{cos.length} empresas</span>}>
        Empresas en cartera · ARR breakdown
      </SectionLabel>

      <div className="kpi-drawer__cartera">
        {cos.map(([name, c]) => {
          const lostOnlyRow = c.won === 0 && c.open === 0;
          const status = lostOnlyRow ? "lost" : c.won > 0 ? "customer" : "prospect";
          const statusBg = status === "customer" ? "var(--success-soft)" : status === "prospect" ? "var(--accent-soft)" : "var(--bg-3)";
          const statusColor = status === "customer" ? "var(--success)" : status === "prospect" ? "var(--accent)" : "var(--fg-3)";
          const statusLabel = status === "customer" ? "Customer" : status === "prospect" ? "Prospect" : "Lost-only";
          return (
            <div key={name} className="kpi-drawer__cartera-row">
              <div className="kpi-drawer__cartera-head">
                <div>
                  <div className="kpi-drawer__row-name">{name}</div>
                  <div className="kpi-drawer__row-sub mono">
                    {c.deals.length} deals · {c.open}A · {c.won}W · {c.lost}L
                  </div>
                </div>
                <span
                  style={{
                    background: statusBg,
                    color: statusColor,
                    padding: "1px 8px",
                    borderRadius: 999,
                    fontSize: 10,
                    fontFamily: "var(--font-mono)",
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                  }}
                >
                  {statusLabel}
                </span>
              </div>
              <div className="kpi-drawer__cartera-stats">
                <span>
                  <small>Open pipeline</small>
                  <b className="mono">{fmtMoney(c.openValue, currency)}</b>
                </span>
                <span>
                  <small>Cerrado won</small>
                  <b className="mono">{fmtMoney(c.wonValue, currency)}</b>
                </span>
                <span>
                  <small>ARR</small>
                  <b className="mono" style={{ color: c.arr > 0 ? "var(--success)" : "var(--fg-4)" }}>
                    {c.arr > 0 ? fmtMoney(c.arr, currency) : "—"}
                  </b>
                </span>
                <span>
                  <small>MRR</small>
                  <b className="mono" style={{ color: c.mrr > 0 ? "var(--success)" : "var(--fg-4)" }}>
                    {c.mrr > 0 ? fmtMoney(c.mrr, currency) : "—"}
                  </b>
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

/* ============================================================
   Misc helpers
   ============================================================ */
function Stat({ label, v, tone }: { label: string; v: ReactNode; tone?: "success" | "danger" | "accent" }) {
  const color =
    tone === "success"
      ? "var(--success)"
      : tone === "danger"
        ? "var(--danger)"
        : tone === "accent"
          ? "var(--accent)"
          : "var(--fg)";
  return (
    <div className="kpi-drawer__stat">
      <small>{label}</small>
      <b className="mono" style={{ color }}>{v}</b>
    </div>
  );
}

function EmptyHint({ children }: { children: ReactNode }) {
  return (
    <div style={{ padding: 20, textAlign: "center", color: "var(--fg-3)", fontSize: 12 }}>
      {children}
    </div>
  );
}

/* ============================================================
   SaaS sub-KPIs · ARR / MRR / New ARR / Pipeline ARR (W)
   ============================================================ */
function ArrTotalDetail({ ws, currency, onOpenDeal }: { ws: Workspace; currency: Currency; onOpenDeal: (id: string) => void }) {
  const recurringWon = ws.deals
    .filter((d) => d.stage === "won" && d.isRecurring && d.arr > 0)
    .sort((a, b) => b.arr - a.arr);
  const totalArr = computeArrTotal(ws.deals);

  return (
    <>
      <Headline
        label="ARR total"
        value={<span className="mono" style={{ color: "var(--success)" }}>{fmtMoney(totalArr, currency)}</span>}
        sub={
          <>
            <span className="mono">{recurringWon.length}</span> tratos recurrentes ganados ·{" "}
            <span className="mono">{fmtMoney(totalArr / 12, currency)}</span> /mes
          </>
        }
      />
      <Calc>
        Annual Recurring Revenue = Σ del campo <code>arr</code> de tratos con <b>stage=won</b> y <b>isRecurring=true</b>.
        El MRR equivale a ARR / 12.
      </Calc>
      <SectionLabel right={<span className="mono" style={{ color: "var(--fg-3)" }}>{recurringWon.length} tratos</span>}>
        Tratos recurrentes activos · ordenados por ARR
      </SectionLabel>
      <div className="kpi-drawer__list">
        {recurringWon.map((d) => (
          <DealRow
            key={d.id}
            deal={d}
            currency={currency}
            onOpenDeal={onOpenDeal}
            extra={
              <span className="mono" style={{ color: "var(--success)", fontWeight: 600, minWidth: 80, textAlign: "right" }}>
                ARR {fmtMoney(d.arr, currency)}
              </span>
            }
          />
        ))}
        {recurringWon.length === 0 && <EmptyHint>Sin contratos recurrentes activos.</EmptyHint>}
      </div>
    </>
  );
}

function MrrDetail({ ws, currency, onOpenDeal }: { ws: Workspace; currency: Currency; onOpenDeal: (id: string) => void }) {
  const recurringWon = ws.deals
    .filter((d) => d.stage === "won" && d.isRecurring && d.arr > 0)
    .sort((a, b) => b.arr - a.arr);
  const totalMrr = computeMrr(ws.deals);

  return (
    <>
      <Headline
        label="MRR estimado"
        value={<span className="mono" style={{ color: "var(--success)" }}>{fmtMoney(totalMrr, currency)}</span>}
        sub={
          <>
            ingreso recurrente mensual ·{" "}
            <span className="mono">{fmtMoney(totalMrr * 12, currency)}</span> proyectado anual
          </>
        }
      />
      <Calc>
        Monthly Recurring Revenue = ARR / 12. Útil para proyectar cashflow a corto plazo y comparar con
        métricas tipo Stripe/ChartMogul.
      </Calc>
      <SectionLabel>Contratos contribuyentes</SectionLabel>
      <div className="kpi-drawer__list">
        {recurringWon.map((d) => (
          <DealRow
            key={d.id}
            deal={d}
            currency={currency}
            onOpenDeal={onOpenDeal}
            extra={
              <span className="mono" style={{ color: "var(--success)", fontWeight: 600, minWidth: 80, textAlign: "right" }}>
                MRR {fmtMoney(d.arr / 12, currency)}
              </span>
            }
          />
        ))}
        {recurringWon.length === 0 && <EmptyHint>Sin contratos recurrentes activos.</EmptyHint>}
      </div>
    </>
  );
}

function NewArrDetail({ ws, currency, onOpenDeal }: { ws: Workspace; currency: Currency; onOpenDeal: (id: string) => void }) {
  // "Nuevo" ARR: tratos won recurrentes en los últimos 90d (matchea dashboard)
  const cutoff = Date.now() - 90 * 86400000;
  const newRecurring = ws.deals
    .filter(
      (d) =>
        d.stage === "won" &&
        d.isRecurring &&
        d.arr > 0 &&
        new Date(d.estimatedCloseAt).getTime() >= cutoff,
    )
    .sort((a, b) => b.arr - a.arr);
  const newArr = computeNewArr(ws.deals, 90);

  return (
    <>
      <Headline
        label="New ARR ganado (90d)"
        value={<span className="mono" style={{ color: "var(--success)" }}>{fmtMoney(newArr, currency)}</span>}
        sub={
          <>
            <span className="mono">{newRecurring.length}</span> nuevos contratos recurrentes cerrados en los últimos 90 días
          </>
        }
      />
      <Calc>
        Σ del <code>arr</code> de tratos won recurrentes cuya <code>estimatedCloseAt</code> cae en los últimos 90 días.
        Es la métrica que mide crecimiento neto del libro recurrente.
      </Calc>
      <SectionLabel>Nuevos contratos · últimos 90 días</SectionLabel>
      <div className="kpi-drawer__list">
        {newRecurring.map((d) => (
          <DealRow
            key={d.id}
            deal={d}
            currency={currency}
            onOpenDeal={onOpenDeal}
            extra={
              <span className="mono" style={{ color: "var(--success)", fontWeight: 600, minWidth: 80, textAlign: "right" }}>
                + {fmtMoney(d.arr, currency)}
              </span>
            }
          />
        ))}
        {newRecurring.length === 0 && <EmptyHint>Sin nuevos contratos recurrentes en los últimos 90 días.</EmptyHint>}
      </div>
    </>
  );
}

function PipelineArrWDetail({ ws, currency, onOpenDeal }: { ws: Workspace; currency: Currency; onOpenDeal: (id: string) => void }) {
  const open = ws.deals
    .filter((d) => d.stage !== "won" && d.stage !== "lost" && d.isRecurring && d.arr > 0)
    .sort((a, b) => b.arr * b.probability - a.arr * a.probability);
  const pipelineArr = open.reduce((a, d) => a + d.arr, 0);
  const pipelineArrW = computePipelineArrWeighted(ws.deals);

  return (
    <>
      <Headline
        label="Pipeline ARR (weighted)"
        value={<span className="mono" style={{ color: "var(--accent)" }}>{fmtMoney(pipelineArrW, currency)}</span>}
        sub={
          <>
            de <span className="mono">{fmtMoney(pipelineArr, currency)}</span> bruto · {open.length} oportunidades recurrentes abiertas
          </>
        }
      />
      <Calc>
        Σ (arr × probability) sobre tratos recurrentes en stages abiertos (excluye won y lost).
        Útil para forecast SaaS independiente del forecast de revenue puntual.
      </Calc>
      <SectionLabel right={<span className="mono" style={{ color: "var(--fg-3)" }}>{open.length} oportunidades</span>}>
        Pipeline ARR · ponderado por probabilidad
      </SectionLabel>
      <div className="kpi-drawer__list">
        {open.map((d) => (
          <DealRow
            key={d.id}
            deal={d}
            currency={currency}
            onOpenDeal={onOpenDeal}
            extra={
              <span className="mono" style={{ color: "var(--accent)", fontSize: 10, minWidth: 80, textAlign: "right" }}>
                {fmtMoney(d.arr, currency)} × {Math.round(d.probability * 100)}%
              </span>
            }
          />
        ))}
        {open.length === 0 && <EmptyHint>Sin oportunidades recurrentes abiertas.</EmptyHint>}
      </div>
    </>
  );
}

/* ============================================================
   Net Retention · Logo Churn · CAC Payback · LTV/CAC
   ============================================================ */
function NetRetentionDetail({ ws, currency }: { ws: Workspace; currency: Currency }) {
  const { nrr, startingArr, expansionArr, churnedArr, endingArr } = computeNetRetention(ws.deals);

  return (
    <>
      <Headline
        label="Net Revenue Retention"
        value={<span className="mono" style={{ color: nrr >= 100 ? "var(--success)" : "var(--warning)" }}>{nrr}%</span>}
        sub={
          <>
            NRR &gt; 100% indica expansión neta · NRR &lt; 100% indica contracción
          </>
        }
      />
      <Calc>
        NRR = (Starting ARR + Expansion − Churn − Downgrades) / Starting ARR. Mide el comportamiento de la
        cohort 12 meses atrás: cuánto creció (o se contrajo) la misma base de clientes.
      </Calc>
      <div className="kpi-drawer__stats">
        <Stat label="Starting ARR" v={fmtMoney(startingArr, currency)} />
        <Stat label="Expansion" v={`+ ${fmtMoney(expansionArr, currency)}`} tone="success" />
        <Stat label="Churn" v={`− ${fmtMoney(churnedArr, currency)}`} tone="danger" />
        <Stat label="Ending ARR" v={fmtMoney(endingArr, currency)} tone="accent" />
      </div>
      <SectionLabel>Asunciones del modelo</SectionLabel>
      <div style={{ padding: "8px 10px", fontSize: 11, color: "var(--fg-3)", lineHeight: 1.6 }}>
        Proxies del proto: expansion +18%/año (upsell vía cross-sell del playbook NOVIT), churn 6%/año
        (proporción típica B2B mid-market). Cuando integremos eventos de billing reales, esto se calculará
        a partir del histórico de cambios en MRR por cliente.
      </div>
    </>
  );
}

function LogoChurnDetail({ ws }: { ws: Workspace }) {
  const { churn, wonClients, lostOnlyClients, totalClients } = computeLogoChurn(ws.deals);
  const lostClients = lostOnlyClients;
  const total = totalClients;

  return (
    <>
      <Headline
        label="Logo Churn anualizado"
        value={<span className="mono" style={{ color: churn > 5 ? "var(--danger)" : "var(--success)" }}>{churn}%</span>}
        sub={
          <>
            <span className="mono">{lostClients}</span> clientes perdidos /{" "}
            <span className="mono">{total}</span> totales (won + lost-only)
          </>
        }
      />
      <Calc>
        Logo churn = clientes perdidos / clientes totales en el período. Se contabiliza una empresa como
        "perdida" cuando todos sus tratos están en stage <b>lost</b> y no hay ningún won activo.
      </Calc>
      <SectionLabel>Benchmarks</SectionLabel>
      <div style={{ padding: "8px 10px", fontSize: 11, color: "var(--fg-3)", lineHeight: 1.6 }}>
        • <b>SMB</b> ($0-50k ACV): 8-15% anual considerado sano<br />
        • <b>Mid-market</b> ($50-500k ACV): 4-8% anual<br />
        • <b>Enterprise</b> (&gt;$500k ACV): 1-4% anual<br />
        Por encima de 10% en mid-market sugiere problemas de fit o de onboarding.
      </div>
    </>
  );
}

function CacPaybackDetail({ ws, currency }: { ws: Workspace; currency: Currency }) {
  const { payback, cac: blendedCac, mrr: totalMrr, grossMargin: grossMarginPct } = computeCacPayback(ws.deals);

  return (
    <>
      <Headline
        label="CAC Payback period"
        value={<span className="mono">{payback}m</span>}
        sub={
          <>
            tiempo en recuperar el costo de adquisición vía margen bruto recurrente
          </>
        }
      />
      <Calc>
        CAC Payback = CAC / (MRR × Gross Margin). Asume blended CAC = $8.5k (sales+marketing combinado en
        el último Q) y gross margin 78%. Benchmark: &lt; 12m es excelente, &lt; 18m sano, &gt; 24m foco rojo.
      </Calc>
      <div className="kpi-drawer__stats">
        <Stat label="CAC blended" v={fmtMoney(blendedCac, currency)} />
        <Stat label="MRR contribuído" v={fmtMoney(totalMrr, currency)} tone="success" />
        <Stat label="Gross margin" v={`${Math.round(grossMarginPct * 100)}%`} />
        <Stat label="Payback" v={`${payback}m`} tone={payback < 12 ? "success" : "accent"} />
      </div>
    </>
  );
}

function LtvCacDetail({ ws, currency }: { ws: Workspace; currency: Currency }) {
  const { ratio, ltv, cac: blendedCac } = computeLtvCac(ws.deals);

  return (
    <>
      <Headline
        label="LTV / CAC ratio"
        value={<span className="mono" style={{ color: ratio >= 3 ? "var(--success)" : "var(--warning)" }}>{ratio}x</span>}
        sub={
          <>
            LTV promedio <span className="mono">{fmtMoney(ltv, currency)}</span> / CAC blended{" "}
            <span className="mono">{fmtMoney(blendedCac, currency)}</span>
          </>
        }
      />
      <Calc>
        LTV = (ARPA × Gross Margin) / monthly churn. Asume churn mensual 0.5% (≈ 6% anual), gross margin 78%.
        Un ratio LTV/CAC ≥ 3 indica modelo unit economics sano; &lt; 1 quema capital.
      </Calc>
      <div className="kpi-drawer__stats">
        <Stat label="LTV por cliente" v={fmtMoney(ltv, currency)} tone="success" />
        <Stat label="CAC" v={fmtMoney(blendedCac, currency)} />
        <Stat label="Ratio" v={`${ratio}x`} tone={ratio >= 3 ? "success" : "accent"} />
      </div>
      <SectionLabel>Cómo mejorarlo</SectionLabel>
      <div style={{ padding: "8px 10px", fontSize: 11, color: "var(--fg-3)", lineHeight: 1.6 }}>
        • Subir LTV: extender contratos a 24/36m, agregar upsells, reducir churn vía CS.<br />
        • Bajar CAC: optimizar canales de origen (los WhatsApp/referral típicamente tienen CAC menor que paid),
        acortar sales cycle vía templates.
      </div>
    </>
  );
}
