// Helpers de avatar compartidos en todo el app (iniciales + color estable por hash).

export function initialsOf(name: string): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Color de fondo estable (mismo nombre → mismo color) en oklch. */
export function avatarBg(seed: string): string {
  let h = 0;
  const s = seed ?? "";
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
  return `oklch(64% 0.14 ${h})`;
}
