/**
 * LogoDna — "CRM AGILE" logo cuyas letras están formadas por puntos coloreados
 * en gradiente espectro (azul → violeta → rosa → naranja), con dos hebras
 * sinusoidales detrás que sugieren la doble hélice de un ADN.
 *
 * Uso:
 *   <LogoDna height={56} />
 *   <LogoDna height={32} compact />   // sólo "CA" en versión mark
 */

const FONT: Record<string, string[]> = {
  C: [
    ".XXX.",
    "X...X",
    "X....",
    "X....",
    "X....",
    "X...X",
    ".XXX.",
  ],
  R: [
    "XXXX.",
    "X...X",
    "X...X",
    "XXXX.",
    "X.X..",
    "X..X.",
    "X...X",
  ],
  M: [
    "X...X",
    "XX.XX",
    "X.X.X",
    "X.X.X",
    "X.X.X",
    "X...X",
    "X...X",
  ],
  A: [
    ".XXX.",
    "X...X",
    "X...X",
    "XXXXX",
    "X...X",
    "X...X",
    "X...X",
  ],
  G: [
    ".XXXX",
    "X....",
    "X....",
    "X.XXX",
    "X...X",
    "X...X",
    ".XXX.",
  ],
  I: [
    "XXXXX",
    "..X..",
    "..X..",
    "..X..",
    "..X..",
    "..X..",
    "XXXXX",
  ],
  L: [
    "X....",
    "X....",
    "X....",
    "X....",
    "X....",
    "X....",
    "XXXXX",
  ],
  E: [
    "XXXXX",
    "X....",
    "X....",
    "XXXX.",
    "X....",
    "X....",
    "XXXXX",
  ],
  " ": ["", "", "", "", "", "", ""],
};

// Espectro: azul → violeta → rosa → naranja (rainbow biotech)
function colorAt(t: number): string {
  // t en [0,1] mapea hue 220 (azul) → 25 (naranja) pasando por 270, 330
  const startHue = 220;
  const endHue = 385; // 25 + 360 para forzar pasar por 360
  const hue = (startHue + (endHue - startHue) * t) % 360;
  return `hsl(${hue} 88% 58%)`;
}

const CHAR_W = 5;
const CHAR_H = 7;
const CHAR_GAP = 1; // columnas vacías entre letras
const CELL = 6; // px (en viewBox) por celda
const DOT_R = 2.3;

export function LogoDna({
  text = "CRM AGILE",
  height = 56,
  className,
  showHelix = true,
  ariaLabel = "CRM AGILE",
}: {
  text?: string;
  height?: number;
  className?: string;
  showHelix?: boolean;
  ariaLabel?: string;
}) {
  const chars = text.split("");
  const totalCols = chars.length * CHAR_W + (chars.length - 1) * CHAR_GAP;
  const vbW = totalCols * CELL;
  const vbH = CHAR_H * CELL;

  type Dot = { cx: number; cy: number; r: number; fill: string };
  const dots: Dot[] = [];

  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i].toUpperCase();
    const matrix = FONT[ch] ?? FONT[" "];
    const xOff = i * (CHAR_W + CHAR_GAP) * CELL;
    for (let r = 0; r < CHAR_H; r++) {
      const row = matrix[r] ?? "";
      for (let c = 0; c < CHAR_W; c++) {
        if (row[c] === "X") {
          const cx = xOff + c * CELL + CELL / 2;
          const cy = r * CELL + CELL / 2;
          dots.push({
            cx,
            cy,
            r: DOT_R,
            fill: colorAt(cx / vbW),
          });
        }
      }
    }
  }

  // Doble hélice: dos curvas sinusoidales en fase opuesta sobre el alto total.
  // Las usamos como fondo decorativo muy sutil.
  const helixPath = (phase: number) => {
    const pts: string[] = [];
    const steps = 80;
    for (let s = 0; s <= steps; s++) {
      const x = (s / steps) * vbW;
      const y =
        vbH / 2 +
        Math.sin((x / vbW) * Math.PI * 5 + phase) * (vbH / 2.4);
      pts.push(`${s === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`);
    }
    return pts.join(" ");
  };

  return (
    <svg
      role="img"
      aria-label={ariaLabel}
      viewBox={`0 0 ${vbW} ${vbH}`}
      height={height}
      className={className}
      style={{ display: "block", overflow: "visible" }}
    >
      {showHelix && (
        <g opacity="0.18">
          <path
            d={helixPath(0)}
            fill="none"
            stroke="url(#dna-strand-a)"
            strokeWidth="1"
            strokeLinecap="round"
          />
          <path
            d={helixPath(Math.PI)}
            fill="none"
            stroke="url(#dna-strand-b)"
            strokeWidth="1"
            strokeLinecap="round"
          />
        </g>
      )}
      <defs>
        <linearGradient id="dna-strand-a" x1="0" x2="1">
          <stop offset="0" stopColor="hsl(220 88% 58%)" />
          <stop offset="0.4" stopColor="hsl(280 88% 58%)" />
          <stop offset="0.7" stopColor="hsl(330 88% 58%)" />
          <stop offset="1" stopColor="hsl(25 88% 58%)" />
        </linearGradient>
        <linearGradient id="dna-strand-b" x1="0" x2="1">
          <stop offset="0" stopColor="hsl(220 88% 58%)" />
          <stop offset="0.4" stopColor="hsl(280 88% 58%)" />
          <stop offset="0.7" stopColor="hsl(330 88% 58%)" />
          <stop offset="1" stopColor="hsl(25 88% 58%)" />
        </linearGradient>
      </defs>
      {dots.map((d, i) => (
        <circle
          key={i}
          cx={d.cx}
          cy={d.cy}
          r={d.r}
          fill={d.fill}
        />
      ))}
    </svg>
  );
}

/**
 * Versión "mark" compacta: sólo dos puntos en doble hélice — para favicon /
 * sidebar collapsed / loaders.
 */
export function LogoDnaMark({ size = 32, className }: { size?: number; className?: string }) {
  const vb = 40;
  const dots: Array<{ cx: number; cy: number; t: number }> = [];
  const N = 7;
  for (let k = 0; k < N; k++) {
    const t = k / (N - 1);
    const x = 6 + t * (vb - 12);
    const y1 = vb / 2 + Math.sin(t * Math.PI * 2) * 12;
    const y2 = vb / 2 - Math.sin(t * Math.PI * 2) * 12;
    dots.push({ cx: x, cy: y1, t });
    dots.push({ cx: x, cy: y2, t });
  }
  return (
    <svg
      role="img"
      aria-label="CRM Agile"
      viewBox={`0 0 ${vb} ${vb}`}
      width={size}
      height={size}
      className={className}
      style={{ display: "block" }}
    >
      {dots.map((d, i) => (
        <circle
          key={i}
          cx={d.cx}
          cy={d.cy}
          r={2.4}
          fill={colorAt(d.t)}
        />
      ))}
    </svg>
  );
}
