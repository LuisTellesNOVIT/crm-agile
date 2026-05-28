import type { CSSProperties, ReactNode } from "react";

type CardProps = {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
};

export function Card({ children, className = "", style }: CardProps) {
  return (
    <div className={`card ${className}`.trim()} style={style}>
      {children}
    </div>
  );
}

function Header({
  label,
  sub,
  children,
}: {
  label?: string;
  sub?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="card__h">
      {label && <span className="label">{label}</span>}
      {children}
      {sub != null && <span className="card__sub">{sub}</span>}
    </div>
  );
}

function Body({ children, className = "", style }: CardProps) {
  return (
    <div className={`card__b ${className}`.trim()} style={style}>
      {children}
    </div>
  );
}

Card.Header = Header;
Card.Body = Body;
