import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "default" | "primary" | "accent" | "ghost" | "icon" | "filtered";

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type"> & {
  variant?: Variant;
  badge?: ReactNode;
  type?: "button" | "submit" | "reset";
};

export function Button({
  variant = "default",
  badge,
  className = "",
  children,
  type = "button",
  ...rest
}: Props) {
  const v = variant === "default" ? "" : `btn--${variant}`;
  return (
    <button type={type} className={`btn ${v} ${className}`.trim()} {...rest}>
      {children}
      {badge != null && <span className="btn__badge mono">{badge}</span>}
    </button>
  );
}
