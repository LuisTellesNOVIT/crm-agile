import { useState } from "react";
import { customObjects } from "../lib/mock/rich";
import { Card } from "../components/ui/Card";
import { Chip } from "../components/ui/Chip";

export default function ObjectsRoute() {
  const [activeId, setActiveId] = useState(customObjects[0]?.id ?? "");
  const active = customObjects.find((o) => o.id === activeId);

  return (
    <div style={{ padding: "20px 24px", display: "grid", gridTemplateColumns: "240px 1fr", gap: 14, height: "100%", maxWidth: 1200 }}>
      <aside>
        <header style={{ marginBottom: 10 }}>
          <h1 style={{ fontSize: "var(--fs-md)", fontWeight: 600, letterSpacing: "-0.01em" }}>
            Custom objects
          </h1>
          <p style={{ color: "var(--fg-3)", fontSize: "var(--fs-xs)" }}>
            {customObjects.length} objetos
          </p>
        </header>
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 4 }}>
          {customObjects.map((o) => (
            <li
              key={o.id}
              onClick={() => setActiveId(o.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 10px",
                borderRadius: "var(--radius-sm)",
                cursor: "pointer",
                background: o.id === activeId ? "var(--accent-soft)" : "transparent",
                border: o.id === activeId ? "1px solid var(--accent-border)" : "1px solid transparent",
              }}
            >
              <div
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: "var(--radius-sm)",
                  background: o.color,
                  color: "#fff",
                  display: "grid",
                  placeItems: "center",
                  fontWeight: 600,
                  fontSize: "var(--fs-xs)",
                  fontFamily: "var(--font-mono)",
                }}
              >
                {o.icon}
              </div>
              <span style={{ flex: 1, fontSize: "var(--fs-sm)" }}>{o.name}</span>
              <span className="mono" style={{ color: "var(--fg-3)", fontSize: "var(--fs-xs)" }}>
                {o.count.toLocaleString("en-US")}
              </span>
            </li>
          ))}
        </ul>
      </aside>
      <main>
        {active && (
          <Card>
            <Card.Header label={`${active.attrs.length} atributos`} sub={`${active.count.toLocaleString("en-US")} registros`}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 24, height: 24, borderRadius: "var(--radius-sm)", background: active.color, color: "#fff", display: "grid", placeItems: "center", fontWeight: 600, fontSize: "var(--fs-xs)", fontFamily: "var(--font-mono)" }}>
                  {active.icon}
                </div>
                <span style={{ fontWeight: 600 }}>{active.name}</span>
              </span>
            </Card.Header>
            <Card.Body style={{ padding: 0 }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Atributo</th>
                    <th style={{ width: 100 }}>Tipo</th>
                    <th style={{ width: 80, textAlign: "center" }}>Required</th>
                    <th>Descripción</th>
                  </tr>
                </thead>
                <tbody>
                  {active.attrs.map((a, i) => (
                    <tr key={i}>
                      <td>{a.name}</td>
                      <td><Chip tone="accent">{a.type}</Chip></td>
                      <td style={{ textAlign: "center" }}>
                        {a.required ? <Chip tone="success" dot>req</Chip> : <span style={{ color: "var(--fg-4)" }}>—</span>}
                      </td>
                      <td style={{ color: "var(--fg-3)", fontSize: "var(--fs-xs)" }}>{a.desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card.Body>
          </Card>
        )}
      </main>
    </div>
  );
}
