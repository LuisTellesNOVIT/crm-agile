import { Fragment, useEffect, useRef, useState } from "react";
import { Icon } from "../shell/Icon";
import { initialsOf, avatarBg } from "../../lib/avatar";

/**
 * Combobox — selector buscable con teclado y opción "crear nuevo".
 * Estándar reusable en todo el app (alta de lead, detalle del trato, filtros…).
 *
 * Estilos en app.css bajo `.cbx*`.
 *
 * value: el valor seleccionado actual (id real | newValue | "").
 * newValue: si se pasa, muestra una fila fija "crear nuevo" arriba que devuelve
 *           ese valor centinela; si no se pasa, el combobox es de solo selección.
 */

export type ComboOption = {
  value: string;
  label: string;
  sublabel?: string;
  group?: string;
  /** Si es true, muestra avatar con iniciales del label. */
  avatar?: boolean;
};

export function Combobox({
  value,
  options,
  onSelect,
  placeholder,
  searchPlaceholder = "Buscar…",
  newValue,
  newLabel,
  newHint,
  emptyText,
  invalid,
  disabled,
  size = "md",
}: {
  value: string;
  options: ComboOption[];
  onSelect: (v: string) => void;
  placeholder: string;
  searchPlaceholder?: string;
  newValue?: string;
  newLabel?: string;
  newHint?: string;
  emptyText?: string;
  invalid?: boolean;
  disabled?: boolean;
  size?: "sm" | "md";
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const hasNew = newValue != null;
  const isNew = hasNew && value === newValue;
  const selected = options.find((o) => o.value === value) || null;

  const q = query.trim().toLowerCase();
  const filtered = q
    ? options.filter((o) => (o.label + " " + (o.sublabel ?? "")).toLowerCase().includes(q))
    : options;
  // índice 0 = fila "crear nuevo" (si hasNew); el resto son filtered[i].
  const offset = hasNew ? 1 : 0;
  const flatLen = filtered.length + offset;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
      const t = window.setTimeout(() => inputRef.current?.focus(), 10);
      return () => window.clearTimeout(t);
    }
  }, [open]);

  const chooseIdx = (idx: number) => {
    if (hasNew && idx <= 0) onSelect(newValue!);
    else {
      const opt = filtered[idx - offset];
      if (opt) onSelect(opt.value);
    }
    setOpen(false);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, flatLen - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      chooseIdx(active);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    }
  };

  return (
    <div className={`cbx ${size === "sm" ? "cbx--sm" : ""} ${invalid ? "is-invalid" : ""}`.trim()} ref={rootRef}>
      <button
        type="button"
        className={`cbx__trigger ${isNew ? "is-new" : ""}`.trim()}
        onClick={() => !disabled && setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
      >
        {isNew ? (
          <span className="cbx__triggerlabel cbx__new">
            <span className="cbx__createicon"><Icon name="plus" size={12} /></span>
            {newLabel}…
          </span>
        ) : selected ? (
          <span className="cbx__triggerlabel">
            {selected.avatar && (
              <span className="cbx__avatar" style={{ background: avatarBg(selected.label) }}>
                {initialsOf(selected.label)}
              </span>
            )}
            <span className="cbx__lbl">{selected.label}</span>
            {selected.sublabel && <span className="cbx__sub">{selected.sublabel}</span>}
          </span>
        ) : (
          <span className="cbx__placeholder">{placeholder}</span>
        )}
        <span className="cbx__chev"><Icon name="chevron-down" size={14} /></span>
      </button>

      {open && (
        <div className="cbx__panel" role="listbox">
          <div className="cbx__searchwrap">
            <Icon name="search" size={13} />
            <input
              ref={inputRef}
              className="cbx__search"
              placeholder={searchPlaceholder}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              onKeyDown={onKey}
            />
          </div>
          <div className="cbx__list">
            {hasNew && (
              <button
                type="button"
                className={`cbx__opt cbx__createopt ${active === 0 ? "is-active" : ""}`.trim()}
                onMouseEnter={() => setActive(0)}
                onClick={() => chooseIdx(0)}
              >
                <span className="cbx__optmain">
                  <span className="cbx__createicon"><Icon name="plus" size={12} /></span>
                  <span className="cbx__lbl">
                    {newLabel}
                    {query ? `: “${query.trim()}”` : "…"}
                  </span>
                </span>
                {newHint && !query && <span className="cbx__opthint">{newHint}</span>}
              </button>
            )}

            {filtered.length === 0 && (
              <div className="cbx__empty">{q ? `Nada coincide con “${query.trim()}”.` : emptyText ?? "Sin opciones."}</div>
            )}

            {filtered.map((opt, i) => {
              const idx = i + offset;
              const showHeader = opt.group && opt.group !== filtered[i - 1]?.group;
              return (
                <Fragment key={opt.value}>
                  {showHeader && <div className="cbx__group">{opt.group}</div>}
                  <button
                    type="button"
                    className={`cbx__opt ${active === idx ? "is-active" : ""} ${opt.value === value ? "is-selected" : ""}`.trim()}
                    onMouseEnter={() => setActive(idx)}
                    onClick={() => chooseIdx(idx)}
                  >
                    <span className="cbx__optmain">
                      {opt.avatar && (
                        <span className="cbx__avatar" style={{ background: avatarBg(opt.label) }}>
                          {initialsOf(opt.label)}
                        </span>
                      )}
                      <span className="cbx__lbl">{opt.label}</span>
                      {opt.sublabel && <span className="cbx__sub">{opt.sublabel}</span>}
                    </span>
                    {opt.value === value && <Icon name="check" size={14} />}
                  </button>
                </Fragment>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
