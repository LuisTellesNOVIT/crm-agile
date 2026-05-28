import type { ReactNode } from "react";

type Tone = "default" | "accent" | "success" | "warn" | "danger" | "info";

type Props = {
  tone?: Tone;
  dot?: boolean;
  children: ReactNode;
  className?: string;
};

export function Chip({ tone = "default", dot, children, className = "" }: Props) {
  const t = tone === "default" ? "" : `chip--${tone}`;
  const d = dot ? "chip--dot" : "";
  return <span className={`chip ${t} ${d} ${className}`.trim()}>{children}</span>;
}
