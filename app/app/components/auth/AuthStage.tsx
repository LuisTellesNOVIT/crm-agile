/**
 * AuthStage — componentes visuales del login del CRM AGILE (Remix).
 *
 * Diseño portado del prototipo agile-crm-login.html (PROMPT.md / SPEC.md):
 *   - HelixCanvas: doble hélice vertical (90 nucleótidos), centro al ~32%
 *     del viewport para dejar la card flotante a la derecha sin que el eje
 *     atraviese el formulario.
 *   - AppStrandCanvas: strand horizontal bajo el wordmark, sentido inverso.
 *   - BrandMark: "CRM AGILE" con nucleótidos pulsantes escalonados.
 *   - Annotations: 4 etiquetas tipo plano de lab en esquinas del lienzo.
 *   - SequenceTicker: banda inferior ATCG en vivo.
 *
 * Todo respeta `prefers-reduced-motion: reduce` (single frame, sin loop).
 */
import { useEffect, useRef, useState } from "react";
import {
  BASE_COLOR,
  BASES,
  PAIR,
  prefersReducedMotion,
  randomSequence,
  tickerSequence,
} from "../../lib/dna";

/* ============================================================
   HelixCanvas — vertical, sentido descendente (principal)
   ============================================================ */
export function HelixCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.max(1, window.devicePixelRatio || 1);
    let W = 0;
    let H = 0;

    function resize() {
      if (!canvas || !ctx) return;
      const r = canvas.getBoundingClientRect();
      W = r.width;
      H = r.height;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    let resizeTimer: number | undefined;
    const onResize = () => {
      if (resizeTimer) window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(resize, 80);
    };
    window.addEventListener("resize", onResize);
    resize();

    const N = 90;
    const seq = randomSequence(N);
    let t = 0;
    let mouseX = 0.5;
    let targetMouseX = 0.5;

    const onMove = (e: MouseEvent) => {
      if (!canvas) return;
      const r = canvas.getBoundingClientRect();
      targetMouseX = (e.clientX - r.left) / r.width;
    };
    window.addEventListener("mousemove", onMove);

    let raf = 0;
    let paused = false;
    const reduced = prefersReducedMotion();

    function frame() {
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, W, H);
      mouseX += (targetMouseX - mouseX) * 0.04;
      // Centro horizontal del helix en ~32% del viewport — deja la card flotante
      // (lado derecho) con el helix de fondo sin que el eje atraviese el form.
      const cx = W * (0.32 + (mouseX - 0.5) * 0.06);
      const top = -40;
      const bot = H + 40;
      const span = bot - top;
      const amp = Math.min(W * 0.26, 240);
      const step = span / N;
      const tilt = (mouseX - 0.5) * 0.5;

      // Hebra A
      ctx.lineWidth = 1.4;
      ctx.strokeStyle = "rgba(10, 143, 191, 0.32)";
      ctx.beginPath();
      for (let i = 0; i < N; i++) {
        const y = top + i * step;
        const phase = i * 0.3 + t + tilt;
        const x = cx + Math.sin(phase) * amp;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Hebra B
      ctx.strokeStyle = "rgba(15, 154, 106, 0.30)";
      ctx.beginPath();
      for (let i = 0; i < N; i++) {
        const y = top + i * step;
        const phase = i * 0.3 + t + tilt + Math.PI;
        const x = cx + Math.sin(phase) * amp;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Pares de bases + nucleótidos
      for (let i = 0; i < N; i++) {
        const y = top + i * step;
        const phase = i * 0.3 + t + tilt;
        const x1 = cx + Math.sin(phase) * amp;
        const x2 = cx + Math.sin(phase + Math.PI) * amp;
        const z1 = Math.cos(phase);
        const z2 = Math.cos(phase + Math.PI);

        if (i % 2 === 0) {
          const grad = ctx.createLinearGradient(x1, y, x2, y);
          grad.addColorStop(0, "rgba(40, 60, 90, 0.10)");
          grad.addColorStop(0.5, "rgba(40, 60, 90, 0.22)");
          grad.addColorStop(1, "rgba(40, 60, 90, 0.10)");
          ctx.strokeStyle = grad;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(x1, y);
          ctx.lineTo(x2, y);
          ctx.stroke();
        }

        const b1 = seq[i];
        const r1 = 2.6 + (z1 + 1) * 1.6;
        ctx.fillStyle = BASE_COLOR[b1];
        ctx.globalAlpha = Math.min(0.95, 0.35 + (z1 + 1) * 0.3);
        ctx.beginPath();
        ctx.arc(x1, y, r1, 0, Math.PI * 2);
        ctx.fill();
        if (z1 > 0.45) {
          ctx.globalAlpha = 0.2;
          ctx.beginPath();
          ctx.arc(x1, y, r1 * 3.5, 0, Math.PI * 2);
          ctx.fill();
        }

        const b2 = PAIR[b1];
        const r2 = 2.6 + (z2 + 1) * 1.6;
        ctx.fillStyle = BASE_COLOR[b2];
        ctx.globalAlpha = Math.min(0.95, 0.35 + (z2 + 1) * 0.3);
        ctx.beginPath();
        ctx.arc(x2, y, r2, 0, Math.PI * 2);
        ctx.fill();
        if (z2 > 0.45) {
          ctx.globalAlpha = 0.2;
          ctx.beginPath();
          ctx.arc(x2, y, r2 * 3.5, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }

      t += 0.006;
      if (!paused && !reduced) raf = requestAnimationFrame(frame);
    }

    const onVisibility = () => {
      paused = document.hidden;
      if (!paused && !reduced) raf = requestAnimationFrame(frame);
    };
    document.addEventListener("visibilitychange", onVisibility);

    if (reduced) frame();
    else raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("mousemove", onMove);
      document.removeEventListener("visibilitychange", onVisibility);
      if (resizeTimer) window.clearTimeout(resizeTimer);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      className="auth-helix"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
    />
  );
}

/* ============================================================
   AppStrandCanvas — horizontal bajo el wordmark, sentido inverso
   ============================================================ */
export function AppStrandCanvas({ width = 240, height = 22 }: { width?: number; height?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.max(1, window.devicePixelRatio || 1);
    let W = 0;
    let H = 0;

    function resize() {
      if (!canvas || !ctx) return;
      const r = canvas.getBoundingClientRect();
      W = r.width;
      H = r.height;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    window.addEventListener("resize", resize);
    resize();

    const N = 36;
    const seq = randomSequence(N);
    let t = 0;
    let raf = 0;
    let paused = false;
    const reduced = prefersReducedMotion();

    function frame() {
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, W, H);
      const cy = H / 2;
      const left = -10;
      const right = W + 10;
      const span = right - left;
      const amp = Math.min(H * 0.42, 8);
      const step = span / N;

      // Hebra A (signo `-t` invierte el sentido)
      ctx.lineWidth = 1;
      ctx.strokeStyle = "rgba(10, 143, 191, 0.45)";
      ctx.beginPath();
      for (let i = 0; i < N; i++) {
        const x = left + i * step;
        const phase = i * 0.55 - t;
        const y = cy + Math.sin(phase) * amp;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Hebra B
      ctx.strokeStyle = "rgba(15, 154, 106, 0.45)";
      ctx.beginPath();
      for (let i = 0; i < N; i++) {
        const x = left + i * step;
        const phase = i * 0.55 - t + Math.PI;
        const y = cy + Math.sin(phase) * amp;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Pares + nucleótidos
      for (let i = 0; i < N; i++) {
        const x = left + i * step;
        const phase = i * 0.55 - t;
        const y1 = cy + Math.sin(phase) * amp;
        const y2 = cy + Math.sin(phase + Math.PI) * amp;
        const z1 = Math.cos(phase);
        const z2 = Math.cos(phase + Math.PI);

        if (i % 2 === 0) {
          const grad = ctx.createLinearGradient(x, y1, x, y2);
          grad.addColorStop(0, "rgba(40, 60, 90, 0.12)");
          grad.addColorStop(0.5, "rgba(40, 60, 90, 0.28)");
          grad.addColorStop(1, "rgba(40, 60, 90, 0.12)");
          ctx.strokeStyle = grad;
          ctx.lineWidth = 0.9;
          ctx.beginPath();
          ctx.moveTo(x, y1);
          ctx.lineTo(x, y2);
          ctx.stroke();
        }

        const b1 = seq[i];
        const r1 = 1.4 + (z1 + 1) * 0.9;
        ctx.fillStyle = BASE_COLOR[b1];
        ctx.globalAlpha = Math.min(0.95, 0.45 + (z1 + 1) * 0.25);
        ctx.beginPath();
        ctx.arc(x, y1, r1, 0, Math.PI * 2);
        ctx.fill();

        const b2 = PAIR[b1];
        const r2 = 1.4 + (z2 + 1) * 0.9;
        ctx.fillStyle = BASE_COLOR[b2];
        ctx.globalAlpha = Math.min(0.95, 0.45 + (z2 + 1) * 0.25);
        ctx.beginPath();
        ctx.arc(x, y2, r2, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      t += 0.012;
      if (!paused && !reduced) raf = requestAnimationFrame(frame);
    }

    const onVisibility = () => {
      paused = document.hidden;
      if (!paused && !reduced) raf = requestAnimationFrame(frame);
    };
    document.addEventListener("visibilitychange", onVisibility);

    if (reduced) frame();
    else raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      style={{ display: "block", width: `${width}px`, height: `${height}px`, marginTop: "-2px" }}
    />
  );
}

/* ============================================================
   BrandMark — "CRM AGILE" con nucleótidos pulsantes
   ============================================================ */
const BRAND_LETTERS = [
  { ch: "C", color: "var(--auth-n-c)" },
  { ch: "R", color: "var(--auth-n-a)" },
  { ch: "M", color: "var(--auth-n-t)" },
  { ch: "A", color: "var(--auth-n-a)" },
  { ch: "G", color: "var(--auth-n-g)" },
  { ch: "I", color: "var(--auth-n-t)" },
  { ch: "L", color: "var(--auth-n-c)" },
  { ch: "E", color: "var(--auth-n-g)" },
];

export function BrandMark() {
  return (
    <div className="auth-brand-mark">
      <div className="auth-brand-name">
        <span className="auth-brand-letters" aria-label="CRM AGILE" role="img">
          {BRAND_LETTERS.slice(0, 3).map((L, i) => (
            <span
              key={`crm-${i}`}
              className="auth-al"
              aria-hidden="true"
              style={{ ["--c" as never]: L.color, ["--d" as never]: `${i * 0.15}s` } as React.CSSProperties}
            >
              {L.ch}
            </span>
          ))}
          <span className="auth-al-sep" aria-hidden="true">·</span>
          {BRAND_LETTERS.slice(3).map((L, i) => (
            <span
              key={`agile-${i}`}
              className="auth-al"
              aria-hidden="true"
              style={{ ["--c" as never]: L.color, ["--d" as never]: `${(i + 3) * 0.15}s` } as React.CSSProperties}
            >
              {L.ch}
            </span>
          ))}
        </span>
        <AppStrandCanvas width={240} height={22} />
        <span className="auth-brand-meta">Secuencia 04.2 · CRM</span>
      </div>
    </div>
  );
}

/* ============================================================
   Annotations — etiquetas tipo plano de lab en esquinas
   ============================================================ */
export function Annotations() {
  return (
    <>
      <div className="auth-annot auth-annot-1" aria-hidden="true">
        POS <span className="v">1.247.382</span>
      </div>
      <div className="auth-annot auth-annot-2" aria-hidden="true">
        PAR <span className="v">CGTA</span> · ATCG
      </div>
      <div className="auth-annot auth-annot-3" aria-hidden="true">
        REC <span className="v">17.42</span> · 04Z
      </div>
      <div className="auth-annot auth-annot-4 auth-annot--left" aria-hidden="true">
        CADENA · A
      </div>
    </>
  );
}

/* ============================================================
   SequenceTicker — banda inferior con secuencias en vivo
   ============================================================ */
export function SequenceTicker() {
  const [seqA, setSeqA] = useState("ATCG-CGAT-TGCA-GCTA-AATC");
  const [seqB, setSeqB] = useState("GCTA-TACG-CAGT-GTCA");

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;
    const id = window.setInterval(() => {
      setSeqA(tickerSequence(5));
      setSeqB(tickerSequence(4));
    }, 1400);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="auth-ticker" aria-hidden="true">
      <span className="auth-ticker-dot" />
      <span className="auth-ticker-label">// SEQUENCE STREAM</span>
      <span className="auth-ticker-seq">{seqA}</span>
      <span className="auth-ticker-pulse">»</span>
      <span className="auth-ticker-seq dim">{seqB}</span>
    </div>
  );
}
