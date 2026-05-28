import { useMemo, type ReactNode } from "react";
import { Icon, type IconName } from "../shell/Icon";
import { fmtMoney, fmtMoneyFull, stageColor, stageLabel } from "../../lib/format";
import { STAGES } from "../../lib/stages";
import type { Deal, FeaturedCustomer } from "../../lib/types";
import type { Currency } from "../../lib/store";

/**
 * CustomerKpiDrawer — drill-down scoped al cliente (no global como el del
 * Dashboard). Sustenta los 8 smart-buttons del header de Cliente 360.
 */

export type CustKpiId =
  | "pipeline"
  | "arr"
  | "won"
  | "contacts"
  | "tasks"
  | "proposals"
  | "convs"
  | "aiscore";

type Task = {
  id: string;
  text: string;
  due: string;
  done: boolean;
  kind: string;
};

type Note = { id: string; date: string; text: string; by: string };

type Proposal = {
  id: string;
  dealId: string;
  dealName: string;
  stage: Deal["stage"];
  version: number;
  value: number;
  sentAt?: string;
  signedAt?: string;
};

type Props = {
  kpiId: CustKpiId | null;
  company: FeaturedCustomer;
  customerDeals: Deal[];
  proposals: Proposal[];
  tasks: Task[];
  notes: Note[];
  today: Date;
  currency: Currency;
  onClose: () => void;
  onOpenDeal: (id: string) => void;
};

const KPI_META: Record<CustKpiId, { title: string; icon: IconName; color: string }> = {
  pipeline: { title: "Pipeline abierto", icon: "dollar", color: "var(--accent)" },
  arr: { title: "ARR del cliente", icon: "trending", color: "var(--success)" },
  won: { title: "Tratos ganados", icon: "check", color: "var(--success)" },
  contacts: { title: "Contactos del cliente", icon: "users", color: "var(--accent)" },
  tasks: { title: "Tareas pendientes", icon: "note", color: "var(--warning)" },
  proposals: { title: "Propuestas enviadas", icon: "doc", color: "var(--accent)" },
  convs: { title: "Conversaciones (30d)", icon: "chat", color: "var(--accent)" },
  aiscore: { title: "AI Score · salud del cliente", icon: "sparkles", color: "var(--accent)" },
};

export function CustomerKpiDrawer({
  kpiId,
  company,
  customerDeals,
  proposals,
  tasks,
  notes: _notes,
  today,
  currency,
  onClose,
  onOpenDeal,
}: Props) {
  void _notes;
  if (!kpiId) return null;
  const meta = KPI_META[kpiId];

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside
        className="ai-drawer kpi-drawer"
        style={{ width: "min(580px, 100vw)" }}
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
                {company.name} · drill-down
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
          {kpiId === "pipeline" && (
            <PipelineDetail customerDeals={customerDeals} currency={currency} onOpenDeal={onOpenDeal} />
          )}
          {kpiId === "arr" && (
            <ArrDetail customerDeals={customerDeals} currency={currency} onOpenDeal={onOpenDeal} />
          )}
          {kpiId === "won" && (
            <WonDetail customerDeals={customerDeals} currency={currency} onOpenDeal={onOpenDeal} />
          )}
          {kpiId === "contacts" && (
            <ContactsDetail company={company} />
          )}
          {kpiId === "tasks" && (
            <TasksDetail tasks={tasks} today={today} />
          )}
          {kpiId === "proposals" && (
            <ProposalsDetail proposals={proposals} currency={currency} onOpenDeal={onOpenDeal} />
          )}
          {kpiId === "convs" && (
            <ConvsDetail company={company} />
          )}
          {kpiId === "aiscore" && (
            <AiScoreDetail company={company} customerDeals={customerDeals} tasks={tasks} today={today} />
          )}
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

function SectionLabel({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="kpi-drawer__section">
      <span>{children}</span>
      {right && <span style={{ marginLeft: "auto" }}>{right}</span>}
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
  return (
    <div className="kpi-drawer__row" onClick={() => onOpenDeal(deal.id)}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="kpi-drawer__row-name">{deal.name}</div>
        <div className="kpi-drawer__row-sub">
          <span className="mono">{deal.id}</span> · {stageLabel(deal.stage)}
        </div>
      </div>
      <span
        style={{
          background: stageColor(deal.stage) + "22",
          color: stageColor(deal.stage),
          padding: "2px 7px",
          borderRadius: 999,
          fontSize: 10,
          fontFamily: "var(--font-mono)",
          fontWeight: 600,
        }}
      >
        {stageLabel(deal.stage)}
      </span>
      <span className="mono kpi-drawer__row-value">{fmtMoney(deal.value, currency)}</span>
      {extra}
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

/* ============================================================
   PIPELINE
   ============================================================ */
function PipelineDetail({ customerDeals, currency, onOpenDeal }: { customerDeals: Deal[]; currency: Currency; onOpenDeal: (id: string) => void }) {
  const open = customerDeals.filter((d) => d.stage !== "won" && d.stage !== "lost").sort((a, b) => b.value - a.value);
  const total = open.reduce((a, d) => a + d.value, 0);
  const weighted = open.reduce((a, d) => a + d.value * d.probability, 0);

  // Agrupar por stage
  const byStage = STAGES.map((s) => ({
    stage: s,
    deals: open.filter((d) => d.stage === s.id),
  })).filter((g) => g.deals.length > 0);

  return (
    <>
      <Headline
        label="Pipeline abierto del cliente"
        value={<span className="mono">{fmtMoney(total, currency)}</span>}
        sub={
          <>
            <span className="mono">{open.length}</span> tratos abiertos · ponderado{" "}
            <span className="mono" style={{ color: "var(--accent)" }}>{fmtMoney(weighted, currency)}</span>
          </>
        }
      />
      <Calc>
        Σ valor bruto de los tratos del cliente en stages diferentes a <b>won</b> y <b>lost</b>.
        El ponderado aplica la probabilidad de cada etapa (Σ valor × prob).
      </Calc>
      {byStage.map((g) => (
        <div key={g.stage.id}>
          <SectionLabel
            right={
              <span className="mono" style={{ color: "var(--fg-3)" }}>
                {g.deals.length} · {fmtMoney(g.deals.reduce((a, d) => a + d.value, 0), currency)}
              </span>
            }
          >
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span className="dot" style={{ background: g.stage.color }} />
              {g.stage.label}
            </span>
          </SectionLabel>
          <div className="kpi-drawer__list">
            {g.deals.map((d) => (
              <DealRow key={d.id} deal={d} currency={currency} onOpenDeal={onOpenDeal} />
            ))}
          </div>
        </div>
      ))}
      {open.length === 0 && <EmptyHint>Este cliente no tiene pipeline abierto actualmente.</EmptyHint>}
    </>
  );
}

/* ============================================================
   ARR
   ============================================================ */
function ArrDetail({ customerDeals, currency, onOpenDeal }: { customerDeals: Deal[]; currency: Currency; onOpenDeal: (id: string) => void }) {
  const recurring = customerDeals
    .filter((d) => d.isRecurring && d.stage !== "lost" && d.arr > 0)
    .sort((a, b) => b.arr - a.arr);
  const wonArr = recurring.filter((d) => d.stage === "won").reduce((a, d) => a + d.arr, 0);
  const openArr = recurring.filter((d) => d.stage !== "won").reduce((a, d) => a + d.arr, 0);
  const totalArr = wonArr + openArr;
  const mrr = totalArr / 12;

  return (
    <>
      <Headline
        label="ARR del cliente"
        value={<span className="mono" style={{ color: "var(--success)" }}>{fmtMoney(totalArr, currency)}</span>}
        sub={
          <>
            MRR <span className="mono">{fmtMoney(mrr, currency)}</span> ·{" "}
            <span className="mono">{recurring.length}</span> contrato{recurring.length !== 1 ? "s" : ""} recurrente{recurring.length !== 1 ? "s" : ""}
          </>
        }
      />
      <Calc>
        ARR = Σ del campo <code>arr</code> de tratos recurrentes del cliente (excluye lost).
        Incluye contratos ya firmados (won) + propuestas recurrentes en pipeline abierto.
      </Calc>
      <div className="kpi-drawer__stats">
        <Stat label="ARR ganado" v={fmtMoney(wonArr, currency)} tone="success" />
        <Stat label="ARR en pipeline" v={fmtMoney(openArr, currency)} tone="accent" />
        <Stat label="MRR equivalente" v={fmtMoney(mrr, currency)} tone="success" />
      </div>
      <SectionLabel>Contratos recurrentes</SectionLabel>
      <div className="kpi-drawer__list">
        {recurring.map((d) => (
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
        {recurring.length === 0 && <EmptyHint>Este cliente no tiene contratos recurrentes activos.</EmptyHint>}
      </div>
    </>
  );
}

/* ============================================================
   WON DEALS
   ============================================================ */
function WonDetail({ customerDeals, currency, onOpenDeal }: { customerDeals: Deal[]; currency: Currency; onOpenDeal: (id: string) => void }) {
  const won = customerDeals.filter((d) => d.stage === "won").sort((a, b) => b.value - a.value);
  const total = won.reduce((a, d) => a + d.value, 0);
  const recurring = won.filter((d) => d.isRecurring).length;

  return (
    <>
      <Headline
        label="Tratos ganados (histórico)"
        value={<span className="mono">{won.length} {won.length === 1 ? "trato" : "tratos"}</span>}
        sub={
          <>
            Total cerrado <span className="mono" style={{ color: "var(--success)" }}>{fmtMoney(total, currency)}</span> ·{" "}
            {recurring} recurrente{recurring !== 1 ? "s" : ""}
          </>
        }
      />
      <Calc>
        Tratos del cliente en stage <b>won</b>. El total es el valor bruto cerrado (one-shot + setup);
        los recurrentes además contribuyen al ARR.
      </Calc>
      <SectionLabel>Tratos cerrados · ordenados por valor</SectionLabel>
      <div className="kpi-drawer__list">
        {won.map((d) => (
          <DealRow
            key={d.id}
            deal={d}
            currency={currency}
            onOpenDeal={onOpenDeal}
            extra={
              <span className="mono" style={{ fontSize: 10, color: "var(--fg-3)", minWidth: 80, textAlign: "right" }}>
                {new Date(d.estimatedCloseAt).toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "2-digit" })}
              </span>
            }
          />
        ))}
        {won.length === 0 && <EmptyHint>Aún no hay tratos ganados con este cliente.</EmptyHint>}
      </div>
    </>
  );
}

/* ============================================================
   CONTACTS
   ============================================================ */
function ContactsDetail({ company }: { company: FeaturedCustomer }) {
  const contacts = company.contacts;
  const cLevel = contacts.filter((c) => /CTO|CEO|VP|Head|CFO|CIO|COO/i.test(c.role));
  const operational = contacts.filter((c) => !cLevel.includes(c));

  return (
    <>
      <Headline
        label="Buying committee"
        value={<span className="mono">{contacts.length}</span>}
        sub={
          <>
            <span className="mono" style={{ color: "var(--accent)" }}>{cLevel.length}</span> c-level ·{" "}
            <span className="mono">{operational.length}</span> operacionales
          </>
        }
      />
      <Calc>
        Stakeholders identificados en la cuenta. Un buying committee saludable B2B típicamente tiene
        2+ contactos C-level (decisores) y 1-2 contactos operacionales (champions).
      </Calc>
      {cLevel.length > 0 && (
        <>
          <SectionLabel>Contactos C-level · decisores</SectionLabel>
          <div className="kpi-drawer__list">
            {cLevel.map((c) => (
              <div key={c.email} className="kpi-drawer__row" style={{ cursor: "default" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="kpi-drawer__row-name">{c.name}</div>
                  <div className="kpi-drawer__row-sub">{c.role}</div>
                </div>
                <span className="mono" style={{ fontSize: 10, color: "var(--fg-3)" }}>{c.email}</span>
              </div>
            ))}
          </div>
        </>
      )}
      {operational.length > 0 && (
        <>
          <SectionLabel>Contactos operacionales · champions</SectionLabel>
          <div className="kpi-drawer__list">
            {operational.map((c) => (
              <div key={c.email} className="kpi-drawer__row" style={{ cursor: "default" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="kpi-drawer__row-name">{c.name}</div>
                  <div className="kpi-drawer__row-sub">{c.role}</div>
                </div>
                <span className="mono" style={{ fontSize: 10, color: "var(--fg-3)" }}>{c.email}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}

/* ============================================================
   TASKS
   ============================================================ */
function TasksDetail({ tasks, today }: { tasks: Task[]; today: Date }) {
  const open = tasks.filter((t) => !t.done);
  const overdue = open.filter((t) => new Date(t.due).getTime() < today.getTime());
  const upcoming = open.filter((t) => new Date(t.due).getTime() >= today.getTime());
  const done = tasks.filter((t) => t.done);

  return (
    <>
      <Headline
        label="Tareas pendientes"
        value={<span className="mono">{open.length}</span>}
        sub={
          <>
            <span className="mono" style={{ color: overdue.length > 0 ? "var(--danger)" : "var(--fg-3)" }}>
              {overdue.length} vencida{overdue.length !== 1 ? "s" : ""}
            </span> ·{" "}
            <span className="mono">{upcoming.length}</span> próxima{upcoming.length !== 1 ? "s" : ""}
          </>
        }
      />
      <Calc>
        Actividades programadas con este cliente (llamadas, follow-ups, propuestas, NDA, etc.).
        Tareas vencidas indican posible stalling en el ciclo de venta.
      </Calc>
      {overdue.length > 0 && (
        <>
          <SectionLabel>Vencidas · acción inmediata</SectionLabel>
          <div className="kpi-drawer__list">
            {overdue.map((t) => (
              <div key={t.id} className="kpi-drawer__row" style={{ cursor: "default" }}>
                <span
                  style={{
                    width: 22, height: 22, borderRadius: 6,
                    background: "rgba(220, 38, 38, 0.12)",
                    color: "#dc2626",
                    display: "grid", placeItems: "center",
                  }}
                >
                  <Icon name="alert" size={11} />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="kpi-drawer__row-name">{t.text}</div>
                  <div className="kpi-drawer__row-sub mono">
                    {t.kind} · vence {new Date(t.due).toLocaleDateString("es-PE", { day: "2-digit", month: "short" })}
                  </div>
                </div>
                <span style={{ color: "#dc2626", fontSize: 11, fontWeight: 600 }}>Vencida</span>
              </div>
            ))}
          </div>
        </>
      )}
      {upcoming.length > 0 && (
        <>
          <SectionLabel>Próximas</SectionLabel>
          <div className="kpi-drawer__list">
            {upcoming.map((t) => (
              <div key={t.id} className="kpi-drawer__row" style={{ cursor: "default" }}>
                <span
                  style={{
                    width: 22, height: 22, borderRadius: 6,
                    background: "var(--bg-3)",
                    color: "var(--fg-2)",
                    display: "grid", placeItems: "center",
                  }}
                >
                  <Icon name="clock" size={11} />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="kpi-drawer__row-name">{t.text}</div>
                  <div className="kpi-drawer__row-sub mono">
                    {t.kind} · vence {new Date(t.due).toLocaleDateString("es-PE", { day: "2-digit", month: "short" })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
      {done.length > 0 && (
        <>
          <SectionLabel right={<span className="mono" style={{ color: "var(--fg-3)" }}>{done.length}</span>}>
            Completadas
          </SectionLabel>
          <div className="kpi-drawer__list" style={{ opacity: 0.55 }}>
            {done.slice(0, 5).map((t) => (
              <div key={t.id} className="kpi-drawer__row" style={{ cursor: "default", textDecoration: "line-through" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="kpi-drawer__row-name">{t.text}</div>
                  <div className="kpi-drawer__row-sub mono">{t.kind}</div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
      {open.length === 0 && done.length === 0 && (
        <EmptyHint>Sin tareas registradas para este cliente.</EmptyHint>
      )}
    </>
  );
}

/* ============================================================
   PROPOSALS
   ============================================================ */
function ProposalsDetail({ proposals, currency, onOpenDeal }: { proposals: Proposal[]; currency: Currency; onOpenDeal: (id: string) => void }) {
  const total = proposals.reduce((a, p) => a + p.value, 0);
  const won = proposals.filter((p) => p.stage === "won");
  const lost = proposals.filter((p) => p.stage === "lost");
  const open = proposals.filter((p) => p.stage !== "won" && p.stage !== "lost");

  // Agrupar por stage
  const byStage = STAGES.filter((s) => proposals.some((p) => p.stage === s.id)).map((s) => ({
    stage: s,
    list: proposals.filter((p) => p.stage === s.id),
  }));

  return (
    <>
      <Headline
        label="Propuestas enviadas"
        value={<span className="mono">{proposals.length}</span>}
        sub={
          <>
            Total <span className="mono">{fmtMoney(total, currency)}</span> ·{" "}
            <span className="mono" style={{ color: "var(--success)" }}>{won.length} ganadas</span> ·{" "}
            <span className="mono" style={{ color: "var(--fg-3)" }}>{open.length} en curso</span>
            {lost.length > 0 && <> · <span className="mono" style={{ color: "var(--danger)" }}>{lost.length} perdidas</span></>}
          </>
        }
      />
      <Calc>
        Propuestas formales enviadas al cliente (deals desde stage <b>proposal</b> en adelante).
        El estado coincide con la etapa del pipeline.
      </Calc>
      {byStage.map((g) => (
        <div key={g.stage.id}>
          <SectionLabel
            right={
              <span className="mono" style={{ color: "var(--fg-3)" }}>
                {g.list.length} · {fmtMoney(g.list.reduce((a, p) => a + p.value, 0), currency)}
              </span>
            }
          >
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span className="dot" style={{ background: g.stage.color }} />
              {g.stage.label}
            </span>
          </SectionLabel>
          <div className="kpi-drawer__list">
            {g.list.map((p) => (
              <div
                key={p.id}
                className="kpi-drawer__row"
                onClick={() => onOpenDeal(p.dealId)}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="kpi-drawer__row-name">{p.dealName}</div>
                  <div className="kpi-drawer__row-sub mono">
                    {p.dealId} · v{p.version} · enviada {p.sentAt}
                    {p.signedAt && ` · firmada ${p.signedAt}`}
                  </div>
                </div>
                <span className="mono kpi-drawer__row-value">{fmtMoney(p.value, currency)}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
      {proposals.length === 0 && (
        <EmptyHint>Sin propuestas todavía (solo deals en discovery o qualified).</EmptyHint>
      )}
    </>
  );
}

/* ============================================================
   CONVERSACIONES (timeline última 30d)
   ============================================================ */
function ConvsDetail({ company }: { company: FeaturedCustomer }) {
  const events = company.timeline.flatMap((day) =>
    day.events.map((ev) => ({ ...ev, day: day.day })),
  );
  const byType = events.reduce<Record<string, number>>((acc, ev) => {
    acc[ev.type] = (acc[ev.type] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <>
      <Headline
        label="Conversaciones (últimos 30 días)"
        value={<span className="mono">{events.length}</span>}
        sub={
          <>
            distribuidas en <span className="mono">{company.timeline.length}</span> día{company.timeline.length !== 1 ? "s" : ""} con actividad
          </>
        }
      />
      <Calc>
        Mensajes, llamadas, meetings y eventos del CRM registrados con el cliente en el período.
        Una cuenta saludable promedia 8-15 toques mensuales en B2B mid-market.
      </Calc>
      <div className="kpi-drawer__stats">
        {Object.entries(byType).map(([type, count]) => (
          <Stat key={type} label={type.toUpperCase()} v={count} />
        ))}
      </div>
      <SectionLabel>Timeline cronológico</SectionLabel>
      <div className="kpi-drawer__list">
        {events.map((ev, i) => (
          <div key={i} className="kpi-drawer__row" style={{ cursor: "default", flexWrap: "wrap" }}>
            <span
              style={{
                background: "var(--bg-3)",
                padding: "2px 6px",
                borderRadius: 4,
                fontSize: 9,
                fontFamily: "var(--font-mono)",
                textTransform: "uppercase",
                color: "var(--fg-2)",
                fontWeight: 600,
              }}
            >
              {ev.type}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="kpi-drawer__row-name" style={{ fontSize: 12 }}>{ev.text}</div>
              <div className="kpi-drawer__row-sub mono">{ev.who} · {ev.at} · {ev.day}</div>
            </div>
          </div>
        ))}
        {events.length === 0 && <EmptyHint>Sin actividad registrada en el período.</EmptyHint>}
      </div>
    </>
  );
}

/* ============================================================
   AI SCORE
   ============================================================ */
function AiScoreDetail({ company, customerDeals, tasks, today }: { company: FeaturedCustomer; customerDeals: Deal[]; tasks: Task[]; today: Date }) {
  const score = company.aiScore;
  const tone = score >= 75 ? "verde" : score >= 50 ? "amarillo/atención" : "rojo/riesgo";
  const color = score >= 75 ? "var(--success)" : score >= 50 ? "#c2410c" : "var(--danger)";

  const factors = useMemo(() => {
    const won = customerDeals.filter((d) => d.stage === "won").length;
    const lost = customerDeals.filter((d) => d.stage === "lost").length;
    const winRate = won + lost > 0 ? Math.round((won / (won + lost)) * 100) : 0;
    const stalled = customerDeals.filter((d) => d.stage !== "won" && d.stage !== "lost" && d.lastActivity >= 7).length;
    const overdue = tasks.filter((t) => !t.done && new Date(t.due).getTime() < today.getTime()).length;
    return { winRate, stalled, overdue };
  }, [customerDeals, tasks, today]);

  return (
    <>
      <Headline
        label="AI Score · salud del cliente"
        value={<span className="mono" style={{ color }}>{score}%</span>}
        sub={
          <>
            Estado actual: <b style={{ color }}>{tone}</b> ·{" "}
            <span style={{ color: "var(--fg-3)" }}>+6 puntos esta semana</span>
          </>
        }
      />
      <Calc>
        AI Score = score compuesto del modelo <b>gradient-boost v3</b> ponderando engagement WhatsApp,
        cobertura de stakeholders, win rate histórico, velocidad en etapa, tamaño cuenta vs ICP y tareas
        al día. Rango 0-100. Verde ≥ 75, Amarillo 50-74, Rojo &lt; 50.
      </Calc>
      <div className="kpi-drawer__stats">
        <Stat label="Win rate cliente" v={`${factors.winRate}%`} tone={factors.winRate >= 50 ? "success" : "accent"} />
        <Stat label="Tratos stalled (≥7d)" v={factors.stalled} tone={factors.stalled > 0 ? "danger" : "success"} />
        <Stat label="Tareas vencidas" v={factors.overdue} tone={factors.overdue > 0 ? "danger" : "success"} />
      </div>
      <SectionLabel>Cómo interpretar el score</SectionLabel>
      <div style={{ padding: "8px 10px", fontSize: 11.5, color: "var(--fg-3)", lineHeight: 1.6 }}>
        Para un breakdown completo (factores con peso + acciones recomendadas para subir al siguiente
        nivel), abrí el <b>Coach del cliente</b> haciendo click en el semáforo de salud al lado del nombre
        del cliente.
      </div>
    </>
  );
}
