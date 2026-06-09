import { useEffect, useMemo, useState } from "react";
import { useFetcher } from "react-router";
import {
  DndContext,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useActiveWorkspace, useAppStore, useCurrentUser, type Currency } from "../lib/store";
import { fmtMoney, daysBetween } from "../lib/format";
import { Icon, type IconName } from "../components/shell/Icon";
import { PipelineStageEditor } from "../components/pipeline/PipelineStageEditor";
import { tagColor } from "../lib/tags";
import type { Deal, OwnersByKey, Stage } from "../lib/types";

/* ============================================================
   Quick filters
   ============================================================ */
type QuickFilterId = "all" | "mine" | "hot" | "risk" | "week" | "saas";

function getDealFacts(deal: Deal) {
  // Determinístico por deal.id — replica el getDealFacts del proto
  const seed = (deal.id || "x").split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const stageBoost =
    { discovery: 0, qualified: 1, proposal: 2, negotiation: 3, signing: 3, won: 4, lost: 2 }[
      deal.stage
    ] || 0;
  return {
    files: stageBoost >= 2 ? 3 + (seed % 3) : seed % 3,
    wa: stageBoost >= 1 ? 1 + (seed % 4) + stageBoost : seed % 2,
    emails: stageBoost >= 2 ? 2 + (seed % 3) + stageBoost : 1 + (seed % 2),
    calls: stageBoost >= 2 ? 1 + (seed % 3) : 0,
    notes: stageBoost + (seed % 2),
    tasks: stageBoost >= 1 ? 1 + (seed % 3) : seed % 2,
    nextWaUnread: deal.stage !== "won" && deal.stage !== "lost" && seed % 3 === 0,
    overdue: deal.stage !== "won" && deal.stage !== "lost" && seed % 5 === 0,
  };
}

function daysInStage(deal: Deal, today: Date): number {
  return Math.max(0, daysBetween(deal.createdAt, today));
}

function inferWs(deal: Deal): "novit" | "sharky" {
  if (deal._ws) return deal._ws;
  return deal.id.startsWith("SHARKY") ? "sharky" : "novit";
}

/**
 * "SaaS-heavy" — el ARR anual recurrente supera al setup (one-time) en un año.
 * Son los tratos de setup bajo pero alto valor recurrente que conviene priorizar.
 * Se marcan con ★ + color dorado para detectarlos rápido en el pipeline.
 */
export function isHighSaaS(d: Deal): boolean {
  return d.isRecurring && d.arr > 0 && d.arr > d.value;
}

/* ============================================================
   ROUTE
   ============================================================ */
export default function PipelineRoute() {
  const ws = useActiveWorkspace();
  const workspace = useAppStore((s) => s.workspace);
  const updateDeal = useAppStore((s) => s.setSelectedDeal);
  const setSelectedDeal = useAppStore((s) => s.setSelectedDeal);
  const currency = useAppStore((s) => s.currency);
  const fetcher = useFetcher();
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [quickFilter, setQuickFilter] = useState<QuickFilterId>("all");
  const [companySearch, setCompanySearch] = useState("");
  const [stageFilter, setStageFilter] = useState<string | null>(null);
  const [stageEditorOpen, setStageEditorOpen] = useState(false);
  const currentUser = useCurrentUser();

  // ── Modo de vista (kanban | list) y subtab de list (grouped | flat) ──
  // Persistimos en localStorage para que la última elección sobreviva al reload.
  const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban");
  const [listMode, setListMode] = useState<"grouped" | "flat">("grouped");
  useEffect(() => {
    const v = localStorage.getItem("pipeline-view");
    if (v === "kanban" || v === "list") setViewMode(v);
    const l = localStorage.getItem("pipeline-list-mode");
    if (l === "grouped" || l === "flat") setListMode(l);
  }, []);
  const changeView = (v: "kanban" | "list") => {
    setViewMode(v);
    if (typeof window !== "undefined") localStorage.setItem("pipeline-view", v);
  };
  const changeListMode = (v: "grouped" | "flat") => {
    setListMode(v);
    if (typeof window !== "undefined") localStorage.setItem("pipeline-list-mode", v);
  };

  const optimisticPatch = fetcher.formData
    ? {
        id: String(fetcher.formData.get("id")),
        stage: String(fetcher.formData.get("stage")) as Stage["id"],
      }
    : null;

  const myInitials = workspace === "sharky" ? "AV" : "MP";
  // Normalizamos la query: trim + lowercase. Si está vacía, no filtra por empresa.
  const searchQ = companySearch.trim().toLowerCase();
  const filterDeal = (d: Deal) => {
    // ── Filtro de búsqueda por cliente (aplica primero, combina con quickFilter) ──
    if (searchQ) {
      const haystack = `${d.company} ${d.name} ${d.id}`.toLowerCase();
      if (!haystack.includes(searchQ)) return false;
    }
    // ── Filtro por etapa (click en el strip de proceso) ──
    if (stageFilter && d.stage !== stageFilter) return false;
    if (quickFilter === "all") return true;
    const facts = getDealFacts(d);
    const days = daysInStage(d, ws.today);
    const isOpen = d.stage !== "won" && d.stage !== "lost";
    if (quickFilter === "hot") return d.ai >= 70 && isOpen;
    if (quickFilter === "risk") return (facts.overdue || days > 30) && isOpen;
    if (quickFilter === "mine") return d.owner === myInitials;
    if (quickFilter === "saas") return d.isRecurring;
    if (quickFilter === "week") {
      const eta = new Date(d.estimatedCloseAt);
      return (
        Math.abs((eta.getTime() - ws.today.getTime()) / 86400000) <= 7 && isOpen
      );
    }
    return true;
  };

  // Sugerencias de empresas: únicas, ordenadas alfabéticamente, top 8 que matcheen.
  const companySuggestions = useMemo(() => {
    if (!searchQ) return [];
    const unique = new Set<string>();
    for (const d of ws.deals) {
      if (d.company.toLowerCase().includes(searchQ)) unique.add(d.company);
    }
    return Array.from(unique).sort((a, b) => a.localeCompare(b)).slice(0, 8);
  }, [ws.deals, searchQ]);

  // Count de matches para el badge del input
  const searchMatchCount = useMemo(() => {
    if (!searchQ) return 0;
    return ws.deals.filter((d) =>
      `${d.company} ${d.name} ${d.id}`.toLowerCase().includes(searchQ),
    ).length;
  }, [ws.deals, searchQ]);

  const filterCounts = useMemo(() => {
    return {
      all: ws.deals.length,
      mine: ws.deals.filter((d) => d.owner === myInitials).length,
      hot: ws.deals.filter(
        (d) => d.ai >= 70 && d.stage !== "won" && d.stage !== "lost",
      ).length,
      risk: ws.deals.filter((d) => {
        const f = getDealFacts(d);
        const days = daysInStage(d, ws.today);
        return (f.overdue || days > 30) && d.stage !== "won" && d.stage !== "lost";
      }).length,
      week: ws.deals.filter((d) => {
        const eta = new Date(d.estimatedCloseAt);
        return (
          Math.abs((eta.getTime() - ws.today.getTime()) / 86400000) <= 7 &&
          d.stage !== "won" &&
          d.stage !== "lost"
        );
      }).length,
      saas: ws.deals.filter((d) => d.isRecurring).length,
    };
  }, [ws.deals, ws.today, myInitials]);

  const filters: { id: QuickFilterId; label: string; n: number }[] = [
    { id: "all", label: "Todos", n: filterCounts.all },
    { id: "mine", label: "Mis tratos", n: filterCounts.mine },
    { id: "hot", label: "🔥 Calientes", n: filterCounts.hot },
    { id: "risk", label: "⚠ En riesgo", n: filterCounts.risk },
    { id: "week", label: "Cierra esta semana", n: filterCounts.week },
    { id: "saas", label: "SaaS", n: filterCounts.saas },
  ];

  const openDeals = ws.deals.filter((d) => d.stage !== "won" && d.stage !== "lost");
  const openValue = openDeals.reduce((a, d) => a + d.value, 0);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const onDragStart = (e: DragStartEvent) => setDraggingId(String(e.active.id));
  const onDragEnd = (e: DragEndEvent) => {
    setDraggingId(null);
    const overId = e.over?.id;
    const dealId = String(e.active.id);
    if (!overId) return;
    const newStage = String(overId) as Stage["id"];
    const deal = ws.deals.find((d) => d.id === dealId);
    if (!deal || deal.stage === newStage) return;
    fetcher.submit(
      { id: dealId, stage: newStage },
      { method: "POST", action: "/api/deal-update" },
    );
  };

  const openStages = ws.stages.filter((s) => s.id !== "won" && s.id !== "lost");

  return (
    <div className="pipeline-wrap" data-screen-label="Pipeline">
      {/* Process strip */}
      <div className="pipe-process">
        <div className="pipe-process__title">
          <span className="pipe-process__label">Proceso</span>
          <span className="pipe-process__meta">
            {openStages.length} etapas activas · {openDeals.length} tratos abiertos · {fmtMoney(openValue, currency)}
          </span>
          <div className="pipe-view-toggle" style={{ marginLeft: "auto" }} role="tablist" aria-label="Vista del pipeline">
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === "kanban"}
              className={`pipe-view-toggle__btn ${viewMode === "kanban" ? "is-active" : ""}`.trim()}
              onClick={() => changeView("kanban")}
            >
              <Icon name="kanban" size={12} /> Kanban
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === "list"}
              className={`pipe-view-toggle__btn ${viewMode === "list" ? "is-active" : ""}`.trim()}
              onClick={() => changeView("list")}
            >
              <Icon name="database" size={12} /> Lista
            </button>
          </div>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => setStageEditorOpen(true)}
          >
            <Icon name="settings" size={12} /> Editar etapas
          </button>
        </div>
        <div className="pipe-process__flow">
          {ws.stages.map((s, i) => {
            const isLast = i === ws.stages.length - 1;
            const isClosed = s.id === "won" || s.id === "lost";
            return (
              <span key={s.id} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                <button
                  type="button"
                  className={`pipe-process__node ${isClosed ? "is-closed" : ""} ${stageFilter === s.id ? "is-selected" : ""}`.trim()}
                  onClick={() => setStageFilter((prev) => (prev === s.id ? null : s.id))}
                  aria-pressed={stageFilter === s.id}
                  title={stageFilter === s.id ? "Quitar filtro de esta etapa" : `Filtrar por ${s.label}`}
                >
                  <span className="pipe-process__dot" style={{ background: s.color }} />
                  <span className="pipe-process__name">{s.label}</span>
                  <span className="pipe-process__prob mono">{Math.round(s.prob * 100)}%</span>
                </button>
                {!isLast && <span className="pipe-process__arrow">→</span>}
              </span>
            );
          })}
          <button
            type="button"
            className="pipe-process__add"
            onClick={() => setStageEditorOpen(true)}
            title="Agregar nueva etapa"
          >
            <Icon name="plus" size={11} /> Nueva etapa
          </button>
        </div>
      </div>

      {stageEditorOpen && (
        <PipelineStageEditor
          workspaceSlug={
            workspace === "all"
              ? (currentUser?.workspaceSlug ?? "novit")
              : workspace
          }
          stages={ws.stages}
          onClose={() => setStageEditorOpen(false)}
        />
      )}

      {/* Quick filters + búsqueda por cliente */}
      <div className="pipe-filters">
        {filters.map((f) => (
          <button
            key={f.id}
            type="button"
            className={`pipe-filter ${quickFilter === f.id ? "is-active" : ""}`.trim()}
            onClick={() => setQuickFilter(f.id)}
          >
            <span>{f.label}</span>
            <span className="pipe-filter__n">{f.n}</span>
          </button>
        ))}
        <div className="pipe-filters__spacer" />
        <div className="pipe-search">
          <Icon name="search" size={13} className="pipe-search__icon" />
          <input
            type="search"
            className="pipe-search__input"
            placeholder="Buscar por cliente, trato o ID…"
            value={companySearch}
            onChange={(e) => setCompanySearch(e.target.value)}
            list="pipe-company-suggestions"
            aria-label="Buscar"
          />
          {companySuggestions.length > 0 && (
            <datalist id="pipe-company-suggestions">
              {companySuggestions.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          )}
          {searchQ && (
            <>
              <span className="pipe-search__count" title={`${searchMatchCount} match${searchMatchCount !== 1 ? "es" : ""}`}>
                {searchMatchCount}
              </span>
              <button
                type="button"
                className="pipe-search__clear"
                onClick={() => setCompanySearch("")}
                aria-label="Limpiar búsqueda"
              >
                <Icon name="x" size={11} />
              </button>
            </>
          )}
        </div>
        {(quickFilter !== "all" || stageFilter) && (
          <button
            type="button"
            className="pipe-filter pipe-filter--clear"
            onClick={() => {
              setQuickFilter("all");
              setStageFilter(null);
            }}
          >
            <Icon name="x" size={11} /> Limpiar{stageFilter ? ` · ${ws.stages.find((s) => s.id === stageFilter)?.label ?? ""}` : ""}
          </button>
        )}
      </div>

      {/* Gráfico de valor SETUP por etapa (entre filtros y kanban) */}
      <SetupByStageChart
        stages={ws.stages}
        deals={ws.deals.filter(filterDeal)}
        currency={currency}
      />

      {viewMode === "kanban" ? (
        <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
          <div className="pipeline">
            {ws.stages
              .filter((stage) => !stageFilter || stage.id === stageFilter)
              .map((stage) => (
              <PipelineColumn
                key={stage.id}
                stage={stage}
                allDeals={ws.deals}
                optimisticPatch={optimisticPatch}
                filterDeal={filterDeal}
                quickFilter={quickFilter}
                owners={ws.owners}
                today={ws.today}
                currency={currency}
                onCardClick={(id) => setSelectedDeal(id)}
                draggingId={draggingId}
              />
            ))}
          </div>
        </DndContext>
      ) : (
        <PipelineListView
          stages={ws.stages}
          deals={ws.deals}
          owners={ws.owners}
          today={ws.today}
          currency={currency}
          filterDeal={filterDeal}
          optimisticPatch={optimisticPatch}
          listMode={listMode}
          onChangeListMode={changeListMode}
          onOpenDeal={(id) => setSelectedDeal(id)}
          onStageChange={(dealId, newStage) => {
            fetcher.submit(
              { id: dealId, stage: newStage },
              { method: "POST", action: "/api/deal-update" },
            );
          }}
        />
      )}
    </div>
  );
}

/* ============================================================
   Column
   ============================================================ */
function PipelineColumn({
  stage,
  allDeals,
  optimisticPatch,
  filterDeal,
  quickFilter,
  owners,
  today,
  currency,
  onCardClick,
  draggingId,
}: {
  stage: Stage;
  allDeals: Deal[];
  optimisticPatch: { id: string; stage: Stage["id"] } | null;
  filterDeal: (d: Deal) => boolean;
  quickFilter: QuickFilterId;
  owners: OwnersByKey;
  today: Date;
  currency: Currency;
  onCardClick: (id: string) => void;
  draggingId: string | null;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });
  const openNewLead = useAppStore((s) => s.openNewLead);

  const ds = useMemo(() => {
    return allDeals.filter((d) => {
      const effectiveStage =
        optimisticPatch && optimisticPatch.id === d.id ? optimisticPatch.stage : d.stage;
      return effectiveStage === stage.id;
    });
  }, [allDeals, stage.id, optimisticPatch]);
  const filtered = ds.filter(filterDeal);
  const sum = filtered.reduce((a, d) => a + d.value, 0);
  // ARR anual agregado de los tratos SaaS recurrentes de esta etapa.
  const recurring = filtered.filter((d) => d.isRecurring && d.arr > 0);
  const arrSum = recurring.reduce((a, d) => a + d.arr, 0);

  const isOpen = stage.id !== "won" && stage.id !== "lost";
  const isLost = stage.id === "lost";

  const healthDist = isOpen
    ? {
        hot: ds.filter((d) => d.ai >= 70 && daysInStage(d, today) <= 14).length,
        warm: ds.filter((d) => d.ai >= 50 && d.ai < 70).length,
        cold: ds.filter((d) => {
          const f = getDealFacts(d);
          return d.ai < 50 && !f.overdue && daysInStage(d, today) <= 30;
        }).length,
        risk: ds.filter((d) => {
          const f = getDealFacts(d);
          return f.overdue || daysInStage(d, today) > 30;
        }).length,
      }
    : null;

  return (
    <div
      ref={setNodeRef}
      className={`pipe-col ${isLost ? "pipe-col--lost" : ""} ${isOver ? "is-drop-hover" : ""}`.trim()}
      style={{ "--stage-color": stage.color } as React.CSSProperties}
    >
      <div className="pipe-col__tint" />
      <div className="pipe-col__band" />
      <div className="pipe-col__h">
        <span className="pipe-col__title">{stage.label}</span>
        <span className="pipe-col__count">
          {quickFilter === "all" ? ds.length : `${filtered.length}/${ds.length}`}
        </span>
        <span className="pipe-col__menu" title="Opciones (próximamente)">
          <Icon name="more" size={13} />
        </span>
      </div>
      <div className="pipe-col__subhead">
        <span className="pipe-col__sum">{fmtMoney(sum, currency)}</span>
        {arrSum > 0 && (
          <span
            className="pipe-col__arr"
            title={`ARR anual de ${recurring.length} SaaS recurrente${recurring.length !== 1 ? "s" : ""} en esta etapa`}
          >
            <Icon name="trending" size={9} /> {fmtMoney(arrSum, currency)}/año
          </span>
        )}
        {isOpen && (
          <span className="pipe-col__prob" title="Probabilidad de cierre">
            <span className="pipe-col__prob-track">
              <span
                className="pipe-col__prob-fill"
                style={{ width: `${Math.round(stage.prob * 100)}%`, background: stage.color }}
              />
            </span>
            <span className="mono" style={{ fontSize: 10, color: "var(--fg-3)" }}>
              {Math.round(stage.prob * 100)}%
            </span>
          </span>
        )}
      </div>

      {healthDist && (healthDist.hot + healthDist.warm + healthDist.cold + healthDist.risk > 0) && (
        <div
          className="pipe-col__health-bar"
          title={`${healthDist.hot} hot · ${healthDist.warm} warm · ${healthDist.cold} cold · ${healthDist.risk} at risk`}
        >
          {healthDist.hot > 0 && <span className="pipe-col__health-seg pipe-col__health-seg--hot" style={{ flex: healthDist.hot }} />}
          {healthDist.warm > 0 && <span className="pipe-col__health-seg pipe-col__health-seg--warm" style={{ flex: healthDist.warm }} />}
          {healthDist.cold > 0 && <span className="pipe-col__health-seg pipe-col__health-seg--cold" style={{ flex: healthDist.cold }} />}
          {healthDist.risk > 0 && <span className="pipe-col__health-seg pipe-col__health-seg--risk" style={{ flex: healthDist.risk }} />}
        </div>
      )}

      <div className="pipe-col__body">
        {filtered.map((d) => (
          <KanbanCard
            key={d.id}
            deal={d}
            owners={owners}
            today={today}
            currency={currency}
            isDragging={draggingId === d.id}
            onClick={() => onCardClick(d.id)}
          />
        ))}
        {filtered.length === 0 && quickFilter !== "all" && ds.length > 0 && (
          <div className="pipe-col__empty">
            <span style={{ fontSize: 11, color: "var(--fg-3)" }}>
              {ds.length} {ds.length === 1 ? "trato" : "tratos"} fuera del filtro
            </span>
          </div>
        )}
        {isOpen && (
          <button
            type="button"
            className="pipe-col__add-deal"
            title={`Nuevo trato en ${stage.label}`}
            onClick={() => openNewLead(stage.id)}
          >
            <Icon name="plus" size={12} /> Nuevo trato
          </button>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   Kanban card (proto-style)
   ============================================================ */
function KanbanCard({
  deal,
  owners,
  today,
  currency,
  isDragging,
  onClick,
}: {
  deal: Deal;
  owners: OwnersByKey;
  today: Date;
  currency: Currency;
  isDragging: boolean;
  onClick: () => void;
}) {
  const owner = owners[deal.owner];
  const facts = getDealFacts(deal);
  const days = daysInStage(deal, today);
  const isClosed = deal.stage === "won" || deal.stage === "lost";
  const ageClass = isClosed
    ? "is-closed"
    : days > 30
      ? "is-stale"
      : days > 14
        ? "is-warming"
        : "is-fresh";
  const dealWs = inferWs(deal);
  const dealWsLabel = dealWs === "sharky" ? "SHARKY" : "NOVIT";

  let healthLevel: string;
  if (deal.stage === "won") healthLevel = "won";
  else if (deal.stage === "lost") healthLevel = "lost";
  else if (facts.overdue || days > 30) healthLevel = "risk";
  else if (deal.ai >= 70 && days <= 14) healthLevel = "hot";
  else if (deal.ai >= 50) healthLevel = "warm";
  else healthLevel = "cold";

  let nextAction: { icon: IconName; label: string; tone: string } | null = null;
  if (facts.overdue) nextAction = { icon: "alert", label: "Tarea vencida hace 3d", tone: "danger" };
  else if (facts.nextWaUnread) nextAction = { icon: "wa", label: "WhatsApp sin responder", tone: "wa" };
  else if (deal.stage === "proposal" && facts.tasks > 0) nextAction = { icon: "check", label: "Enviar propuesta", tone: "accent" };
  else if (deal.stage === "negotiation") nextAction = { icon: "phone", label: "Cerrar negociación", tone: "warn" };
  else if (deal.stage === "signing") nextAction = { icon: "check", label: "Firmar contrato", tone: "accent" };
  else if (deal.stage === "discovery") nextAction = { icon: "calendar", label: "Agendar discovery call", tone: "muted" };
  else if (deal.stage === "qualified") nextAction = { icon: "sparkles", label: "Calificar BANT", tone: "muted" };

  const channels = [
    { k: "wa", n: facts.wa, ico: "wa" as IconName },
    { k: "email", n: facts.emails, ico: "mail" as IconName },
    { k: "call", n: facts.calls, ico: "phone" as IconName },
  ].filter((c) => c.n > 0);
  const topChannel = channels.sort((a, b) => b.n - a.n)[0];

  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: deal.id });
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  const stop = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <div
      ref={setNodeRef}
      className={`deal-card deal-card--health-${healthLevel} ${isDragging ? "is-dragging" : ""}`.trim()}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => {
        if (isDragging) return;
        onClick();
      }}
    >
      <div className="deal-card__health" />

      <div className="deal-card__quick" onClick={stop} onPointerDown={stop}>
        <button type="button" title="Nota"><Icon name="note" size={12} /></button>
        <button type="button" title="Tarea"><Icon name="check" size={12} /></button>
        <button type="button" title="WhatsApp"><Icon name="wa" size={12} /></button>
        <button type="button" title="Email"><Icon name="mail" size={12} /></button>
      </div>

      <div className="deal-card__body">
        <span className={`deal-card__ws-pill deal-card__ws-pill--${dealWs}`}>
          <span className="deal-card__ws-dot" />
          {dealWsLabel}
        </span>

        <div className="deal-card__top">
          <span className="deal-card__id mono">{deal.id}</span>
          {!isClosed && (
            <span className={`deal-card__age ${ageClass}`} title={`${days} días en pipeline`}>
              <Icon name="clock" size={9} /> {days}d
            </span>
          )}
          {owner && (
            <span
              className="avatar--xs"
              style={{ background: `linear-gradient(135deg, ${owner.color}aa, ${owner.color})` }}
              title={owner.name}
            >
              {owner.name.split(" ").map((s) => s[0]).slice(0, 2).join("")}
            </span>
          )}
        </div>

        <div className="deal-card__name">{deal.name}</div>
        <div className="deal-card__co">
          <span className="deal-card__co-link" title={deal.company}>
            {deal.company}
          </span>
        </div>

        {deal.tags.length > 0 && (
          <div className="deal-card__tags">
            {deal.tags.slice(0, 4).map((t) => {
              const c = tagColor(t);
              return (
                <span
                  key={t}
                  className="deal-card__tag"
                  style={{ background: c.bg, color: c.fg, borderColor: c.border }}
                >
                  {t}
                </span>
              );
            })}
            {deal.tags.length > 4 && (
              <span className="deal-card__tag deal-card__tag--more">+{deal.tags.length - 4}</span>
            )}
          </div>
        )}

        <div className="deal-card__money">
          <span className="deal-card__value">{fmtMoney(deal.value, currency)}</span>
          {deal.isRecurring && (
            <span
              className={`deal-card__saas ${isHighSaaS(deal) ? "is-high" : ""}`.trim()}
              title={
                isHighSaaS(deal)
                  ? `Alto valor recurrente — ARR anual ${fmtMoney(deal.arr, currency)} supera el setup ${fmtMoney(deal.value, currency)}`
                  : deal.arr > 0
                    ? `SaaS recurrente · ARR anual ${fmtMoney(deal.arr, currency)}`
                    : "Contrato recurrente"
              }
            >
              SaaS{deal.arr > 0 ? ` · ${fmtMoney(deal.arr, currency)}/año` : ""}
            </span>
          )}
          <span className="deal-card__ai" title={`AI confidence: ${deal.ai}%`}>
            <span className="deal-card__ai-ring" style={{ "--p": deal.ai } as React.CSSProperties}>
              <span>{deal.ai}</span>
            </span>
          </span>
        </div>

        {!isClosed && (channels.length > 0 || facts.tasks > 0 || facts.files > 0) && (
          <div className="deal-card__activity">
            {topChannel && (
              <span
                className={`deal-card__chan deal-card__chan--${topChannel.k}`}
                title={`${topChannel.n} en este canal`}
              >
                <Icon name={topChannel.ico} size={10} /> {topChannel.n}
              </span>
            )}
            {facts.files > 0 && (
              <span className="deal-card__chip" title={`${facts.files} adjuntos`}>
                <Icon name="doc" size={10} /> {facts.files}
              </span>
            )}
            {facts.tasks > 0 && (
              <span
                className={`deal-card__chip ${facts.overdue ? "is-overdue" : ""}`.trim()}
                title={`${facts.tasks} tareas`}
              >
                <Icon name="check" size={10} /> {facts.tasks}
              </span>
            )}
            <span className="deal-card__pulse">
              <span className="deal-card__spark">
                {[3, 5, 2, 6, 4, 7, 5].map((h, i) => (
                  <span key={i} className="deal-card__spark-bar" style={{ height: `${h * 2 + 2}px` }} />
                ))}
              </span>
            </span>
          </div>
        )}

        {nextAction && !isClosed && (
          <div className={`deal-card__next deal-card__next--${nextAction.tone}`}>
            <Icon name={nextAction.icon} size={10} />
            <span>{nextAction.label}</span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   PIPELINE LIST VIEW — vista alternativa al Kanban
   Soporta dos sub-modos: "grouped" (agrupada por etapa) y "flat"
   (tabla plana ordenable). Edición inline de stage por dropdown.
   ============================================================ */
type SortKey = "value" | "saas" | "ai" | "age" | "stage" | "company";
type SortDir = "asc" | "desc";

function PipelineListView({
  stages,
  deals,
  owners,
  today,
  currency,
  filterDeal,
  optimisticPatch,
  listMode,
  onChangeListMode,
  onOpenDeal,
  onStageChange,
}: {
  stages: Stage[];
  deals: Deal[];
  owners: OwnersByKey;
  today: Date;
  currency: Currency;
  filterDeal: (d: Deal) => boolean;
  optimisticPatch: { id: string; stage: Stage["id"] } | null;
  listMode: "grouped" | "flat";
  onChangeListMode: (m: "grouped" | "flat") => void;
  onOpenDeal: (id: string) => void;
  onStageChange: (dealId: string, newStage: Stage["id"]) => void;
}) {
  // Aplicar optimistic patch + quick filter
  const patched = useMemo(() => {
    return deals
      .filter(filterDeal)
      .map((d) =>
        optimisticPatch && d.id === optimisticPatch.id
          ? { ...d, stage: optimisticPatch.stage }
          : d,
      );
  }, [deals, filterDeal, optimisticPatch]);

  // Stats por stage para los headers (incluye ARR anual de SaaS recurrentes)
  const stageStats = useMemo(() => {
    const m = new Map<Stage["id"], { count: number; total: number; arr: number }>();
    for (const s of stages) m.set(s.id, { count: 0, total: 0, arr: 0 });
    for (const d of patched) {
      const s = m.get(d.stage);
      if (s) {
        s.count++;
        s.total += d.value;
        if (d.isRecurring && d.arr > 0) s.arr += d.arr;
      }
    }
    return m;
  }, [patched, stages]);

  // ARR anual total (todos los SaaS recurrentes filtrados) para el header de la lista.
  const arrTotal = useMemo(
    () => patched.filter((d) => d.isRecurring && d.arr > 0).reduce((a, d) => a + d.arr, 0),
    [patched],
  );

  // ── State para sort (flat) y collapsed groups (grouped) ──
  const [sortKey, setSortKey] = useState<SortKey>("value");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [collapsed, setCollapsed] = useState<Set<Stage["id"]>>(new Set());

  const toggleGroup = (id: Stage["id"]) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const flatSorted = useMemo(() => {
    const sorted = [...patched];
    sorted.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "value") cmp = a.value - b.value;
      else if (sortKey === "saas") cmp = (a.isRecurring ? a.arr : 0) - (b.isRecurring ? b.arr : 0);
      else if (sortKey === "ai") cmp = a.ai - b.ai;
      else if (sortKey === "age")
        cmp =
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      else if (sortKey === "company") cmp = a.company.localeCompare(b.company);
      else if (sortKey === "stage") {
        const idxA = stages.findIndex((s) => s.id === a.stage);
        const idxB = stages.findIndex((s) => s.id === b.stage);
        cmp = idxA - idxB;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [patched, sortKey, sortDir, stages]);

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(k);
      setSortDir("desc");
    }
  };

  return (
    <div className="pipe-list">
      <div className="pipe-list__head">
        <div className="pipe-list__sub-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={listMode === "grouped"}
            className={`pipe-list__sub-tab ${listMode === "grouped" ? "is-active" : ""}`.trim()}
            onClick={() => onChangeListMode("grouped")}
          >
            Agrupada por etapa
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={listMode === "flat"}
            className={`pipe-list__sub-tab ${listMode === "flat" ? "is-active" : ""}`.trim()}
            onClick={() => onChangeListMode("flat")}
          >
            Tabla plana
          </button>
        </div>
        <div className="pipe-list__head-meta">
          {patched.length} tratos · {fmtMoney(patched.reduce((a, d) => a + d.value, 0), currency)} total
          {arrTotal > 0 && (
            <span className="pipe-list__head-arr" title="ARR anual de SaaS recurrentes">
              {" · "}ARR {fmtMoney(arrTotal, currency)}/año
            </span>
          )}
        </div>
      </div>

      <div className="pipe-list__body">
        {listMode === "grouped" ? (
          <div className="pipe-list__groups">
            {(() => {
              let runningIndex = 0;
              return stages.map((stage) => {
              const stat = stageStats.get(stage.id) ?? { count: 0, total: 0, arr: 0 };
              const rows = patched
                .filter((d) => d.stage === stage.id)
                .sort((a, b) => b.value - a.value);
              const startIndex = runningIndex;
              runningIndex += rows.length;
              const isCollapsed = collapsed.has(stage.id);
              return (
                <section
                  key={stage.id}
                  className="pipe-list-group"
                  style={{ ["--stage-color" as never]: stage.color }}
                >
                  <header
                    className="pipe-list-group__head"
                    onClick={() => toggleGroup(stage.id)}
                  >
                    <span
                      className="pipe-list-group__chev"
                      style={{ transform: isCollapsed ? "rotate(-90deg)" : undefined }}
                    >
                      <Icon name="chevron-down" size={12} />
                    </span>
                    <span
                      className="pipe-list-group__dot"
                      style={{ background: stage.color }}
                    />
                    <span className="pipe-list-group__name">{stage.label}</span>
                    <span className="pipe-list-group__count">{stat.count}</span>
                    <span className="pipe-list-group__prob mono">
                      {Math.round(stage.prob * 100)}%
                    </span>
                    {stat.arr > 0 && (
                      <span
                        className="pipe-list-group__arr mono"
                        title="ARR anual de SaaS recurrentes en esta etapa"
                      >
                        ARR {fmtMoney(stat.arr, currency)}/año
                      </span>
                    )}
                    <span className="pipe-list-group__total mono">
                      {fmtMoney(stat.total, currency)}
                    </span>
                  </header>
                  {!isCollapsed && rows.length > 0 && (
                    <ListTable
                      rows={rows}
                      startIndex={startIndex}
                      stages={stages}
                      owners={owners}
                      today={today}
                      currency={currency}
                      onOpenDeal={onOpenDeal}
                      onStageChange={onStageChange}
                      hideStageColumn
                    />
                  )}
                  {!isCollapsed && rows.length === 0 && (
                    <div className="pipe-list-group__empty">
                      Sin tratos en esta etapa.
                    </div>
                  )}
                </section>
              );
              });
            })()}
          </div>
        ) : (
          <ListTable
            rows={flatSorted}
            stages={stages}
            owners={owners}
            today={today}
            currency={currency}
            onOpenDeal={onOpenDeal}
            onStageChange={onStageChange}
            sortKey={sortKey}
            sortDir={sortDir}
            onSort={toggleSort}
          />
        )}
      </div>
    </div>
  );
}

function ListTable({
  rows,
  stages,
  owners,
  today,
  currency,
  onOpenDeal,
  onStageChange,
  hideStageColumn,
  startIndex = 0,
  sortKey,
  sortDir,
  onSort,
}: {
  rows: Deal[];
  stages: Stage[];
  owners: OwnersByKey;
  today: Date;
  currency: Currency;
  onOpenDeal: (id: string) => void;
  onStageChange: (dealId: string, newStage: Stage["id"]) => void;
  hideStageColumn?: boolean;
  startIndex?: number;
  sortKey?: SortKey;
  sortDir?: SortDir;
  onSort?: (k: SortKey) => void;
}) {
  const SortHead = ({
    k,
    children,
    align,
  }: {
    k: SortKey;
    children: React.ReactNode;
    align?: "right" | "center";
  }) => (
    <button
      type="button"
      className={`pipe-list-table__th ${
        align === "right"
          ? "pipe-list-table__th--right"
          : align === "center"
            ? "pipe-list-table__th--center"
            : ""
      } ${sortKey === k ? "is-sorted" : ""}`.replace(/\s+/g, " ").trim()}
      onClick={() => onSort?.(k)}
    >
      {children}
      {sortKey === k && (
        <Icon
          name="chevron-down"
          size={10}
          style={{
            marginLeft: 4,
            transform: sortDir === "asc" ? "rotate(180deg)" : undefined,
          }}
        />
      )}
    </button>
  );

  return (
    <div className="pipe-list-table">
      <div
        className={`pipe-list-table__row pipe-list-table__row--head ${hideStageColumn ? "no-stage-col" : ""}`.trim()}
      >
        <span className="pipe-list-table__th pipe-list-table__th--num">#</span>
        {onSort ? <SortHead k="company">Empresa</SortHead> : <span className="pipe-list-table__th">Empresa</span>}
        <span className="pipe-list-table__th">Trato</span>
        <span className="pipe-list-table__th pipe-list-table__th--center" title="Estratégico">★</span>
        {!hideStageColumn && (
          onSort ? <SortHead k="stage">Etapa</SortHead> : <span className="pipe-list-table__th">Etapa</span>
        )}
        <span className="pipe-list-table__th pipe-list-table__th--center">Owner</span>
        {onSort ? <SortHead k="value" align="right">Valor</SortHead> : <span className="pipe-list-table__th pipe-list-table__th--right">Valor</span>}
        {onSort ? <SortHead k="saas" align="right">SaaS/año</SortHead> : <span className="pipe-list-table__th pipe-list-table__th--right">SaaS/año</span>}
        {onSort ? <SortHead k="ai" align="right">AI</SortHead> : <span className="pipe-list-table__th pipe-list-table__th--right">AI</span>}
        {onSort ? <SortHead k="age" align="right">Edad</SortHead> : <span className="pipe-list-table__th pipe-list-table__th--right">Edad</span>}
      </div>
      {rows.map((d, i) => (
        <ListRow
          key={d.id}
          deal={d}
          index={startIndex + i + 1}
          stages={stages}
          owners={owners}
          today={today}
          currency={currency}
          hideStageColumn={hideStageColumn}
          onOpenDeal={onOpenDeal}
          onStageChange={onStageChange}
        />
      ))}
    </div>
  );
}

function ListRow({
  deal,
  index,
  stages,
  owners,
  today,
  currency,
  hideStageColumn,
  onOpenDeal,
  onStageChange,
}: {
  deal: Deal;
  index: number;
  stages: Stage[];
  owners: OwnersByKey;
  today: Date;
  currency: Currency;
  hideStageColumn?: boolean;
  onOpenDeal: (id: string) => void;
  onStageChange: (dealId: string, newStage: Stage["id"]) => void;
}) {
  const stage = stages.find((s) => s.id === deal.stage);
  const owner = owners[deal.owner];
  // daysBetween(a, b) = B - A. Para "edad en días" queremos today - createdAt
  // → llamamos daysBetween(createdAt, today) y absoluto por si createdAt es futuro.
  const days = Math.abs(daysBetween(new Date(deal.createdAt), today));

  return (
    <div
      className={`pipe-list-table__row ${hideStageColumn ? "no-stage-col" : ""} ${isHighSaaS(deal) ? "is-high-saas" : ""} ${deal.stage === "won" ? "is-won" : deal.stage === "signing" ? "is-firma" : ""}`.trim()}
      title={
        isHighSaaS(deal)
          ? `Alto valor recurrente — ARR anual ${fmtMoney(deal.arr, currency)} supera el setup ${fmtMoney(deal.value, currency)}`
          : undefined
      }
      onClick={() => onOpenDeal(deal.id)}
    >
      <span className="pipe-list-table__cell pipe-list-table__cell--num">{index}</span>
      <span className="pipe-list-table__cell pipe-list-table__cell--company">
        <span className="pipe-list-table__company">{deal.company}</span>
        <span className="pipe-list-table__id mono">{deal.id}</span>
      </span>
      <span className="pipe-list-table__cell pipe-list-table__cell--name">
        <span className="pipe-list-table__name-line">
          {deal.name}
        </span>
        {deal.tags.length > 0 && (
          <span className="pipe-list-table__tags">
            {deal.tags.slice(0, 4).map((t) => {
              const c = tagColor(t);
              return (
                <span
                  key={t}
                  className="pipe-list-table__tag"
                  style={{ background: c.bg, color: c.fg, borderColor: c.border }}
                >
                  {t}
                </span>
              );
            })}
            {deal.tags.length > 4 && (
              <span className="pipe-list-table__tag pipe-list-table__tag--more">
                +{deal.tags.length - 4}
              </span>
            )}
          </span>
        )}
      </span>
      <span className="pipe-list-table__cell pipe-list-table__cell--center" title={deal.strategic ? "Estratégico" : "No estratégico"}>
        {deal.strategic ? <span className="pipe-strat">★</span> : <span style={{ color: "var(--fg-4)" }}>—</span>}
      </span>
      {!hideStageColumn && (
        <span
          className="pipe-list-table__cell"
          onClick={(e) => e.stopPropagation()}
        >
          <StageSelect
            current={deal.stage}
            stages={stages}
            onChange={(newStage) => onStageChange(deal.id, newStage)}
          />
        </span>
      )}
      <span className="pipe-list-table__cell pipe-list-table__cell--center">
        <span
          className="pipe-list-table__avatar"
          style={{
            background: `linear-gradient(135deg, ${owner?.color ?? "#666"}aa, ${owner?.color ?? "#666"})`,
          }}
          title={owner?.name ?? deal.owner}
        >
          {owner?.name?.split(" ").map((s) => s[0]).slice(0, 2).join("") ?? deal.owner}
        </span>
      </span>
      <span className="pipe-list-table__cell pipe-list-table__cell--right mono pipe-list-table__value">
        {fmtMoney(deal.value, currency)}
      </span>
      <span className="pipe-list-table__cell pipe-list-table__cell--right mono">
        {deal.isRecurring && deal.arr > 0 ? (
          <span
            className={`pipe-list-table__arr ${isHighSaaS(deal) ? "is-high" : ""}`.trim()}
            title={
              isHighSaaS(deal)
                ? `SaaS anual ${fmtMoney(deal.arr, currency)} — supera el setup ${fmtMoney(deal.value, currency)}`
                : `SaaS anual ${fmtMoney(deal.arr, currency)}`
            }
          >
            {fmtMoney(deal.arr, currency)}
          </span>
        ) : (
          <span style={{ color: "var(--fg-4)" }}>—</span>
        )}
      </span>
      <span className="pipe-list-table__cell pipe-list-table__cell--right">
        <span
          className={`pipe-list-table__ai ${deal.ai >= 70 ? "is-hot" : deal.ai >= 40 ? "is-warm" : "is-cold"}`.trim()}
        >
          {deal.ai}%
        </span>
      </span>
      <span className="pipe-list-table__cell pipe-list-table__cell--right mono pipe-list-table__age">
        {days}d
      </span>
    </div>
  );
}

/* ============================================================
   StageSelect — chip clickeable que abre dropdown de etapas
   ============================================================ */
function StageSelect({
  current,
  stages,
  onChange,
}: {
  current: Stage["id"];
  stages: Stage[];
  onChange: (id: Stage["id"]) => void;
}) {
  const [open, setOpen] = useState(false);
  const stage = stages.find((s) => s.id === current);
  const color = stage?.color ?? "#94a3b8";

  return (
    <span className="stage-select">
      <button
        type="button"
        className="stage-select__chip"
        style={{
          background: color + "1f",
          color,
          borderColor: color + "55",
        }}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
      >
        <span className="stage-select__dot" style={{ background: color }} />
        {stage?.label ?? current}
        <Icon name="chevron-down" size={10} />
      </button>
      {open && (
        <div className="stage-select__pop" onMouseLeave={() => setOpen(false)}>
          {stages.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`stage-select__opt ${s.id === current ? "is-current" : ""}`.trim()}
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
                if (s.id !== current) onChange(s.id);
              }}
            >
              <span className="stage-select__dot" style={{ background: s.color }} />
              <span style={{ flex: 1 }}>{s.label}</span>
              <span className="mono stage-select__prob">{Math.round(s.prob * 100)}%</span>
              {s.id === current && <Icon name="check" size={11} />}
            </button>
          ))}
        </div>
      )}
    </span>
  );
}

/* ============================================================
   SetupByStageChart — valor de SETUP por etapa (área tipo curva)
   Va entre los filtros y el kanban. Suma deal.value por etapa.
   ============================================================ */
function SetupByStageChart({
  stages,
  deals,
  currency,
}: {
  stages: Stage[];
  deals: Deal[];
  currency: Currency;
}) {
  const data = useMemo(
    () =>
      stages.map((s) => ({
        stage: s,
        setup: deals.filter((d) => d.stage === s.id).reduce((a, d) => a + d.value, 0),
      })),
    [stages, deals],
  );
  const total = data.reduce((a, d) => a + d.setup, 0);
  const max = Math.max(1, ...data.map((d) => d.setup));
  const n = Math.max(1, data.length);
  const H = 70;
  const xOf = (i: number) => ((i + 0.5) / n) * 100;
  const yOf = (v: number) => H - (v / max) * H;

  const pts = data.map((d, i) => [xOf(i), yOf(d.setup)] as const);
  // Color por segmento según la etapa DESTINO: won → verde, lost → rojo, resto → azul.
  const segColor = (s: Stage) =>
    s.id === "won" ? "#16a34a" : s.id === "lost" ? "#dc2626" : "var(--info)";
  const segments = data.slice(1).map((d, idx) => {
    const i = idx + 1;
    const [x1, y1] = pts[i - 1];
    const [x2, y2] = pts[i];
    const cx = (x1 + x2) / 2;
    return {
      key: d.stage.id,
      color: segColor(d.stage),
      lineD: `M${x1},${y1} C${cx},${y1} ${cx},${y2} ${x2},${y2}`,
      areaD: `M${x1},${H} L${x1},${y1} C${cx},${y1} ${cx},${y2} ${x2},${y2} L${x2},${H} Z`,
    };
  });

  return (
    <div className="setup-stage-chart">
      <div className="setup-stage-chart__head">
        <Icon name="dollar" size={11} style={{ color: "var(--info)" }} />
        Valor SETUP por etapa · {fmtMoney(total, currency)} total
        <span className="setup-stage-chart__max mono">{fmtMoney(max, currency)}</span>
      </div>
      <div className="setup-stage-chart__plot">
        <svg viewBox={`0 0 100 ${H}`} preserveAspectRatio="none" className="setup-stage-chart__svg">
          {segments.map((s, i) => (
            <g key={i}>
              <path d={s.areaD} fill={s.color} fillOpacity={0.12} />
              <path d={s.lineD} fill="none" stroke={s.color} strokeWidth="1.8" vectorEffect="non-scaling-stroke" strokeLinecap="round" />
            </g>
          ))}
        </svg>
        {data.map((d, i) => (
          <span
            key={d.stage.id}
            className="setup-stage-chart__dot"
            style={{ left: `${xOf(i)}%`, top: `${(yOf(d.setup) / H) * 100}%`, background: d.stage.id === "lost" ? "#dc2626" : d.stage.id === "won" ? "#16a34a" : d.stage.color }}
            title={`${d.stage.label}: ${fmtMoney(d.setup, currency)}`}
          />
        ))}
      </div>
      <div className="setup-stage-chart__axis">
        {data.map((d) => (
          <span key={d.stage.id} className="setup-stage-chart__axis-lbl">
            <span className="setup-stage-chart__axis-name">
              <span className="dot" style={{ background: d.stage.color }} />
              {d.stage.label}
            </span>
            <b className="mono">{fmtMoney(d.setup, currency)}</b>
          </span>
        ))}
      </div>
    </div>
  );
}
