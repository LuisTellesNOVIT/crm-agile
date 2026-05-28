import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useActiveWorkspace, useAppStore, type Currency } from "../lib/store";
import { featured } from "../lib/mock/rich";
import { fmtMoney, fmtMoneyFull, daysBetween, stageColor, stageLabel } from "../lib/format";
import { Icon, type IconName } from "../components/shell/Icon";
import { CustomerKpiDrawer, type CustKpiId } from "../components/customer/CustomerKpiDrawer";
import { STAGES } from "../lib/stages";
import type { Deal, FeaturedCustomer, OwnersByKey, StageId, WorkspaceId } from "../lib/types";

/* ============================================================
   Synth helpers — generan datos por empresa (cuando no es featured)
   ============================================================ */
type CompanyAgg = {
  name: string;
  deals: Deal[];
  totalValue: number;
  won: number;
  arr: number;
};

function synthCompany(c: CompanyAgg, fallbackOwner: string): FeaturedCustomer {
  const seed = c.name.split("").reduce((a, ch) => a + ch.charCodeAt(0), 0);
  const tiers = ["Strategic", "Growth", "SMB"];
  const industries = [
    "Seguros · Multinacional",
    "Tech · LATAM",
    "Salud · Privada",
    "Retail · Multimarca",
    "Fintech · LATAM",
    "Industrial · Energía",
  ];
  return {
    id: "CUS-" + c.name.replace(/\s+/g, "").slice(0, 6).toUpperCase(),
    name: c.name,
    logo: c.name.split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase() || "??",
    industry: industries[seed % industries.length],
    website: c.name.toLowerCase().replace(/[^a-z0-9]/g, "") + ".com",
    employees: ["50-100", "100-500", "500-1k", "1k-5k", "10k+"][seed % 5],
    tier: tiers[seed % 3],
    arr: c.arr,
    mrr: c.arr ? Math.round(c.arr / 12) : 0,
    churnRisk: c.arr > 0 ? "Low" : seed % 3 === 0 ? "Medium" : "Low",
    nps: 45 + (seed % 30),
    aiScore: 50 + (seed % 35),
    stage: (c.deals[0]?.stage as StageId) ?? "qualified",
    owner: c.deals[0]?.owner ?? fallbackOwner,
    contacts: buildContacts(c.name, seed),
    timeline: buildTimeline(c.name, seed),
  };
}

function buildContacts(company: string, seed: number) {
  const firstNames = ["Andrés", "María", "Patricia", "Sergio", "Carlos", "Laura", "Federico", "Camila"];
  const lastNames = ["Rivas", "Ñahui", "Quispe", "Becerra", "Soto", "Velasco", "Klein"];
  const roles = ["CIO", "CTO", "VP Tecnología", "Procurement Lead", "Head of Operations", "CEO"];
  const n = 2 + (seed % 2);
  const out = [];
  for (let i = 0; i < n; i++) {
    const fn = firstNames[(seed + i * 3) % firstNames.length];
    const ln = lastNames[(seed + i * 5) % lastNames.length];
    out.push({
      name: `${fn} ${ln}`,
      role: roles[(seed + i) % roles.length],
      email: `${fn[0].toLowerCase()}.${ln.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "")}@${company.toLowerCase().replace(/\s+/g, "")}.com`,
    });
  }
  return out;
}

function buildTimeline(_company: string, seed: number) {
  return [
    {
      day: "Hoy",
      events: [
        { type: "wa", text: "Contacto pidió actualización del proyecto.", who: "Equipo cliente", at: "10:42" },
        { type: "ai", text: `AI Score recalculado por engagement reciente (+${(seed % 7) + 2}).`, who: "AI", at: "09:00" },
      ],
    },
    {
      day: "Esta semana",
      events: [
        { type: "email", text: "Propuesta enviada y respondida.", who: "AE", at: "16:20" },
        { type: "note", text: "Nota IA: cliente con apetito de modernización en stack.", who: "AI · Recap", at: "15:00" },
      ],
    },
    {
      day: "Hace 2 semanas",
      events: [
        { type: "call", text: "Discovery call de 45 min — sin compromiso aún.", who: "AE", at: "14:00" },
      ],
    },
  ];
}

type TaskKind = "Llamada" | "Email" | "Reunión" | "Propuesta" | "Follow-up";
type Task = {
  id: string;
  title: string;
  kind: TaskKind;
  due: string;
  done: boolean;
  byInitials: string;
};

function buildTasks(companyName: string, today: Date, ownerInitials: string): Task[] {
  const seed = companyName.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const kinds: TaskKind[] = ["Llamada", "Email", "Reunión", "Propuesta", "Follow-up"];
  const templates = [
    `Llamar a contacto de ${companyName} para revisar alcance`,
    `Enviar propuesta v2 a ${companyName}`,
    `Reunión técnica con equipo de ${companyName}`,
    `Follow-up post-demo ${companyName}`,
    `Coordinar firma de NDA con ${companyName}`,
    `Calificar oportunidad de upsell ${companyName}`,
  ];
  const out: Task[] = [];
  for (let i = 0; i < 4; i++) {
    const due = new Date(today);
    due.setDate(due.getDate() + (((seed + i * 7) % 14) - 3));
    out.push({
      id: `t${seed}-${i}`,
      title: templates[(seed + i) % templates.length],
      kind: kinds[(seed + i) % kinds.length],
      due: due.toISOString(),
      done: i === 3,
      byInitials: ownerInitials,
    });
  }
  return out;
}

type Note = { by?: string; at: string; text: string; kind?: "ai" | "note"; tags?: string[] };
function buildNotes(companyName: string): Note[] {
  return [
    {
      by: "María Paz I.",
      at: "Hoy · 11:30",
      text: `Reunión con ${companyName} confirmada para el jueves. Necesitan referencias de implementaciones similares en el vertical.`,
      kind: "note",
      tags: ["referencias", "discovery"],
    },
    {
      kind: "ai",
      at: "Ayer · 17:20",
      text: `Resumen IA del meeting: ${companyName} muestra apetito de modernización del stack. Pain principal: latencia en consultas analíticas. Match alto con propuesta de Data Lake.`,
      tags: ["ai-recap", "data-lake"],
    },
    {
      by: "Carlos Giménez",
      at: "Hace 4 días",
      text: `Confirmé con procurement que la POC entra en presupuesto Q4. Pidieron desglose del SLA.`,
      kind: "note",
    },
  ];
}

/**
 * Proposal heredan el stage del Deal — las etapas de la propuesta SON las
 * etapas del pipeline (no una enum separada). Las propuestas existen para
 * deals que ya pasaron la etapa de qualificación (proposal en adelante).
 */
type Proposal = {
  id: string;
  dealId: string;
  dealName: string;
  stage: StageId; // mismo enum que Deal.stage
  version: number;
  value: number;
  sentAt?: string;
  signedAt?: string;
};

function buildProposals(customerDeals: Deal[]): Proposal[] {
  return customerDeals
    .filter((d) => d.stage !== "discovery" && d.stage !== "qualified")
    .map((d) => {
      const seed = d.id.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
      return {
        id: `prop-${d.id}`,
        dealId: d.id,
        dealName: d.name,
        stage: d.stage,
        version: 1 + (seed % 3),
        value: d.value,
        sentAt: new Date(d.createdAt).toLocaleDateString("es-PE"),
        signedAt: d.stage === "won" ? new Date(d.estimatedCloseAt).toLocaleDateString("es-PE") : undefined,
      };
    });
}

function isOverdue(t: Task, today: Date) {
  if (t.done) return false;
  return new Date(t.due).getTime() < today.getTime();
}

/* ============================================================
   ROUTE
   ============================================================ */
export default function CustomersRoute() {
  const workspace = useAppStore((s) => s.workspace);
  const currency = useAppStore((s) => s.currency);
  const ws = useActiveWorkspace();
  const setSelectedDeal = useAppStore((s) => s.setSelectedDeal);

  const wsKey: WorkspaceId = workspace === "sharky" ? "sharky" : "novit";
  const featuredCustomer = featured[wsKey];

  // Group all companies in current workspace
  const allCompanies = useMemo(() => {
    const m = new Map<string, CompanyAgg>();
    for (const d of ws.deals) {
      const agg = m.get(d.company) ?? { name: d.company, deals: [], totalValue: 0, won: 0, arr: 0 };
      agg.deals.push(d);
      agg.totalValue += d.value;
      if (d.stage === "won") agg.won++;
      if (d.stage === "won" && d.isRecurring) agg.arr += d.arr;
      m.set(d.company, agg);
    }
    return Array.from(m.values()).sort((a, b) => {
      // Featured primero, después por totalValue
      if (a.name === featuredCustomer.name) return -1;
      if (b.name === featuredCustomer.name) return 1;
      return b.totalValue - a.totalValue;
    });
  }, [ws.deals, featuredCustomer.name]);

  const [selectedName, setSelectedName] = useState(featuredCustomer.name);
  const [tab, setTab] = useState("overview");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQ, setPickerQ] = useState("");
  const [following, setFollowing] = useState(true);
  const [healthOpen, setHealthOpen] = useState(false);
  const [kpiDrawer, setKpiDrawer] = useState<CustKpiId | null>(null);

  useEffect(() => {
    setSelectedName(featuredCustomer.name);
    setTab("overview");
  }, [workspace, featuredCustomer.name]);

  const isFeatured = selectedName === featuredCustomer.name;
  const agg = allCompanies.find((c) => c.name === selectedName) ??
    allCompanies[0] ?? {
      name: selectedName,
      deals: [],
      totalValue: 0,
      won: 0,
      arr: 0,
    };
  const ownerInitials = agg.deals[0]?.owner ?? (workspace === "sharky" ? "AV" : "MP");
  const company: FeaturedCustomer = isFeatured ? featuredCustomer : synthCompany(agg, ownerInitials);

  const customerDeals = agg.deals;
  const openDeals = customerDeals.filter((d) => d.stage !== "won" && d.stage !== "lost");
  const wonDeals = customerDeals.filter((d) => d.stage === "won");
  const lostDeals = customerDeals.filter((d) => d.stage === "lost");
  const totalPipeline = openDeals.reduce((a, d) => a + d.value, 0);
  const totalWon = wonDeals.reduce((a, d) => a + d.value, 0);
  const computedArr = customerDeals.reduce((acc, d) => {
    if (d.stage === "lost") return acc;
    if (d.isRecurring) return acc + d.arr;
    if (d.stage === "won") return acc + d.value;
    return acc;
  }, 0);
  const computedMrr = customerDeals
    .filter((d) => d.isRecurring && d.stage !== "lost")
    .reduce((a, d) => a + d.arr / 12, 0);

  const tasks = useMemo(
    () => buildTasks(selectedName, ws.today, ownerInitials),
    [selectedName, ws.today, ownerInitials],
  );
  const notes = useMemo(() => buildNotes(selectedName), [selectedName]);
  const proposals = useMemo(() => buildProposals(customerDeals), [customerDeals]);

  const filteredPicker = useMemo(() => {
    const q = pickerQ.trim().toLowerCase();
    if (!q) return allCompanies;
    return allCompanies.filter((c) => c.name.toLowerCase().includes(q));
  }, [allCompanies, pickerQ]);

  const counts = {
    deals: openDeals.length,
    tasks: tasks.filter((t) => !t.done).length,
    notes: notes.length,
    files: 0,
    convs: company.timeline.reduce((a, d) => a + d.events.length, 0),
    contacts: company.contacts.length,
  };

  return (
    <div className="cust360" data-screen-label="Cliente 360">
      {/* Header */}
      <div className="cust360__header">
        <div className="cust360__brand">
          <div className="cust__logo" style={{ width: 56, height: 56 }}>{company.logo}</div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="cust360__title-row">
              <h1>{company.name}</h1>
              <HealthLight
                score={company.aiScore}
                open={healthOpen}
                onToggle={() => setHealthOpen((o) => !o)}
              />
              <button
                type="button"
                className={`cust360__follow ${following ? "is-on" : ""}`.trim()}
                onClick={() => setFollowing((f) => !f)}
              >
                <Icon name={following ? "check" : "plus"} size={12} />
                {following ? "Siguiendo" : "Seguir"}
              </button>
              <div className="cust360__picker">
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => setPickerOpen((p) => !p)}
                >
                  <Icon name="users" size={13} /> Cambiar cliente
                  <Icon name="chevron-down" size={11} />
                </button>
                {pickerOpen && (
                  <div className="cust360__picker-menu" onMouseLeave={() => setPickerOpen(false)}>
                    <div className="cust360__picker-search">
                      <input
                        autoFocus
                        type="search"
                        placeholder={`Buscar entre ${allCompanies.length} empresas…`}
                        value={pickerQ}
                        onChange={(e) => setPickerQ(e.target.value)}
                      />
                    </div>
                    <div className="cust360__picker-list">
                      {filteredPicker.length === 0 && (
                        <div className="empty-hint" style={{ padding: 16 }}>
                          Sin coincidencias
                        </div>
                      )}
                      {filteredPicker.map((c) => (
                        <div
                          key={c.name}
                          className={`cust360__picker-item ${c.name === selectedName ? "is-active" : ""}`.trim()}
                          onClick={() => {
                            setSelectedName(c.name);
                            setPickerOpen(false);
                            setPickerQ("");
                            setTab("overview");
                          }}
                        >
                          <span
                            className="cust__logo"
                            style={{ width: 24, height: 24, fontSize: 10 }}
                          >
                            {c.name.split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase()}
                          </span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: 500 }}>{c.name}</div>
                            <div
                              style={{
                                fontSize: 10,
                                color: "var(--fg-3)",
                                fontFamily: "var(--font-mono)",
                              }}
                            >
                              {c.deals.length} deal{c.deals.length !== 1 ? "s" : ""} ·{" "}
                              {fmtMoney(c.totalValue, currency)}
                            </div>
                          </div>
                          {c.name === featuredCustomer.name && (
                            <span className="chip chip--accent" style={{ fontSize: 9 }}>
                              360
                            </span>
                          )}
                          {c.name === selectedName && <Icon name="check" size={12} />}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="cust360__meta">
              <span>{company.industry}</span>
              <span>·</span>
              <span>
                <Icon name="external" size={10} /> {company.website}
              </span>
              <span>·</span>
              <span>{company.employees} empleados</span>
              <span>·</span>
              <span className="mono" style={{ color: "var(--fg-4)" }}>
                {company.id}
              </span>
            </div>
          </div>
        </div>

        <div className="cust360__actions">
          <span className={`chip ${company.tier === "Strategic" ? "chip--accent" : ""}`.trim()}>
            {company.tier}
          </span>
          <button type="button" className="btn"><Icon name="wa" size={13} /> WhatsApp</button>
          <button type="button" className="btn"><Icon name="mail" size={13} /> Email</button>
          <button type="button" className="btn"><Icon name="phone" size={13} /></button>
          <button type="button" className="btn btn--primary"><Icon name="plus" size={13} /> Trato</button>
          <button type="button" className="btn btn--icon"><Icon name="more" size={14} /></button>
        </div>
      </div>

      {healthOpen && (
        <HealthCoachPanel
          company={company}
          customerDeals={customerDeals}
          tasks={tasks}
          today={ws.today}
          onClose={() => setHealthOpen(false)}
        />
      )}

      {/* Smart buttons */}
      <div className="cust360__smart">
        <SmartButton icon="dollar" label="Pipeline" value={fmtMoney(totalPipeline, currency)} sub={`${openDeals.length} abiertos`} onClick={() => setKpiDrawer("pipeline")} />
        <SmartButton icon="trending" label="ARR" value={fmtMoney(computedArr, currency)} sub={`MRR ${fmtMoney(computedMrr, currency)}`} onClick={() => setKpiDrawer("arr")} />
        <SmartButton icon="check" label="Tratos ganados" value={String(wonDeals.length)} sub={fmtMoney(totalWon, currency)} accent="var(--success)" onClick={() => setKpiDrawer("won")} />
        <SmartButton icon="users" label="Contactos" value={String(counts.contacts)} sub={`${company.contacts.filter((c) => /CTO|CEO|VP|Head/i.test(c.role)).length} c-level`} onClick={() => setKpiDrawer("contacts")} />
        <SmartButton icon="note" label="Tareas" value={String(counts.tasks)} sub={`${tasks.filter((t) => isOverdue(t, ws.today)).length} vencidas`} accent={tasks.some((t) => isOverdue(t, ws.today)) ? "var(--warning)" : undefined} onClick={() => setKpiDrawer("tasks")} />
        <SmartButton icon="doc" label="Propuestas" value={String(proposals.length)} sub={`${proposals.filter((p) => p.stage === "won").length} ganadas`} accent="var(--accent)" onClick={() => setKpiDrawer("proposals")} />
        <SmartButton icon="chat" label="Conversaciones" value={String(counts.convs)} sub="últimos 30d" onClick={() => setKpiDrawer("convs")} />
        <SmartButton icon="sparkles" label="AI Score" value={`${company.aiScore}%`} sub="+6 esta semana" accent="var(--accent)" onClick={() => setKpiDrawer("aiscore")} />
      </div>

      {/* Tabs + Chatter rail */}
      <div className="cust360__body">
        <div className="cust360__main">
          <div className="cust360__tabs">
            {[
              { id: "overview", l: "Resumen", icon: "database" as IconName },
              { id: "tasks", l: `Tareas · ${counts.tasks}`, icon: "check" as IconName },
              { id: "notes", l: `Notas · ${counts.notes}`, icon: "note" as IconName },
              { id: "activity", l: "Timeline", icon: "clock" as IconName },
            ].map((t) => (
              <div
                key={t.id}
                className={`tab ${tab === t.id ? "is-active" : ""}`.trim()}
                onClick={() => setTab(t.id)}
              >
                <Icon name={t.icon} size={11} />
                {t.l}
              </div>
            ))}
          </div>

          <div className="cust360__panel">
            {tab === "overview" && (
              <Overview
                company={company}
                customerDeals={customerDeals}
                proposals={proposals}
                currency={currency}
                computedArr={computedArr}
                computedMrr={computedMrr}
                onOpenDeal={(id) => setSelectedDeal(id)}
              />
            )}
            {tab === "tasks" && (
              <TasksTab tasks={tasks} today={ws.today} />
            )}
            {tab === "notes" && (
              <NotesTab notes={notes} />
            )}
            {tab === "activity" && (
              <TimelineTab company={company} />
            )}
          </div>
        </div>

        <ChatterRail
          companyName={company.name}
          tasks={tasks}
          today={ws.today}
          timeline={company.timeline}
          owners={ws.owners}
          workspace={workspace}
        />
      </div>

      <CustomerKpiDrawer
        kpiId={kpiDrawer}
        company={company}
        customerDeals={customerDeals}
        proposals={proposals}
        tasks={tasks}
        notes={notes}
        today={ws.today}
        currency={currency}
        onClose={() => setKpiDrawer(null)}
        onOpenDeal={(id) => {
          setKpiDrawer(null);
          setSelectedDeal(id);
        }}
      />
    </div>
  );
}

/* ============================================================
   Chatter rail (right side panel)
   ============================================================ */
type ChannelMetaKey = "wa" | "email" | "call" | "note" | "ai" | "task" | "deal" | "mention";
const CHANNEL_META: Record<ChannelMetaKey, { color: string; icon: IconName; label: string }> = {
  wa: { color: "#25D366", icon: "wa", label: "WhatsApp" },
  email: { color: "#5b6cff", icon: "mail", label: "Email" },
  call: { color: "#ea580c", icon: "phone", label: "Llamada" },
  note: { color: "#71717a", icon: "note", label: "Nota" },
  ai: { color: "#8b5cf6", icon: "sparkles", label: "AI" },
  task: { color: "#8b5cf6", icon: "check", label: "Tarea" },
  deal: { color: "#16a34a", icon: "dollar", label: "Trato" },
  mention: { color: "#2563eb", icon: "users", label: "Mención" },
};

function ChatterRail({
  companyName,
  tasks,
  today,
  timeline,
  owners,
  workspace,
}: {
  companyName: string;
  tasks: Task[];
  today: Date;
  timeline: FeaturedCustomer["timeline"];
  owners: OwnersByKey;
  workspace: string;
}) {
  const [composerTab, setComposerTab] = useState<"note" | "message" | "schedule">("note");
  const [draft, setDraft] = useState("");
  const pending = tasks.filter((t) => !t.done);

  const placeholders: Record<typeof composerTab, string> = {
    note: `Registrar una nota sobre ${companyName}…`,
    message: `Escribir mensaje a ${companyName}…`,
    schedule: `Agendar actividad con ${companyName}…`,
  };

  return (
    <aside className="cust360__chatter">
      {/* Composer */}
      <div className="chatter__composer">
        <div className="chatter__tabs">
          <button
            type="button"
            className={composerTab === "note" ? "is-active" : ""}
            onClick={() => setComposerTab("note")}
          >
            Registrar nota
          </button>
          <button
            type="button"
            className={composerTab === "message" ? "is-active" : ""}
            onClick={() => setComposerTab("message")}
          >
            Enviar mensaje
          </button>
          <button
            type="button"
            className={composerTab === "schedule" ? "is-active" : ""}
            onClick={() => setComposerTab("schedule")}
          >
            Programar actividad
          </button>
        </div>
        <textarea
          rows={3}
          placeholder={placeholders[composerTab]}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <div className="chatter__composer-foot">
          <div className="chatter__attach">
            <button type="button" title="Adjuntar archivo"><Icon name="doc" size={12} /></button>
            <button type="button" title="Mencionar a alguien"><Icon name="users" size={12} /></button>
            <button type="button" title="Emoji" style={{ fontSize: 13 }}>🙂</button>
          </div>
          <button
            type="button"
            className="btn btn--primary"
            disabled={!draft.trim()}
            onClick={() => setDraft("")}
          >
            {composerTab === "note" ? "Registrar" : composerTab === "message" ? "Enviar" : "Agendar"}
          </button>
        </div>
      </div>

      {/* Próximas actividades */}
      <div className="chatter__section">
        <div className="chatter__section-h">
          <Icon name="clock" size={11} />
          Próximas actividades
          <span className="chip" style={{ fontSize: 9, marginLeft: "auto" }}>{pending.length}</span>
        </div>
        {pending.length === 0 ? (
          <div className="empty-hint" style={{ padding: 12, fontSize: 11 }}>
            Sin actividades pendientes
          </div>
        ) : (
          pending.slice(0, 3).map((t) => {
            const overdue = isOverdue(t, today);
            return (
              <div key={t.id} className="chatter__activity">
                <div className={`activity-dot ${overdue ? "is-overdue" : ""}`.trim()} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 500 }}>{t.title}</div>
                  <div style={{ fontSize: 10, color: "var(--fg-3)", fontFamily: "var(--font-mono)" }}>
                    {t.kind} · vence {new Date(t.due).toLocaleDateString("es-PE", { day: "2-digit", month: "short" })}
                    {overdue && (
                      <span style={{ color: "var(--warning)" }}> · vencida</span>
                    )}
                  </div>
                </div>
                <span
                  style={{
                    width: 22, height: 22, borderRadius: 11,
                    background: "linear-gradient(135deg, #93c5fd, #2563eb)",
                    color: "#fff", display: "grid", placeItems: "center",
                    fontSize: 9, fontFamily: "var(--font-mono)", fontWeight: 600,
                  }}
                >
                  {t.byInitials}
                </span>
              </div>
            );
          })
        )}
      </div>

      {/* Followers */}
      <div className="chatter__section">
        <div className="chatter__section-h">
          <Icon name="users" size={11} />
          Followers
          <span className="chip" style={{ fontSize: 9, marginLeft: "auto" }}>
            {Object.keys(owners).length + 1}
          </span>
        </div>
        <div className="chatter__followers">
          {Object.entries(owners).map(([k, o]) => (
            <span
              key={k}
              title={o.name}
              style={{
                width: 26, height: 26, borderRadius: 13,
                background: `linear-gradient(135deg, ${o.color}aa, ${o.color})`,
                color: "#fff", display: "grid", placeItems: "center",
                fontSize: 10, fontFamily: "var(--font-mono)", fontWeight: 600,
              }}
            >
              {k}
            </span>
          ))}
          <button type="button" className="chatter__follow-add" title="Agregar follower">+</button>
        </div>
      </div>

      {/* Actividad reciente */}
      <div className="chatter__section">
        <div className="chatter__section-h">
          <Icon name="clock" size={11} />
          Actividad reciente
        </div>
        <div className="chatter__feed">
          {timeline.slice(0, 2).flatMap((day) =>
            day.events.map((ev, i) => {
              const meta = CHANNEL_META[ev.type as ChannelMetaKey] ?? CHANNEL_META.note;
              return (
                <div key={`${day.day}-${i}`} className="chatter__feed-item">
                  <div className="icon-tile" style={{ background: meta.color }}>
                    <Icon name={meta.icon} size={10} />
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 11, color: "var(--fg-3)" }}>
                      <b style={{ color: "var(--fg-2)" }}>{ev.who}</b> · {ev.at}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--fg)", marginTop: 2, lineHeight: 1.45 }}>
                      {ev.text}
                    </div>
                  </div>
                </div>
              );
            }),
          )}
          <span style={{ fontSize: 10, color: "var(--fg-4)", textAlign: "center", marginTop: 4 }}>
            Workspace: <span className="mono">{workspace}</span>
          </span>
        </div>
      </div>
    </aside>
  );
}

/* ============================================================
   Components
   ============================================================ */
function SmartButton({
  icon,
  label,
  value,
  sub,
  accent,
  onClick,
}: {
  icon: IconName;
  label: string;
  value: string;
  sub: string;
  accent?: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      className="smart-btn"
      style={accent ? ({ "--accent-color": accent } as React.CSSProperties) : undefined}
      onClick={onClick}
    >
      <div className="smart-btn__icon"><Icon name={icon} size={14} /></div>
      <div style={{ minWidth: 0, textAlign: "left" }}>
        <div className="smart-btn__label">{label}</div>
        <div className="smart-btn__value">{value}</div>
        <div className="smart-btn__sub">{sub}</div>
      </div>
    </button>
  );
}

function Overview({
  company,
  customerDeals,
  proposals,
  currency,
  computedArr,
  computedMrr,
  onOpenDeal,
}: {
  company: FeaturedCustomer;
  customerDeals: Deal[];
  proposals: Proposal[];
  currency: Currency;
  computedArr: number;
  computedMrr: number;
  onOpenDeal: (id: string) => void;
}) {
  const openDeals = customerDeals.filter((d) => d.stage !== "won" && d.stage !== "lost");
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <ProposalsBoard
        proposals={proposals}
        currency={currency}
        onOpenDeal={onOpenDeal}
      />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 14 }}>
        <Section title="Datos de la cuenta">
          <Row k="Razón social" v={company.name} />
          <Row k="Sitio" v={<span className="mono">{company.website}</span>} />
          <Row k="Industria" v={company.industry} />
          <Row k="Empleados" v={company.employees} />
          <Row k="ARR" v={<span className="mono">{fmtMoneyFull(computedArr, currency)}</span>} />
          <Row k="MRR" v={<span className="mono">{fmtMoneyFull(computedMrr, currency)}</span>} />
          <Row k="NPS" v={<span className="mono">{company.nps}</span>} />
        </Section>
        <Section title={`Contactos · ${company.contacts.length}`}>
          {company.contacts.map((c) => (
            <div key={c.email} style={{ display: "flex", gap: 10, padding: "8px 14px", borderBottom: "1px solid var(--border-2)" }}>
              <span style={{
                width: 26, height: 26, borderRadius: 13,
                background: "linear-gradient(135deg, #94a3b8, #475569)",
                color: "#fff", display: "grid", placeItems: "center",
                fontSize: 10, fontFamily: "var(--font-mono)", fontWeight: 600,
              }}>
                {c.name.split(" ").map((s) => s[0]).slice(0, 2).join("")}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{c.name}</div>
                <div style={{ fontSize: 11, color: "var(--fg-3)" }}>{c.role}</div>
              </div>
              <span className="mono" style={{ fontSize: 10, color: "var(--fg-3)" }}>{c.email}</span>
            </div>
          ))}
        </Section>
        <Section title={`Deals abiertos · ${openDeals.length}`}>
          {openDeals.length === 0 ? (
            <div className="empty-hint" style={{ padding: 14 }}>Sin deals abiertos.</div>
          ) : (
            openDeals.slice(0, 5).map((d) => (
              <div key={d.id} style={{ display: "flex", padding: "8px 14px", borderBottom: "1px solid var(--border-2)", alignItems: "center", gap: 8 }}>
                <span className="mono" style={{ color: "var(--fg-3)", fontSize: 10 }}>{d.id}</span>
                <span style={{ flex: 1, fontSize: 12 }}>{d.name}</span>
                <span style={{
                  background: stageColor(d.stage) + "22",
                  color: stageColor(d.stage),
                  padding: "1px 6px",
                  borderRadius: 3,
                  fontSize: 10,
                  fontFamily: "var(--font-mono)",
                }}>{stageLabel(d.stage)}</span>
                <span className="mono" style={{ fontSize: 12 }}>{fmtMoney(d.value, currency)}</span>
              </div>
            ))
          )}
        </Section>
      </div>
    </div>
  );
}

/* ============================================================
   HealthLight — semáforo basado en AI Score (click expande panel coach)
   ============================================================ */
type HealthTone = "green" | "yellow" | "red";

function healthTone(score: number): HealthTone {
  return score >= 75 ? "green" : score >= 50 ? "yellow" : "red";
}

const HEALTH_META: Record<
  HealthTone,
  { label: string; color: string; bg: string; range: string }
> = {
  green: {
    label: "Saludable",
    color: "#15803d", // verde intenso
    bg: "#dcfce7",
    range: "≥ 75",
  },
  yellow: {
    label: "Atención",
    color: "#c2410c", // naranja intenso (más visible que amarillo puro)
    bg: "#ffedd5",
    range: "50 – 74",
  },
  red: {
    label: "Riesgo",
    color: "#b91c1c", // rojo intenso
    bg: "#fee2e2",
    range: "< 50",
  },
};

function HealthLight({
  score,
  open,
  onToggle,
}: {
  score: number;
  open: boolean;
  onToggle: () => void;
}) {
  const tone = healthTone(score);
  const m = HEALTH_META[tone];
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      title={`Salud del cliente · ${score}% (${m.label}) · click para ver coach`}
      className={`health-light health-light--${tone} ${open ? "is-open" : ""}`.trim()}
      style={{
        background: m.bg,
        border: `1.5px solid ${m.color}`,
        color: m.color,
      }}
    >
      <span
        aria-hidden
        className="health-light__dot"
        style={{
          background: m.color,
          boxShadow: `0 0 0 4px ${m.color}33, 0 0 8px ${m.color}66`,
        }}
      />
      <span className="health-light__score">{score}%</span>
      <span className="health-light__sep">·</span>
      <span className="health-light__label">{m.label}</span>
      <Icon
        name="chevron-down"
        size={12}
        style={{
          marginLeft: 2,
          transform: open ? "rotate(180deg)" : undefined,
          transition: "transform .15s",
        }}
      />
    </button>
  );
}

/* ============================================================
   HealthCoachPanel — leyenda + breakdown + acciones para subir de nivel
   ============================================================ */
function HealthCoachPanel({
  company,
  customerDeals,
  tasks,
  today,
  onClose,
}: {
  company: FeaturedCustomer;
  customerDeals: Deal[];
  tasks: Task[];
  today: Date;
  onClose: () => void;
}) {
  const score = company.aiScore;
  const tone = healthTone(score);
  const m = HEALTH_META[tone];

  // Breakdown sintético del score (factores que contribuyen)
  // En real, vendría del modelo AI; acá lo derivamos heurísticamente de la data
  const openDeals = customerDeals.filter((d) => d.stage !== "won" && d.stage !== "lost");
  const wonDeals = customerDeals.filter((d) => d.stage === "won");
  const lostDeals = customerDeals.filter((d) => d.stage === "lost");
  const overdueTasks = tasks.filter((t) => !t.done && new Date(t.due).getTime() < today.getTime()).length;
  const cLevel = company.contacts.filter((c) => /CTO|CEO|VP|Head/i.test(c.role)).length;
  const stalled = openDeals.filter((d) => d.lastActivity >= 7).length;
  const winRate = wonDeals.length + lostDeals.length > 0
    ? Math.round((wonDeals.length / (wonDeals.length + lostDeals.length)) * 100)
    : 0;

  // Factores que influyen en el score (cada uno con peso y aporte actual)
  const factors = [
    {
      label: "Engagement WhatsApp",
      weight: 25,
      value: Math.min(100, 60 + (company.contacts.length * 5)),
      tip: "Frecuencia de respuesta y velocidad de reply en WA",
    },
    {
      label: "Cobertura de stakeholders C-level",
      weight: 20,
      value: Math.min(100, cLevel * 35 + 30),
      tip: cLevel >= 2 ? "Cobertura completa de buying committee" : `Solo ${cLevel} contacto c-level — sumá CFO/CIO`,
    },
    {
      label: "Win rate histórico",
      weight: 20,
      value: winRate,
      tip: `${wonDeals.length} won / ${wonDeals.length + lostDeals.length} cerrados`,
    },
    {
      label: "Velocidad en etapa",
      weight: 15,
      value: stalled === 0 ? 90 : Math.max(20, 80 - stalled * 20),
      tip: stalled > 0
        ? `${stalled} trato${stalled > 1 ? "s" : ""} con ≥7d sin actividad`
        : "Todos los tratos con movimiento reciente",
    },
    (() => {
      // company.employees puede ser "30,000+" (string) o número — parseamos ambos
      const empNum = typeof company.employees === "number"
        ? company.employees
        : parseInt(String(company.employees).replace(/[^\d]/g, ""), 10) || 0;
      return {
        label: "Tamaño cuenta vs ICP",
        weight: 10,
        value: empNum >= 1000 ? 90 : empNum >= 100 ? 70 : 50,
        tip: `${company.employees} empleados — ${empNum >= 1000 ? "enterprise fit" : "mid-market fit"}`,
      };
    })(),
    {
      label: "Tareas al día",
      weight: 10,
      value: overdueTasks === 0 ? 100 : Math.max(0, 100 - overdueTasks * 25),
      tip: overdueTasks > 0 ? `${overdueTasks} tarea${overdueTasks > 1 ? "s" : ""} vencida${overdueTasks > 1 ? "s" : ""}` : "Sin tareas vencidas",
    },
  ];

  // Acciones recomendadas para subir de nivel
  const target = tone === "green" ? null : tone === "yellow" ? 75 : 50;
  const needed = target ? target - score : 0;

  type Action = { icon: IconName; title: string; impact: string; tone?: "high" | "med" };
  const actions: Action[] = [];
  if (overdueTasks > 0) {
    actions.push({
      icon: "check",
      title: `Cerrá las ${overdueTasks} tarea${overdueTasks > 1 ? "s" : ""} vencida${overdueTasks > 1 ? "s" : ""}`,
      impact: `+${Math.min(8, overdueTasks * 3)} pts`,
      tone: "high",
    });
  }
  if (stalled > 0) {
    actions.push({
      icon: "clock",
      title: `Reactivá ${stalled} trato${stalled > 1 ? "s" : ""} sin movimiento (≥7d)`,
      impact: `+${Math.min(6, stalled * 2)} pts`,
      tone: "high",
    });
  }
  if (cLevel < 2) {
    actions.push({
      icon: "users",
      title: "Sumá un contacto C-level (CFO o CIO) al buying committee",
      impact: "+5 pts",
      tone: "med",
    });
  }
  const propsInNeg = customerDeals.filter((d) => d.stage === "negotiation" || d.stage === "signing").length;
  if (propsInNeg > 0) {
    actions.push({
      icon: "doc",
      title: `Avanzá ${propsInNeg} propuesta${propsInNeg > 1 ? "s" : ""} en Negociation/Signing`,
      impact: "+4 pts c/u",
      tone: "med",
    });
  }
  if (winRate < 50 && wonDeals.length + lostDeals.length >= 2) {
    actions.push({
      icon: "trending",
      title: "Revisá causas de pérdida del último Q (compitencia, pricing, fit)",
      impact: "+3 pts en próx. cierre",
      tone: "med",
    });
  }
  if (actions.length === 0) {
    actions.push({
      icon: "sparkles",
      title: "Mantené el ritmo — todo va bien",
      impact: "+1 pt /sem",
      tone: "med",
    });
  }

  return (
    <div className={`health-coach health-coach--${tone}`}>
      <div className="health-coach__head">
        <div className="health-coach__title">
          <Icon name="sparkles" size={14} style={{ color: m.color }} />
          <b>Coach del cliente</b>
          <span className="health-coach__meta mono">AI Score · {company.name}</span>
        </div>
        <button type="button" className="btn btn--icon" onClick={onClose} aria-label="Cerrar">
          <Icon name="x" size={14} />
        </button>
      </div>

      <div className="health-coach__body">
        {/* Leyenda — 3 niveles */}
        <div className="health-coach__legend">
          {(["green", "yellow", "red"] as HealthTone[]).map((t) => {
            const meta = HEALTH_META[t];
            const isCurrent = t === tone;
            return (
              <div
                key={t}
                className={`health-coach__leg ${isCurrent ? "is-current" : ""}`.trim()}
                style={{
                  background: isCurrent ? meta.bg : "transparent",
                  borderColor: isCurrent ? meta.color : "var(--border-2)",
                }}
              >
                <span
                  className="health-coach__leg-dot"
                  style={{
                    background: meta.color,
                    boxShadow: isCurrent ? `0 0 0 3px ${meta.color}33` : undefined,
                  }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, color: meta.color, fontSize: 12 }}>
                    {meta.label}
                  </div>
                  <div className="mono" style={{ fontSize: 10, color: "var(--fg-3)" }}>
                    Score {meta.range}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Estado actual y siguiente nivel */}
        <div className="health-coach__status">
          <div>
            <div className="health-coach__label">Estado actual</div>
            <div className="health-coach__big" style={{ color: m.color }}>
              {score}% · {m.label}
            </div>
          </div>
          {target ? (
            <div style={{ textAlign: "right" }}>
              <div className="health-coach__label">Para llegar a {tone === "yellow" ? "verde" : "amarillo"}</div>
              <div className="health-coach__big mono">
                +{needed} pts <span style={{ color: "var(--fg-3)", fontSize: 12, fontWeight: 400 }}>(score ≥ {target})</span>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: "right" }}>
              <div className="health-coach__label">Nivel máximo</div>
              <div className="health-coach__big" style={{ color: m.color }}>🏆 Saludable</div>
            </div>
          )}
        </div>

        {/* Breakdown del score */}
        <div className="health-coach__section">
          <div className="health-coach__section-h">
            Breakdown del score · qué contribuye
          </div>
          <div className="health-coach__factors">
            {factors.map((f) => {
              const contribution = Math.round((f.value / 100) * f.weight);
              return (
                <div key={f.label} className="health-coach__factor" title={f.tip}>
                  <div className="health-coach__factor-head">
                    <span className="health-coach__factor-label">{f.label}</span>
                    <span className="mono health-coach__factor-pts">
                      {contribution}/{f.weight} pts
                    </span>
                  </div>
                  <div className="health-coach__factor-bar">
                    <div
                      style={{
                        width: f.value + "%",
                        background:
                          f.value >= 75 ? "#15803d" : f.value >= 50 ? "#c2410c" : "#b91c1c",
                      }}
                    />
                  </div>
                  <div className="health-coach__factor-tip">{f.tip}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Acciones recomendadas */}
        <div className="health-coach__section">
          <div className="health-coach__section-h">
            {target ? `Acciones para llegar a ${tone === "yellow" ? "verde" : "amarillo"}` : "Acciones para mantener el nivel"}
          </div>
          <div className="health-coach__actions">
            {actions.map((a, i) => (
              <div key={i} className={`health-coach__action health-coach__action--${a.tone}`}>
                <span className="health-coach__action-icon" style={{ background: m.color }}>
                  <Icon name={a.icon} size={12} />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="health-coach__action-title">{a.title}</div>
                </div>
                <span className="health-coach__action-impact mono">{a.impact}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   ProposalsBoard — agrupa propuestas por etapa del Pipeline
   (las etapas son las MISMAS que en /pipeline, no una enum aparte)
   ============================================================ */
function ProposalsBoard({
  proposals,
  currency,
  onOpenDeal,
}: {
  proposals: Proposal[];
  currency: Currency;
  onOpenDeal: (id: string) => void;
}) {
  // Solo mostrar stages que apliquen a propuestas — desde "proposal" en adelante.
  const RELEVANT_STAGES: StageId[] = ["proposal", "negotiation", "signing", "won", "lost"];
  const STAGE_TONE: Record<StageId, "success" | "accent" | "warn" | "info" | "danger" | "neutral"> = {
    discovery: "neutral",
    qualified: "info",
    proposal: "accent",
    negotiation: "warn",
    signing: "info",
    won: "success",
    lost: "danger",
  };

  // Default expanded: la primera con propuestas (priorizar won)
  const [expanded, setExpanded] = useState<StageId | null>(() => {
    const priority: StageId[] = ["won", "signing", "negotiation", "proposal", "lost"];
    for (const s of priority) {
      if (proposals.some((p) => p.stage === s)) return s;
    }
    return null;
  });

  const grandTotal = proposals.reduce((a, p) => a + p.value, 0);

  if (proposals.length === 0) {
    return (
      <Section title="Propuestas">
        <div className="empty-hint" style={{ padding: 18 }}>
          Sin propuestas aún (solo deals en discovery o qualified).
        </div>
      </Section>
    );
  }

  // Mapear stages a su meta de STAGES (label + color)
  const cards = RELEVANT_STAGES
    .map((sid) => STAGES.find((s) => s.id === sid))
    .filter((s): s is NonNullable<typeof s> => Boolean(s));

  return (
    <Section title={`Propuestas · ${proposals.length} · ${fmtMoney(grandTotal, currency)}`}>
      <div className="prop-board">
        {cards.map((stage) => {
          const list = proposals.filter((p) => p.stage === stage.id);
          const sum = list.reduce((a, p) => a + p.value, 0);
          const isOpen = expanded === stage.id;
          const isEmpty = list.length === 0;
          const tone = STAGE_TONE[stage.id] ?? "neutral";
          return (
            <div key={stage.id} className={`prop-board__group ${isOpen ? "is-open" : ""}`.trim()}>
              <button
                type="button"
                className={`prop-board__card prop-board__card--${tone} ${isEmpty ? "is-empty" : ""}`.trim()}
                onClick={() => !isEmpty && setExpanded(isOpen ? null : stage.id)}
                disabled={isEmpty}
              >
                <div className="prop-board__card-head">
                  <span className="prop-board__dot" style={{ background: stage.color }} />
                  <span className="prop-board__card-label">{stage.label}</span>
                  {!isEmpty && (
                    <Icon
                      name="chevron-down"
                      size={11}
                      className="prop-board__chev"
                      style={{ transform: isOpen ? "rotate(180deg)" : undefined, color: "var(--fg-4)" }}
                    />
                  )}
                </div>
                <div className="prop-board__card-value mono">
                  {fmtMoney(sum, currency)}
                </div>
                <div className="prop-board__card-count">
                  {list.length} {list.length === 1 ? "propuesta" : "propuestas"}
                </div>
              </button>
            </div>
          );
        })}
      </div>

      {expanded && (
        <div className="prop-board__list">
          {proposals
            .filter((p) => p.stage === expanded)
            .map((p) => {
              const stage = STAGES.find((s) => s.id === p.stage);
              const color = stage?.color ?? "#94a3b8";
              const label = stage?.label ?? p.stage;
              return (
                <div
                  key={p.id}
                  className="proposal-card"
                  onClick={() => onOpenDeal(p.dealId)}
                  style={{ cursor: "pointer" }}
                >
                  <div
                    className="proposal-card__icon"
                    style={{ background: color + "22", color }}
                  >
                    <Icon name="doc" size={16} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 14, fontWeight: 600 }}>{p.dealName}</span>
                      <span style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: 10,
                        color: "var(--fg-3)",
                        background: "var(--bg-2)",
                        padding: "1px 5px",
                        borderRadius: 3,
                      }}>v{p.version}</span>
                      <span className="proposal-card__status" style={{ color, borderColor: color }}>
                        {label}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: "var(--fg-3)", marginTop: 4, fontFamily: "var(--font-mono)" }}>
                      <span className="mono">{p.dealId}</span> · enviada {p.sentAt}
                      {p.signedAt && ` · firmada ${p.signedAt}`}
                    </div>
                  </div>
                  <div className="mono" style={{ fontSize: 16, fontWeight: 600, color: "var(--fg)" }}>
                    {fmtMoney(p.value, currency)}
                  </div>
                </div>
              );
            })}
        </div>
      )}
    </Section>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius)", background: "var(--bg)" }}>
      <div style={{
        padding: "9px 14px",
        background: "var(--bg-2)",
        borderBottom: "1px solid var(--border-2)",
        fontSize: 11,
        fontFamily: "var(--font-mono)",
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        color: "var(--fg-3)",
      }}>{title}</div>
      <div>{children}</div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "130px 1fr",
      padding: "6px 14px",
      borderBottom: "1px solid var(--border-2)",
      fontSize: 12.5,
      gap: 10,
      alignItems: "center",
    }}>
      <div style={{ color: "var(--fg-3)", fontSize: 11 }}>{k}</div>
      <div style={{ color: "var(--fg)" }}>{v}</div>
    </div>
  );
}

function DealsTab({
  open,
  won,
  lost,
  owners,
  currency,
  onOpenDeal,
}: {
  open: Deal[];
  won: Deal[];
  lost: Deal[];
  owners: OwnersByKey;
  currency: Currency;
  onOpenDeal: (id: string) => void;
}) {
  if (open.length + won.length + lost.length === 0)
    return <div className="empty-hint">Sin deals para este cliente.</div>;
  return (
    <div className="deals-tab">
      <DealsGroup title="En curso" deals={open} owners={owners} currency={currency} onOpenDeal={onOpenDeal} />
      <DealsGroup title="Ganados" deals={won} owners={owners} currency={currency} onOpenDeal={onOpenDeal} accent="var(--success)" />
      <DealsGroup title="Perdidos" deals={lost} owners={owners} currency={currency} onOpenDeal={onOpenDeal} accent="var(--danger)" muted />
    </div>
  );
}

function DealsGroup({
  title,
  deals,
  owners,
  currency,
  onOpenDeal,
  accent,
  muted,
}: {
  title: string;
  deals: Deal[];
  owners: OwnersByKey;
  currency: Currency;
  onOpenDeal: (id: string) => void;
  accent?: string;
  muted?: boolean;
}) {
  if (deals.length === 0) return null;
  const total = deals.reduce((a, d) => a + d.value, 0);
  return (
    <div className="deals-group">
      <div className="deals-group__h">
        <span style={{ color: accent }}>{title}</span>
        <span className="mono">{deals.length}</span>
        <span style={{ marginLeft: "auto" }} className="mono">{fmtMoney(total, currency)}</span>
      </div>
      <div className="deals-group__list" style={muted ? { opacity: 0.7 } : undefined}>
        {deals.map((d) => {
          const owner = owners[d.owner];
          return (
            <div key={d.id} className="deal-row" onClick={() => onOpenDeal(d.id)}>
              <span className="dot" style={{ background: stageColor(d.stage), width: 8, height: 8 }} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{d.name}</div>
                <div style={{ fontSize: 11, color: "var(--fg-3)", fontFamily: "var(--font-mono)", marginTop: 2, display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <span>{d.id}</span>
                  <span>{stageLabel(d.stage)}</span>
                  <span>AI {d.ai}%</span>
                  {d.isRecurring && <span style={{ color: "var(--accent)" }}>ARR {fmtMoney(d.arr, currency)}</span>}
                  <span>cierre {new Date(d.estimatedCloseAt).toLocaleDateString("es-PE", { day: "2-digit", month: "short" })}</span>
                </div>
              </div>
              <span
                style={{
                  width: 22, height: 22, borderRadius: 11,
                  background: `linear-gradient(135deg, ${owner?.color ?? "#666"}aa, ${owner?.color ?? "#666"})`,
                  color: "#fff", display: "grid", placeItems: "center",
                  fontSize: 9, fontFamily: "var(--font-mono)", fontWeight: 600,
                }}
                title={owner?.name}
              >
                {owner?.name.split(" ").map((s) => s[0]).slice(0, 2).join("") ?? d.owner}
              </span>
              <div className="mono" style={{ fontSize: 14, fontWeight: 500, width: 80, textAlign: "right" }}>
                {fmtMoney(d.value, currency)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TasksTab({ tasks, today }: { tasks: Task[]; today: Date }) {
  const [items, setItems] = useState(tasks);
  useEffect(() => setItems(tasks), [tasks]);
  const toggle = (id: string) =>
    setItems((prev) => prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
  const pending = items.filter((t) => !t.done);
  const completed = items.filter((t) => t.done);
  return (
    <div className="tasks-tab">
      <div className="tasks-tab__head">
        <span>{pending.length} pendientes · {completed.length} completadas</span>
        <button type="button" className="btn btn--primary"><Icon name="plus" size={12} /> Nueva tarea</button>
      </div>
      <div className="tasks-tab__list">
        {pending.map((t) => <TaskRow key={t.id} task={t} today={today} onToggle={toggle} />)}
        {completed.length > 0 && (
          <>
            <div className="tasks-tab__divider">Completadas</div>
            {completed.map((t) => <TaskRow key={t.id} task={t} today={today} onToggle={toggle} />)}
          </>
        )}
      </div>
    </div>
  );
}

function TaskRow({ task, today, onToggle }: { task: Task; today: Date; onToggle: (id: string) => void }) {
  const overdue = isOverdue(task, today);
  return (
    <div className={`task-row ${task.done ? "is-done" : ""} ${overdue ? "is-overdue" : ""}`.trim()}>
      <button type="button" className="task-row__check" onClick={() => onToggle(task.id)}>
        {task.done && <Icon name="check" size={11} />}
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="task-row__title">{task.title}</div>
        <div className="task-row__meta">
          <span className="chip" style={{ fontSize: 9, padding: "1px 5px" }}>{task.kind}</span>
          <span>vence {new Date(task.due).toLocaleDateString("es-PE", { day: "2-digit", month: "short" })}</span>
          {overdue && !task.done && (
            <span style={{ color: "var(--warning)" }}>· vencida hace {daysBetween(task.due, today)}d</span>
          )}
        </div>
      </div>
      <span style={{
        width: 22, height: 22, borderRadius: 11,
        background: "linear-gradient(135deg, #93c5fd, #2563eb)",
        color: "#fff", display: "grid", placeItems: "center",
        fontSize: 9, fontFamily: "var(--font-mono)", fontWeight: 600,
      }}>{task.byInitials}</span>
    </div>
  );
}

function NotesTab({ notes }: { notes: Note[] }) {
  return (
    <div className="notes-tab">
      {notes.map((n, i) => (
        <div key={i} className="note-card">
          <div className="note-card__h">
            <span style={{
              width: 28, height: 28, borderRadius: 14,
              background: n.kind === "ai" ? "linear-gradient(135deg, #8b5cf6, #2563eb)" : "linear-gradient(135deg, #93c5fd, #2563eb)",
              color: "#fff", display: "grid", placeItems: "center",
              fontSize: 10, fontFamily: "var(--font-mono)", fontWeight: 600,
            }}>
              {n.kind === "ai" ? "AI" : (n.by ?? "MP").split(" ").map((s) => s[0]).slice(0, 2).join("")}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 500 }}>
                {n.by ?? (n.kind === "ai" ? "AI · Recap" : "Nota interna")}
                {n.kind === "ai" && (
                  <span className="ai-tag" style={{ marginLeft: 6 }}>
                    <Icon name="sparkles" size={9} /> AI
                  </span>
                )}
              </div>
              <div style={{ fontSize: 10, color: "var(--fg-3)", fontFamily: "var(--font-mono)" }}>{n.at}</div>
            </div>
          </div>
          <div className="note-card__body">{n.text}</div>
          {n.tags && (
            <div style={{ display: "flex", gap: 5, marginTop: 8 }}>
              {n.tags.map((t) => <span key={t} className="chip">{t}</span>)}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function TimelineTab({ company }: { company: FeaturedCustomer }) {
  return (
    <div className="cust__timeline">
      {company.timeline.map((day) => (
        <div key={day.day} className="tl-day">
          <h3 className="tl-day__head mono">{day.day}</h3>
          <ul className="tl-day__events">
            {day.events.map((ev, i) => (
              <li key={i} className="tl-event">
                <span className={`tl-event__type tl-event__type--${ev.type}`}>{ev.type}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="tl-event__text">{ev.text}</div>
                  <div className="tl-event__meta mono">{ev.who} · {ev.at}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
