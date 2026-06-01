/**
 * brief-charts.ts — Renderiza los gráficos del brief a PNG (headless, sin
 * navegador) con @napi-rs/canvas, para adjuntarlos por WhatsApp.
 *
 *   renderTopClients(...)  → donut Top 5 clientes + leyenda
 *   renderFunnel(...)      → embudo por etapa (trapecios conectados)
 *
 * Montos en Soles (S/) por default — mismo criterio que el brief de texto.
 */
import { createCanvas, type SKRSContext2D } from "@napi-rs/canvas";

const FX = 3.75;
export function money(v: number, currency: "PEN" | "USD" = "PEN"): string {
  const sym = currency === "PEN" ? "S/" : "$";
  const conv = currency === "PEN" ? v * FX : v;
  const abs = Math.abs(conv);
  if (abs >= 1_000_000) return `${sym}${(conv / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (abs >= 1_000) return `${sym}${Math.round(conv / 1000)}k`;
  return `${sym}${Math.round(conv)}`;
}

function roundRect(ctx: SKRSContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

const SCALE = 2; // retina
const INK = "#0f172a";
const SUB = "#64748b";
const MUTE = "#94a3b8";

export type ClientSeg = { label: string; value: number; count: number; color: string };

export function renderTopClients(
  segs: ClientSeg[],
  total: number,
  clientCount: number,
  currency: "PEN" | "USD" = "PEN",
): Buffer {
  const W = 940;
  const headerH = 96;
  const rowH = 66;
  const padB = 24;
  const bodyH = Math.max(segs.length * rowH, 360);
  const H = headerH + bodyH + padB;

  const canvas = createCanvas(W * SCALE, H * SCALE);
  const ctx = canvas.getContext("2d");
  ctx.scale(SCALE, SCALE);

  // fondo + borde
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "#e5e7eb";
  ctx.lineWidth = 1;
  roundRect(ctx, 1, 1, W - 2, H - 2, 16);
  ctx.stroke();

  // header
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillStyle = INK;
  ctx.font = "600 23px sans-serif";
  ctx.fillText("Top 5 clientes", 30, 48);
  ctx.textAlign = "right";
  ctx.fillStyle = SUB;
  ctx.font = "14px sans-serif";
  ctx.fillText(`${money(total, currency)} · ${clientCount} clientes · ganados + en proceso`, W - 30, 48);

  // divider
  ctx.strokeStyle = "#eef2f7";
  ctx.beginPath();
  ctx.moveTo(20, headerH - 6);
  ctx.lineTo(W - 20, headerH - 6);
  ctx.stroke();

  // donut
  const cx = 140;
  const cy = headerH + bodyH / 2;
  const rO = 94;
  const rI = 60;
  let a0 = -Math.PI / 2;
  for (const s of segs) {
    if (s.value <= 0) continue;
    const a1 = a0 + (s.value / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(cx, cy, rO, a0, a1);
    ctx.arc(cx, cy, rI, a1, a0, true);
    ctx.closePath();
    ctx.fillStyle = s.color;
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.stroke();
    a0 = a1;
  }
  ctx.textAlign = "center";
  ctx.fillStyle = MUTE;
  ctx.font = "11px sans-serif";
  ctx.fillText("CLIENTES", cx, cy - 18);
  ctx.fillStyle = INK;
  ctx.font = "600 23px sans-serif";
  ctx.fillText(money(total, currency), cx, cy + 4);
  ctx.fillStyle = SUB;
  ctx.font = "12px sans-serif";
  ctx.fillText(`${clientCount} clientes`, cx, cy + 26);

  // leyenda
  const lx = 296;
  const lw = W - lx - 28;
  segs.forEach((s, i) => {
    const y = headerH + i * rowH + 4;
    const ch = rowH - 12;
    ctx.fillStyle = "#f8fafc";
    roundRect(ctx, lx, y, lw, ch, 10);
    ctx.fill();
    ctx.fillStyle = s.color;
    roundRect(ctx, lx, y, 4, ch, 2);
    ctx.fill();
    ctx.fillStyle = s.color;
    ctx.beginPath();
    ctx.arc(lx + 24, y + ch / 2, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.textBaseline = "alphabetic";
    ctx.textAlign = "left";
    ctx.fillStyle = INK;
    ctx.font = "600 16px sans-serif";
    ctx.fillText(s.label, lx + 42, y + ch / 2 - 2);
    const pct = total ? Math.round((s.value / total) * 100) : 0;
    ctx.fillStyle = MUTE;
    ctx.font = "12px sans-serif";
    ctx.fillText(`${pct}% · ${s.count} ${s.count === 1 ? "trato" : "tratos"}`, lx + 42, y + ch / 2 + 16);
    ctx.textAlign = "right";
    ctx.fillStyle = INK;
    ctx.font = "600 18px sans-serif";
    ctx.fillText(money(s.value, currency), lx + lw - 16, y + ch / 2 + 6);
    ctx.textBaseline = "middle";
  });

  return canvas.toBuffer("image/png");
}

export type FunnelStage = { label: string; value: number; color: string };

export function renderFunnel(stages: FunnelStage[], currency: "PEN" | "USD" = "PEN"): Buffer {
  const W = 940;
  const headerH = 96;
  const rowH = 62;
  const padB = 24;
  const H = headerH + stages.length * rowH + padB;

  const canvas = createCanvas(W * SCALE, H * SCALE);
  const ctx = canvas.getContext("2d");
  ctx.scale(SCALE, SCALE);

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "#e5e7eb";
  ctx.lineWidth = 1;
  roundRect(ctx, 1, 1, W - 2, H - 2, 16);
  ctx.stroke();

  const total = stages.reduce((a, s) => a + s.value, 0);
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillStyle = INK;
  ctx.font = "600 23px sans-serif";
  ctx.fillText("Embudo por etapa", 30, 48);
  ctx.textAlign = "right";
  ctx.fillStyle = SUB;
  ctx.font = "14px sans-serif";
  ctx.fillText(`valor por etapa · ${money(total, currency)}`, W - 30, 48);

  ctx.strokeStyle = "#eef2f7";
  ctx.beginPath();
  ctx.moveTo(20, headerH - 6);
  ctx.lineTo(W - 20, headerH - 6);
  ctx.stroke();

  const max = Math.max(...stages.map((s) => s.value), 1);
  const labelW = 150;
  const pctW = 56;
  const trackX = labelW + 12;
  const trackW = W - trackX - pctW - 24;
  const trackCx = trackX + trackW / 2;
  const w = (v: number) => Math.max((v / max) * trackW, trackW * 0.07);

  stages.forEach((s, i) => {
    const y = headerH + i * rowH;
    const bandH = rowH - 6;
    const topW = w(s.value);
    const botW = i < stages.length - 1 ? w(stages[i + 1].value) : topW * 0.5;
    ctx.beginPath();
    ctx.moveTo(trackCx - topW / 2, y + 3);
    ctx.lineTo(trackCx + topW / 2, y + 3);
    ctx.lineTo(trackCx + botW / 2, y + bandH);
    ctx.lineTo(trackCx - botW / 2, y + bandH);
    ctx.closePath();
    ctx.fillStyle = s.color;
    ctx.fill();

    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    ctx.fillStyle = "#334155";
    ctx.font = "15px sans-serif";
    ctx.fillText(s.label, 30, y + rowH / 2);

    const valStr = money(s.value, currency);
    const wide = Math.max(topW, botW) >= trackW * 0.26;
    if (wide) {
      ctx.textAlign = "center";
      ctx.fillStyle = "#ffffff";
      ctx.font = "600 14px sans-serif";
      ctx.fillText(valStr, trackCx, y + rowH / 2);
    } else {
      ctx.textAlign = "left";
      ctx.fillStyle = "#334155";
      ctx.font = "600 13px sans-serif";
      ctx.fillText(valStr, trackCx + Math.max(topW, botW) / 2 + 8, y + rowH / 2);
    }

    const pct = total ? Math.round((s.value / total) * 100) : 0;
    ctx.textAlign = "right";
    ctx.fillStyle = MUTE;
    ctx.font = "12px sans-serif";
    ctx.fillText(`${pct}%`, W - 28, y + rowH / 2);
  });

  return canvas.toBuffer("image/png");
}
