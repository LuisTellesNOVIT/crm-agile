import { useEffect, useState } from "react";
import { useFetcher } from "react-router";
import { Icon } from "../shell/Icon";
import { Chip } from "../ui/Chip";
import { useActiveWorkspace, useCurrentUser, useWorkspaceLoaderData, useAppStore } from "../../lib/store";
import { TagsEditor } from "../ui/TagsEditor";

/**
 * NewLeadDrawer — formulario de un solo paso para crear un lead completo
 * (Company + Contact + Deal) en una sola transacción contra /api/lead-create.
 *
 * - Teléfono con prefijo +51 PE por default (bandera + número visible).
 * - RUC opcional (11 dígitos, validado).
 * - Workspace del lead = workspace activo (o NOVIT si está en "Todas").
 * - Owner del deal = usuario logueado.
 * - Al crear: refresca loaders → aparece de inmediato en Pipeline / Cliente 360.
 */

const NEW = "__new__"; // valor centinela = "crear nuevo" en los selectores de maestro

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

export function NewLeadDrawer({ onClose }: { onClose: () => void }) {
  const ws = useActiveWorkspace();
  const currentUser = useCurrentUser();
  const fetcher = useFetcher<ActionResult>();
  const presetStage = useAppStore((s) => s.ui.newLeadStage);
  const [form, setForm] = useState<FormState>(() => ({ ...INITIAL, stage: presetStage ?? "" }));
  const [tags, setTags] = useState<string[]>([]);
  const update = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }));

  const busy = fetcher.state !== "idle";
  const result = fetcher.data;

  // Workspace activo: si está en "all", usamos el del usuario logueado (o novit).
  const targetWorkspace =
    ws.isAll
      ? currentUser?.workspaceSlug ?? "novit"
      : ws.id;

  // Stage default = primer stage del workspace que no sea won/lost
  const defaultStage =
    ws.stages.find((s) => s.id !== "won" && s.id !== "lost")?.id ?? "qualified";

  // Secuencias del grupo destino (no del activo, por si está en "all")
  const loaderData = useWorkspaceLoaderData();
  const wsData = loaderData[targetWorkspace as "novit" | "sharky"];
  const seqOptions = wsData?.sequences ?? [];

  // ── Maestros del grupo destino ──────────────────────────
  const clients = [...(wsData?.companies ?? [])].sort((a, b) =>
    a.name.localeCompare(b.name, "es"),
  );
  const allContacts = wsData?.contacts ?? [];

  const isNewClient = form.companyId === NEW;
  const isNewContact = form.contactId === NEW;

  // Contactos del cliente elegido (cuando es un cliente existente del maestro).
  const clientContacts = isNewClient
    ? []
    : allContacts
        .filter((c) => c.companyId === form.companyId)
        .sort((a, b) => a.name.localeCompare(b.name, "es"));

  // Maestro completo agrupado por cliente (para elegir un contacto cuando el
  // cliente todavía es "nuevo": al elegirlo, su cliente se autocompleta).
  const contactsByClient = (() => {
    const groups = new Map<string, { companyName: string; items: typeof allContacts }>();
    for (const c of [...allContacts].sort((a, b) => a.name.localeCompare(b.name, "es"))) {
      const g = groups.get(c.companyId) ?? { companyName: c.companyName, items: [] };
      g.items.push(c);
      groups.set(c.companyId, g);
    }
    return [...groups.values()].sort((a, b) =>
      a.companyName.localeCompare(b.companyName, "es"),
    );
  })();

  // Al cambiar de cliente, reseteamos el contacto (sus contactos cambian).
  const onClientChange = (value: string) => {
    setForm((f) => ({ ...f, companyId: value, contactId: NEW }));
  };
  // Al elegir un contacto existente: lo asignamos, autocompletamos su cliente
  // (un contacto pertenece a un cliente) y prellenamos sus datos de display.
  const onContactChange = (value: string) => {
    if (value === NEW) {
      setForm((f) => ({ ...f, contactId: NEW }));
      return;
    }
    const c = allContacts.find((x) => x.id === value);
    setForm((f) => ({
      ...f,
      contactId: value,
      // El cliente sigue al contacto (evita inconsistencias contacto↔cliente).
      companyId: c?.companyId ?? f.companyId,
      firstName: c?.name ?? f.firstName,
      lastName: "",
      email: c?.email ?? f.email,
      phoneLocal:
        (c?.phone ?? "").replace(/^\+?51/, "").replace(/\D/g, "").slice(0, 9) ||
        f.phoneLocal,
    }));
  };

  // Cerrar drawer 1.5s después del éxito (para que vea el mensaje)
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
    // El número final es +51 + lo que tipeó (limpiamos espacios/guiones)
    const phoneClean = form.phoneLocal.replace(/\D/g, "");
    const phoneFull = phoneClean ? `+51${phoneClean}` : "";

    fetcher.submit(
      {
        workspaceSlug: targetWorkspace,
        // Cliente: id del maestro si es existente, sino nombre/ruc nuevos
        companyId: isNewClient ? "" : form.companyId,
        companyName: isNewClient ? form.companyName : "",
        ruc: isNewClient ? form.ruc : "",
        industry: isNewClient ? form.industry : "",
        // Contacto: id del maestro si es existente, sino datos nuevos
        contactId: isNewContact ? "" : form.contactId,
        firstName: isNewContact ? form.firstName : "",
        lastName: isNewContact ? form.lastName : "",
        email: isNewContact ? form.email : "",
        phone: isNewContact ? phoneFull : "",
        source: form.source,
        estimatedValue: form.estimatedValue || "0",
        stage: form.stage || defaultStage,
        dealName: form.dealName,
        tags: tags.join(","),
        sequenceId: form.sequence,
        strategic: String(form.strategic),
      },
      { method: "POST", action: "/api/lead-create" },
    );
  };

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside
        className="ai-drawer new-lead-drawer"
        style={{ width: "min(560px, 100vw)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="ai-drawer__head">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Icon name="plus" size={14} />
            <span style={{ fontWeight: 600 }}>Nuevo lead</span>
            <Chip tone="accent">{targetWorkspace.toUpperCase()}</Chip>
          </div>
          <button type="button" className="btn btn--icon" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </header>

        {result?.ok ? (
          /* ─── Estado éxito ─── */
          <div className="lead-success">
            <div className="lead-success__icon">✓</div>
            <div className="lead-success__title">Lead creado</div>
            <div className="lead-success__sub mono">
              {result.dealId} · {result.company}
            </div>
            <div className="lead-success__msg">
              {result.message ?? "Lo encontrarás en el Pipeline."}
            </div>
          </div>
        ) : (
          /* ─── Form ─── */
          <form onSubmit={onSubmit} className="lead-form">
            <div className="lead-form__section">
              <h3>Cliente</h3>
              <label className="lead-form__field">
                <span>Cliente *</span>
                <select
                  value={form.companyId}
                  onChange={(e) => onClientChange(e.target.value)}
                  autoFocus
                >
                  <option value={NEW}>➕ Nuevo cliente…</option>
                  {clients.length > 0 && (
                    <optgroup label="Clientes existentes">
                      {clients.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                          {c.ruc ? ` · ${c.ruc}` : ""}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
                <small>
                  Elegí un cliente del maestro o creá uno nuevo. No se duplican.
                </small>
              </label>

              {isNewClient && (
                <>
                  <div className="lead-form__row">
                    <label className="lead-form__field" style={{ flex: 2 }}>
                      <span>Razón social *</span>
                      <input
                        type="text"
                        required
                        value={form.companyName}
                        onChange={(e) => update({ companyName: e.target.value })}
                        placeholder="Mapfre Perú S.A."
                      />
                    </label>
                    <label className="lead-form__field" style={{ flex: 1 }}>
                      <span>RUC</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={form.ruc}
                        onChange={(e) => update({ ruc: e.target.value.replace(/\D/g, "").slice(0, 11) })}
                        placeholder="20512345678"
                        maxLength={11}
                        className="mono"
                      />
                    </label>
                  </div>

                  <label className="lead-form__field">
                    <span>Industria / Sector</span>
                    <input
                      type="text"
                      value={form.industry}
                      onChange={(e) => update({ industry: e.target.value })}
                      placeholder="Seguros, Banca, Salud, Retail…"
                    />
                  </label>
                </>
              )}
            </div>

            <div className="lead-form__section">
              <h3>Contacto</h3>
              <label className="lead-form__field">
                <span>Contacto *</span>
                <select
                  value={form.contactId}
                  onChange={(e) => onContactChange(e.target.value)}
                >
                  <option value={NEW}>➕ Nuevo contacto…</option>
                  {!isNewClient && clientContacts.length > 0 && (
                    <optgroup label="Contactos del cliente">
                      {clientContacts.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                          {c.email ? ` · ${c.email}` : ""}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {/* Cliente nuevo: ofrecemos el maestro completo; al elegir
                      un contacto, su cliente se autocompleta arriba. */}
                  {isNewClient &&
                    contactsByClient.map((g) => (
                      <optgroup key={g.companyName} label={g.companyName}>
                        {g.items.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                            {c.email ? ` · ${c.email}` : ""}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                </select>
                <small>
                  {isNewClient
                    ? "Elegí un contacto del maestro (su cliente se completa solo) o creá uno nuevo."
                    : clientContacts.length > 0
                      ? "Elegí un contacto existente o creá uno nuevo. No se duplican."
                      : "Este cliente aún no tiene contactos. Creá el primero."}
                </small>
              </label>

              {isNewContact && (
                <>
                  <div className="lead-form__row">
                    <label className="lead-form__field" style={{ flex: 1 }}>
                      <span>Nombre *</span>
                      <input
                        type="text"
                        required
                        value={form.firstName}
                        onChange={(e) => update({ firstName: e.target.value })}
                        placeholder="Luis"
                      />
                    </label>
                    <label className="lead-form__field" style={{ flex: 1 }}>
                      <span>Apellido</span>
                      <input
                        type="text"
                        value={form.lastName}
                        onChange={(e) => update({ lastName: e.target.value })}
                        placeholder="Telles Atto"
                      />
                    </label>
                  </div>

                  <label className="lead-form__field">
                    <span>Email *</span>
                    <input
                      type="email"
                      required
                      value={form.email}
                      onChange={(e) => update({ email: e.target.value })}
                      placeholder="luis@empresa.com"
                    />
                  </label>

                  <label className="lead-form__field">
                    <span>WhatsApp / Celular</span>
                    <div className="lead-form__phone">
                      <span className="lead-form__phone-prefix" aria-label="Perú">
                        <span className="lead-form__flag" aria-hidden="true">🇵🇪</span>
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
                    <small>Sólo el número, 9 dígitos. El prefijo +51 se agrega automáticamente.</small>
                  </label>
                </>
              )}
            </div>

            <div className="lead-form__section">
              <h3>Oportunidad</h3>
              <label className="lead-form__field">
                <span>Nombre del trato</span>
                <input
                  type="text"
                  value={form.dealName}
                  onChange={(e) => update({ dealName: e.target.value })}
                  placeholder="(opcional — sino: 'Empresa · Nueva oportunidad')"
                />
              </label>

              <div className="lead-form__row">
                <label className="lead-form__field" style={{ flex: 1 }}>
                  <span>Etapa inicial</span>
                  <select
                    value={form.stage || defaultStage}
                    onChange={(e) => update({ stage: e.target.value })}
                  >
                    {ws.stages
                      .filter((s) => s.id !== "won" && s.id !== "lost")
                      .map((s) => (
                        <option key={s.id} value={s.id}>{s.label}</option>
                      ))}
                  </select>
                </label>
                <label className="lead-form__field" style={{ flex: 1 }}>
                  <span>Valor estimado (USD)</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="100"
                    value={form.estimatedValue}
                    onChange={(e) => update({ estimatedValue: e.target.value })}
                    placeholder="50000"
                    className="mono"
                  />
                </label>
              </div>

              <label className="lead-form__field">
                <span>Secuencia de seguimiento <small style={{ color: "var(--fg-4)" }}>(opcional)</small></span>
                <select
                  value={form.sequence}
                  onChange={(e) => update({ sequence: e.target.value })}
                >
                  <option value="">— Sin secuencia —</option>
                  {seqOptions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {(s.category ? s.category + " · " : "") + s.name}
                      {s.active ? "" : " (pausada)"}
                    </option>
                  ))}
                </select>
              </label>

              <label className={`seq-testtoggle ${form.strategic ? "is-on" : ""}`}>
                <input
                  type="checkbox"
                  checked={form.strategic}
                  onChange={(e) => update({ strategic: e.target.checked })}
                />
                <span className="seq-testtoggle__sw" />
                <span><b>★ Estratégico</b> — marcar este lead como prioritario.</span>
              </label>

              <label className="lead-form__field">
                <span>Canal de origen</span>
                <select
                  value={form.source}
                  onChange={(e) => update({ source: e.target.value })}
                >
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

              <label className="lead-form__field">
                <span>Tags / palabras clave</span>
                <TagsEditor value={tags} onChange={setTags} />
                <small>Sector, tipo de lead, cliente… Enter o coma para agregar.</small>
              </label>
            </div>

            {result?.error && (
              <div className="lead-form__error" role="alert">
                ⚠ {result.error}
              </div>
            )}

            <footer className="lead-form__foot">
              <button type="button" className="btn" onClick={onClose} disabled={busy}>
                Cancelar
              </button>
              <button type="submit" className="btn btn--primary" disabled={busy}>
                {busy ? "Creando…" : "Crear lead"}
              </button>
            </footer>
          </form>
        )}

        <style>{`
          .new-lead-drawer .ai-drawer__head { border-bottom: 1px solid var(--border-2); }
          .lead-form {
            padding: 16px 18px 14px;
            display: flex;
            flex-direction: column;
            gap: 18px;
            overflow-y: auto;
          }
          .lead-form__section {
            display: flex;
            flex-direction: column;
            gap: 10px;
            padding-bottom: 14px;
            border-bottom: 1px solid var(--border-2);
          }
          .lead-form__section:last-of-type { border-bottom: 0; padding-bottom: 0; }
          .lead-form__section h3 {
            font-size: 11px;
            font-family: var(--font-mono);
            text-transform: uppercase;
            letter-spacing: 0.08em;
            color: var(--fg-3);
            margin: 0 0 4px;
          }
          .lead-form__row {
            display: flex;
            gap: 10px;
          }
          .lead-form__field {
            display: flex;
            flex-direction: column;
            gap: 4px;
          }
          .lead-form__field > span {
            font-size: 11px;
            color: var(--fg-3);
            font-weight: 500;
          }
          .lead-form__field > small {
            font-size: 10px;
            color: var(--fg-4);
            margin-top: 2px;
          }
          .lead-form__field input,
          .lead-form__field select {
            padding: 8px 10px;
            border: 1px solid var(--border);
            border-radius: var(--radius-sm);
            background: var(--bg);
            color: var(--fg);
            font: inherit;
            font-size: 13.5px;
            outline: none;
            transition: border-color .12s, box-shadow .12s;
          }
          .lead-form__field input:focus,
          .lead-form__field select:focus {
            border-color: var(--accent);
            box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.10);
          }
          .lead-form__phone {
            display: flex;
            align-items: stretch;
            border: 1px solid var(--border);
            border-radius: var(--radius-sm);
            background: var(--bg);
            overflow: hidden;
          }
          .lead-form__phone:focus-within {
            border-color: var(--accent);
            box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.10);
          }
          .lead-form__phone-prefix {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 0 10px;
            background: var(--bg-2);
            border-right: 1px solid var(--border);
            font-size: 13px;
            color: var(--fg);
            font-weight: 500;
            user-select: none;
            white-space: nowrap;
          }
          .lead-form__flag { font-size: 16px; line-height: 1; }
          .lead-form__phone input {
            flex: 1;
            border: none !important;
            outline: none !important;
            box-shadow: none !important;
            padding: 8px 10px;
            font: inherit;
            font-size: 13.5px;
          }
          .lead-form__error {
            font-size: 12px;
            color: var(--danger);
            background: oklch(58% 0.22 25 / .08);
            border: 1px solid oklch(58% 0.22 25 / .25);
            border-radius: var(--radius-sm);
            padding: 8px 10px;
            margin: 0;
          }
          .lead-form__foot {
            display: flex;
            justify-content: flex-end;
            gap: 8px;
            padding-top: 12px;
            border-top: 1px solid var(--border-2);
            margin-top: 8px;
          }

          .lead-success {
            padding: 48px 32px;
            text-align: center;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 12px;
          }
          .lead-success__icon {
            width: 56px;
            height: 56px;
            border-radius: 50%;
            background: linear-gradient(135deg, var(--success, #16a34a), oklch(50% 0.18 155));
            color: #fff;
            font-size: 28px;
            font-weight: 700;
            display: grid;
            place-items: center;
            box-shadow: 0 6px 20px rgba(22, 163, 74, .35);
            animation: leadPop .4s cubic-bezier(.2,.8,.2,1);
          }
          .lead-success__title {
            font-size: 20px;
            font-weight: 600;
            color: var(--fg);
            margin-top: 4px;
          }
          .lead-success__sub {
            font-size: 13px;
            color: var(--fg-3);
          }
          .lead-success__msg {
            font-size: 13px;
            color: var(--fg-2);
            margin-top: 8px;
          }
          @keyframes leadPop {
            0%   { transform: scale(0.3); opacity: 0; }
            70%  { transform: scale(1.1); opacity: 1; }
            100% { transform: scale(1);   opacity: 1; }
          }
        `}</style>
      </aside>
    </div>
  );
}
