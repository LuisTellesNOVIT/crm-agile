import { useMemo, useState } from "react";
import { useFetcher, useRevalidator } from "react-router";
import { Icon } from "../shell/Icon";
import { Chip } from "../ui/Chip";
import { Tabs } from "../ui/Tabs";
import { Card } from "../ui/Card";
import { useActiveWorkspace, useAppStore, useAllCompanies, useCurrentUser } from "../../lib/store";
import { fmtMoneyFull, daysFromToday } from "../../lib/format";
import { templates } from "../../lib/mock/rich";
import type { ChannelKind, CompanyLite, Deal, OwnersByKey, Stage } from "../../lib/types";

const TABS = [
  { id: "detail", label: "Detalle" },
  { id: "files", label: "Archivos" },
  { id: "compose", label: "Componer" },
];

export function DealDetail({ dealId, onClose }: { dealId: string; onClose: () => void }) {
  const ws = useActiveWorkspace();
  const currency = useAppStore((s) => s.currency);
  const openAI = useAppStore((s) => s.openAI);
  const [tab, setTab] = useState("detail");
  const [editModalOpen, setEditModalOpen] = useState(false);
  const deleteFetcher = useFetcher<{ ok?: boolean; error?: string }>();
  const deleting = deleteFetcher.state !== "idle";

  const deal = ws.deals.find((d) => d.id === dealId);

  // Al confirmarse el delete, cerramos el detalle (vuelve al Pipeline).
  const deleteData = deleteFetcher.data;
  if (deleteData?.ok && deleteFetcher.state === "idle") {
    // El loader ya revalidó y el deal desapareció; cerramos el overlay.
    setTimeout(onClose, 50);
  }

  const handleDelete = () => {
    if (!deal) return;
    const ok = window.confirm(
      `¿Eliminar el trato "${deal.name}" (${deal.id})?\n\nEsta acción NO se puede deshacer. Se borran también sus actividades, archivos y conversaciones. La empresa y los contactos se mantienen.`,
    );
    if (!ok) return;
    deleteFetcher.submit(
      { id: deal.id },
      { method: "POST", action: "/api/deal-delete" },
    );
  };

  if (!deal) {
    return (
      <div className="deal-detail">
        <header className="deal-detail__head">
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            <Icon name="chevron-right" size={14} style={{ transform: "rotate(180deg)" }} /> Volver
          </button>
        </header>
        <div className="empty-hint" style={{ padding: 32 }}>
          Deal {dealId} no encontrado en este workspace.
        </div>
      </div>
    );
  }

  const stage = ws.stages.find((s) => s.id === deal.stage);
  const owner = ws.owners[deal.owner];

  return (
    <div className="deal-detail">
      <header className="deal-detail__head">
        <button type="button" className="btn btn--ghost" onClick={onClose}>
          <Icon name="chevron-right" size={14} style={{ transform: "rotate(180deg)" }} /> Volver
        </button>
        <div className="deal-detail__title">
          <div style={{ minWidth: 0 }}>
            <span className="mono" style={{ color: "var(--fg-3)", fontSize: "var(--fs-xs)" }}>{deal.id}</span>
            <InlineText
              dealId={deal.id}
              fieldName="name"
              value={deal.name}
              ariaLabel="Nombre del trato"
              renderDisplay={(v) => (
                <h1 style={{ fontSize: "var(--fs-xl)", fontWeight: 600, letterSpacing: "-0.01em" }}>{v}</h1>
              )}
            />
            <div style={{ color: "var(--fg-3)", fontSize: "var(--fs-sm)" }}>{deal.company}</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" className="topbar__ai" onClick={() => openAI(`Estás viendo el trato ${deal.id} — ${deal.name}`)}>
            <Icon name="sparkles" size={13} /> Pedir a la IA
          </button>
          <button type="button" className="btn btn--primary" onClick={() => setEditModalOpen(true)}>
            <Icon name="settings" size={13} /> Editar
          </button>
          <button
            type="button"
            className="btn deal-detail__delete"
            onClick={handleDelete}
            disabled={deleting}
            title="Eliminar trato"
          >
            <Icon name="x" size={13} /> {deleting ? "Eliminando…" : "Eliminar"}
          </button>
        </div>
      </header>

      {deleteData?.error && (
        <div className="deal-detail__delete-error" role="alert">
          ⚠ {deleteData.error}
        </div>
      )}

      <Tabs items={TABS} active={tab} onChange={setTab} />

      <div className="deal-detail__body">
        {tab === "detail" && (
          <DetailPane
            deal={deal}
            stage={stage}
            owner={owner}
            currency={currency}
            today={ws.today}
            stages={ws.stages}
            owners={ws.owners}
            companies={ws.companies}
          />
        )}
        {tab === "files" && <FilesPane deal={deal} />}
        {tab === "compose" && <ComposePane deal={deal} />}
      </div>

      {editModalOpen && (
        <DealEditModal
          deal={deal}
          stages={ws.stages}
          owners={ws.owners}
          companies={ws.companies}
          onClose={() => setEditModalOpen(false)}
        />
      )}
    </div>
  );
}

function DetailPane({
  deal,
  stage,
  owner,
  currency,
  today,
  stages,
  owners,
  companies,
}: {
  deal: Deal;
  stage: Stage | undefined;
  owner: { id?: string; name: string; role: string; color: string } | undefined;
  currency: ReturnType<typeof useAppStore.getState>["currency"];
  today: Date;
  stages: Stage[];
  owners: OwnersByKey;
  companies: CompanyLite[];
}) {
  const fetcher = useFetcher();
  // Mientras el fetcher está en vuelo, reflejamos el stage optimista localmente.
  const pendingStage = fetcher.formData
    ? (String(fetcher.formData.get("stage")) as Stage["id"])
    : null;
  const visibleStage = pendingStage ?? deal.stage;
  const daysToClose = daysFromToday(deal.estimatedCloseAt, today);
  const summary = useMemo(() => {
    const trend = deal.ai >= 70 ? "saludable" : deal.ai >= 50 ? "en riesgo" : "estancado";
    return `Trato ${trend}. AI Score ${deal.ai}. Cierre estimado en ${daysToClose} días con probabilidad ${Math.round(deal.probability * 100)}%. Owner: ${owner?.name ?? deal.owner}. Valor ${fmtMoneyFull(deal.value, currency)}.`;
  }, [deal, owner, daysToClose, currency]);

  const nextActions = useMemo(() => {
    const out: string[] = [];
    if (deal.ai < 55) out.push("Re-engagement urgente: el AI score cayó por debajo de 55.");
    if (deal.lastActivity >= 4) out.push("Sin actividad hace " + deal.lastActivity + " días — programar follow-up.");
    if (deal.stage === "negotiation" && daysToClose <= 14) out.push("Cierre próximo en " + daysToClose + " días — confirmar términos y firmar.");
    if (deal.stage === "proposal") out.push("Validar próximo paso post-propuesta (signing or technical review).");
    if (out.length === 0) out.push("Mantener cadencia actual de follow-up.");
    return out;
  }, [deal, daysToClose]);

  // Owners + Companies como opciones para los selects inline
  const ownerOptions = Object.entries(owners)
    .map(([initials, o]) => ({ value: o.id ?? initials, label: o.name, sublabel: o.role }))
    .filter((o) => o.value);

  return (
    <div className="deal-detail__grid">
      <Card>
        <Card.Header label="Resumen IA" />
        <Card.Body>
          <p style={{ fontSize: "var(--fs-sm)", lineHeight: 1.5, color: "var(--fg)" }}>
            {summary}
          </p>
        </Card.Body>
      </Card>

      <Card>
        <Card.Header label="Campos" sub="click para editar inline" />
        <Card.Body>
          <FieldRow k="Stage" v={
            <select
              className="deal-detail__select"
              value={visibleStage}
              disabled={fetcher.state !== "idle"}
              onChange={(e) =>
                fetcher.submit(
                  { id: deal.id, stage: e.target.value },
                  { method: "POST", action: "/api/deal-update" },
                )
              }
            >
              {stages.map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
          } />
          <FieldRow k="Valor" v={
            <InlineNumber
              dealId={deal.id}
              fieldName="value"
              value={deal.value}
              ariaLabel="Valor del trato"
              renderDisplay={(v) => <span className="mono">{fmtMoneyFull(v, currency)}</span>}
            />
          } />
          <FieldRow k="Probability" v={
            <InlineNumber
              dealId={deal.id}
              fieldName="probability"
              value={Math.round(deal.probability * 100)}
              ariaLabel="Probabilidad %"
              minValue={0}
              maxValue={100}
              suffix="%"
              transformOnSave={(v) => v / 100}
              renderDisplay={(_v, raw) => (
                <span className="mono">{raw}%</span>
              )}
            />
          } />
          <FieldRow k="AI Score" v={
            <InlineNumber
              dealId={deal.id}
              fieldName="ai"
              value={deal.ai}
              ariaLabel="AI Score"
              minValue={0}
              maxValue={100}
              renderDisplay={(v) => (
                <span className="mono" style={{ color: v >= 70 ? "var(--success)" : v >= 50 ? "var(--warning)" : "var(--danger)", fontWeight: 600 }}>
                  {v}
                </span>
              )}
            />
          } />
          <FieldRow k="Owner" v={
            ownerOptions.length > 0 ? (
              <InlineSelect
                dealId={deal.id}
                fieldName="ownerId"
                value={deal.ownerId ?? owner?.id ?? ""}
                options={ownerOptions}
                ariaLabel="Owner del trato"
                renderDisplay={() => (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <span style={{
                      width: 18, height: 18, borderRadius: 9,
                      background: owner?.color ?? "var(--fg-3)",
                      color: "#fff", display: "inline-grid", placeItems: "center",
                      fontSize: 9, fontFamily: "var(--font-mono)", fontWeight: 600,
                    }}>{deal.owner}</span>
                    <span>{owner?.name ?? deal.owner}</span>
                  </span>
                )}
              />
            ) : (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <span style={{
                  width: 18, height: 18, borderRadius: 9,
                  background: owner?.color ?? "var(--fg-3)",
                  color: "#fff", display: "inline-grid", placeItems: "center",
                  fontSize: 9, fontFamily: "var(--font-mono)", fontWeight: 600,
                }}>{deal.owner}</span>
                <span>{owner?.name ?? deal.owner}</span>
              </span>
            )
          } />
          <FieldRow k="Empresa" v={
            companies.length > 0 ? (
              <InlineSelect
                dealId={deal.id}
                fieldName="companyId"
                value={deal.companyId ?? ""}
                options={companies.map((c) => ({ value: c.id, label: c.name, sublabel: c.industry ?? undefined }))}
                ariaLabel="Empresa"
                searchable
                renderDisplay={() => <span>{deal.company}</span>}
              />
            ) : (
              <span>{deal.company}</span>
            )
          } />
          <FieldRow k="Creado" v={<span className="mono">{new Date(deal.createdAt).toLocaleDateString("es")}</span>} />
          <FieldRow k="Cierre estimado" v={
            <InlineDate
              dealId={deal.id}
              fieldName="estimatedCloseAt"
              value={deal.estimatedCloseAt}
              ariaLabel="Fecha estimada de cierre"
              renderDisplay={(v) => (
                <span className="mono">
                  {new Date(v).toLocaleDateString("es")}{" "}
                  <span style={{ color: "var(--fg-3)" }}>· {daysToClose}d</span>
                </span>
              )}
            />
          } />
          <FieldRow k="Recurrente" v={deal.isRecurring ? <Chip tone="info">Sí · {fmtMoneyFull(deal.arr, currency)} ARR</Chip> : <span style={{ color: "var(--fg-3)" }}>No</span>} />
          <FieldRow k="Source" v={
            <span style={{ color: deal.source ? "var(--fg)" : "var(--fg-4)" }} className="mono">
              {deal.source || "—"}
            </span>
          } />
          <FieldRow k="Contactos" v={<span className="mono">{deal.contacts}</span>} />
        </Card.Body>
      </Card>

      <Card>
        <Card.Header label="Next actions" sub={`${nextActions.length}`} />
        <Card.Body>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
            {nextActions.map((a, i) => (
              <li key={i} style={{ fontSize: "var(--fs-sm)", color: "var(--fg)", padding: "8px 10px", background: "var(--bg-2)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-2)" }}>
                {a}
              </li>
            ))}
          </ul>
        </Card.Body>
      </Card>

      <Card>
        <Card.Header label="Timeline · últimos eventos" />
        <Card.Body>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 6 }}>
            <li className="tl-event" style={{ background: "var(--bg)", borderColor: "var(--border-2)" }}>
              <span className="tl-event__type tl-event__type--ai">ai</span>
              <div><div className="tl-event__text">AI Score recalculado a {deal.ai}.</div><div className="tl-event__meta">AI · hoy</div></div>
            </li>
            <li className="tl-event" style={{ background: "var(--bg)", borderColor: "var(--border-2)" }}>
              <span className="tl-event__type tl-event__type--deal">deal</span>
              <div><div className="tl-event__text">Stage actual: <b>{stage?.label}</b>.</div><div className="tl-event__meta">{owner?.name ?? deal.owner} · hace {deal.lastActivity}d</div></div>
            </li>
            <li className="tl-event" style={{ background: "var(--bg)", borderColor: "var(--border-2)" }}>
              <span className="tl-event__type tl-event__type--note">note</span>
              <div><div className="tl-event__text">Trato creado · valor inicial {fmtMoneyFull(deal.value, currency)}.</div><div className="tl-event__meta">{new Date(deal.createdAt).toLocaleDateString("es")}</div></div>
            </li>
          </ul>
        </Card.Body>
      </Card>
    </div>
  );
}

function FieldRow({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="form-row">
      <div className="form-row__k">{k}</div>
      <div className="form-row__v">{v}</div>
    </div>
  );
}

/* ============================================================
   Inline editors — text / number / date / select
   ============================================================ */
function useInlineSubmit() {
  const fetcher = useFetcher();
  const submit = (dealId: string, fieldName: string, value: string) => {
    fetcher.submit(
      { id: dealId, [fieldName]: value },
      { method: "POST", action: "/api/deal-update" },
    );
  };
  return { submit, busy: fetcher.state !== "idle", error: (fetcher.data as { error?: string } | undefined)?.error };
}

function InlineText({
  dealId,
  fieldName,
  value,
  ariaLabel,
  renderDisplay,
}: {
  dealId: string;
  fieldName: string;
  value: string;
  ariaLabel?: string;
  renderDisplay: (v: string) => React.ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const { submit, busy, error } = useInlineSubmit();

  if (!editing) {
    return (
      <button
        type="button"
        className="inline-edit"
        onClick={() => {
          setDraft(value);
          setEditing(true);
        }}
        title="Click para editar"
        aria-label={ariaLabel}
      >
        {renderDisplay(value)}
      </button>
    );
  }

  const save = () => {
    setEditing(false);
    const v = draft.trim();
    if (v && v !== value) submit(dealId, fieldName, v);
  };

  return (
    <span className="inline-edit__form">
      <input
        type="text"
        className="inline-edit__input"
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") save();
          if (e.key === "Escape") {
            setDraft(value);
            setEditing(false);
          }
        }}
        disabled={busy}
        aria-label={ariaLabel}
      />
      {error && <span className="inline-edit__error">{error}</span>}
    </span>
  );
}

function InlineNumber({
  dealId,
  fieldName,
  value,
  ariaLabel,
  minValue,
  maxValue,
  suffix,
  transformOnSave,
  renderDisplay,
}: {
  dealId: string;
  fieldName: string;
  value: number;
  ariaLabel?: string;
  minValue?: number;
  maxValue?: number;
  suffix?: string;
  transformOnSave?: (v: number) => number;
  renderDisplay: (v: number, raw: number) => React.ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const { submit, busy, error } = useInlineSubmit();

  if (!editing) {
    return (
      <button
        type="button"
        className="inline-edit"
        onClick={() => {
          setDraft(String(value));
          setEditing(true);
        }}
        title="Click para editar"
        aria-label={ariaLabel}
      >
        {renderDisplay(value, value)}
      </button>
    );
  }

  const save = () => {
    const n = parseFloat(draft);
    setEditing(false);
    if (!Number.isFinite(n)) return;
    if (minValue != null && n < minValue) return;
    if (maxValue != null && n > maxValue) return;
    const toSave = transformOnSave ? transformOnSave(n) : n;
    if (toSave !== (transformOnSave ? transformOnSave(value) : value)) {
      submit(dealId, fieldName, String(toSave));
    }
  };

  return (
    <span className="inline-edit__form">
      <input
        type="number"
        className="inline-edit__input"
        autoFocus
        value={draft}
        min={minValue}
        max={maxValue}
        step="any"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") save();
          if (e.key === "Escape") {
            setDraft(String(value));
            setEditing(false);
          }
        }}
        disabled={busy}
        aria-label={ariaLabel}
      />
      {suffix && <span className="inline-edit__suffix">{suffix}</span>}
      {error && <span className="inline-edit__error">{error}</span>}
    </span>
  );
}

function InlineDate({
  dealId,
  fieldName,
  value,
  ariaLabel,
  renderDisplay,
}: {
  dealId: string;
  fieldName: string;
  value: string;
  ariaLabel?: string;
  renderDisplay: (v: string) => React.ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  const initialISO = value ? new Date(value).toISOString().slice(0, 10) : "";
  const [draft, setDraft] = useState(initialISO);
  const { submit, busy, error } = useInlineSubmit();

  if (!editing) {
    return (
      <button
        type="button"
        className="inline-edit"
        onClick={() => {
          setDraft(initialISO);
          setEditing(true);
        }}
        title="Click para editar"
        aria-label={ariaLabel}
      >
        {renderDisplay(value)}
      </button>
    );
  }

  const save = () => {
    setEditing(false);
    if (!draft || draft === initialISO) return;
    submit(dealId, fieldName, draft);
  };

  return (
    <span className="inline-edit__form">
      <input
        type="date"
        className="inline-edit__input"
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") save();
          if (e.key === "Escape") {
            setDraft(initialISO);
            setEditing(false);
          }
        }}
        disabled={busy}
        aria-label={ariaLabel}
      />
      {error && <span className="inline-edit__error">{error}</span>}
    </span>
  );
}

function InlineSelect({
  dealId,
  fieldName,
  value,
  options,
  ariaLabel,
  searchable,
  renderDisplay,
}: {
  dealId: string;
  fieldName: string;
  value: string;
  options: Array<{ value: string; label: string; sublabel?: string }>;
  ariaLabel?: string;
  searchable?: boolean;
  renderDisplay: (v: string) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const { submit, busy } = useInlineSubmit();

  const filtered = q
    ? options.filter(
        (o) =>
          o.label.toLowerCase().includes(q.toLowerCase()) ||
          (o.sublabel ?? "").toLowerCase().includes(q.toLowerCase()),
      )
    : options;

  return (
    <span className="inline-edit__select-wrap">
      <button
        type="button"
        className="inline-edit"
        onClick={() => setOpen((o) => !o)}
        disabled={busy}
        title="Click para editar"
        aria-label={ariaLabel}
      >
        {renderDisplay(value)}
        <Icon name="chevron-down" size={10} style={{ marginLeft: 4, color: "var(--fg-3)" }} />
      </button>
      {open && (
        <div className="inline-edit__pop" onMouseLeave={() => setOpen(false)}>
          {searchable && (
            <div className="inline-edit__pop-search">
              <Icon name="search" size={11} />
              <input
                autoFocus
                type="search"
                placeholder="Buscar…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
          )}
          <div className="inline-edit__pop-list">
            {filtered.length === 0 && (
              <div className="inline-edit__pop-empty">Sin coincidencias</div>
            )}
            {filtered.map((o) => (
              <button
                key={o.value}
                type="button"
                className={`inline-edit__pop-opt ${o.value === value ? "is-current" : ""}`.trim()}
                onClick={() => {
                  setOpen(false);
                  setQ("");
                  if (o.value && o.value !== value) submit(dealId, fieldName, o.value);
                }}
              >
                <div>
                  <div>{o.label}</div>
                  {o.sublabel && <small>{o.sublabel}</small>}
                </div>
                {o.value === value && <Icon name="check" size={11} />}
              </button>
            ))}
          </div>
        </div>
      )}
    </span>
  );
}

/* ============================================================
   DealEditModal — modal para campos avanzados
   ============================================================ */
const SUNAT_ESTADO = ["ACTIVO", "SUSPENDIDO TEMPORAL", "BAJA DE OFICIO", "BAJA DEFINITIVA"];
const SUNAT_CONDICION = ["HABIDO", "NO HALLADO", "NO HABIDO"];

function DealEditModal({
  deal,
  stages,
  owners,
  onClose,
}: {
  deal: Deal;
  stages: Stage[];
  owners: OwnersByKey;
  companies: CompanyLite[]; // (ya no se usa; el modal lee todas via useAllCompanies)
  onClose: () => void;
}) {
  const allCompanies = useAllCompanies();
  const currentUser = useCurrentUser();
  const revalidator = useRevalidator();
  const isAdmin = currentUser?.permissions === "admin";

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Estado del trato ──
  const [name, setName] = useState(deal.name);
  const [value, setValue] = useState(String(deal.value));
  const [closeAt, setCloseAt] = useState(new Date(deal.estimatedCloseAt).toISOString().slice(0, 10));
  const [stage, setStage] = useState(deal.stage);
  const [probPct, setProbPct] = useState(Math.round(deal.probability * 100));
  const [ownerId, setOwnerId] = useState(deal.ownerId ?? "");
  const [companyId, setCompanyId] = useState(deal.companyId ?? "");
  const [isRecurring, setIsRecurring] = useState(deal.isRecurring);
  const [arr, setArr] = useState(String(deal.arr || 0));
  const [source, setSource] = useState(deal.source ?? "");
  const [ai, setAi] = useState(String(deal.ai));

  // ── Grupo (workspace) — admin puede mover ──
  const currentCompany = allCompanies.find((c) => c.id === (deal.companyId ?? ""));
  const initialGroup = (currentCompany?._ws ?? deal._ws ?? "novit") as "novit" | "sharky";
  const [group, setGroup] = useState<"novit" | "sharky">(initialGroup);

  // Empresas filtradas por grupo seleccionado
  const companiesInGroup = allCompanies.filter((c) => (c._ws ?? "novit") === group);
  // Owners del grupo seleccionado
  const ownerOptions = Object.entries(owners)
    .map(([initials, o]) => ({ id: o.id ?? "", label: o.name + " · " + initials }))
    .filter((o) => o.id);

  // ── Estado de la empresa (SUNAT) — refleja la empresa seleccionada ──
  const selectedCompany = allCompanies.find((c) => c.id === companyId);
  const [coRuc, setCoRuc] = useState(selectedCompany?.ruc ?? "");
  const [coRazon, setCoRazon] = useState(selectedCompany?.razonSocial ?? "");
  const [coComercial, setCoComercial] = useState(selectedCompany?.nombreComercial ?? "");
  const [coEstado, setCoEstado] = useState(selectedCompany?.estado ?? "");
  const [coCondicion, setCoCondicion] = useState(selectedCompany?.condicion ?? "");
  const [coTipo, setCoTipo] = useState(selectedCompany?.tipoContribuyente ?? "");
  const [coIndustry, setCoIndustry] = useState(selectedCompany?.industry ?? "");
  const [coDireccion, setCoDireccion] = useState(selectedCompany?.domicilioFiscal ?? "");
  const [coDistrito, setCoDistrito] = useState(selectedCompany?.distrito ?? "");
  const [coProvincia, setCoProvincia] = useState(selectedCompany?.provincia ?? "");
  const [coDepartamento, setCoDepartamento] = useState(selectedCompany?.departamento ?? "");
  const [coUbigeo, setCoUbigeo] = useState(selectedCompany?.ubigeo ?? "");
  const [coRepLegal, setCoRepLegal] = useState(selectedCompany?.representanteLegal ?? "");
  const [coRepDni, setCoRepDni] = useState(selectedCompany?.representanteDni ?? "");
  const [coRepCargo, setCoRepCargo] = useState(selectedCompany?.representanteCargo ?? "");
  const [coTelefono, setCoTelefono] = useState(selectedCompany?.telefono ?? "");
  const [coEmail, setCoEmail] = useState(selectedCompany?.email ?? "");

  // Al cambiar de empresa seleccionada, recargar los campos SUNAT de esa empresa
  const onCompanyChange = (id: string) => {
    setCompanyId(id);
    const c = allCompanies.find((x) => x.id === id);
    setCoRuc(c?.ruc ?? "");
    setCoRazon(c?.razonSocial ?? "");
    setCoComercial(c?.nombreComercial ?? "");
    setCoEstado(c?.estado ?? "");
    setCoCondicion(c?.condicion ?? "");
    setCoTipo(c?.tipoContribuyente ?? "");
    setCoIndustry(c?.industry ?? "");
    setCoDireccion(c?.domicilioFiscal ?? "");
    setCoDistrito(c?.distrito ?? "");
    setCoProvincia(c?.provincia ?? "");
    setCoDepartamento(c?.departamento ?? "");
    setCoUbigeo(c?.ubigeo ?? "");
    setCoRepLegal(c?.representanteLegal ?? "");
    setCoRepDni(c?.representanteDni ?? "");
    setCoRepCargo(c?.representanteCargo ?? "");
    setCoTelefono(c?.telefono ?? "");
    setCoEmail(c?.email ?? "");
  };

  // Al cambiar de grupo, resetear empresa al primero del grupo destino
  const onGroupChange = (g: "novit" | "sharky") => {
    setGroup(g);
    const first = allCompanies.find((c) => (c._ws ?? "novit") === g);
    if (first && first.id !== companyId) onCompanyChange(first.id);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      // 1) Actualizar la empresa (SUNAT) si hay una seleccionada
      if (companyId) {
        const cf = new FormData();
        cf.set("companyId", companyId);
        cf.set("ruc", coRuc);
        cf.set("razonSocial", coRazon);
        cf.set("nombreComercial", coComercial);
        cf.set("estado", coEstado);
        cf.set("condicion", coCondicion);
        cf.set("tipoContribuyente", coTipo);
        cf.set("industry", coIndustry);
        cf.set("domicilioFiscal", coDireccion);
        cf.set("distrito", coDistrito);
        cf.set("provincia", coProvincia);
        cf.set("departamento", coDepartamento);
        cf.set("ubigeo", coUbigeo);
        cf.set("representanteLegal", coRepLegal);
        cf.set("representanteDni", coRepDni);
        cf.set("representanteCargo", coRepCargo);
        cf.set("telefono", coTelefono);
        cf.set("email", coEmail);
        const r1 = await fetch("/api/company-update", { method: "POST", body: cf });
        const j1 = await r1.json();
        if (!j1.ok) throw new Error(j1.error || "Error al guardar la empresa");
      }

      // 2) Actualizar el trato (+ mover de grupo si cambió)
      const df = new FormData();
      df.set("id", deal.id);
      df.set("name", name);
      df.set("value", value);
      df.set("estimatedCloseAt", closeAt);
      df.set("stage", stage);
      df.set("probability", (probPct / 100).toFixed(2));
      df.set("ai", ai);
      df.set("source", source);
      df.set("isRecurring", isRecurring ? "true" : "false");
      df.set("arr", arr);
      if (companyId) df.set("companyId", companyId);
      if (ownerId) df.set("ownerId", ownerId);
      if (group !== initialGroup) df.set("moveToWorkspace", group);
      const r2 = await fetch("/api/deal-update", { method: "POST", body: df });
      const j2 = await r2.json();
      if (!j2.ok) throw new Error(j2.error || "Error al guardar el trato");

      // 3) Refrescar loaders + cerrar
      revalidator.revalidate();
      setTimeout(onClose, 120);
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  };

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <div className="deal-edit-modal" onClick={(e) => e.stopPropagation()}>
        <header className="deal-edit-modal__head">
          <div>
            <h2>Editar trato</h2>
            <p className="mono">{deal.id} · {deal.name}</p>
          </div>
          <button type="button" className="btn btn--icon" onClick={onClose}>
            <Icon name="x" size={14} />
          </button>
        </header>

        <div className="deal-edit-modal__body">
          {/* ─── Datos comerciales ─── */}
          <div className="deal-edit-modal__section">
            <h3>Datos comerciales</h3>
            <div className="deal-edit-modal__row">
              <label className="deal-edit-modal__field" style={{ flex: 2 }}>
                <span>Nombre del trato</span>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} required />
              </label>
              <label className="deal-edit-modal__field" style={{ flex: 1 }}>
                <span>Código (interno)</span>
                {/* publicId es interno y NO editable */}
                <input type="text" value={deal.id} readOnly disabled className="mono deal-edit-modal__readonly" />
              </label>
            </div>

            <div className="deal-edit-modal__row">
              <label className="deal-edit-modal__field" style={{ flex: 1 }}>
                <span>Valor (setup)</span>
                <input type="number" value={value} onChange={(e) => setValue(e.target.value)} min={0} step="0.01" className="mono" />
              </label>
              <label className="deal-edit-modal__field" style={{ flex: 1 }}>
                <span>Cierre estimado</span>
                <input type="date" value={closeAt} onChange={(e) => setCloseAt(e.target.value)} />
              </label>
            </div>

            <div className="deal-edit-modal__row">
              <label className="deal-edit-modal__field" style={{ flex: 1 }}>
                <span>Stage</span>
                <select value={stage} onChange={(e) => setStage(e.target.value)}>
                  {stages.map((s) => (
                    <option key={s.id} value={s.id}>{s.label}</option>
                  ))}
                </select>
              </label>
              <label className="deal-edit-modal__field" style={{ flex: 1 }}>
                <span>Probability % <small>(override)</small></span>
                <input
                  type="number"
                  value={probPct}
                  onChange={(e) => setProbPct(Math.max(0, Math.min(100, parseInt(e.target.value || "0", 10))))}
                  min={0}
                  max={100}
                  className="mono"
                />
              </label>
            </div>
          </div>

          {/* ─── Asignación: Grupo + Owner + Empresa ─── */}
          <div className="deal-edit-modal__section">
            <h3>Asignación</h3>
            <div className="deal-edit-modal__row">
              <label className="deal-edit-modal__field" style={{ flex: 1 }}>
                <span>Grupo {isAdmin ? <small>(podés mover)</small> : <small>(solo admin mueve)</small>}</span>
                <select
                  value={group}
                  onChange={(e) => onGroupChange(e.target.value as "novit" | "sharky")}
                  disabled={!isAdmin}
                >
                  <option value="novit">NOVIT</option>
                  <option value="sharky">SHARKY</option>
                </select>
              </label>
              <label className="deal-edit-modal__field" style={{ flex: 1 }}>
                <span>Owner</span>
                <select value={ownerId} onChange={(e) => setOwnerId(e.target.value)}>
                  <option value="">—</option>
                  {ownerOptions.map((o) => (
                    <option key={o.id} value={o.id}>{o.label}</option>
                  ))}
                </select>
              </label>
            </div>
            <label className="deal-edit-modal__field">
              <span>Empresa <small>({companiesInGroup.length} en {group.toUpperCase()})</small></span>
              <select value={companyId} onChange={(e) => onCompanyChange(e.target.value)}>
                {companiesInGroup.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}{c.ruc ? ` · ${c.ruc}` : ""}</option>
                ))}
              </select>
            </label>
            {group !== initialGroup && (
              <div className="deal-edit-modal__hint-move">
                ⚠ Al guardar, el trato y la empresa <b>{selectedCompany?.name}</b> se moverán al grupo <b>{group.toUpperCase()}</b>.
              </div>
            )}
          </div>

          {/* ─── Empresa (SUNAT) — editable ─── */}
          <div className="deal-edit-modal__section">
            <h3>Empresa · datos SUNAT</h3>
            <div className="deal-edit-modal__row">
              <label className="deal-edit-modal__field" style={{ flex: 1 }}>
                <span>RUC</span>
                <input type="text" value={coRuc} onChange={(e) => setCoRuc(e.target.value.replace(/\D/g, "").slice(0, 11))} maxLength={11} className="mono" placeholder="11 dígitos" />
              </label>
              <label className="deal-edit-modal__field" style={{ flex: 2 }}>
                <span>Razón social</span>
                <input type="text" value={coRazon} onChange={(e) => setCoRazon(e.target.value)} />
              </label>
            </div>
            <div className="deal-edit-modal__row">
              <label className="deal-edit-modal__field" style={{ flex: 1 }}>
                <span>Nombre comercial</span>
                <input type="text" value={coComercial} onChange={(e) => setCoComercial(e.target.value)} />
              </label>
              <label className="deal-edit-modal__field" style={{ flex: 1 }}>
                <span>Industria / Sector</span>
                <input type="text" value={coIndustry} onChange={(e) => setCoIndustry(e.target.value)} placeholder="Seguros, Banca…" />
              </label>
            </div>
            <div className="deal-edit-modal__row">
              <label className="deal-edit-modal__field" style={{ flex: 1 }}>
                <span>Estado</span>
                <select value={coEstado} onChange={(e) => setCoEstado(e.target.value)}>
                  <option value="">—</option>
                  {SUNAT_ESTADO.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>
              <label className="deal-edit-modal__field" style={{ flex: 1 }}>
                <span>Condición</span>
                <select value={coCondicion} onChange={(e) => setCoCondicion(e.target.value)}>
                  <option value="">—</option>
                  {SUNAT_CONDICION.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>
              <label className="deal-edit-modal__field" style={{ flex: 1 }}>
                <span>Tipo contribuyente</span>
                <input type="text" value={coTipo} onChange={(e) => setCoTipo(e.target.value)} placeholder="S.A.C., E.I.R.L…" />
              </label>
            </div>
            <label className="deal-edit-modal__field">
              <span>Domicilio fiscal</span>
              <input type="text" value={coDireccion} onChange={(e) => setCoDireccion(e.target.value)} />
            </label>
            <div className="deal-edit-modal__row">
              <label className="deal-edit-modal__field" style={{ flex: 1 }}>
                <span>Distrito</span>
                <input type="text" value={coDistrito} onChange={(e) => setCoDistrito(e.target.value)} />
              </label>
              <label className="deal-edit-modal__field" style={{ flex: 1 }}>
                <span>Provincia</span>
                <input type="text" value={coProvincia} onChange={(e) => setCoProvincia(e.target.value)} />
              </label>
              <label className="deal-edit-modal__field" style={{ flex: 1 }}>
                <span>Departamento</span>
                <input type="text" value={coDepartamento} onChange={(e) => setCoDepartamento(e.target.value)} />
              </label>
              <label className="deal-edit-modal__field" style={{ flex: 1 }}>
                <span>Ubigeo</span>
                <input type="text" value={coUbigeo} onChange={(e) => setCoUbigeo(e.target.value.replace(/\D/g, "").slice(0, 6))} maxLength={6} className="mono" />
              </label>
            </div>
            <div className="deal-edit-modal__row">
              <label className="deal-edit-modal__field" style={{ flex: 2 }}>
                <span>Representante legal</span>
                <input type="text" value={coRepLegal} onChange={(e) => setCoRepLegal(e.target.value)} />
              </label>
              <label className="deal-edit-modal__field" style={{ flex: 1 }}>
                <span>DNI</span>
                <input type="text" value={coRepDni} onChange={(e) => setCoRepDni(e.target.value.replace(/\D/g, "").slice(0, 8))} maxLength={8} className="mono" />
              </label>
              <label className="deal-edit-modal__field" style={{ flex: 1 }}>
                <span>Cargo</span>
                <input type="text" value={coRepCargo} onChange={(e) => setCoRepCargo(e.target.value)} />
              </label>
            </div>
            <div className="deal-edit-modal__row">
              <label className="deal-edit-modal__field" style={{ flex: 1 }}>
                <span>Teléfono</span>
                <input type="text" value={coTelefono} onChange={(e) => setCoTelefono(e.target.value)} className="mono" />
              </label>
              <label className="deal-edit-modal__field" style={{ flex: 1 }}>
                <span>Email</span>
                <input type="email" value={coEmail} onChange={(e) => setCoEmail(e.target.value)} />
              </label>
            </div>
          </div>

          {/* ─── SaaS / recurrencia ─── */}
          <div className="deal-edit-modal__section">
            <h3>SaaS / recurrencia</h3>
            <div className="deal-edit-modal__row">
              <label className="deal-edit-modal__field deal-edit-modal__field--check" style={{ flex: 0 }}>
                <input type="checkbox" checked={isRecurring} onChange={(e) => setIsRecurring(e.target.checked)} />
                <span>Contrato recurrente</span>
              </label>
              <label className="deal-edit-modal__field" style={{ flex: 1 }}>
                <span>ARR (anual)</span>
                <input type="number" value={arr} onChange={(e) => setArr(e.target.value)} min={0} step="0.01" className="mono" />
                <small>MRR se calcula como ARR / 12 al guardar.</small>
              </label>
            </div>
          </div>

          {/* ─── Avanzado ─── */}
          <div className="deal-edit-modal__section">
            <h3>Avanzado</h3>
            <div className="deal-edit-modal__row">
              <label className="deal-edit-modal__field" style={{ flex: 1 }}>
                <span>Source / canal de origen</span>
                <select value={source} onChange={(e) => setSource(e.target.value)}>
                  <option value="">— (sin definir)</option>
                  <option value="fb_ads">Facebook Ads</option>
                  <option value="linkedin">LinkedIn</option>
                  <option value="web">Sitio web</option>
                  <option value="referral">Referido</option>
                  <option value="outbound">Outbound</option>
                  <option value="event">Evento</option>
                  <option value="other">Otro</option>
                </select>
              </label>
              <label className="deal-edit-modal__field" style={{ flex: 1 }}>
                <span>AI Score <small>(override 0-100)</small></span>
                <input type="number" value={ai} onChange={(e) => setAi(e.target.value)} min={0} max={100} className="mono" />
              </label>
            </div>
          </div>

          {error && <div className="deal-edit-modal__error">{error}</div>}

          <footer className="deal-edit-modal__foot">
            <button type="button" className="btn" onClick={onClose} disabled={saving}>
              Cancelar
            </button>
            <button type="button" className="btn btn--primary" onClick={handleSave} disabled={saving}>
              {saving ? "Guardando…" : "Guardar cambios"}
            </button>
          </footer>
        </div>
      </div>
    </div>
  );
}

function FilesPane({ deal }: { deal: Deal }) {
  const fakeFiles = [
    { name: `Propuesta-${deal.id}-v3.pdf`, type: "pdf", size: "1.2 MB" },
    { name: `SOW-${deal.id}.docx`, type: "docx", size: "84 KB" },
    { name: "Arquitectura.png", type: "png", size: "640 KB" },
    { name: "Pricing.xlsx", type: "xlsx", size: "32 KB" },
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10, padding: 14 }}>
      {fakeFiles.map((f) => (
        <div key={f.name} style={{ border: "1px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden", background: "var(--bg)" }}>
          <div style={{ height: 90, background: "var(--bg-3)", display: "grid", placeItems: "center", color: "var(--fg-3)", fontFamily: "var(--font-mono)", fontSize: "var(--fs-xs)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            .{f.type}
          </div>
          <div style={{ padding: "8px 10px" }}>
            <div style={{ fontSize: "var(--fs-sm)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</div>
            <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-3)" }} className="mono">{f.size}</div>
          </div>
        </div>
      ))}
      <button type="button" style={{ border: "1px dashed var(--border-strong)", borderRadius: "var(--radius)", padding: 24, background: "var(--bg-2)", color: "var(--fg-3)", fontSize: "var(--fs-sm)", cursor: "pointer" }}>
        <Icon name="plus" size={14} /> Subir archivos
      </button>
    </div>
  );
}

function ComposePane({ deal }: { deal: Deal }) {
  const [channel, setChannel] = useState<ChannelKind>("wa");
  const [templateId, setTemplateId] = useState<string>("");
  const channelTemplates = templates.filter((t) => t.channel === channel);
  const tpl = channelTemplates.find((t) => t.id === templateId);
  const body = (tpl?.body ?? "")
    .replace(/\{\{deal_name\}\}/g, deal.name)
    .replace(/\{\{company\}\}/g, deal.company)
    .replace(/\{\{deal_value\}\}/g, fmtMoneyFull(deal.value, "USD"))
    .replace(/\{\{first_name\}\}/g, "Contacto")
    .replace(/\{\{owner_name\}\}/g, deal.owner)
    .replace(/\{\{workspace_name\}\}/g, "NOVIT");

  return (
    <div style={{ padding: 16, display: "grid", gridTemplateColumns: "1fr 320px", gap: 14, maxWidth: 1100 }}>
      <div>
        <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
          {(["wa", "email", "linkedin"] as const).map((c) => (
            <button
              key={c}
              type="button"
              className={`btn ${channel === c ? "btn--accent" : ""}`.trim()}
              onClick={() => { setChannel(c); setTemplateId(""); }}
            >
              {c === "wa" ? "WhatsApp" : c === "email" ? "Email" : "LinkedIn"}
            </button>
          ))}
        </div>
        <textarea
          value={body || `Mensaje por ${channel} para ${deal.company}…`}
          onChange={() => {}}
          rows={14}
          style={{ width: "100%", padding: 12, border: "1px solid var(--border)", borderRadius: "var(--radius)", fontFamily: "var(--font-sans)", fontSize: "var(--fs-sm)", resize: "vertical" }}
        />
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10 }}>
          <span style={{ fontSize: "var(--fs-xs)", color: "var(--fg-3)" }}>
            Variables {`{{first_name}}`}, {`{{deal_name}}`}, {`{{company}}`}, {`{{deal_value}}`} se reemplazan automáticamente.
          </span>
          <button type="button" className="btn btn--primary">Enviar</button>
        </div>
      </div>
      <Card>
        <Card.Header label="Templates" sub={`${channelTemplates.length}`} />
        <Card.Body style={{ padding: 0 }}>
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {channelTemplates.map((t) => (
              <li
                key={t.id}
                onClick={() => setTemplateId(t.id)}
                style={{
                  padding: "8px 12px",
                  borderBottom: "1px solid var(--border-2)",
                  cursor: "pointer",
                  background: templateId === t.id ? "var(--accent-soft)" : "transparent",
                }}
              >
                <div style={{ fontSize: "var(--fs-sm)", fontWeight: 500 }}>{t.name}</div>
                <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-3)" }}>
                  {t.desc} · <span className="mono">{t.uses}</span> usos · <span className="mono">{t.replyRate}%</span> reply
                </div>
              </li>
            ))}
          </ul>
        </Card.Body>
      </Card>
    </div>
  );
}
