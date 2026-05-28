export function PlaceholderView({ title, step }: { title: string; step: number }) {
  return (
    <div style={{ padding: "24px 28px" }}>
      <h1
        style={{
          fontSize: "var(--fs-xl)",
          fontWeight: 600,
          letterSpacing: "-0.01em",
          marginBottom: 6,
        }}
      >
        {title}
      </h1>
      <p style={{ color: "var(--fg-3)", fontSize: "var(--fs-sm)" }}>
        Vista pendiente — se construye en Paso {step}.
      </p>
    </div>
  );
}
