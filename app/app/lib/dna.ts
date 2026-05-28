/**
 * Utilidades de secuencia ADN compartidas por los dos canvas del login.
 *
 * - BASES: las 4 bases que pintamos.
 * - PAIR: complementario (A↔T, G↔C). Usado para colorear la hebra opuesta.
 * - BASE_COLOR: colores ajustados para fondo claro (más saturados, menos
 *   translúcidos). Tomados literal del prototipo agile-crm-login.html.
 */
export type Base = "A" | "T" | "G" | "C";

export const BASES: Base[] = ["A", "T", "G", "C"];

export const PAIR: Record<Base, Base> = {
  A: "T",
  T: "A",
  G: "C",
  C: "G",
};

export const BASE_COLOR: Record<Base, string> = {
  A: "#0a8fbf", // cian
  T: "#d63a64", // rosa/coral
  G: "#0f9a6a", // verde
  C: "#c98a14", // ámbar
};

export function randomSequence(n: number): Base[] {
  const out: Base[] = [];
  for (let i = 0; i < n; i++) out.push(BASES[(Math.random() * 4) | 0]);
  return out;
}

export function tickerSequence(groups: number): string {
  const parts: string[] = [];
  for (let g = 0; g < groups; g++) {
    let s = "";
    for (let i = 0; i < 4; i++) s += BASES[(Math.random() * 4) | 0];
    parts.push(s);
  }
  return parts.join("-");
}

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
