import { useEffect, useMemo, useState } from "react";
import { useLoaderData, useFetcher, useRevalidator, type LoaderFunctionArgs } from "react-router";
import { prisma } from "../lib/db.server";
import { requireUser } from "../lib/session.server";
import { useAppStore } from "../lib/store";
import { Icon, type IconName } from "../components/shell/Icon";

type Step = {
  kind: string;
  title: string;
  body: string;
  to?: "client" | "internal";
  templateKey?: string;
  delayDays?: number;
};
type SeqDTO = {
  id: string;
  name: string;
  active: boolean;
  category: string | null;
  description: string | null;
  trigger: string | null;
  steps: Step[];
};
type Tpl = { name: string; channel: string; body: string };
type DealLite = {
  id: string;
  publicId: string;
  name: string;
  value: number;
  stage: string;
  company: string;
  tier: string | null;
  phone: string | null;
};
type EnrollLite = { dealId: string; status: string; stepIndex: number; test: boolean; nextFireAt: string };

const KIND: Record<string, { label: string; icon: IconName; color: string; addable?: boolean }> = {
  trigger: { label: "Trigger", icon: "zap", color: "#2563eb" },
  delay: { label: "Delay", icon: "clock", color: "#64748b", addable: true },
  wa: { label: "WhatsApp", icon: "wa", color: "#16a34a", addable: true },
  email: { label: "Email", icon: "mail", color: "#6366f1", addable: true },
  branch: { label: "Condición", icon: "filter", color: "#7c3aed", addable: true },
  exit: { label: "Exit", icon: "x", color: "#dc2626" },
};
const CAT_COLOR: Record<string, string> = {
  Grande: "#dc2626",
  Consolidación: "#f59e0b",
  Regular: "#4f46e5",
  Test: "#64748b",
};
const STATUS: Record<string, { label: string; color: string }> = {
  active: { label: "En curso", color: "#16a34a" },
  done: { label: "Completada", color: "#2563eb" },
  exited: { label: "Salió (respondió)", color: "#7c3aed" },
  paused: { label: "Pausado", color: "#f59e0b" },
};

/** Deduce la categoría de una plantilla por el prefijo de su nombre. */
function tplCategory(name: string): string {
  if (name.startsWith("grandes_")) return "Grande";
  if (name.startsWith("consol_")) return "Consolidación";
  if (name.startsWith("regular_")) return "Regular";
  if (name.startsWith("test_")) return "Test";
  return "Otros";
}

export async function loader({ request }: LoaderFunctionArgs) {
  await requireUser(request);
  const wss = await prisma.workspace.findMany({ where: { slug: { in: ["novit", "sharky"] } }, select: { id: true, slug: true } });
  const ids = wss.map((w) => w.id);
  const idToSlug = new Map(wss.map((w) => [w.id, w.slug]));
  const [seqs, tpls, deals] = await Promise.all([
    prisma.sequence.findMany({ where: { workspaceId: { in: ids } }, orderBy: { name: "asc" } }),
    prisma.template.findMany({ where: { workspaceId: { in: ids } }, select: { name: true, channel: true, body: true, workspaceId: true } }),
    prisma.deal.findMany({
      where: { workspaceId: { in: ids } },
      orderBy: { publicId: "asc" },
      select: {
        id: true,
        publicId: true,
        name: true,
        value: true,
        stage: true,
        workspaceId: true,
        company: { select: { name: true, tier: true, telefono: true, contacts: { select: { phone: true }, take: 3 } } },
      },
    }),
  ]);
  const seqIds = seqs.map((s) => s.id);
  const enrolls = await prisma.sequenceEnrollment.findMany({
    where: { sequenceId: { in: seqIds } },
    select: { sequenceId: true, dealId: true, status: true, stepIndex: true, testTarget: true, nextFireAt: true },
  });

  const bySlug: Record<string, SeqDTO[]> = { novit: [], sharky: [] };
  for (const s of seqs) {
    const slug = idToSlug.get(s.workspaceId);
    if (!slug) continue;
    const n = (s.nodes ?? {}) as Record<string, unknown>;
    const steps: Step[] = Array.isArray(n) ? (n as Step[]) : Array.isArray(n.steps) ? (n.steps as Step[]) : [];
    bySlug[slug].push({
      id: s.id,
      name: s.name,
      active: s.active,
      category: (n.category as string) ?? null,
      description: (n.description as string) ?? null,
      trigger: (n.trigger as string) ?? null,
      steps,
    });
  }
  const tplBySlug: Record<string, Tpl[]> = { novit: [], sharky: [] };
  for (const t of tpls) {
    const slug = idToSlug.get(t.workspaceId);
    if (!slug) continue;
    tplBySlug[slug].push({ name: t.name, channel: t.channel as unknown as string, body: t.body });
  }
  const dealsBySlug: Record<string, DealLite[]> = { novit: [], sharky: [] };
  for (const d of deals) {
    const slug = idToSlug.get(d.workspaceId);
    if (!slug) continue;
    const phone = d.company?.telefono ?? d.company?.contacts.find((c) => c.phone)?.phone ?? null;
    dealsBySlug[slug].push({
      id: d.id,
      publicId: d.publicId,
      name: d.name,
      value: d.value,
      stage: d.stage,
      company: d.company?.name ?? "—",
      tier: d.company?.tier ?? null,
      phone,
    });
  }
  const enrollBySeq: Record<string, EnrollLite[]> = {};
  for (const e of enrolls) {
    (enrollBySeq[e.sequenceId] ??= []).push({
      dealId: e.dealId,
      status: e.status,
      stepIndex: e.stepIndex,
      test: !!e.testTarget,
      nextFireAt: e.nextFireAt.toISOString(),
    });
  }
  return { bySlug, tplBySlug, dealsBySlug, enrollBySeq };
}

export default function SequencesRoute() {
  const { bySlug, tplBySlug, dealsBySlug, enrollBySeq } = useLoaderData<typeof loader>();
  const workspace = useAppStore((s) => s.workspace);
  const slug = workspace === "all" ? "novit" : workspace;
  const seqs: SeqDTO[] = bySlug[slug] ?? bySlug.novit ?? [];
  const templates: Tpl[] = tplBySlug[slug] ?? tplBySlug.novit ?? [];
  const deals: DealLite[] = dealsBySlug[slug] ?? dealsBySlug.novit ?? [];
  const tplBody = useMemo(() => new Map(templates.map((t) => [t.name, t.body])), [templates]);

  const fetcher = useFetcher();
  const enrollFetcher = useFetcher();
  const revalidator = useRevalidator();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<SeqDTO | null>(null);
  const [tplEdits, setTplEdits] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);
  const [menuIdx, setMenuIdx] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [enrollOpen, setEnrollOpen] = useState(false);

  const enrolled: EnrollLite[] = (selectedId && enrollBySeq[selectedId]) || [];
  const dealById = useMemo(() => new Map(deals.map((d) => [d.id, d])), [deals]);
  function enrollDeal(dealId: string, test: boolean) {
    if (!selectedId) return;
    enrollFetcher.submit(
      { op: "enroll", sequenceId: selectedId, dealId, test: String(test) },
      { method: "post", action: "/api/sequence-enroll" },
    );
  }
  function unenrollDeal(dealId: string) {
    if (!selectedId) return;
    enrollFetcher.submit(
      { op: "unenroll", sequenceId: selectedId, dealId },
      { method: "post", action: "/api/sequence-enroll" },
    );
  }
  useEffect(() => {
    if (enrollFetcher.state === "idle" && enrollFetcher.data && (enrollFetcher.data as { ok?: boolean }).ok) {
      revalidator.revalidate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enrollFetcher.state, enrollFetcher.data]);

  // default selection
  useEffect(() => {
    if (selectedId == null && seqs.length) setSelectedId(seqs[0].id);
  }, [seqs, selectedId]);
  // (re)load draft when selection changes
  useEffect(() => {
    const s = seqs.find((x) => x.id === selectedId);
    if (s) {
      setDraft(structuredClone(s));
      setTplEdits({});
      setDirty(false);
      setEditing(null);
      setMenuIdx(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);
  // after a successful save, refresh + clear dirty
  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data && (fetcher.data as { ok?: boolean }).ok) {
      setDirty(false);
      setTplEdits({});
      revalidator.revalidate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetcher.state, fetcher.data]);

  function patch(fn: (d: SeqDTO) => void) {
    setDraft((d) => {
      if (!d) return d;
      const nd = structuredClone(d);
      fn(nd);
      return nd;
    });
    setDirty(true);
  }
  function setTpl(name: string, body: string) {
    setTplEdits((e) => ({ ...e, [name]: body }));
    setDirty(true);
  }
  function bodyOf(name?: string): string {
    if (!name) return "";
    return tplEdits[name] ?? tplBody.get(name) ?? "";
  }

  function save() {
    if (!draft) return;
    const nodes = { category: draft.category, description: draft.description, trigger: draft.trigger, steps: draft.steps };
    const templatesPayload = Object.entries(tplEdits).map(([name, body]) => ({ name, body }));
    fetcher.submit(
      {
        id: draft.id,
        nodes: JSON.stringify(nodes),
        active: String(draft.active),
        name: draft.name,
        templates: JSON.stringify(templatesPayload),
      },
      { method: "post", action: "/api/sequence-update" },
    );
  }
  function toggleActive() {
    if (!draft) return;
    const next = !draft.active;
    setDraft((d) => (d ? { ...d, active: next } : d));
    fetcher.submit({ id: draft.id, active: String(next) }, { method: "post", action: "/api/sequence-update" });
  }

  function moveNode(idx: number, dir: -1 | 1) {
    patch((d) => {
      const j = idx + dir;
      if (j < 0 || j >= d.steps.length) return;
      [d.steps[idx], d.steps[j]] = [d.steps[j], d.steps[idx]];
    });
    setMenuIdx(null);
  }
  function deleteNode(idx: number) {
    patch((d) => d.steps.splice(idx, 1));
    setMenuIdx(null);
  }
  function addNode(kind: string) {
    const defaults: Record<string, Step> = {
      wa: { kind: "wa", title: "WhatsApp · Nuevo mensaje", body: "Mensaje al cliente", to: "client" },
      email: { kind: "email", title: "Email · Nuevo", body: "Email al cliente", to: "client" },
      delay: { kind: "delay", title: "Esperar 1 día", body: "Si no responde, continuar", delayDays: 1 },
      branch: { kind: "branch", title: "¿Respondió?", body: "Exit si responde" },
    };
    const step = defaults[kind];
    if (!step) return;
    patch((d) => {
      const exitIdx = d.steps.findIndex((s) => s.kind === "exit");
      if (exitIdx >= 0) d.steps.splice(exitIdx, 0, step);
      else d.steps.push(step);
    });
    setAdding(false);
  }

  if (!seqs.length) {
    return (
      <div style={{ padding: "20px 24px" }}>
        <h1 style={{ fontSize: "var(--fs-xl)", fontWeight: 600 }}>Secuencias</h1>
        <p style={{ color: "var(--fg-3)", marginTop: 8 }}>No hay secuencias en este grupo.</p>
      </div>
    );
  }

  const cat = draft?.category;
  const catColor = cat ? CAT_COLOR[cat] ?? "var(--fg-3)" : "var(--fg-3)";
  const saving = fetcher.state !== "idle";

  return (
    <div className="seq-page">
      {/* Toolbar: pestañas de secuencias + estado + guardar */}
      <div className="seq-toolbar">
        <span className="seq-tabs__label">Elegí una secuencia:</span>
        <div className="seq-tabs">
          {seqs.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`seq-tab ${s.id === selectedId ? "is-active" : ""}`}
              style={{ ["--c" as string]: s.category ? CAT_COLOR[s.category] ?? "var(--fg-3)" : "var(--fg-3)" } as React.CSSProperties}
              onClick={() => setSelectedId(s.id)}
              title={s.name}
            >
              <span className="seq-tab__dot" />
              {s.category ?? s.name}
            </button>
          ))}
        </div>
        <span style={{ flex: 1 }} />
        <button
          type="button"
          className={`seq-toggle ${draft?.active ? "is-on" : ""}`}
          onClick={toggleActive}
          disabled={saving}
          title={draft?.active ? "Pausar secuencia" : "Activar secuencia"}
        >
          <span className="seq-toggle__dot" />
          {draft?.active ? "Activa" : "Pausada"}
        </button>
        <button type="button" className="btn btn--primary" onClick={save} disabled={!dirty || saving}>
          {saving ? "Guardando…" : dirty ? "Guardar cambios" : "Guardado"}
        </button>
      </div>

      {draft && (
        <div className="seq-head">
          {cat && <span className="seq-cat" style={{ background: catColor }}>{cat}</span>}
          <span className="seq-head__name">{draft.name}</span>
          {draft.description && <div className="seq-head__desc">{draft.description}</div>}
        </div>
      )}

      {/* Inscritos: tratos asignados a esta secuencia */}
      {draft && (
        <div className="seq-enroll">
          <div className="seq-enroll__bar">
            <strong>Tratos inscritos</strong>
            <span className="seq-enroll__count">{enrolled.length}</span>
            {!draft.active && (
              <span className="seq-enroll__hint">La secuencia está <b>pausada</b>: los inscritos esperan (salvo modo prueba).</span>
            )}
            <span style={{ flex: 1 }} />
            <button type="button" className="btn btn--primary" onClick={() => setEnrollOpen(true)}>
              <Icon name="plus" size={14} /> Inscribir trato
            </button>
          </div>
          {enrolled.length > 0 && (
            <div className="seq-enroll__list">
              {enrolled.map((en) => {
                const d = dealById.get(en.dealId);
                const st = STATUS[en.status] ?? { label: en.status, color: "var(--fg-3)" };
                return (
                  <div key={en.dealId} className="seq-enroll__item">
                    <span className="seq-enroll__pid">{d?.publicId ?? "—"}</span>
                    <span className="seq-enroll__name">{d ? `${d.company} · ${d.name}` : en.dealId}</span>
                    {en.test && <span className="seq-enroll__test">modo prueba → tu número</span>}
                    <span className="seq-enroll__status" style={{ ["--c" as string]: st.color } as React.CSSProperties}>
                      {st.label} · paso {en.stepIndex}
                    </span>
                    <button type="button" className="seq-enroll__rm" onClick={() => unenrollDeal(en.dealId)} title="Quitar de la secuencia">
                      <Icon name="x" size={13} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Canvas tipo workflow */}
      <div className="seq-canvas" onClick={() => setMenuIdx(null)}>
        <div className="seq-flow">
          {draft?.steps.map((step, i) => {
            const meta = KIND[step.kind] ?? KIND.delay;
            return (
              <div key={i}>
                <div
                  className={`seq-node ${step.kind === "exit" ? "seq-node--exit" : ""}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditing(i);
                  }}
                >
                  <div className="seq-node__head">
                    <span className="seq-node__icon" style={{ background: meta.color }}>
                      <Icon name={meta.icon} size={16} />
                    </span>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div className="seq-node__kind">{meta.label}</div>
                      <div className="seq-node__title">{step.title}</div>
                    </div>
                    <button
                      type="button"
                      className="seq-node__menu"
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuIdx(menuIdx === i ? null : i);
                      }}
                    >
                      <Icon name="more" size={16} />
                    </button>
                    {menuIdx === i && (
                      <div className="seq-menu" onClick={(e) => e.stopPropagation()}>
                        <button type="button" onClick={() => { setEditing(i); setMenuIdx(null); }}>Editar</button>
                        <button type="button" onClick={() => moveNode(i, -1)} disabled={i === 0}>Subir</button>
                        <button type="button" onClick={() => moveNode(i, 1)} disabled={i === draft.steps.length - 1}>Bajar</button>
                        {step.kind !== "trigger" && step.kind !== "exit" && (
                          <button type="button" className="is-danger" onClick={() => deleteNode(i)}>Eliminar</button>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="seq-node__body">{step.body}</div>
                  {(step.kind === "wa" || step.kind === "email") && (
                    <div className="seq-node__meta">
                      <span className={`seq-pill ${step.to === "internal" ? "is-internal" : "is-client"}`}>
                        {step.to === "internal" ? "→ Equipo" : "→ Cliente"}
                      </span>
                      {step.templateKey && <span className="seq-tplref">📋 {step.templateKey}</span>}
                    </div>
                  )}
                </div>
                {i < draft.steps.length - 1 && <div className="seq-conn" />}
              </div>
            );
          })}

          {/* Agregar paso */}
          <div className="seq-conn" />
          <div className="seq-add">
            {!adding ? (
              <button type="button" className="seq-add__btn" onClick={() => setAdding(true)}>
                <Icon name="plus" size={14} /> Agregar paso
              </button>
            ) : (
              <div className="seq-add__menu">
                {Object.entries(KIND)
                  .filter(([, m]) => m.addable)
                  .map(([k, m]) => (
                    <button key={k} type="button" onClick={() => addNode(k)} style={{ borderColor: m.color }}>
                      <span className="seq-node__icon" style={{ background: m.color, width: 22, height: 22 }}>
                        <Icon name={m.icon} size={12} />
                      </span>
                      {m.label}
                    </button>
                  ))}
                <button type="button" className="seq-add__cancel" onClick={() => setAdding(false)}>Cancelar</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal de edición de nodo */}
      {editing != null && draft && draft.steps[editing] && (
        <NodeEditor
          step={draft.steps[editing]}
          templates={templates}
          templateBody={bodyOf}
          category={draft.category}
          onChangeStep={(p) => patch((d) => Object.assign(d.steps[editing], p))}
          onChangeTemplate={setTpl}
          onClose={() => setEditing(null)}
        />
      )}

      {/* Modal de inscripción de tratos */}
      {enrollOpen && draft && (
        <EnrollModal
          seqName={draft.name}
          deals={deals}
          enrolledIds={new Set(enrolled.map((e) => e.dealId))}
          onEnroll={enrollDeal}
          busy={enrollFetcher.state !== "idle"}
          onClose={() => setEnrollOpen(false)}
        />
      )}
    </div>
  );
}

function EnrollModal({
  seqName,
  deals,
  enrolledIds,
  onEnroll,
  busy,
  onClose,
}: {
  seqName: string;
  deals: DealLite[];
  enrolledIds: Set<string>;
  onEnroll: (dealId: string, test: boolean) => void;
  busy: boolean;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const [test, setTest] = useState(false);
  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return deals
      .filter((d) => !enrolledIds.has(d.id))
      .filter((d) =>
        !needle ||
        d.company.toLowerCase().includes(needle) ||
        d.name.toLowerCase().includes(needle) ||
        d.publicId.toLowerCase().includes(needle),
      )
      .slice(0, 60);
  }, [deals, enrolledIds, q]);

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <div className="seq-modal seq-modal--wide" onClick={(e) => e.stopPropagation()}>
        <header>
          <span className="seq-node__icon" style={{ background: "#16a34a" }}>
            <Icon name="users" size={15} />
          </span>
          <div>
            <div style={{ fontSize: 10, fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: ".06em", color: "var(--fg-3)" }}>
              Inscribir en
            </div>
            <div style={{ fontWeight: 600 }}>{seqName}</div>
          </div>
          <button type="button" className="btn btn--icon" onClick={onClose} style={{ marginLeft: "auto" }}>
            <Icon name="x" size={14} />
          </button>
        </header>

        <div className="seq-modal__body">
          <label className={`seq-testtoggle ${test ? "is-on" : ""}`}>
            <input type="checkbox" checked={test} onChange={(e) => setTest(e.target.checked)} />
            <span className="seq-testtoggle__sw" />
            <span>
              <b>Modo prueba</b> — los mensajes van a <b>tu número</b> (+51980203171), no al cliente. Ideal para validar el flujo.
            </span>
          </label>

          <input
            className="seq-search"
            placeholder="Buscar por cliente, trato o ID…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            autoFocus
          />

          <div className="seq-deal-list">
            {list.length === 0 && <div className="seq-deal-empty">Sin tratos para mostrar.</div>}
            {list.map((d) => (
              <div key={d.id} className="seq-deal-row">
                <span className="seq-enroll__pid">{d.publicId}</span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="seq-deal-row__co">{d.company}</div>
                  <div className="seq-deal-row__nm">{d.name}</div>
                </div>
                {d.tier && <span className="seq-deal-row__tier">{d.tier}</span>}
                {!d.phone && !test && <span className="seq-deal-row__nophone" title="Sin teléfono: el envío al cliente quedará en espera">sin teléfono</span>}
                <button
                  type="button"
                  className="btn btn--primary btn--sm"
                  disabled={busy}
                  onClick={() => onEnroll(d.id, test)}
                >
                  Inscribir
                </button>
              </div>
            ))}
          </div>
        </div>

        <footer>
          <span style={{ fontSize: 12, color: "var(--fg-3)" }}>
            El envío real ocurre cuando el motor corre en la Mac. Los inscritos aparecen abajo al instante.
          </span>
          <button type="button" className="btn btn--primary" onClick={onClose} style={{ marginLeft: "auto" }}>Listo</button>
        </footer>
      </div>
    </div>
  );
}

function NodeEditor({
  step,
  templates,
  templateBody,
  category,
  onChangeStep,
  onChangeTemplate,
  onClose,
}: {
  step: Step;
  templates: Tpl[];
  templateBody: (name?: string) => string;
  category: string | null;
  onChangeStep: (patch: Partial<Step>) => void;
  onChangeTemplate: (name: string, body: string) => void;
  onClose: () => void;
}) {
  const meta = KIND[step.kind] ?? KIND.delay;
  const isMsg = step.kind === "wa" || step.kind === "email";
  const channel = step.kind === "email" ? "email" : "wa";
  const tplOptions = templates.filter((t) => t.channel === channel);
  // Agrupa las plantillas por categoría, con la del flujo actual primero.
  const tplGroups = useMemo(() => {
    const g: Record<string, Tpl[]> = {};
    for (const t of tplOptions) (g[tplCategory(t.name)] ??= []).push(t);
    const order = [category ?? "", "Grande", "Consolidación", "Regular", "Test", "Otros"].filter(
      (v, i, a) => v && a.indexOf(v) === i,
    );
    return order.filter((c) => g[c]).map((c) => ({ label: c, items: g[c] }));
  }, [tplOptions, category]);

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <div className="seq-modal" onClick={(e) => e.stopPropagation()}>
        <header>
          <span className="seq-node__icon" style={{ background: meta.color }}>
            <Icon name={meta.icon} size={15} />
          </span>
          <div>
            <div style={{ fontSize: 10, fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: ".06em", color: "var(--fg-3)" }}>
              {meta.label}
            </div>
            <div style={{ fontWeight: 600 }}>Editar paso</div>
          </div>
          <button type="button" className="btn btn--icon" onClick={onClose} style={{ marginLeft: "auto" }}>
            <Icon name="x" size={14} />
          </button>
        </header>

        <div className="seq-modal__body">
          <label className="seq-field">
            <span>Título</span>
            <input value={step.title} onChange={(e) => onChangeStep({ title: e.target.value })} />
          </label>
          <label className="seq-field">
            <span>Descripción (lo que se ve en la tarjeta)</span>
            <input value={step.body} onChange={(e) => onChangeStep({ body: e.target.value })} />
          </label>

          {step.kind === "delay" && (
            <label className="seq-field">
              <span>Esperar (días)</span>
              <input
                type="number"
                min={0}
                value={step.delayDays ?? 1}
                onChange={(e) => onChangeStep({ delayDays: Math.max(0, parseInt(e.target.value || "0", 10)) })}
              />
            </label>
          )}

          {isMsg && (
            <>
              <div className="seq-field">
                <span>Destinatario</span>
                <div style={{ display: "flex", gap: 8 }}>
                  {(["client", "internal"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      className={`seq-seg ${step.to === t ? "is-on" : ""}`}
                      onClick={() => onChangeStep({ to: t })}
                    >
                      {t === "client" ? "Cliente" : "Equipo interno"}
                    </button>
                  ))}
                </div>
              </div>
              <label className="seq-field">
                <span>Plantilla ({channel === "wa" ? "WhatsApp" : "Email"})</span>
                <select value={step.templateKey ?? ""} onChange={(e) => onChangeStep({ templateKey: e.target.value || undefined })}>
                  <option value="">— sin plantilla —</option>
                  {tplGroups.map((g) => (
                    <optgroup key={g.label} label={g.label}>
                      {g.items.map((t) => (
                        <option key={t.name} value={t.name}>{t.name}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </label>
              {step.templateKey && (
                <label className="seq-field">
                  <span>
                    Texto de la plantilla <i style={{ color: "var(--fg-4)" }}>(usa {"{{nombre}}"}, {"{{empresa}}"}, {"{{trato}}"}, {"{{valor}}"}, {"{{ejecutivo}}"}, {"{{industria}}"})</i>
                  </span>
                  <textarea
                    rows={5}
                    value={templateBody(step.templateKey)}
                    onChange={(e) => onChangeTemplate(step.templateKey!, e.target.value)}
                  />
                  <i style={{ fontSize: 11, color: "var(--fg-4)" }}>Editás la plantilla compartida — afecta a todos los pasos que la usan.</i>
                </label>
              )}
            </>
          )}
        </div>

        <footer>
          <button type="button" className="btn btn--primary" onClick={onClose}>Listo</button>
        </footer>
      </div>
    </div>
  );
}
