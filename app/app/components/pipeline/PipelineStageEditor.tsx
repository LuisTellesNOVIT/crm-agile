/**
 * PipelineStageEditor — modal para editar las etapas del pipeline.
 *
 * Permite: rename label, recolor, cambiar probability, reordenar (arriba/abajo),
 * agregar nuevas, eliminar (si no tienen deals). Las stages se persisten al
 * POST /api/stages que actualiza la tabla PipelineStage del workspace.
 *
 * El componente padre debe pasar `workspaceSlug` y `stages` actuales, y maneja
 * el cierre + el revalidate vía useRevalidator de react-router.
 */
import { useState } from "react";
import { useFetcher } from "react-router";
import { Icon } from "../shell/Icon";
import type { Stage } from "../../lib/types";

type EditableStage = Stage & {
  _isNew?: boolean;
  _delete?: boolean;
  isWon?: boolean;
  isLost?: boolean;
};

const COLOR_PRESETS = [
  "#94a3b8", "#64748b", "#475569",
  "#0ea5e9", "#2563eb", "#06b6d4",
  "#8b5cf6", "#a855f7", "#ec4899",
  "#f59e0b", "#ea580c", "#dc2626",
  "#16a34a", "#10b981", "#84cc16",
];

function slugify(s: string): string {
  return s.toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function PipelineStageEditor({
  workspaceSlug,
  stages,
  onClose,
}: {
  workspaceSlug: string;
  stages: Stage[];
  onClose: () => void;
}) {
  const fetcher = useFetcher<{ ok?: boolean; error?: string; blockingKeys?: string[] }>();
  const saving = fetcher.state !== "idle";

  // Inicializar con las stages actuales (con flags vacíos)
  const [items, setItems] = useState<EditableStage[]>(() =>
    stages.map((s) => ({ ...s })),
  );

  // Stats por stage (cuántos deals tiene cada uno) — sería ideal pasar por props,
  // pero por simplicidad mostramos solo un placeholder/contador.

  const visible = items.filter((s) => !s._delete);

  const updateField = <K extends keyof EditableStage>(idx: number, key: K, value: EditableStage[K]) => {
    setItems((prev) => prev.map((s, i) => (i === idx ? { ...s, [key]: value } : s)));
  };

  const move = (idx: number, dir: -1 | 1) => {
    setItems((prev) => {
      // Trabajar solo con visibles para reordenar
      const vis = prev.filter((s) => !s._delete);
      const target = vis.indexOf(prev[idx]);
      if (target < 0) return prev;
      const swap = target + dir;
      if (swap < 0 || swap >= vis.length) return prev;
      const newVis = [...vis];
      [newVis[target], newVis[swap]] = [newVis[swap], newVis[target]];
      // Reconstruir lista preservando _delete
      const next: EditableStage[] = [];
      let visIdx = 0;
      for (const s of prev) {
        if (s._delete) next.push(s);
        else { next.push(newVis[visIdx]); visIdx++; }
      }
      return next;
    });
  };

  const markDelete = (idx: number) => {
    setItems((prev) => prev.map((s, i) => {
      if (i !== idx) return s;
      // Si es nuevo, removerlo directamente
      if (s._isNew) return { ...s, _delete: true };
      return { ...s, _delete: !s._delete };
    }));
  };

  const addNew = () => {
    setItems((prev) => {
      const baseLabel = "Nueva etapa";
      let label = baseLabel;
      let n = 1;
      while (prev.some((s) => s.label === label)) {
        label = `${baseLabel} ${++n}`;
      }
      const newStage: EditableStage = {
        id: `new_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        label,
        color: "#94a3b8",
        prob: 0.5,
        _isNew: true,
      };
      return [...prev, newStage];
    });
  };

  const save = () => {
    // Recalcular position por orden visible
    const visibleNow = items.filter((s) => !s._delete);

    // Generar key estable: para new usa slugify, para existentes preserva id
    const payload = items.map((s) => {
      const pos = visibleNow.indexOf(s);
      const key = s._isNew
        ? `${slugify(s.label)}_${s.id.slice(-4)}` // único
        : (s.id as string);
      return {
        key,
        label: s.label,
        color: s.color,
        probability: s.prob,
        position: pos >= 0 ? pos : 999, // los _delete no aplican
        isWon: s.isWon ?? s.id === "won",
        isLost: s.isLost ?? s.id === "lost",
        _delete: s._delete ?? false,
      };
    });

    fetcher.submit(
      JSON.stringify({ workspaceSlug, stages: payload }),
      {
        method: "POST",
        action: "/api/stages",
        encType: "application/json",
      },
    );
  };

  // Cerrar al recibir respuesta ok
  if (fetcher.data?.ok && !saving) {
    setTimeout(onClose, 50);
  }

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <div
        className="stage-editor"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="stage-editor__head">
          <div>
            <h2>Editar etapas del Pipeline</h2>
            <p className="stage-editor__sub">
              Renombrá, reordená, cambiá colores o agregá nuevas etapas. Los deals existentes
              respetan la <code>key</code> estable de su etapa.
            </p>
          </div>
          <button type="button" className="btn btn--icon" onClick={onClose} aria-label="Cerrar">
            <Icon name="x" size={14} />
          </button>
        </header>

        <div className="stage-editor__body">
          {items.map((s, idx) => {
            if (s._delete) {
              return (
                <div key={s.id} className="stage-editor__row stage-editor__row--deleted">
                  <span className="stage-editor__dot" style={{ background: s.color, opacity: 0.4 }} />
                  <span style={{ flex: 1, textDecoration: "line-through", color: "var(--fg-3)" }}>
                    {s.label}
                  </span>
                  <button
                    type="button"
                    className="btn btn--ghost"
                    onClick={() => markDelete(idx)}
                  >
                    Restaurar
                  </button>
                </div>
              );
            }
            const visibleIdx = visible.indexOf(s);
            const isFirst = visibleIdx === 0;
            const isLast = visibleIdx === visible.length - 1;

            return (
              <div key={s.id} className={`stage-editor__row ${s._isNew ? "is-new" : ""}`.trim()}>
                <div className="stage-editor__order">
                  <button
                    type="button"
                    className="stage-editor__order-btn"
                    onClick={() => move(idx, -1)}
                    disabled={isFirst}
                    aria-label="Subir"
                  >
                    ↑
                  </button>
                  <span className="mono stage-editor__pos">{visibleIdx + 1}</span>
                  <button
                    type="button"
                    className="stage-editor__order-btn"
                    onClick={() => move(idx, 1)}
                    disabled={isLast}
                    aria-label="Bajar"
                  >
                    ↓
                  </button>
                </div>

                <ColorSwatch
                  value={s.color}
                  onChange={(c) => updateField(idx, "color", c)}
                />

                <input
                  type="text"
                  value={s.label}
                  onChange={(e) => updateField(idx, "label", e.target.value)}
                  className="stage-editor__input"
                  placeholder="Nombre de la etapa"
                />

                <label className="stage-editor__prob">
                  <span className="stage-editor__prob-label">Probabilidad</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={5}
                    value={Math.round(s.prob * 100)}
                    onChange={(e) => updateField(idx, "prob", Math.max(0, Math.min(100, parseFloat(e.target.value || "0"))) / 100)}
                    className="stage-editor__prob-input mono"
                  />
                  <span style={{ color: "var(--fg-3)", fontSize: 11 }}>%</span>
                </label>

                <div className="stage-editor__flags">
                  <label title="Marca esta etapa como 'ganado' (terminal won)">
                    <input
                      type="checkbox"
                      checked={s.isWon ?? s.id === "won"}
                      onChange={(e) => updateField(idx, "isWon", e.target.checked)}
                    />
                    <span>Won</span>
                  </label>
                  <label title="Marca esta etapa como 'perdido' (terminal lost)">
                    <input
                      type="checkbox"
                      checked={s.isLost ?? s.id === "lost"}
                      onChange={(e) => updateField(idx, "isLost", e.target.checked)}
                    />
                    <span>Lost</span>
                  </label>
                </div>

                <button
                  type="button"
                  className="stage-editor__delete"
                  onClick={() => markDelete(idx)}
                  title="Eliminar etapa"
                  aria-label="Eliminar etapa"
                >
                  <Icon name="x" size={12} />
                </button>
              </div>
            );
          })}

          <button
            type="button"
            className="stage-editor__add"
            onClick={addNew}
          >
            <Icon name="plus" size={13} />
            Agregar etapa
          </button>
        </div>

        {fetcher.data?.error && (
          <div className="stage-editor__error">
            <Icon name="alert" size={13} />
            <div>
              <b>{fetcher.data.error}</b>
              {fetcher.data.blockingKeys && (
                <div style={{ fontSize: 11, marginTop: 4, fontFamily: "var(--font-mono)" }}>
                  Etapas bloqueadas (tienen deals): {fetcher.data.blockingKeys.join(", ")}
                </div>
              )}
            </div>
          </div>
        )}

        <footer className="stage-editor__foot">
          <button type="button" className="btn" onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn btn--primary"
            onClick={save}
            disabled={saving}
          >
            {saving ? "Guardando…" : "Guardar cambios"}
          </button>
        </footer>
      </div>
    </div>
  );
}

function ColorSwatch({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="stage-editor__color">
      <button
        type="button"
        className="stage-editor__color-btn"
        onClick={() => setOpen((o) => !o)}
        style={{ background: value }}
        aria-label="Color"
      />
      {open && (
        <div
          className="stage-editor__color-pop"
          onMouseLeave={() => setOpen(false)}
        >
          {COLOR_PRESETS.map((c) => (
            <button
              key={c}
              type="button"
              className="stage-editor__color-swatch"
              style={{ background: c, outline: c === value ? "2px solid var(--fg)" : undefined }}
              onClick={() => {
                onChange(c);
                setOpen(false);
              }}
              aria-label={c}
            />
          ))}
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="stage-editor__color-input"
            aria-label="Color personalizado"
          />
        </div>
      )}
    </div>
  );
}
