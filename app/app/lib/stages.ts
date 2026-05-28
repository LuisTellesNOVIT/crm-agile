import type { Stage, StageId } from "./types";

/**
 * STAGES_DEFAULT = etapas por defecto cuando un workspace recién creado no
 * tiene PipelineStage en la DB. También se usa como fallback en componentes
 * que se renderizan antes de que el loader resuelva (SSR initial paint).
 *
 * Las etapas REALES vienen ahora del workspace loader (PipelineStage table).
 * Usá `useStages()` para leerlas o `getStagesOrDefault(workspace)` para
 * obtenerlas con fallback al default.
 */
export const STAGES_DEFAULT: Stage[] = [
  { id: "discovery", label: "Discovery", color: "#94a3b8", prob: 0.1 },
  { id: "qualified", label: "Qualified", color: "#0ea5e9", prob: 0.25 },
  { id: "proposal", label: "Proposal", color: "#8b5cf6", prob: 0.5 },
  { id: "negotiation", label: "Negotiation", color: "#f59e0b", prob: 0.75 },
  { id: "signing", label: "Signing", color: "#06b6d4", prob: 0.9 },
  { id: "won", label: "Closed Won", color: "#16a34a", prob: 1.0 },
  { id: "lost", label: "Closed Lost", color: "#94a3b8", prob: 0.0 },
];

/**
 * Alias retrocompatible — código existente importa `STAGES`. Lo apuntamos al
 * default; los lugares que necesitan las etapas dinámicas del workspace deben
 * usar `useActiveWorkspace().stages`.
 */
export const STAGES = STAGES_DEFAULT;

export function stageProbability(id: StageId, stages: Stage[] = STAGES_DEFAULT): number {
  return stages.find((s) => s.id === id)?.prob ?? 0;
}

export function stageById(id: StageId, stages: Stage[] = STAGES_DEFAULT): Stage | undefined {
  return stages.find((s) => s.id === id);
}

/**
 * Para detectar si un stage es "terminal" (won/lost). Las default tienen
 * estos IDs reservados; las custom respetan las flags `isWon`/`isLost` que
 * setea el editor — esa data viene en el campo `meta` del PipelineStage de la
 * DB y se proyecta al `Stage` del cliente.
 */
export function isWonStage(id: StageId, stages: Stage[] = STAGES_DEFAULT): boolean {
  const s = stages.find((x) => x.id === id);
  if (!s) return id === "won";
  return s.id === "won" || (s as Stage & { isWon?: boolean }).isWon === true;
}

export function isLostStage(id: StageId, stages: Stage[] = STAGES_DEFAULT): boolean {
  const s = stages.find((x) => x.id === id);
  if (!s) return id === "lost";
  return s.id === "lost" || (s as Stage & { isLost?: boolean }).isLost === true;
}
