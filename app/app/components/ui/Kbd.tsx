import type { ReactNode } from "react";

export function Kbd({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <span className={`kbd ${className}`.trim()}>{children}</span>;
}
