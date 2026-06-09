import { Fragment, useEffect, useRef, useState } from "react";
import { useFetcher } from "react-router";
import { Icon } from "../shell/Icon";
import { Chip } from "../ui/Chip";
import { useActiveWorkspace, useCurrentUser, useWorkspaceLoaderData, useAppStore } from "../../lib/store";
import { TagsEditor } from "../ui/TagsEditor";

/**
 * NewLeadDrawer — alta de un lead completo (Cliente + Contacto + Trato) en una
 * sola transacción contra /api/lead-create.
 *
 * UX: comboboxes con búsqueda/teclado para elegir del maestro o crear nuevo,
 * tarjetas de selección, etapa en pills, validación inline, preview del trato
 * y footer fijo con atajo ⌘↵.
 */

const NEW = "__new__"; // valor centinela = "crear nuevo" en los comboboxes de maestro
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type FormState = {
  // Cliente (maestro): companyId real | NEW
  companyId: string;
  companyName: string;
  ruc: string;
  industry: string;
  // Contacto (maestro): contactId real | NEW
  contactId: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneLocal: string; // sólo el número local (sin +51)
  // Oportunidad
  source: string;
  estimatedValue: string;
  dealName: string;
  stage: string;
  sequence: string;
  strategic: boolean;
};

const INITIAL: FormState = {
  companyId: NEW,
  companyName: "",
  ruc: "",
  industry: "",
  contactId: NEW,
  firstName: "",
  lastName: "",
  email: "",
  phoneLocal: "",
  source: "",
  estimatedValue: "",
  dealName: "",
  stage: "",
  sequence: "",
  strategic: false,
};

type ActionResult = { ok?: boolean; error?: string; dealId?: string; dealName?: string; company?: string; message?: string };

// ── helpers de presentación ──────────────────────────────
function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
function avatarBg(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 360;
  return `oklch(64% 0.14 ${h})`;
}
const USD0 = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

// ── Combobox (buscable, teclado, "crear nuevo") ──────────
type ComboOption = {
  value: string;
  label: string;
  sublabel?: string;
  group?: string;
  avatar?: string; // iniciales
};

function Combobox({
  value,
  options,
  onSelect,
  placeholder,
  searchPlaceholder,
  newLabel,
  newHint,
  emptyText,
  invalid,
}: {
  value: string;
  options: ComboOption[];
  onSelect: (v: string) => void;
  placeholder: string;
  searchPlaceholder: string;
  newLabel: string;
  newHint?: string;
  emptyText?: string;
  invalid?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isNew = value === NEW;
  const selected = options.find((o) => o.value === value) || null;

  const q = query.trim().toLowerCase();
  const filtered = q
    ? options.filter((o) => (o.label + " " + (o.sublabel ?? "")).toLowerCase().includes(q))
    : options;
  // índice 0 = fila "crear nuevo"; el resto son filtered[i] → flat idx i+1
  const flatLen = filtered.length + 1;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
      const t = window.setTimeout(() => inputRef.current?.focus(), 10);
      return () => window.clearTimeout(t);
    }
  }, [open]);

  const chooseIdx = (idx: number) => {
    if (idx <= 0) onSelect(NEW);
    else onSelect(filtered[idx - 1].value);
    setOpen(false);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, flatLen - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      chooseIdx(active);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    }
  };

  return (
    <div className={`cbx ${invalid ? "is-invalid" : ""}`.trim()} ref={rootRef}>
      <button
        type="button"
        className={`cbx__trigger ${isNew ? "is-new" : ""}`.trim()}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {isNew ? (
          <span className="cbx__triggerlabel cbx__new">
            <span className="cbx__createicon"><Icon name="plus" size={12} /></span>
            {newLabel}…
          </span>
        ) : selected ? (
          <span className="cbx__triggerlabel">
            {selected.avatar && (
              <span className="cbx__avatar" style={{ background: avatarBg(selected.label) }}>
                {selected.avatar}
              </span>
            )}
            <span className="cbx__lbl">{selected.label}</span>
            {selected.sublabel && <span className="cbx__sub">{selected.sublabel}</span>}
          </span>
        ) : (
          <span className="cbx__placeholder">{placeholder}</span>
        )}
        <span className="cbx__chev"><Icon name="chevron-down" size={14} /></span>
      </button>

      {open && (
        <div className="cbx__panel" role="listbox">
          <div className="cbx__searchwrap">
            <Icon name="search" size={13} />
            <input
              ref={inputRef}
              className="cbx__search"
              placeholder={searchPlaceholder}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              onKeyDown={onKey}
            />
          </div>
          <div className="cbx__list">
            <button
              type="button"
              className={`cbx__opt cbx__createopt ${active === 0 ? "is-active" : ""}`.trim()}
              onMouseEnter={() => setActive(0)}
              onClick={() => chooseIdx(0)}
            >
              <span className="cbx__optmain">
                <span className="cbx__createicon"><Icon name="plus" size={12} /></span>
                <span className="cbx__lbl">
                  {newLabel}
                  {query ? `: “${query.trim()}”` : "…"}
                </span>
              </span>
              {newHint && !query && <span className="cbx__opthint">{newHint}</span>}
            </button>

            {filtered.length === 0 && (
              <div className="cbx__empty">{q ? `Nada coincide con “${query.trim()}”.` : emptyText ?? "Sin opciones."}</div>
            )}

            {filtered.map((opt, i) => {
              const idx = i + 1;
              const showHeader = opt.group && opt.group !== filtered[i - 1]?.group;
              return (
                <Fragment key={opt.value}>
                  {showHeader && <div className="cbx__group">{opt.group}</div>}
                  <button
                    type="button"
                    className={`cbx__opt ${active === idx ? "is-active" : ""} ${opt.value === value ? "is-selected" : ""}`.trim()}
                    onMouseEnter={() => setActive(idx)}
                    onClick={() => chooseIdx(idx)}
                  >
                    <span className="cbx__optmain">
                      {opt.avatar && (
                        <span className="cbx__avatar" style={{ background: avatarBg(opt.label) }}>
                          {opt.avatar}
                        </span>
                      )}
                      <span className="cbx__lbl">{opt.label}</span>
                      {opt.sublabel && <span className="cbx__sub">{opt.sublabel}</span>}
                    </span>
                    {opt.value === value && <Icon name="check" size={14} />}
                  </button>
                </Fragment>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Etapa como pills ─────────────────────────────────────
function StagePills({
  stages,
  value,
  onChange,
}: {
  stages: { id: string; label: string; color: string }[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="stagepills" role="radiogroup" aria-label="Etapa inicial">
      {stages.map((s) => {
        const on = value === s.id;
        return (
          <button
            key={s.id}
            type="button"
            role="radio"
            aria-checked={on}
            className={`stagepills__pill ${on ? "is-on" : ""}`.trim()}
            style={
              on
                ? { borderColor: s.color, background: `color-mix(in srgb, ${s.color} 13%, transparent)`, color: "var(--fg)" }
                : undefined
            }
            onClick={() => onChange(s.id)}
          >
            <span className="stagepills__dot" style={{ background: s.color }} />
            {s.label}
          </button>
        );
      })}
    </div>
  );
}

export function NewLeadDrawer({ onClose }: { onClose: () => void }) {
  const ws = useActiveWorkspace();
  const currentUser = useCurrentUser();
  const fetcher = useFetcher<ActionResult>();
  const presetStage = useAppStore((s) => s.ui.newLeadStage);
  const [form, setForm] = useState<FormState>(() => ({ ...INITIAL, stage: presetStage ?? "" }));
  const [tags, setTags] = useState<string[]>([]);
  const formRef = useRef<HTMLFormElement>(null);
  const update = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }));

  const busy = fetcher.state !== "idle";
  const result = fetcher.data;

  const targetWorkspace = ws.isAll ? currentUser?.workspaceSlug ?? "novit" : ws.id;
  const pipelineStages = ws.stages.filter((s) => s.id !== "won" && s.id !== "lost");
  const defaultStage = pipelineStages[0]?.id ?? "qualified";

  const loaderData = useWorkspaceLoaderData();
  const wsData = loaderData[targetWorkspace as "novit" | "sharky"];
  const seqOptions = wsData?.sequences ?? [];

  // ── Maestros del grupo destino ──────────────────────────
  const clients = [...(wsData?.companies ?? [])].sort((a, b) => a.name.localeCompare(b.name, "es"));
  const allContacts = wsData?.contacts ?? [];

  const isNewClient = form.companyId === NEW;
  const isNewContact = form.contactId === NEW;

  const selectedClient = isNewClient ? null : clients.find((c) => c.id === form.companyId) ?? null;
  const selectedContact = isNewContact ? null : allContacts.find((c) => c.id === form.contactId) ?? null;

  const clientContacts = isNewClient
    ? []
    : allContacts.filter((c) => c.companyId === form.companyId).sort((a, b) => a.name.localeCompare(b.name, "es"));

  // Maestro agrupado por cliente (para elegir un contacto con cliente "nuevo").
  const contactsByClient = (() => {
    const groups = new Map<string, { companyName: string; items: typeof allContacts }>();
    for (const c of [...allContacts].sort((a, b) => a.name.localeCompare(b.name, "es"))) {
      const g = groups.get(c.companyId) ?? { companyName: c.companyName, items: [] };
      g.items.push(c);
      groups.set(c.companyId, g);
    }
    return [...groups.values()].sort((a, b) => a.companyName.localeCompare(b.companyName, "es"));
  })();

  // Opciones de combobox
  const clientOptions: ComboOption[] = clients.map((c) => ({
    value: c.id,
    label: c.name,
    sublabel: c.ruc ? `RUC ${c.ruc}` : c.industry ?? undefined,
  }));
  const contactOptions: ComboOption[] = isNewClient
    ? contactsByClient.flatMap((g) =>
        g.items.map((c) => ({ value: c.id, label: c.name, sublabel: c.email || undefined, group: g.companyName, avatar: initialsOf(c.name) })),
      )
    : clientContacts.map((c) => ({ value: c.id, label: c.name, sublabel: c.email || undefined, avatar: initialsOf(c.name) }));

  const onClientChange = (value: string) => setForm((f) => ({ ...f, companyId: value, contactId: NEW }));
  const onContactChange = (value: string) => {
    if (value === NEW) {
      setForm((f) => ({ ...f, contactId: NEW }));
      return;
    }
    const c = allContacts.find((x) => x.id === value);
    setForm((f) => ({
      ...f,
      contactId: value,
      companyId: c?.companyId ?? f.companyId, // el cliente sigue al contacto
      firstName: c?.name ?? f.firstName,
      lastName: "",
      email: c?.email ?? f.email,
      phoneLocal: (c?.phone ?? "").replace(/^\+?51/, "").replace(/\D/g, "").slice(0, 9) || f.phoneLocal,
    }));
  };

  // ── Validación ──────────────────────────────────────────
  const emailValid = EMAIL_RE.test(form.email.trim());
  const rucValid = !form.ruc || /^\d{11}$/.test(form.ruc);
  const clientOk = !isNewClient || form.companyName.trim().length > 0;
  const contactOk = !isNewContact || (form.firstName.trim().length > 0 && emailValid);
  const canSubmit = clientOk && contactOk && rucValid && !busy;

  // Etapa efectiva: si form.stage no es una etapa válida (preset obsoleto, won/
  // lost, etc.) cae al default → siempre hay una pill marcada.
  const effectiveStage = pipelineStages.some((s) => s.id === form.stage) ? form.stage : defaultStage;

  // Preview del trato
  const clientDisplayName = isNewClient ? form.companyName.trim() || "Cliente" : selectedClient?.name ?? "Cliente";
  const dealPreview = form.dealName.trim() || `${clientDisplayName} · Nueva oportunidad`;
  const valueNum = parseFloat(form.estimatedValue || "0");
  const stageObj = pipelineStages.find((s) => s.id === effectiveStage);

  // Cerrar drawer tras el éxito
  useEffect(() => {
    if (result?.ok) {
      const t = window.setTimeout(() => {
        setForm(INITIAL);
        setTags([]);
        onClose();
      }, 1500);
      return () => window.clearTimeout(t);
    }
  }, [result, onClose]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    const phoneClean = form.phoneLocal.replace(/\D/g, "");
    const phoneFull = phoneClean ? `+51${phoneClean}` : "";

    fetcher.submit(
      {
        workspaceSlug: targetWorkspace,
        companyId: isNewClient ? "" : form.companyId,
        companyName: isNewClient ? form.companyName : "",
        ruc: isNewClient ? form.ruc : "",
        industry: isNewClient ? form.industry : "",
        contactId: isNewContact ? "" : form.contactId,
        firstName: isNewContact ? form.firstName : "",
        lastName: isNewContact ? form.lastName : "",
        email: isNewContact ? form.email : "",
        phone: isNewContact ? phoneFull : "",
        source: form.source,
        estimatedValue: form.estimatedValue || "0",
        stage: effectiveStage,
        dealName: form.dealName,
        tags: tags.join(","),
        sequenceId: form.sequence,
        strategic: String(form.strategic),
      },
      { method: "POST", action: "/api/lead-create" },
    );
  };

  const onFormKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      formRef.current?.requestSubmit();
    }
  };

  const ownerInitials = currentUser?.initials ?? "··";

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside
        className="ai-drawer new-lead-drawer"
        style={{ width: "min(600px, 100vw)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="lead-head">
          <div className="lead-head__left">
            <span className="lead-head__icon"><Icon name="plus" size={15} /></span>
            <div className="lead-head__titles">
              <span className="lead-head__title">Nuevo lead</span>
              <span className="lead-head__sub">Cliente · Contacto · Oportunidad</span>
            </div>
            <Chip tone="accent">{targetWorkspace.toUpperCase()}</Chip>
          </div>
          <button type="button" className="btn btn--icon" onClick={onClose} aria-label="Cerrar">×</button>
        </header>

        {result?.ok ? (
          <div className="lead-success">
            <div className="lead-success__icon">✓</div>
            <div className="lead-success__title">Lead creado</div>
            <div className="lead-success__sub mono">{result.dealId} · {result.company}</div>
            <div className="lead-success__msg">{result.message ?? "Lo encontrarás en el Pipeline."}</div>
          </div>
        ) : (
          <form ref={formRef} onSubmit={onSubmit} onKeyDown={onFormKeyDown} className="lead-form">
            {/* ── CLIENTE ── */}
            <section className="lead-card">
              <div className="lead-card__head">
                <span className="lead-card__ic"><Icon name="users" size={13} /></span>
                <h3>Cliente</h3>
                <span className="lead-card__hint">{clients.length} en el maestro</span>
              </div>

              <label className="lead-field">
                <span className="lead-field__lbl">Cliente <i className="req">*</i></span>
                <Combobox
                  value={form.companyId}
                  options={clientOptions}
                  onSelect={onClientChange}
                  placeholder="Elegí un cliente…"
                  searchPlaceholder="Buscar por nombre o RUC…"
                  newLabel="Nuevo cliente"
                  newHint="No está en el maestro"
                  emptyText="Sin clientes todavía — creá el primero"
                  invalid={!clientOk}
                />
              </label>

              {isNewClient ? (
                <>
                  <div className="lead-row">
                    <label className="lead-field" style={{ flex: 2 }}>
                      <span className="lead-field__lbl">Razón social <i className="req">*</i></span>
                      <input
                        type="text"
                        className="lead-input"
                        value={form.companyName}
                        onChange={(e) => update({ companyName: e.target.value })}
                        placeholder="Mapfre Perú S.A."
                        autoFocus
                      />
                    </label>
                    <label className="lead-field" style={{ flex: 1 }}>
                      <span className="lead-field__lbl">RUC</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        className={`lead-input mono ${form.ruc && !rucValid ? "is-invalid" : ""}`.trim()}
                        value={form.ruc}
                        onChange={(e) => update({ ruc: e.target.value.replace(/\D/g, "").slice(0, 11) })}
                        placeholder="20512345678"
                        maxLength={11}
                      />
                    </label>
                  </div>
                  <label className="lead-field">
                    <span className="lead-field__lbl">Industria / Sector</span>
                    <input
                      type="text"
                      className="lead-input"
                      value={form.industry}
                      onChange={(e) => update({ industry: e.target.value })}
                      placeholder="Seguros, Banca, Salud, Retail…"
                    />
                  </label>
                </>
              ) : (
                selectedClient && (
                  <div className="lead-selcard">
                    <span className="lead-selcard__logo" style={{ background: avatarBg(selectedClient.name) }}>
                      {initialsOf(selectedClient.name)}
                    </span>
                    <div className="lead-selcard__body">
                      <span className="lead-selcard__name">{selectedClient.name}</span>
                      <span className="lead-selcard__meta">
                        {selectedClient.ruc ? <span className="mono">RUC {selectedClient.ruc}</span> : <em>sin RUC</em>}
                        {selectedClient.industry ? ` · ${selectedClient.industry}` : ""}
                      </span>
                    </div>
                    <Chip>existente</Chip>
                  </div>
                )
              )}
            </section>

            {/* ── CONTACTO ── */}
            <section className="lead-card">
              <div className="lead-card__head">
                <span className="lead-card__ic"><Icon name="user" size={13} /></span>
                <h3>Contacto</h3>
                <span className="lead-card__hint">
                  {isNewClient ? `${allContacts.length} en el maestro` : `${clientContacts.length} del cliente`}
                </span>
              </div>

              <label className="lead-field">
                <span className="lead-field__lbl">Contacto <i className="req">*</i></span>
                <Combobox
                  value={form.contactId}
                  options={contactOptions}
                  onSelect={onContactChange}
                  placeholder="Elegí un contacto…"
                  searchPlaceholder="Buscar por nombre o email…"
                  newLabel="Nuevo contacto"
                  newHint="Crear una persona nueva"
                  emptyText={isNewClient ? "Sin contactos en el maestro" : "Este cliente no tiene contactos aún"}
                />
                <small className="lead-field__help">
                  {isNewClient
                    ? "Elegí un contacto del maestro (su cliente se completa solo) o creá uno nuevo."
                    : "Elegí un contacto del cliente o creá uno nuevo. No se duplican."}
                </small>
              </label>

              {isNewContact ? (
                <>
                  <div className="lead-row">
                    <label className="lead-field" style={{ flex: 1 }}>
                      <span className="lead-field__lbl">Nombre <i className="req">*</i></span>
                      <input
                        type="text"
                        className="lead-input"
                        value={form.firstName}
                        onChange={(e) => update({ firstName: e.target.value })}
                        placeholder="Luis"
                      />
                    </label>
                    <label className="lead-field" style={{ flex: 1 }}>
                      <span className="lead-field__lbl">Apellido</span>
                      <input
                        type="text"
                        className="lead-input"
                        value={form.lastName}
                        onChange={(e) => update({ lastName: e.target.value })}
                        placeholder="Telles Atto"
                      />
                    </label>
                  </div>
                  <label className="lead-field">
                    <span className="lead-field__lbl">Email <i className="req">*</i></span>
                    <input
                      type="email"
                      className={`lead-input ${form.email && !emailValid ? "is-invalid" : ""}`.trim()}
                      value={form.email}
                      onChange={(e) => update({ email: e.target.value })}
                      placeholder="luis@empresa.com"
                    />
                    {form.email && !emailValid && <small className="lead-field__err">Email inválido.</small>}
                  </label>
                  <label className="lead-field">
                    <span className="lead-field__lbl">WhatsApp / Celular</span>
                    <div className="lead-phone">
                      <span className="lead-phone__prefix" aria-label="Perú">
                        <span className="lead-phone__flag" aria-hidden="true">🇵🇪</span>
                        <span className="mono">+51</span>
                      </span>
                      <input
                        type="tel"
                        inputMode="numeric"
                        value={form.phoneLocal}
                        onChange={(e) => update({ phoneLocal: e.target.value.replace(/\D/g, "").slice(0, 9) })}
                        placeholder="999 999 999"
                        maxLength={9}
                      />
                    </div>
                  </label>
                </>
              ) : (
                selectedContact && (
                  <div className="lead-selcard">
                    <span className="lead-selcard__logo" style={{ background: avatarBg(selectedContact.name) }}>
                      {initialsOf(selectedContact.name)}
                    </span>
                    <div className="lead-selcard__body">
                      <span className="lead-selcard__name">{selectedContact.name}</span>
                      <span className="lead-selcard__meta">
                        {selectedContact.email || <em>sin email</em>}
                        {selectedContact.phone ? ` · ${selectedContact.phone}` : ""}
                      </span>
                    </div>
                    <Chip>existente</Chip>
                  </div>
                )
              )}
            </section>

            {/* ── OPORTUNIDAD ── */}
            <section className="lead-card">
              <div className="lead-card__head">
                <span className="lead-card__ic"><Icon name="trending" size={13} /></span>
                <h3>Oportunidad</h3>
              </div>

              <label className="lead-field">
                <span className="lead-field__lbl">Nombre del trato</span>
                <input
                  type="text"
                  className="lead-input"
                  value={form.dealName}
                  onChange={(e) => update({ dealName: e.target.value })}
                  placeholder={`${clientDisplayName} · Nueva oportunidad`}
                />
              </label>

              <div className="lead-field">
                <span className="lead-field__lbl">Etapa inicial</span>
                <StagePills
                  stages={pipelineStages}
                  value={effectiveStage}
                  onChange={(id) => update({ stage: id })}
                />
              </div>

              <div className="lead-row">
                <label className="lead-field" style={{ flex: 1 }}>
                  <span className="lead-field__lbl">Valor estimado</span>
                  <div className="lead-money">
                    <span className="lead-money__cur">USD&nbsp;$</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step="100"
                      className="mono"
                      value={form.estimatedValue}
                      onChange={(e) => update({ estimatedValue: e.target.value })}
                      placeholder="50000"
                    />
                  </div>
                </label>
                <label className="lead-field" style={{ flex: 1 }}>
                  <span className="lead-field__lbl">Canal de origen</span>
                  <select className="lead-input" value={form.source} onChange={(e) => update({ source: e.target.value })}>
                    <option value="">— (sin definir)</option>
                    <option value="referral">Referido</option>
                    <option value="linkedin">LinkedIn</option>
                    <option value="web">Sitio web</option>
                    <option value="fb_ads">Facebook Ads</option>
                    <option value="outbound">Outbound</option>
                    <option value="event">Evento</option>
                    <option value="other">Otro</option>
                  </select>
                </label>
              </div>

              <label className="lead-field">
                <span className="lead-field__lbl">Secuencia de seguimiento <small className="opt">(opcional)</small></span>
                <select className="lead-input" value={form.sequence} onChange={(e) => update({ sequence: e.target.value })}>
                  <option value="">— Sin secuencia —</option>
                  {seqOptions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {(s.category ? s.category + " · " : "") + s.name}
                      {s.active ? "" : " (pausada)"}
                    </option>
                  ))}
                </select>
              </label>

              <label className={`lead-toggle ${form.strategic ? "is-on" : ""}`.trim()}>
                <input type="checkbox" checked={form.strategic} onChange={(e) => update({ strategic: e.target.checked })} />
                <span className="lead-toggle__sw" />
                <span className="lead-toggle__txt"><b>★ Estratégico</b> — marcar este lead como prioritario</span>
              </label>

              <label className="lead-field">
                <span className="lead-field__lbl">Tags / palabras clave</span>
                <TagsEditor value={tags} onChange={setTags} />
              </label>
            </section>

            {result?.error && (
              <div className="lead-error" role="alert">⚠ {result.error}</div>
            )}
          </form>
        )}

        {!result?.ok && (
          <footer className="lead-foot">
            {/* Preview compacto del trato a crear */}
            <div className="lead-preview" title="Resumen del trato a crear">
              <span className="lead-preview__dot" style={{ background: stageObj?.color ?? "var(--accent)" }} />
              <div className="lead-preview__body">
                <span className="lead-preview__name">{dealPreview}</span>
                <span className="lead-preview__meta">
                  {stageObj?.label ?? "—"}
                  {valueNum > 0 ? ` · ${USD0.format(valueNum)}` : ""}
                  {form.strategic ? " · ★" : ""}
                </span>
              </div>
              <span className="lead-preview__owner" title={`Owner: ${currentUser?.name ?? ""}`} style={{ background: currentUser?.color ?? "var(--fg-3)" }}>
                {ownerInitials}
              </span>
            </div>
            <div className="lead-foot__actions">
              <button type="button" className="btn" onClick={onClose} disabled={busy}>Cancelar</button>
              <button
                type="button"
                className="btn btn--primary"
                disabled={!canSubmit}
                onClick={() => formRef.current?.requestSubmit()}
              >
                {busy ? "Creando…" : "Crear lead"}
                <kbd className="lead-kbd">⌘↵</kbd>
              </button>
            </div>
          </footer>
        )}

        <style>{`
          .new-lead-drawer { display: flex; flex-direction: column; padding: 0; }

          /* Header */
          .lead-head {
            display: flex; align-items: center; justify-content: space-between;
            padding: 14px 16px; border-bottom: 1px solid var(--border-2);
            flex: 0 0 auto;
          }
          .lead-head__left { display: flex; align-items: center; gap: 11px; }
          .lead-head__icon {
            width: 30px; height: 30px; border-radius: 9px;
            display: grid; place-items: center; color: #fff;
            background: linear-gradient(135deg, var(--accent), oklch(58% 0.2 280));
            box-shadow: 0 3px 10px rgba(99,102,241,.30);
          }
          .lead-head__titles { display: flex; flex-direction: column; line-height: 1.15; }
          .lead-head__title { font-weight: 650; font-size: 15px; color: var(--fg); }
          .lead-head__sub { font-size: 10.5px; color: var(--fg-4); font-family: var(--font-mono); letter-spacing: .02em; }

          /* Form body (scroll) */
          .lead-form { flex: 1 1 auto; overflow-y: auto; padding: 14px 16px 18px; display: flex; flex-direction: column; gap: 12px; }

          .lead-card {
            border: 1px solid var(--border-2); border-radius: 12px;
            background: var(--bg); padding: 13px 13px 14px;
            display: flex; flex-direction: column; gap: 11px;
          }
          .lead-card__head { display: flex; align-items: center; gap: 8px; }
          .lead-card__ic {
            width: 22px; height: 22px; border-radius: 6px; display: grid; place-items: center;
            background: var(--bg-2); color: var(--accent); border: 1px solid var(--border-2);
          }
          .lead-card__head h3 { margin: 0; font-size: 13px; font-weight: 650; color: var(--fg); }
          .lead-card__hint { margin-left: auto; font-size: 10.5px; color: var(--fg-4); font-family: var(--font-mono); }

          .lead-row { display: flex; gap: 10px; }
          .lead-field { display: flex; flex-direction: column; gap: 5px; min-width: 0; }
          .lead-field__lbl { font-size: 11px; color: var(--fg-3); font-weight: 600; display: flex; align-items: center; gap: 4px; }
          .lead-field__lbl .req { color: var(--accent); font-style: normal; }
          .lead-field__lbl .opt { color: var(--fg-4); font-weight: 400; }
          .lead-field__help { font-size: 10.5px; color: var(--fg-4); }
          .lead-field__err { font-size: 10.5px; color: var(--danger); font-weight: 500; }

          .lead-input {
            padding: 9px 11px; border: 1px solid var(--border); border-radius: 9px;
            background: var(--bg); color: var(--fg); font: inherit; font-size: 13.5px;
            outline: none; transition: border-color .12s, box-shadow .12s; width: 100%;
          }
          .lead-input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(99,102,241,.12); }
          .lead-input.is-invalid { border-color: var(--danger); box-shadow: 0 0 0 3px oklch(58% 0.22 25 / .10); }
          select.lead-input { cursor: pointer; }

          /* Combobox */
          .cbx { position: relative; }
          .cbx__trigger {
            width: 100%; display: flex; align-items: center; gap: 8px;
            padding: 8px 10px; border: 1px solid var(--border); border-radius: 9px;
            background: var(--bg); color: var(--fg); font: inherit; font-size: 13.5px;
            cursor: pointer; text-align: left; transition: border-color .12s, box-shadow .12s;
          }
          .cbx__trigger:hover { border-color: var(--fg-4); }
          .cbx[aria-expanded] .cbx__trigger { }
          .cbx__trigger[aria-expanded="true"] { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(99,102,241,.12); }
          .cbx.is-invalid .cbx__trigger { border-color: var(--danger); }
          .cbx__triggerlabel { display: flex; align-items: center; gap: 8px; min-width: 0; flex: 1; }
          .cbx__triggerlabel.cbx__new { color: var(--accent); font-weight: 600; }
          .cbx__lbl { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
          .cbx__sub { color: var(--fg-4); font-size: 11.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex-shrink: 1; }
          .cbx__placeholder { color: var(--fg-4); flex: 1; }
          .cbx__chev { color: var(--fg-4); display: inline-flex; margin-left: auto; }
          .cbx__createicon {
            width: 17px; height: 17px; border-radius: 5px; display: grid; place-items: center;
            background: color-mix(in srgb, var(--accent) 16%, transparent); color: var(--accent);
          }
          .cbx__avatar {
            width: 22px; height: 22px; border-radius: 50%; color: #fff; flex-shrink: 0;
            display: grid; place-items: center; font-size: 9.5px; font-weight: 700; font-family: var(--font-mono);
          }

          .cbx__panel {
            position: absolute; z-index: 60; top: calc(100% + 5px); left: 0; right: 0;
            background: var(--bg); border: 1px solid var(--border); border-radius: 11px;
            box-shadow: 0 14px 40px rgba(0,0,0,.18); overflow: hidden;
            animation: cbxPop .12s ease;
          }
          @keyframes cbxPop { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }
          .cbx__searchwrap {
            display: flex; align-items: center; gap: 7px; padding: 9px 11px;
            border-bottom: 1px solid var(--border-2); color: var(--fg-4);
          }
          .cbx__search { flex: 1; border: none; outline: none; background: transparent; font: inherit; font-size: 13px; color: var(--fg); }
          .cbx__list { max-height: 260px; overflow-y: auto; padding: 5px; display: flex; flex-direction: column; gap: 1px; }
          .cbx__group {
            font-size: 10px; text-transform: uppercase; letter-spacing: .07em; color: var(--fg-4);
            font-family: var(--font-mono); padding: 8px 9px 3px; position: sticky; top: 0; background: var(--bg);
          }
          .cbx__opt {
            display: flex; align-items: center; gap: 9px; width: 100%; text-align: left;
            padding: 7px 9px; border: 0; border-radius: 8px; background: transparent; cursor: pointer;
            font: inherit; font-size: 13px; color: var(--fg);
          }
          .cbx__opt.is-active { background: var(--bg-2); }
          .cbx__opt.is-selected { color: var(--accent); }
          .cbx__optmain { display: flex; align-items: center; gap: 9px; min-width: 0; flex: 1; }
          .cbx__opt .cbx__sub { margin-left: 2px; }
          .cbx__createopt { color: var(--accent); font-weight: 600; }
          .cbx__opthint { margin-left: auto; font-size: 10.5px; color: var(--fg-4); font-weight: 400; }
          .cbx__empty { padding: 14px 11px; text-align: center; color: var(--fg-4); font-size: 12px; }

          /* Tarjeta de selección (cliente/contacto existente) */
          .lead-selcard {
            display: flex; align-items: center; gap: 11px; padding: 10px 11px;
            border: 1px solid var(--border-2); border-radius: 10px; background: var(--bg-2);
          }
          .lead-selcard__logo {
            width: 34px; height: 34px; border-radius: 9px; color: #fff; flex-shrink: 0;
            display: grid; place-items: center; font-size: 12px; font-weight: 700; font-family: var(--font-mono);
          }
          .lead-selcard__body { display: flex; flex-direction: column; min-width: 0; flex: 1; gap: 1px; }
          .lead-selcard__name { font-weight: 600; font-size: 13.5px; color: var(--fg); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
          .lead-selcard__meta { font-size: 11.5px; color: var(--fg-3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
          .lead-selcard__meta em { color: var(--fg-4); }

          /* Teléfono */
          .lead-phone { display: flex; align-items: stretch; border: 1px solid var(--border); border-radius: 9px; background: var(--bg); overflow: hidden; }
          .lead-phone:focus-within { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(99,102,241,.12); }
          .lead-phone__prefix { display: inline-flex; align-items: center; gap: 6px; padding: 0 11px; background: var(--bg-2); border-right: 1px solid var(--border); font-size: 13px; font-weight: 500; user-select: none; white-space: nowrap; }
          .lead-phone__flag { font-size: 16px; line-height: 1; }
          .lead-phone input { flex: 1; border: none !important; outline: none !important; box-shadow: none !important; padding: 9px 11px; font: inherit; font-size: 13.5px; background: transparent; color: var(--fg); }

          /* Money */
          .lead-money { display: flex; align-items: stretch; border: 1px solid var(--border); border-radius: 9px; background: var(--bg); overflow: hidden; }
          .lead-money:focus-within { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(99,102,241,.12); }
          .lead-money__cur { display: inline-flex; align-items: center; padding: 0 10px; background: var(--bg-2); border-right: 1px solid var(--border); font-size: 11.5px; font-weight: 600; color: var(--fg-3); white-space: nowrap; }
          .lead-money input { flex: 1; border: none !important; outline: none !important; box-shadow: none !important; padding: 9px 11px; font: inherit; font-size: 13.5px; background: transparent; color: var(--fg); width: 100%; }

          /* Stage pills */
          .stagepills { display: flex; flex-wrap: wrap; gap: 6px; }
          .stagepills__pill {
            display: inline-flex; align-items: center; gap: 6px; padding: 6px 11px;
            border: 1px solid var(--border); border-radius: 999px; background: var(--bg);
            font: inherit; font-size: 12px; font-weight: 500; color: var(--fg-3); cursor: pointer;
            transition: border-color .12s, background .12s, color .12s;
          }
          .stagepills__pill:hover { border-color: var(--fg-4); color: var(--fg); }
          .stagepills__pill.is-on { font-weight: 650; }
          .stagepills__dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }

          /* Toggle estratégico */
          .lead-toggle { display: flex; align-items: center; gap: 10px; padding: 10px 11px; border: 1px solid var(--border-2); border-radius: 10px; cursor: pointer; transition: border-color .12s, background .12s; }
          .lead-toggle.is-on { border-color: color-mix(in srgb, var(--warning, #f59e0b) 55%, var(--border)); background: color-mix(in srgb, var(--warning, #f59e0b) 8%, transparent); }
          .lead-toggle input { position: absolute; opacity: 0; width: 0; height: 0; }
          .lead-toggle__sw { width: 34px; height: 20px; border-radius: 999px; background: var(--border); position: relative; flex-shrink: 0; transition: background .15s; }
          .lead-toggle__sw::after { content: ""; position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; border-radius: 50%; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,.25); transition: transform .15s; }
          .lead-toggle.is-on .lead-toggle__sw { background: var(--warning, #f59e0b); }
          .lead-toggle.is-on .lead-toggle__sw::after { transform: translateX(14px); }
          .lead-toggle__txt { font-size: 12.5px; color: var(--fg-2); }
          .lead-toggle__txt b { color: var(--fg); font-weight: 600; }

          .lead-error { font-size: 12px; color: var(--danger); background: oklch(58% 0.22 25 / .08); border: 1px solid oklch(58% 0.22 25 / .25); border-radius: 9px; padding: 9px 11px; }

          /* Footer fijo con preview */
          .lead-foot { flex: 0 0 auto; border-top: 1px solid var(--border-2); padding: 11px 16px; display: flex; flex-direction: column; gap: 10px; background: var(--bg); }
          .lead-preview { display: flex; align-items: center; gap: 10px; padding: 8px 11px; border: 1px solid var(--border-2); border-radius: 10px; background: var(--bg-2); }
          .lead-preview__dot { width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; }
          .lead-preview__body { display: flex; flex-direction: column; min-width: 0; flex: 1; line-height: 1.25; }
          .lead-preview__name { font-size: 12.5px; font-weight: 600; color: var(--fg); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
          .lead-preview__meta { font-size: 11px; color: var(--fg-3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
          .lead-preview__owner { width: 26px; height: 26px; border-radius: 50%; color: #fff; display: grid; place-items: center; font-size: 9.5px; font-weight: 700; font-family: var(--font-mono); flex-shrink: 0; }
          .lead-foot__actions { display: flex; justify-content: flex-end; gap: 8px; }
          .lead-foot__actions .btn--primary { display: inline-flex; align-items: center; gap: 8px; }
          .lead-kbd { font-family: var(--font-mono); font-size: 10px; background: rgba(255,255,255,.22); border-radius: 4px; padding: 1px 5px; line-height: 1.4; }

          /* Success */
          .lead-success { padding: 52px 32px; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 12px; flex: 1; justify-content: center; }
          .lead-success__icon { width: 56px; height: 56px; border-radius: 50%; background: linear-gradient(135deg, var(--success, #16a34a), oklch(50% 0.18 155)); color: #fff; font-size: 28px; font-weight: 700; display: grid; place-items: center; box-shadow: 0 6px 20px rgba(22,163,74,.35); animation: leadPop .4s cubic-bezier(.2,.8,.2,1); }
          .lead-success__title { font-size: 20px; font-weight: 600; color: var(--fg); margin-top: 4px; }
          .lead-success__sub { font-size: 13px; color: var(--fg-3); }
          .lead-success__msg { font-size: 13px; color: var(--fg-2); margin-top: 8px; }
          @keyframes leadPop { 0% { transform: scale(.3); opacity: 0; } 70% { transform: scale(1.1); opacity: 1; } 100% { transform: scale(1); opacity: 1; } }
        `}</style>
      </aside>
    </div>
  );
}
