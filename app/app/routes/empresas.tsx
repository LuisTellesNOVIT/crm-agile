import { useState, type ReactNode } from "react";
import {
  useLoaderData,
  useFetcher,
  type ActionFunctionArgs,
} from "react-router";
import { prisma, isDbConfigured } from "../lib/db.server";
import { Card } from "../components/ui/Card";
import { Chip } from "../components/ui/Chip";
import { Icon } from "../components/shell/Icon";

// ---------- shapes ----------

type Empresa = {
  id: string;
  slug: string;
  name: string;
  brandColor: string;
  ruc: string | null;
  razonSocial: string | null;
  nombreComercial: string | null;
  estado: string | null;
  condicion: string | null;
  tipoContribuyente: string | null;
  ciiu: string | null;
  ciiuDescripcion: string | null;
  domicilioFiscal: string | null;
  distrito: string | null;
  provincia: string | null;
  departamento: string | null;
  ubigeo: string | null;
  fechaInscripcion: string | null;
  fechaInicioActividades: string | null;
  representanteLegal: string | null;
  representanteDni: string | null;
  representanteCargo: string | null;
  telefono: string | null;
  email: string | null;
  trabajadoresActivos: number | null;
  sistemaEmision: string | null;
  sistemaContabilidad: string | null;
  notas: string | null;
};

// ---------- loader ----------

export async function loader(): Promise<{ empresas: Empresa[] }> {
  if (!isDbConfigured) return { empresas: [] };
  const rows = await prisma.workspace.findMany({
    orderBy: { slug: "asc" },
  });
  return {
    empresas: rows.map((r) => ({
      ...r,
      fechaInscripcion: r.fechaInscripcion ? r.fechaInscripcion.toISOString() : null,
      fechaInicioActividades: r.fechaInicioActividades
        ? r.fechaInicioActividades.toISOString()
        : null,
    })),
  };
}

// ---------- action (update) ----------

const TEXT_FIELDS = [
  "ruc",
  "razonSocial",
  "nombreComercial",
  "estado",
  "condicion",
  "tipoContribuyente",
  "ciiu",
  "ciiuDescripcion",
  "domicilioFiscal",
  "distrito",
  "provincia",
  "departamento",
  "ubigeo",
  "representanteLegal",
  "representanteDni",
  "representanteCargo",
  "telefono",
  "email",
  "sistemaEmision",
  "sistemaContabilidad",
  "notas",
] as const;

const DATE_FIELDS = ["fechaInscripcion", "fechaInicioActividades"] as const;

export async function action({ request }: ActionFunctionArgs) {
  const fd = await request.formData();
  const slug = String(fd.get("slug") ?? "");
  if (!slug) return Response.json({ error: "missing slug" }, { status: 400 });

  const data: Record<string, unknown> = {};

  for (const k of TEXT_FIELDS) {
    const v = fd.get(k);
    if (v != null) data[k] = String(v).trim() || null;
  }
  for (const k of DATE_FIELDS) {
    const v = fd.get(k);
    if (v != null && String(v).trim()) data[k] = new Date(String(v));
    else data[k] = null;
  }
  const trabajadores = fd.get("trabajadoresActivos");
  if (trabajadores != null) {
    const n = parseInt(String(trabajadores), 10);
    data.trabajadoresActivos = Number.isFinite(n) ? n : null;
  }

  await prisma.workspace.update({ where: { slug }, data });
  return Response.json({ ok: true });
}

// ---------- UI ----------

const ESTADO_OPTIONS = [
  "ACTIVO",
  "SUSPENDIDO TEMPORAL",
  "BAJA DE OFICIO",
  "BAJA DEFINITIVA",
];
const CONDICION_OPTIONS = ["HABIDO", "NO HALLADO", "NO HABIDO"];
const TIPO_OPTIONS = [
  "SOCIEDAD ANONIMA CERRADA",
  "SOCIEDAD ANONIMA",
  "SOCIEDAD COMERCIAL DE RESP. LTDA",
  "EMPRESA INDIVIDUAL DE RESP. LTDA",
  "PERSONA NATURAL CON NEGOCIO",
];
const SISTEMA_OPTIONS = ["MANUAL", "COMPUTARIZADO", "ELECTRÓNICO"];

export default function EmpresasRoute() {
  const { empresas } = useLoaderData<typeof loader>();
  const [selectedSlug, setSelectedSlug] = useState(empresas[0]?.slug ?? "");
  const [editing, setEditing] = useState(false);
  const fetcher = useFetcher();

  const selected = empresas.find((e) => e.slug === selectedSlug) ?? empresas[0];
  const saving = fetcher.state !== "idle";

  if (empresas.length === 0) {
    return (
      <div className="empty-hint" style={{ padding: 32 }}>
        No hay empresas registradas — verificá la conexión a la DB.
      </div>
    );
  }

  return (
    <div className="emp">
      <aside className="emp__sidebar">
        <header className="emp__sidebar-head">
          <h2>Empresas</h2>
          <p className="muted" style={{ fontSize: 11 }}>
            {empresas.length} contribuyentes
          </p>
        </header>
        {empresas.map((e) => (
          <button
            key={e.slug}
            type="button"
            className={`emp__item ${e.slug === selected?.slug ? "is-active" : ""}`.trim()}
            onClick={() => {
              setSelectedSlug(e.slug);
              setEditing(false);
            }}
          >
            <div className={`ws-mark ws-mark--${e.slug}`}>
              {e.slug[0]?.toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="emp__item-name">{e.razonSocial ?? e.name}</div>
              <div className="emp__item-ruc mono">{e.ruc ?? "—"}</div>
            </div>
            <Chip tone={e.estado === "ACTIVO" ? "success" : "warn"} dot>
              {e.estado ?? "—"}
            </Chip>
          </button>
        ))}
      </aside>

      <main className="emp__main">
        {selected && (
          <fetcher.Form
            method="POST"
            key={selected.slug}
            onSubmit={() => setEditing(false)}
          >
            <input type="hidden" name="slug" value={selected.slug} />

            <header className="emp__head">
              <div className="emp__head-id">
                <div className={`ws-mark ws-mark--${selected.slug}`}>
                  {selected.slug[0]?.toUpperCase()}
                </div>
                <div className="emp__head-text">
                  <h1 className="emp__title">{selected.razonSocial ?? selected.name}</h1>
                  <div className="emp__sub">
                    <span className="mono">RUC <b>{selected.ruc ?? "—"}</b></span>
                    <span className="emp__sub-sep" />
                    <span>{selected.nombreComercial ?? selected.name}</span>
                    {selected.estado && (
                      <>
                        <span className="emp__sub-sep" />
                        <Chip tone={selected.estado === "ACTIVO" ? "success" : "warn"} dot>
                          {selected.estado}
                        </Chip>
                      </>
                    )}
                    {selected.condicion && (
                      <Chip tone={selected.condicion === "HABIDO" ? "success" : "danger"}>
                        {selected.condicion}
                      </Chip>
                    )}
                  </div>
                </div>
              </div>
              <div className="emp__head-actions">
                {!editing ? (
                  <button
                    type="button"
                    className="btn btn--primary"
                    onClick={() => setEditing(true)}
                  >
                    <Icon name="settings" size={13} /> Editar
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      className="btn"
                      onClick={() => setEditing(false)}
                      disabled={saving}
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="btn btn--primary"
                      disabled={saving}
                    >
                      {saving ? "Guardando…" : "Guardar"}
                    </button>
                  </>
                )}
              </div>
            </header>

            <div className="emp__body">
              <Section title="Identidad SUNAT">
                <Field label="RUC" name="ruc" value={selected.ruc} editing={editing} mono pattern="\d{11}" placeholder="11 dígitos" />
                <Field label="Razón social" name="razonSocial" value={selected.razonSocial} editing={editing} />
                <Field label="Nombre comercial" name="nombreComercial" value={selected.nombreComercial} editing={editing} />
                <Field label="Tipo de contribuyente" name="tipoContribuyente" value={selected.tipoContribuyente} editing={editing} options={TIPO_OPTIONS} />
              </Section>

              <Section title="Estado SUNAT">
                <Field label="Estado" name="estado" value={selected.estado} editing={editing} options={ESTADO_OPTIONS} />
                <Field label="Condición" name="condicion" value={selected.condicion} editing={editing} options={CONDICION_OPTIONS} />
                <Field label="Sistema de emisión" name="sistemaEmision" value={selected.sistemaEmision} editing={editing} options={SISTEMA_OPTIONS} />
                <Field label="Sistema de contabilidad" name="sistemaContabilidad" value={selected.sistemaContabilidad} editing={editing} options={SISTEMA_OPTIONS} />
              </Section>

              <Section title="Actividad económica">
                <Field label="CIIU" name="ciiu" value={selected.ciiu} editing={editing} mono placeholder="4 dígitos" />
                <Field label="Descripción" name="ciiuDescripcion" value={selected.ciiuDescripcion} editing={editing} fullWidth />
              </Section>

              <Section title="Domicilio fiscal">
                <Field label="Dirección" name="domicilioFiscal" value={selected.domicilioFiscal} editing={editing} fullWidth />
                <Field label="Distrito" name="distrito" value={selected.distrito} editing={editing} />
                <Field label="Provincia" name="provincia" value={selected.provincia} editing={editing} />
                <Field label="Departamento" name="departamento" value={selected.departamento} editing={editing} />
                <Field label="Ubigeo" name="ubigeo" value={selected.ubigeo} editing={editing} mono placeholder="6 dígitos INEI" />
              </Section>

              <Section title="Representante legal">
                <Field label="Nombre" name="representanteLegal" value={selected.representanteLegal} editing={editing} />
                <Field label="DNI" name="representanteDni" value={selected.representanteDni} editing={editing} mono placeholder="8 dígitos" />
                <Field label="Cargo" name="representanteCargo" value={selected.representanteCargo} editing={editing} />
              </Section>

              <Section title="Contacto">
                <Field label="Teléfono" name="telefono" value={selected.telefono} editing={editing} mono />
                <Field label="Email" name="email" value={selected.email} editing={editing} type="email" />
                <Field label="Trabajadores activos" name="trabajadoresActivos" value={selected.trabajadoresActivos?.toString() ?? null} editing={editing} type="number" mono />
              </Section>

              <Section title="Fechas SUNAT">
                <Field label="Fecha de inscripción" name="fechaInscripcion" value={selected.fechaInscripcion} editing={editing} type="date" />
                <Field label="Inicio de actividades" name="fechaInicioActividades" value={selected.fechaInicioActividades} editing={editing} type="date" />
              </Section>

              <Section title="Notas internas">
                <Field label="" name="notas" value={selected.notas} editing={editing} fullWidth multiline />
              </Section>
            </div>
          </fetcher.Form>
        )}
      </main>
    </div>
  );
}

// ---------- helpers ----------

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card>
      <Card.Header label={title} />
      <Card.Body>
        <div className="emp__grid">{children}</div>
      </Card.Body>
    </Card>
  );
}

function Field({
  label,
  name,
  value,
  editing,
  type = "text",
  options,
  mono,
  fullWidth,
  multiline,
  placeholder,
  pattern,
}: {
  label: string;
  name: string;
  value: string | null;
  editing: boolean;
  type?: "text" | "email" | "number" | "date";
  options?: readonly string[];
  mono?: boolean;
  fullWidth?: boolean;
  multiline?: boolean;
  placeholder?: string;
  pattern?: string;
}) {
  const displayValue = (() => {
    if (!value) return "—";
    if (type === "date") {
      try {
        return new Date(value).toLocaleDateString("es-PE", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        });
      } catch {
        return value;
      }
    }
    return value;
  })();

  const inputValue = (() => {
    if (!value) return "";
    if (type === "date") {
      try {
        return new Date(value).toISOString().slice(0, 10);
      } catch {
        return "";
      }
    }
    return value;
  })();

  return (
    <label
      className={`emp__field ${fullWidth ? "is-full" : ""}`.trim()}
    >
      {label && <span className="emp__field-label">{label}</span>}
      {editing ? (
        options ? (
          <select name={name} defaultValue={value ?? ""} className="emp__input">
            <option value="">—</option>
            {options.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        ) : multiline ? (
          <textarea
            name={name}
            defaultValue={value ?? ""}
            rows={3}
            className="emp__input"
            placeholder={placeholder}
          />
        ) : (
          <input
            type={type}
            name={name}
            defaultValue={inputValue}
            className={`emp__input ${mono ? "mono" : ""}`.trim()}
            placeholder={placeholder}
            pattern={pattern}
          />
        )
      ) : (
        <span className={`emp__field-value ${mono ? "mono" : ""}`.trim()}>
          {displayValue}
        </span>
      )}
    </label>
  );
}
