import type { ReactNode } from "react";

type Align = "left" | "right" | "center";

export type Column<T> = {
  key: string;
  label: string;
  render?: (row: T) => ReactNode;
  align?: Align;
  width?: string | number;
};

type Props<T> = {
  columns: Column<T>[];
  rows: T[];
  rowKey?: (row: T, index: number) => string;
  onRowClick?: (row: T) => void;
  empty?: ReactNode;
};

export function Table<T>({ columns, rows, rowKey, onRowClick, empty }: Props<T>) {
  if (rows.length === 0 && empty != null) {
    return <div className="empty-hint">{empty}</div>;
  }
  return (
    <table className="table">
      <thead>
        <tr>
          {columns.map((c) => (
            <th key={c.key} style={{ width: c.width, textAlign: c.align }}>
              {c.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr
            key={rowKey ? rowKey(row, i) : i}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
            style={{ cursor: onRowClick ? "pointer" : undefined }}
          >
            {columns.map((c) => (
              <td key={c.key} style={{ textAlign: c.align }}>
                {c.render
                  ? c.render(row)
                  : String((row as Record<string, unknown>)[c.key] ?? "")}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
