import type { CSSProperties } from "react";

const GRADIENTS: Record<string, string> = {
  novit: "linear-gradient(135deg, #93c5fd, #2563eb)",
  sharky: "linear-gradient(135deg, #fdba74, #ea580c)",
};

type Props = {
  initials: string;
  workspace?: "novit" | "sharky";
  size?: number;
  className?: string;
  style?: CSSProperties;
};

export function Avatar({
  initials,
  workspace = "novit",
  size,
  className = "",
  style,
}: Props) {
  const sizing = size
    ? { width: size, height: size, fontSize: Math.max(9, Math.round(size * 0.42)) }
    : {};
  return (
    <div
      className={`avatar ${className}`.trim()}
      style={{ background: GRADIENTS[workspace], ...sizing, ...style }}
    >
      {initials}
    </div>
  );
}
