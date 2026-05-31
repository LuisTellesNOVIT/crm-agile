import { useState } from "react";
import { tagColor } from "../../lib/tags";

/**
 * TagsEditor — input de tags multicolor reutilizable.
 *
 * - Escribe y presiona Enter o "," para agregar un tag.
 * - Cada chip recibe un color determinístico (tagColor).
 * - Click en × para borrar; Backspace en input vacío borra el último.
 * - Dedup case-insensitive.
 *
 * Controlado: `value` (string[]) + `onChange`.
 */
export function TagsEditor({
  value,
  onChange,
  placeholder = "sector, lead, cliente…",
  id,
}: {
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  id?: string;
}) {
  const [draft, setDraft] = useState("");

  const addTag = (raw: string) => {
    const t = raw.trim();
    if (!t) return;
    const exists = value.some((x) => x.toLowerCase() === t.toLowerCase());
    if (!exists) onChange([...value, t]);
    setDraft("");
  };

  const removeTag = (idx: number) => {
    onChange(value.filter((_, i) => i !== idx));
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(draft);
    } else if (e.key === "Backspace" && !draft && value.length) {
      e.preventDefault();
      removeTag(value.length - 1);
    }
  };

  return (
    <div className="tags-editor">
      {value.map((tag, i) => {
        const c = tagColor(tag);
        return (
          <span
            key={`${tag}-${i}`}
            className="tags-editor__chip"
            style={{ background: c.bg, color: c.fg, borderColor: c.border }}
          >
            {tag}
            <button
              type="button"
              className="tags-editor__remove"
              onClick={() => removeTag(i)}
              aria-label={`Quitar ${tag}`}
            >
              ×
            </button>
          </span>
        );
      })}
      <input
        id={id}
        type="text"
        className="tags-editor__input"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => addTag(draft)}
        placeholder={value.length ? "" : placeholder}
      />
      <style>{`
        .tags-editor {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 6px;
          padding: 6px 8px;
          border: 1px solid var(--border);
          border-radius: var(--radius-sm);
          background: var(--bg);
          min-height: 38px;
          transition: border-color .12s, box-shadow .12s;
        }
        .tags-editor:focus-within {
          border-color: var(--accent);
          box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.10);
        }
        .tags-editor__chip {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 2px 4px 2px 9px;
          border-radius: 999px;
          border: 1px solid;
          font-size: 12px;
          font-weight: 600;
          line-height: 1.5;
          white-space: nowrap;
        }
        .tags-editor__remove {
          border: none;
          background: transparent;
          color: inherit;
          cursor: pointer;
          font-size: 14px;
          line-height: 1;
          padding: 0 2px;
          opacity: 0.65;
          border-radius: 50%;
        }
        .tags-editor__remove:hover { opacity: 1; }
        .tags-editor__input {
          flex: 1;
          min-width: 90px;
          border: none !important;
          outline: none !important;
          box-shadow: none !important;
          background: transparent;
          font: inherit;
          font-size: 13.5px;
          color: var(--fg);
          padding: 2px 0;
        }
      `}</style>
    </div>
  );
}
