type Item = { id: string; label: string };

type Props = {
  items: Item[];
  active: string;
  onChange: (id: string) => void;
  className?: string;
};

export function Tabs({ items, active, onChange, className = "" }: Props) {
  return (
    <div className={`tabs ${className}`.trim()}>
      {items.map((it) => (
        <div
          key={it.id}
          className={`tab ${active === it.id ? "is-active" : ""}`.trim()}
          onClick={() => onChange(it.id)}
        >
          {it.label}
        </div>
      ))}
    </div>
  );
}
