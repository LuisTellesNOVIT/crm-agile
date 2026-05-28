type Tone = "success" | "warn" | "danger" | "info" | "muted";

export function StatusDot({ tone, className = "" }: { tone: Tone; className?: string }) {
  return <span className={`dot dot--${tone} ${className}`.trim()} />;
}
