import { useState } from "react";
import { Button } from "../components/ui/Button";
import { Chip } from "../components/ui/Chip";
import { Kbd } from "../components/ui/Kbd";
import { Card } from "../components/ui/Card";
import { Avatar } from "../components/ui/Avatar";
import { StatusDot } from "../components/ui/StatusDot";
import { Tabs } from "../components/ui/Tabs";
import { Table, type Column } from "../components/ui/Table";
import { Icon } from "../components/shell/Icon";

type Row = { id: string; name: string; value: number; stage: string };

const ROWS: Row[] = [
  { id: "NOVIT-0012", name: "Data Lake + Snowflake", value: 540000, stage: "Negotiation" },
  { id: "NOVIT-0007", name: "ERP Microsoft Dynamics", value: 680000, stage: "Negotiation" },
  { id: "NOVIT-0014", name: "Plataforma de loyalty", value: 310000, stage: "Proposal" },
];

const COLS: Column<Row>[] = [
  { key: "id", label: "ID", width: 120, render: (r) => <span className="mono">{r.id}</span> },
  { key: "name", label: "Deal" },
  {
    key: "value",
    label: "Valor",
    align: "right",
    render: (r) => <span className="mono">${r.value.toLocaleString("en-US")}</span>,
  },
  { key: "stage", label: "Stage", render: (r) => <Chip tone="accent">{r.stage}</Chip> },
];

export default function AtomsRoute() {
  const [tab, setTab] = useState("buttons");
  return (
    <div style={{ padding: "20px 24px", display: "grid", gap: 20, maxWidth: 1100 }}>
      <header>
        <h1
          style={{
            fontSize: "var(--fs-xl)",
            fontWeight: 600,
            letterSpacing: "-0.01em",
          }}
        >
          Atomic components
        </h1>
        <p style={{ color: "var(--fg-3)", fontSize: "var(--fs-sm)" }}>
          Wrappers React sobre las clases CSS del proto. Verificación visual antes de
          construir vistas.
        </p>
      </header>

      <Tabs
        items={[
          { id: "buttons", label: "Buttons" },
          { id: "chips", label: "Chips & dots" },
          { id: "kbd", label: "Kbd" },
          { id: "cards", label: "Cards" },
          { id: "tables", label: "Tables" },
          { id: "avatars", label: "Avatars" },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === "buttons" && (
        <Card>
          <Card.Header label="Button variants" />
          <Card.Body>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Button>Default</Button>
              <Button variant="primary">
                <Icon name="plus" size={13} /> Primary (inverse)
              </Button>
              <Button variant="accent">Accent (NOVIT)</Button>
              <Button variant="ghost">
                <Icon name="command" size={14} /> Ghost
              </Button>
              <Button variant="icon" title="icon-only">
                <Icon name="settings" size={14} />
              </Button>
              <Button variant="filtered" badge="3">
                <Icon name="filter" size={13} /> Filtered
              </Button>
            </div>
          </Card.Body>
        </Card>
      )}

      {tab === "chips" && (
        <Card>
          <Card.Header label="Chips & status dots" />
          <Card.Body>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
              <Chip>Default</Chip>
              <Chip tone="accent">Accent</Chip>
              <Chip tone="success" dot>
                Won
              </Chip>
              <Chip tone="warn" dot>
                Negotiation
              </Chip>
              <Chip tone="danger" dot>
                Lost
              </Chip>
              <Chip tone="info" dot>
                Discovery
              </Chip>
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <StatusDot tone="success" /> success
              <StatusDot tone="warn" /> warn
              <StatusDot tone="danger" /> danger
              <StatusDot tone="info" /> info
              <StatusDot tone="muted" /> muted
            </div>
          </Card.Body>
        </Card>
      )}

      {tab === "kbd" && (
        <Card>
          <Card.Header label="Keyboard caps" />
          <Card.Body>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <Kbd>⌘</Kbd>
              <Kbd>K</Kbd>
              <span style={{ color: "var(--fg-3)", margin: "0 8px" }}>·</span>
              <Kbd>⌘</Kbd>
              <Kbd>J</Kbd>
              <span style={{ color: "var(--fg-3)", margin: "0 8px" }}>·</span>
              <Kbd>Esc</Kbd>
            </div>
          </Card.Body>
        </Card>
      )}

      {tab === "cards" && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 12,
          }}
        >
          <Card>
            <Card.Header label="Pipeline total" sub="USD" />
            <Card.Body>
              <div style={{ fontSize: "var(--fs-2xl)", fontWeight: 600 }} className="mono">
                $4.2M
              </div>
              <div style={{ color: "var(--fg-3)", fontSize: "var(--fs-sm)" }}>
                +12% vs. mes pasado
              </div>
            </Card.Body>
          </Card>
          <Card>
            <Card.Header label="Deals abiertos" />
            <Card.Body>
              <div style={{ fontSize: "var(--fs-2xl)", fontWeight: 600 }} className="mono">
                21
              </div>
              <div style={{ color: "var(--fg-3)", fontSize: "var(--fs-sm)" }}>
                3 nuevos esta semana
              </div>
            </Card.Body>
          </Card>
        </div>
      )}

      {tab === "tables" && (
        <Card>
          <Card.Header label="Data table" />
          <Card.Body className="!p-0" style={{ padding: 0 }}>
            <Table
              columns={COLS}
              rows={ROWS}
              rowKey={(r) => r.id}
              onRowClick={(r) => console.log("click", r.id)}
            />
          </Card.Body>
        </Card>
      )}

      {tab === "avatars" && (
        <Card>
          <Card.Header label="Avatars" />
          <Card.Body>
            <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
              <Avatar initials="MP" workspace="novit" />
              <Avatar initials="AV" workspace="sharky" />
              <Avatar initials="CG" workspace="novit" size={36} />
              <Avatar initials="RT" workspace="sharky" size={48} />
            </div>
          </Card.Body>
        </Card>
      )}
    </div>
  );
}
