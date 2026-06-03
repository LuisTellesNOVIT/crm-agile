import { useLoaderData, type LoaderFunctionArgs } from "react-router";
import { prisma } from "../lib/db.server";
import { requireUser } from "../lib/session.server";
import { useAppStore } from "../lib/store";
import { Card } from "../components/ui/Card";
import { Chip } from "../components/ui/Chip";
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

const NODE_ICON: Record<string, IconName> = {
  trigger: "zap",
  delay: "command",
  wa: "chat",
  email: "inbox",
  branch: "filter",
  exit: "check",
};
const NODE_COLOR: Record<string, string> = {
  trigger: "var(--accent)",
  delay: "var(--fg-3)",
  wa: "var(--success)",
  email: "var(--info)",
  branch: "var(--warning)",
  exit: "var(--danger)",
};
const CAT_COLOR: Record<string, string> = {
  Grande: "#dc2626",
  Consolidación: "#f59e0b",
  Regular: "#4f46e5",
  Test: "#64748b",
};

export async function loader({ request }: LoaderFunctionArgs) {
  await requireUser(request);
  const wss = await prisma.workspace.findMany({
    where: { slug: { in: ["novit", "sharky"] } },
    select: { id: true, slug: true },
  });
  const ids = wss.map((w) => w.id);
  const idToSlug = new Map(wss.map((w) => [w.id, w.slug]));
  const [seqs, tpls] = await Promise.all([
    prisma.sequence.findMany({ where: { workspaceId: { in: ids } }, orderBy: { name: "asc" } }),
    prisma.template.findMany({ where: { workspaceId: { in: ids } }, select: { name: true, channel: true, body: true } }),
  ]);
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
  const templates: Record<string, { channel: string; body: string }> = {};
  for (const t of tpls) templates[t.name] = { channel: t.channel as unknown as string, body: t.body };
  return { bySlug, templates };
}

export default function SequencesRoute() {
  const { bySlug, templates } = useLoaderData<typeof loader>();
  const workspace = useAppStore((s) => s.workspace);
  const seqs: SeqDTO[] =
    workspace === "all"
      ? [...(bySlug.novit ?? []), ...(bySlug.sharky ?? [])]
      : bySlug[workspace] ?? bySlug.novit ?? [];

  return (
    <div style={{ padding: "20px 24px", display: "grid", gap: 16, maxWidth: 1100 }}>
      <header>
        <h1 style={{ fontSize: "var(--fs-xl)", fontWeight: 600, letterSpacing: "-0.01em" }}>Secuencias</h1>
        <p style={{ color: "var(--fg-3)", fontSize: "var(--fs-sm)" }}>
          Flujos automatizados por categoría de cliente — trigger → delay → mensaje → condición → exit.
          Cada paso de WhatsApp/Email usa una <b>plantilla</b> reutilizable.
        </p>
      </header>

      {seqs.length === 0 && (
        <Card>
          <Card.Body>
            <div style={{ padding: 20, textAlign: "center", color: "var(--fg-3)" }}>
              No hay secuencias en este grupo todavía.
            </div>
          </Card.Body>
        </Card>
      )}

      {seqs.map((seq) => {
        const catColor = seq.category ? CAT_COLOR[seq.category] ?? "var(--fg-3)" : "var(--fg-3)";
        return (
          <Card key={seq.id}>
            <Card.Header
              label="Secuencia"
              sub={seq.active ? <Chip tone="success" dot>Activa</Chip> : <Chip dot>Desactivada</Chip>}
            >
              {seq.category && (
                <span
                  style={{
                    fontSize: 10,
                    fontFamily: "var(--font-mono)",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    color: "#fff",
                    background: catColor,
                    padding: "2px 7px",
                    borderRadius: 5,
                    marginRight: 8,
                  }}
                >
                  {seq.category}
                </span>
              )}
              <span style={{ fontWeight: 600, fontSize: "var(--fs-sm)" }}>{seq.name}</span>
            </Card.Header>
            <Card.Body>
              {seq.description && (
                <p style={{ fontSize: "var(--fs-sm)", color: "var(--fg-2)", margin: "0 0 4px" }}>{seq.description}</p>
              )}
              {seq.trigger && (
                <p style={{ fontSize: 11.5, color: "var(--fg-3)", margin: "0 0 14px" }}>
                  <b style={{ color: "var(--fg-2)" }}>Disparador:</b> {seq.trigger}
                </p>
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {seq.steps.map((n, i) => (
                  <SeqNode key={i} node={n} last={i === seq.steps.length - 1} templates={templates} />
                ))}
              </div>
            </Card.Body>
          </Card>
        );
      })}
    </div>
  );
}

function SeqNode({
  node,
  last,
  templates,
}: {
  node: Step;
  last: boolean;
  templates: Record<string, { channel: string; body: string }>;
}) {
  const color = NODE_COLOR[node.kind] ?? "var(--fg-3)";
  const icon = NODE_ICON[node.kind] ?? "command";
  const tpl = node.templateKey ? templates[node.templateKey] : undefined;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "32px 1fr", gap: 10, alignItems: "stretch" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 6,
            background: color,
            color: "#fff",
            display: "grid",
            placeItems: "center",
            flexShrink: 0,
          }}
        >
          <Icon name={icon} size={14} />
        </div>
        {!last && <div style={{ flex: 1, width: 2, background: "var(--border-2)", marginTop: 2 }} />}
      </div>
      <div style={{ paddingBottom: last ? 0 : 10, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontWeight: 600, fontSize: "var(--fs-sm)" }}>{node.title}</span>
          {node.to && (
            <span
              style={{
                fontSize: 9.5,
                fontFamily: "var(--font-mono)",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                padding: "1px 6px",
                borderRadius: 4,
                background: node.to === "client" ? "var(--accent-soft)" : "rgba(220,38,38,0.10)",
                color: node.to === "client" ? "var(--accent)" : "var(--danger)",
                border: `1px solid ${node.to === "client" ? "var(--accent-border)" : "rgba(220,38,38,0.25)"}`,
              }}
            >
              {node.to === "client" ? "→ Cliente" : "→ Equipo interno"}
            </span>
          )}
        </div>
        <div style={{ fontSize: 12, color: "var(--fg-3)", marginTop: 2 }}>{node.body}</div>
        {node.templateKey && (
          <div
            style={{
              marginTop: 6,
              padding: "6px 9px",
              background: "var(--bg-2)",
              border: "1px solid var(--border-2)",
              borderRadius: 6,
              fontSize: 11.5,
            }}
          >
            <span style={{ fontFamily: "var(--font-mono)", color: "var(--fg-3)" }}>
              Plantilla: <b style={{ color: "var(--fg-2)" }}>{node.templateKey}</b>
            </span>
            {tpl && (
              <div style={{ color: "var(--fg-2)", marginTop: 3, lineHeight: 1.4, whiteSpace: "pre-wrap" }}>
                {tpl.body.length > 160 ? tpl.body.slice(0, 159) + "…" : tpl.body}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
