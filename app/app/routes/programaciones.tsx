import { useEffect, useState } from "react";
import { useLoaderData, useFetcher, useRevalidator, type LoaderFunctionArgs } from "react-router";
import { prisma } from "../lib/db.server";
import { requireUser } from "../lib/session.server";
import { Icon } from "../components/shell/Icon";

type Sched = {
  id: string;
  name: string;
  kind: string;
  channel: string;
  target: string;
  targetLabel: string | null;
  body: string | null;
  freq: string;
  weekday: number | null;
  hour: number;
  minute: number;
  enabled: boolean;
  runNow: boolean;
  lastRunAt: string | null;
  lastStatus: string | null;
  lastError: string | null;
};
type Log = {
  id: string;
  kind: string;
  channel: string;
  target: string;
  summary: string;
  status: string;
  error: string | null;
  at: string;
};

const WEEKDAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

export async function loader({ request }: LoaderFunctionArgs) {
  await requireUser(request);
  const [scheds, logs] = await Promise.all([
    prisma.scheduledMessage.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.messageLog.findMany({ orderBy: { at: "desc" }, take: 40 }),
  ]);
  return {
    scheds: scheds.map((s) => ({ ...s, lastRunAt: s.lastRunAt?.toISOString() ?? null })) as Sched[],
    logs: logs.map((l) => ({ ...l, at: l.at.toISOString() })) as Log[],
  };
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}
function scheduleText(s: Sched): string {
  const t = `${pad(s.hour)}:${pad(s.minute)}`;
  if (s.freq === "manual") return "Manual (solo al pedir)";
  if (s.freq === "daily") return `Todos los días · ${t}`;
  return `${WEEKDAYS[s.weekday ?? 1]} · ${t}`;
}
function fmtWhen(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("es-PE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function ProgramacionesRoute() {
  const { scheds, logs } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();
  const revalidator = useRevalidator();
  const [editing, setEditing] = useState<Sched | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data && (fetcher.data as { ok?: boolean }).ok) {
      revalidator.revalidate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetcher.state, fetcher.data]);

  function submit(payload: Record<string, string>) {
    fetcher.submit(payload, { method: "post", action: "/api/scheduled-message" });
  }

  return (
    <div className="prog">
      <div className="prog__head">
        <div>
          <h1 className="prog__title">Programaciones</h1>
          <p className="prog__sub">
            Controlá los envíos automáticos (WhatsApp / correo). Definí cuándo y a quién, prendé/apagá, reenviá y mirá qué se envió.
          </p>
        </div>
        <button type="button" className="btn btn--primary" onClick={() => setCreating(true)}>
          <Icon name="plus" size={14} /> Nueva programación
        </button>
      </div>

      <div className="prog__note">
        <Icon name="alert" size={13} />
        <span>
          La entrega corre desde el <b>runner local</b> (tu Mac con el gateway). La UI define la configuración y registra los envíos;
          <b> “Enviar ahora”</b> deja el pedido encolado y se manda en la próxima corrida del runner.
        </span>
      </div>

      <div className="prog__list">
        {scheds.length === 0 && <div className="prog__empty">No hay programaciones. Creá una con “Nueva programación”.</div>}
        {scheds.map((s) => (
          <div key={s.id} className={`prog-card ${s.enabled ? "" : "is-off"}`.trim()}>
            <div className="prog-card__main">
              <div className="prog-card__top">
                <span className={`prog-chan prog-chan--${s.channel}`}>
                  <Icon name={s.channel === "email" ? "mail" : "wa"} size={12} /> {s.channel === "email" ? "Email" : "WhatsApp"}
                </span>
                <strong className="prog-card__name">{s.name}</strong>
                {s.kind === "brief" && <span className="prog-kind">Resumen CRM</span>}
                {s.runNow && <span className="prog-queued">⏳ en cola</span>}
              </div>
              <div className="prog-card__meta">
                <span title="Destino"><Icon name="user" size={12} /> {s.targetLabel || s.target}</span>
                <span title="Programación"><Icon name="clock" size={12} /> {scheduleText(s)}</span>
                <span title="Último envío">
                  <Icon name="calendar" size={12} /> Último: {fmtWhen(s.lastRunAt)}
                  {s.lastStatus && (
                    <span className={`prog-status prog-status--${s.lastStatus}`}>
                      {s.lastStatus === "sent" ? "enviado" : s.lastStatus === "failed" ? "error" : s.lastStatus}
                    </span>
                  )}
                </span>
              </div>
              {s.lastError && <div className="prog-card__err">⚠ {s.lastError}</div>}
            </div>
            <div className="prog-card__actions">
              <button
                type="button"
                className={`prog-toggle ${s.enabled ? "is-on" : ""}`.trim()}
                title={s.enabled ? "Activa — click para pausar" : "Pausada — click para activar"}
                onClick={() => submit({ op: "toggle", id: s.id, enabled: String(!s.enabled) })}
              >
                <span className="prog-toggle__dot" />
                {s.enabled ? "Activa" : "Pausada"}
              </button>
              <button
                type="button"
                className="btn btn--sm"
                disabled={s.runNow}
                title="Encolar un envío inmediato"
                onClick={() => submit({ op: "runNow", id: s.id })}
              >
                <Icon name="zap" size={12} /> Enviar ahora
              </button>
              <button type="button" className="btn btn--sm" onClick={() => setEditing(s)}>
                <Icon name="settings" size={12} /> Editar
              </button>
              <button
                type="button"
                className="btn btn--sm prog-del"
                title="Eliminar"
                onClick={() => {
                  if (window.confirm(`¿Eliminar la programación "${s.name}"?`)) submit({ op: "delete", id: s.id });
                }}
              >
                <Icon name="x" size={12} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <h2 className="prog__h2">Historial de envíos</h2>
      <div className="prog-log">
        <div className="prog-log__row prog-log__row--head">
          <span>Fecha</span>
          <span>Tipo</span>
          <span>Canal</span>
          <span>Destino</span>
          <span>Detalle</span>
          <span>Estado</span>
        </div>
        {logs.length === 0 && <div className="prog__empty">Todavía no hay envíos registrados.</div>}
        {logs.map((l) => (
          <div key={l.id} className="prog-log__row">
            <span className="mono">{fmtWhen(l.at)}</span>
            <span>{l.kind}</span>
            <span>{l.channel === "email" ? "Email" : "WA"}</span>
            <span className="prog-log__target" title={l.target}>{l.target}</span>
            <span className="prog-log__sum" title={l.error || l.summary}>{l.summary}</span>
            <span className={`prog-status prog-status--${l.status}`}>{l.status === "sent" ? "enviado" : "error"}</span>
          </div>
        ))}
      </div>

      {(editing || creating) && (
        <SchedEditor
          sched={editing}
          busy={fetcher.state !== "idle"}
          onClose={() => {
            setEditing(null);
            setCreating(false);
          }}
          onSave={(payload) => {
            submit(payload);
            setEditing(null);
            setCreating(false);
          }}
        />
      )}
    </div>
  );
}

function SchedEditor({
  sched,
  busy,
  onClose,
  onSave,
}: {
  sched: Sched | null;
  busy: boolean;
  onClose: () => void;
  onSave: (payload: Record<string, string>) => void;
}) {
  const [f, setF] = useState({
    name: sched?.name ?? "",
    kind: sched?.kind ?? "custom",
    channel: sched?.channel ?? "wa",
    target: sched?.target ?? "",
    targetLabel: sched?.targetLabel ?? "",
    body: sched?.body ?? "",
    freq: sched?.freq ?? "weekly",
    weekday: String(sched?.weekday ?? 1),
    hour: String(sched?.hour ?? 8),
    minute: String(sched?.minute ?? 0),
    enabled: sched?.enabled ?? true,
  });
  const set = (p: Partial<typeof f>) => setF((x) => ({ ...x, ...p }));
  const isBrief = f.kind === "brief";

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <div className="seq-modal seq-modal--wide" onClick={(e) => e.stopPropagation()}>
        <header>
          <span className="seq-node__icon" style={{ background: "#2563eb" }}>
            <Icon name="clock" size={15} />
          </span>
          <div>
            <div style={{ fontSize: 10, fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: ".06em", color: "var(--fg-3)" }}>
              {sched ? "Editar programación" : "Nueva programación"}
            </div>
            <div style={{ fontWeight: 600 }}>{f.name || "Sin nombre"}</div>
          </div>
          <button type="button" className="btn btn--icon" onClick={onClose} style={{ marginLeft: "auto" }}>
            <Icon name="x" size={14} />
          </button>
        </header>

        <div className="seq-modal__body">
          <label className="seq-field">
            <span>Nombre</span>
            <input value={f.name} onChange={(e) => set({ name: e.target.value })} placeholder="Resumen CRM · Gerencia" />
          </label>

          <div style={{ display: "flex", gap: 12 }}>
            <label className="seq-field" style={{ flex: 1 }}>
              <span>Tipo</span>
              <select value={f.kind} onChange={(e) => set({ kind: e.target.value })}>
                <option value="brief">Resumen CRM (se arma solo)</option>
                <option value="custom">Mensaje propio</option>
              </select>
            </label>
            <label className="seq-field" style={{ flex: 1 }}>
              <span>Canal</span>
              <select value={f.channel} onChange={(e) => set({ channel: e.target.value })}>
                <option value="wa">WhatsApp</option>
                <option value="email">Email</option>
              </select>
            </label>
          </div>

          <label className="seq-field">
            <span>Destino {f.channel === "wa" ? "(número +51… o JID de grupo …@g.us, coma para varios)" : "(correo, coma para varios)"}</span>
            <input value={f.target} onChange={(e) => set({ target: e.target.value })} placeholder="+51980203171,12018757382-1438204825@g.us" />
          </label>
          <label className="seq-field">
            <span>Etiqueta del destino (opcional)</span>
            <input value={f.targetLabel} onChange={(e) => set({ targetLabel: e.target.value })} placeholder="Tu número + Gerencia NOVIT" />
          </label>

          {!isBrief && (
            <label className="seq-field">
              <span>Mensaje</span>
              <textarea rows={4} value={f.body} onChange={(e) => set({ body: e.target.value })} placeholder="Texto del mensaje a enviar…" />
            </label>
          )}

          <div style={{ display: "flex", gap: 12 }}>
            <label className="seq-field" style={{ flex: 1 }}>
              <span>Frecuencia</span>
              <select value={f.freq} onChange={(e) => set({ freq: e.target.value })}>
                <option value="weekly">Semanal</option>
                <option value="daily">Diaria</option>
                <option value="manual">Manual</option>
              </select>
            </label>
            {f.freq === "weekly" && (
              <label className="seq-field" style={{ flex: 1 }}>
                <span>Día</span>
                <select value={f.weekday} onChange={(e) => set({ weekday: e.target.value })}>
                  {WEEKDAYS.map((d, i) => (
                    <option key={i} value={i}>{d}</option>
                  ))}
                </select>
              </label>
            )}
            {f.freq !== "manual" && (
              <>
                <label className="seq-field" style={{ width: 90 }}>
                  <span>Hora</span>
                  <input type="number" min={0} max={23} value={f.hour} onChange={(e) => set({ hour: e.target.value })} />
                </label>
                <label className="seq-field" style={{ width: 90 }}>
                  <span>Min</span>
                  <input type="number" min={0} max={59} value={f.minute} onChange={(e) => set({ minute: e.target.value })} />
                </label>
              </>
            )}
          </div>

          <label className={`seq-testtoggle ${f.enabled ? "is-on" : ""}`}>
            <input type="checkbox" checked={f.enabled} onChange={(e) => set({ enabled: e.target.checked })} />
            <span className="seq-testtoggle__sw" />
            <span><b>Activa</b> — si la apagás, el runner la salta.</span>
          </label>
        </div>

        <footer>
          <button type="button" className="btn" onClick={onClose}>Cancelar</button>
          <button
            type="button"
            className="btn btn--primary"
            disabled={busy || !f.target.trim()}
            style={{ marginLeft: "auto" }}
            onClick={() =>
              onSave({
                op: "save",
                ...(sched ? { id: sched.id } : {}),
                name: f.name,
                kind: f.kind,
                channel: f.channel,
                target: f.target,
                targetLabel: f.targetLabel,
                body: f.body,
                freq: f.freq,
                weekday: f.freq === "weekly" ? f.weekday : "",
                hour: f.hour,
                minute: f.minute,
                enabled: String(f.enabled),
              })
            }
          >
            {busy ? "Guardando…" : "Guardar"}
          </button>
        </footer>
      </div>
    </div>
  );
}
