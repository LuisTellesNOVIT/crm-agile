// Tags — palabras clave de un trato (sector, lead, cliente, etc.).
// Cada tag obtiene un color determinístico desde una paleta fija, derivado
// de un hash del texto. El mismo tag => siempre el mismo color, en cualquier
// vista (kanban, lista, detalle, modal).

export type TagStyle = {
  bg: string; // fondo del chip
  fg: string; // texto
  border: string; // borde sutil
};

// Paleta de 12 tonos pastel con buen contraste sobre el texto oscuro.
// bg translúcido + fg saturado del mismo matiz => chips legibles y distintos.
const TAG_PALETTE: TagStyle[] = [
  { bg: "rgba(37, 99, 235, 0.12)", fg: "#1d4ed8", border: "rgba(37, 99, 235, 0.25)" }, // azul
  { bg: "rgba(22, 163, 74, 0.12)", fg: "#15803d", border: "rgba(22, 163, 74, 0.25)" }, // verde
  { bg: "rgba(217, 119, 6, 0.14)", fg: "#b45309", border: "rgba(217, 119, 6, 0.28)" }, // ámbar
  { bg: "rgba(220, 38, 38, 0.12)", fg: "#b91c1c", border: "rgba(220, 38, 38, 0.25)" }, // rojo
  { bg: "rgba(147, 51, 234, 0.13)", fg: "#7e22ce", border: "rgba(147, 51, 234, 0.26)" }, // violeta
  { bg: "rgba(8, 145, 178, 0.13)", fg: "#0e7490", border: "rgba(8, 145, 178, 0.26)" }, // cian
  { bg: "rgba(219, 39, 119, 0.12)", fg: "#be185d", border: "rgba(219, 39, 119, 0.25)" }, // rosa
  { bg: "rgba(101, 163, 13, 0.14)", fg: "#4d7c0f", border: "rgba(101, 163, 13, 0.28)" }, // lima
  { bg: "rgba(234, 88, 12, 0.13)", fg: "#c2410c", border: "rgba(234, 88, 12, 0.26)" }, // naranja
  { bg: "rgba(13, 148, 136, 0.13)", fg: "#0f766e", border: "rgba(13, 148, 136, 0.26)" }, // teal
  { bg: "rgba(79, 70, 229, 0.12)", fg: "#4338ca", border: "rgba(79, 70, 229, 0.25)" }, // índigo
  { bg: "rgba(2, 132, 199, 0.13)", fg: "#0369a1", border: "rgba(2, 132, 199, 0.26)" }, // celeste
];

/** Hash estable (djb2) de un string → entero no negativo. */
function hashString(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = (h * 33) ^ s.charCodeAt(i);
  }
  return h >>> 0; // a uint32
}

/** Devuelve el estilo de color determinístico para un tag. */
export function tagColor(tag: string): TagStyle {
  const norm = tag.trim().toLowerCase();
  const idx = hashString(norm) % TAG_PALETTE.length;
  return TAG_PALETTE[idx];
}

/**
 * Normaliza una entrada de tags: separa por coma, recorta espacios,
 * descarta vacíos, deduplica (case-insensitive conservando el primero).
 */
export function parseTags(input: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of input.split(",")) {
    const t = raw.trim();
    if (!t) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}

/** Limpia un arreglo de tags (trim + dedupe + sin vacíos). */
export function cleanTags(tags: string[]): string[] {
  return parseTags(tags.join(","));
}
