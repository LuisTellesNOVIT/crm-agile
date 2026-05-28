import { sequences } from "../lib/mock/rich";
import { Card } from "../components/ui/Card";
import { Chip } from "../components/ui/Chip";
import { Icon, type IconName } from "../components/shell/Icon";
import type { SequenceNode } from "../lib/types";

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

export default function SequencesRoute() {
  return (
    <div style={{ padding: "20px 24px", display: "grid", gap: 16, maxWidth: 1100 }}>
      <header>
        <h1 style={{ fontSize: "var(--fs-xl)", fontWeight: 600, letterSpacing: "-0.01em" }}>Secuencias</h1>
        <p style={{ color: "var(--fg-3)", fontSize: "var(--fs-sm)" }}>
          Flows automatizados — trigger → delay → action → condition → exit
        </p>
      </header>
      {sequences.map((seq) => (
        <Card key={seq.id}>
          <Card.Header label="Sequence" sub={seq.active ? <Chip tone="success" dot>Activa</Chip> : <Chip dot>Pausada</Chip>}>
            <span style={{ fontWeight: 600, fontSize: "var(--fs-sm)" }}>{seq.name}</span>
          </Card.Header>
          <Card.Body>
            <div style={{ display: "flex", gap: 14, marginBottom: 14, flexWrap: "wrap" }}>
              <Stat label="Enrolados" v={seq.stats.enrolled} />
              <Stat label="Completados" v={seq.stats.completed} />
              <Stat label="Reply rate" v={`${seq.stats.replyRate}%`} accent="success" />
              <Stat label="Meeting booked" v={seq.stats.meetingBooked} accent="accent" />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {seq.nodes.map((n, i) => (
                <SeqNode key={i} node={n} index={i} />
              ))}
            </div>
          </Card.Body>
        </Card>
      ))}
    </div>
  );
}

function Stat({ label, v, accent }: { label: string; v: number | string; accent?: "success" | "accent" }) {
  const color = accent === "success" ? "var(--success)" : accent === "accent" ? "var(--accent)" : "var(--fg)";
  return (
    <div>
      <div style={{ fontSize: 10, fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--fg-4)" }}>
        {label}
      </div>
      <div className="mono" style={{ fontSize: "var(--fs-lg)", fontWeight: 600, color }}>
        {v}
      </div>
    </div>
  );
}

function SeqNode({ node, index }: { node: SequenceNode; index: number }) {
  const color = NODE_COLOR[node.kind] ?? "var(--fg-3)";
  const icon = NODE_ICON[node.kind] ?? "command";
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "32px 1fr",
        gap: 10,
        alignItems: "stretch",
        position: "relative",
      }}
    >
      <div style={{ position: "relative" }}>
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 6,
            background: color,
            color: "#fff",
            display: "grid",
            placeItems: "center",
            zIndex: 1,
            position: "relative",
          }}
        >
          <Icon name={icon} size={14} />
        </div>
        {index < 8 && (
          <div
            style={{
              position: "absolute",
              left: 14,
              top: 28,
              bottom: -6,
              width: 1,
              background: "var(--border)",
            }}
          />
        )}
      </div>
      <div
        style={{
          padding: "6px 10px",
          background: "var(--bg-2)",
          border: "1px solid var(--border-2)",
          borderRadius: "var(--radius-sm)",
        }}
      >
        <div style={{ fontSize: "var(--fs-sm)", fontWeight: 500 }}>
          {node.title}
        </div>
        <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-3)" }}>
          {node.body}
        </div>
      </div>
    </div>
  );
}
