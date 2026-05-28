// Currency formatting + FX (placeholder rates; Settings view will make these editable).
import type { Currency } from "./store";
import type { StageId } from "./types";
import { stageById } from "./stages";

export const EXCHANGE_RATES: Record<Currency, number> = {
  USD: 1,
  PEN: 3.75,
};

const CURRENCY_SYMBOL: Record<Currency, string> = {
  USD: "$",
  PEN: "S/",
};

/**
 * Compact-by-default money formatter — mimics el fmtMoney del proto:
 * - <1k → $123
 * - 1k–999k → $12k
 * - ≥1M → $1.2M
 */
export function fmtMoney(value: number, currency: Currency = "USD"): string {
  if (value == null || Number.isNaN(value)) return "—";
  const conv = value * EXCHANGE_RATES[currency];
  const abs = Math.abs(conv);
  const sym = CURRENCY_SYMBOL[currency];
  if (abs >= 1_000_000) {
    return `${sym}${(conv / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  }
  if (abs >= 1_000) {
    return `${sym}${Math.round(conv / 1000)}k`;
  }
  return `${sym}${Math.round(conv).toLocaleString("en-US")}`;
}

/** Versión expandida sin abreviar — para FormRow / detalles. */
export function fmtMoneyFull(value: number, currency: Currency = "USD"): string {
  if (value == null || Number.isNaN(value)) return "—";
  const conv = value * EXCHANGE_RATES[currency];
  const sym = CURRENCY_SYMBOL[currency];
  return `${sym}${Math.round(conv).toLocaleString("en-US")}`;
}

export function daysFromToday(iso: string, today: Date): number {
  const target = new Date(iso);
  const diff = target.getTime() - today.getTime();
  return Math.round(diff / (1000 * 60 * 60 * 24));
}

export function daysBetween(a: string | Date, b: string | Date): number {
  const A = typeof a === "string" ? new Date(a) : a;
  const B = typeof b === "string" ? new Date(b) : b;
  return Math.round((B.getTime() - A.getTime()) / 86400000);
}

export function stageLabel(id: StageId): string {
  return stageById(id)?.label ?? id;
}

export function stageColor(id: StageId): string {
  return stageById(id)?.color ?? "#94a3b8";
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
