/**
 * Helpers de métricas — fuente única de cálculo para Dashboard KPI y los
 * drawers de sustento. Si una métrica se renderiza en ambos lugares, AMBOS
 * deben usar las funciones de este archivo para evitar mismatches.
 *
 * Reglas:
 * - "ARR" cuenta SOLO deals con stage=won + isRecurring=true. Un trato lost
 *   o open NO suma ARR aunque tenga isRecurring=true.
 * - "Pipeline ARR (weighted)" sí cuenta open recurring, ponderado por probability.
 * - "New ARR" = ARR generado por wins en los últimos 90 días (window móvil).
 * - "Lead Response Time" es decorativo (no hay event log real); ambos usan los
 *   mismos valores fijos por workspace.
 */
import type { Deal, ActiveWorkspaceId } from "./types";

// ---------- Forecast / Pipeline / Cierre ----------

export function computeForecast(deals: Deal[]): number {
  return deals
    .filter((d) => d.stage !== "won" && d.stage !== "lost")
    .reduce((a, d) => a + d.value * d.probability, 0);
}

export function computePipelineValue(deals: Deal[]): number {
  return deals
    .filter((d) => d.stage !== "won" && d.stage !== "lost")
    .reduce((a, d) => a + d.value, 0);
}

export function computeLostValue(deals: Deal[]): number {
  return deals.filter((d) => d.stage === "lost").reduce((a, d) => a + d.value, 0);
}

export function computeWonValue(deals: Deal[]): number {
  return deals.filter((d) => d.stage === "won").reduce((a, d) => a + d.value, 0);
}

// ---------- Win / Conversion ----------

export function computeWinRate(deals: Deal[]): number {
  const won = deals.filter((d) => d.stage === "won").length;
  const lost = deals.filter((d) => d.stage === "lost").length;
  const closed = won + lost;
  return closed > 0 ? Math.round((won / closed) * 100) : 0;
}

export function computeConversionRate(deals: Deal[]): number {
  if (deals.length === 0) return 0;
  const won = deals.filter((d) => d.stage === "won").length;
  return Math.round((won / deals.length) * 100);
}

// ---------- Velocity / Response (decorativo) ----------

/**
 * Sales Velocity = promedio de días entre createdAt y estimatedCloseAt (≈ closedAt)
 * para deals en stage=won. Si no hay won, devuelve null para evitar mostrar 0.
 */
export function computeSalesVelocity(deals: Deal[]): number {
  const won = deals.filter((d) => d.stage === "won");
  if (won.length === 0) return 0;
  const sum = won.reduce((acc, d) => {
    const created = new Date(d.createdAt).getTime();
    const closed = new Date(d.estimatedCloseAt).getTime();
    const days = Math.max(1, Math.round((closed - created) / 86400000));
    return acc + days;
  }, 0);
  return Math.round(sum / won.length);
}

/**
 * Lead Response Time — no hay event log real, devolvemos un valor fijo por
 * workspace que se muestra IDÉNTICO en dashboard y drawer (no es derivado).
 */
export function leadResponseTime(workspace: ActiveWorkspaceId): number {
  return workspace === "sharky" ? 1.4 : 3.2;
}

// ---------- ARR / MRR / New ARR / Pipeline ARR ----------

/**
 * ARR total = Σ del campo `arr` de deals con stage=won + isRecurring=true.
 * No incluye open ni lost.
 */
export function computeArrTotal(deals: Deal[]): number {
  return deals
    .filter((d) => d.stage === "won" && d.isRecurring && d.arr > 0)
    .reduce((a, d) => a + d.arr, 0);
}

export function computeMrr(deals: Deal[]): number {
  return computeArrTotal(deals) / 12;
}

/**
 * New ARR = ARR de deals won + recurring con close en los últimos N días.
 * Default 90 días (típico para un trimestre).
 */
export function computeNewArr(deals: Deal[], windowDays = 90): number {
  const cutoff = Date.now() - windowDays * 86400000;
  return deals
    .filter(
      (d) =>
        d.stage === "won" &&
        d.isRecurring &&
        d.arr > 0 &&
        new Date(d.estimatedCloseAt).getTime() >= cutoff,
    )
    .reduce((a, d) => a + d.arr, 0);
}

/**
 * Pipeline ARR ponderado = Σ (arr × probability) de deals recurring abiertos
 * (stage no es won ni lost).
 */
export function computePipelineArrWeighted(deals: Deal[]): number {
  return deals
    .filter((d) => d.stage !== "won" && d.stage !== "lost" && d.isRecurring && d.arr > 0)
    .reduce((a, d) => a + d.arr * d.probability, 0);
}

// ---------- Clientes / Cartera ----------

export type CompanyStats = {
  won: number;
  open: number;
  lost: number;
  arr: number;
};

export function computeCompanyStats(deals: Deal[]): Map<string, CompanyStats> {
  const m = new Map<string, CompanyStats>();
  for (const d of deals) {
    const c = m.get(d.company) ?? { won: 0, open: 0, lost: 0, arr: 0 };
    if (d.stage === "won") {
      c.won++;
      if (d.isRecurring) c.arr += d.arr;
    } else if (d.stage === "lost") {
      c.lost++;
    } else {
      c.open++;
    }
    m.set(d.company, c);
  }
  return m;
}

export type CarteraSummary = {
  customers: number; // empresas con ≥1 won
  cartera: number; // total empresas únicas
  lostOnly: number; // empresas con solo lost
  customerArr: number;
};

export function computeCartera(deals: Deal[]): CarteraSummary {
  const stats = computeCompanyStats(deals);
  const all = Array.from(stats.values());
  return {
    customers: all.filter((c) => c.won > 0).length,
    cartera: all.length,
    lostOnly: all.filter((c) => c.won === 0 && c.open === 0).length,
    customerArr: all.reduce((a, c) => a + c.arr, 0),
  };
}

// ---------- SaaS unit economics ----------

// Asunciones del proto (cuando integremos billing real, vendrán de eventos)
const CAC_BLENDED_USD = 8500;
const GROSS_MARGIN = 0.78;
const ANNUAL_CHURN = 0.06;
const ANNUAL_EXPANSION = 0.18;

/**
 * Net Revenue Retention = (Starting ARR + Expansion − Churn) / Starting ARR.
 * Usa proxies sobre el ARR actual (hasta tener cohorts reales).
 */
export function computeNetRetention(deals: Deal[]): {
  nrr: number; // 0-200% típicamente
  startingArr: number;
  expansionArr: number;
  churnedArr: number;
  endingArr: number;
} {
  const arr = computeArrTotal(deals);
  const startingArr = arr * (1 - ANNUAL_EXPANSION + ANNUAL_CHURN);
  const expansionArr = arr * ANNUAL_EXPANSION;
  const churnedArr = arr * ANNUAL_CHURN;
  const endingArr = startingArr + expansionArr - churnedArr;
  const nrr = startingArr > 0 ? Math.round((endingArr / startingArr) * 100) : 0;
  return { nrr, startingArr, expansionArr, churnedArr, endingArr };
}

/**
 * Logo Churn = clientes perdidos / total de clientes (won + lost-only).
 * "Lost-only" = empresa con todos los deals en lost (sin ningún won).
 */
export function computeLogoChurn(deals: Deal[]): {
  churn: number; // %
  wonClients: number;
  lostOnlyClients: number;
  totalClients: number;
} {
  const stats = computeCompanyStats(deals);
  const wonClients = Array.from(stats.values()).filter((c) => c.won > 0).length;
  const lostOnlyClients = Array.from(stats.values()).filter((c) => c.won === 0 && c.open === 0 && c.lost > 0).length;
  const totalClients = wonClients + lostOnlyClients;
  const churn = totalClients > 0 ? Math.round((lostOnlyClients / totalClients) * 1000) / 10 : 0;
  return { churn, wonClients, lostOnlyClients, totalClients };
}

/**
 * CAC Payback period (meses) = CAC / (MRR × gross margin).
 */
export function computeCacPayback(deals: Deal[]): {
  payback: number;
  cac: number;
  mrr: number;
  grossMargin: number;
} {
  const mrr = computeMrr(deals);
  const payback = mrr > 0
    ? Math.round((CAC_BLENDED_USD / (mrr * GROSS_MARGIN)) * 10) / 10
    : 0;
  return { payback, cac: CAC_BLENDED_USD, mrr, grossMargin: GROSS_MARGIN };
}

/**
 * LTV / CAC ratio.
 * LTV = (ARPA × gross margin) / monthly churn rate.
 * ARPA = MRR / (# clientes recurrentes activos), o si 0 = MRR.
 */
export function computeLtvCac(deals: Deal[]): {
  ratio: number;
  ltv: number;
  cac: number;
} {
  const mrr = computeMrr(deals);
  const recurringWonCount = deals.filter((d) => d.stage === "won" && d.isRecurring && d.arr > 0).length;
  const arpa = recurringWonCount > 0 ? mrr / recurringWonCount : mrr;
  const monthlyChurn = ANNUAL_CHURN / 12; // ≈ 0.5%/mes
  const ltv = monthlyChurn > 0 ? (arpa * GROSS_MARGIN) / monthlyChurn : 0;
  const ratio = CAC_BLENDED_USD > 0 ? Math.round((ltv / CAC_BLENDED_USD) * 10) / 10 : 0;
  return { ratio, ltv, cac: CAC_BLENDED_USD };
}
