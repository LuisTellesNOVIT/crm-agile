import { templates } from "../lib/mock/rich";
import { Card } from "../components/ui/Card";
import { Chip } from "../components/ui/Chip";

export default function TemplatesRoute() {
  return (
    <div style={{ padding: "20px 24px", display: "grid", gap: 12, maxWidth: 1100 }}>
      <header>
        <h1 style={{ fontSize: "var(--fs-xl)", fontWeight: 600, letterSpacing: "-0.01em" }}>Templates</h1>
        <p style={{ color: "var(--fg-3)", fontSize: "var(--fs-sm)" }}>
          {templates.length} plantillas activas — multi-canal
        </p>
      </header>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 12 }}>
        {templates.map((t) => (
          <Card key={t.id}>
            <Card.Header label={t.channel === "wa" ? "WhatsApp" : t.channel === "email" ? "Email" : t.channel}>
              <span style={{ fontWeight: 600, fontSize: "var(--fs-sm)" }}>{t.name}</span>
            </Card.Header>
            <Card.Body>
              <p style={{ color: "var(--fg-3)", fontSize: "var(--fs-xs)", marginBottom: 8 }}>{t.desc}</p>
              <pre
                style={{
                  background: "var(--bg-2)",
                  padding: 10,
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--border-2)",
                  fontFamily: "var(--font-sans)",
                  fontSize: "var(--fs-xs)",
                  whiteSpace: "pre-wrap",
                  margin: 0,
                  maxHeight: 140,
                  overflow: "auto",
                  lineHeight: 1.45,
                }}
              >
                {t.body}
              </pre>
              <div style={{ display: "flex", gap: 8, marginTop: 10, alignItems: "center" }}>
                <Chip tone="info">
                  <span className="mono">{t.uses}</span> usos
                </Chip>
                <Chip tone={t.replyRate >= 60 ? "success" : t.replyRate >= 40 ? "warn" : "danger"}>
                  <span className="mono">{t.replyRate}%</span> reply
                </Chip>
              </div>
            </Card.Body>
          </Card>
        ))}
      </div>
    </div>
  );
}
