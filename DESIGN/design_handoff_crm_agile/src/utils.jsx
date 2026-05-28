// Shared utilities
// Currency-aware money formatting. window.__currency drives the active code.
// Defaults to USD; App-level state mirrors into window.__currency on change.
const CURRENCIES = {
  USD: { code: "USD", symbol: "$",  rate: 1,      decimals: 0 },
  PEN: { code: "PEN", symbol: "S/", rate: 3.75,   decimals: 0 },
  EUR: { code: "EUR", symbol: "€",  rate: 0.92,   decimals: 0 },
  MXN: { code: "MXN", symbol: "$",  rate: 17.2,   decimals: 0 },
  BRL: { code: "BRL", symbol: "R$", rate: 5.05,   decimals: 0 }
};

if (typeof window !== "undefined" && !window.__currency) window.__currency = "USD";

function getCurrency() {
  return CURRENCIES[(typeof window !== "undefined" ? window.__currency : "USD") || "USD"] || CURRENCIES.USD;
}

const fmtMoney = (v, compact = false) => {
  if (v == null) return "—";
  const cur = getCurrency();
  const conv = v * cur.rate;
  const abs = Math.abs(conv);
  if (compact && abs >= 1000) {
    if (abs >= 1_000_000) return cur.symbol + (conv / 1_000_000).toFixed(1) + "M";
    return cur.symbol + Math.round(conv / 1000) + "k";
  }
  return cur.symbol + Math.round(conv).toLocaleString("en-US");
};

const fmtNum = (v) => v == null ? "—" : v.toLocaleString("en-US");

const fmtDate = (d, opts = {}) => {
  const dt = typeof d === "string" ? new Date(d) : d;
  const day = String(dt.getDate()).padStart(2, "0");
  const monthShort = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"][dt.getMonth()];
  const monthFull = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"][dt.getMonth()];
  const y = dt.getFullYear();
  if (opts.format === "short") return `${day} ${monthShort}`;
  if (opts.format === "long")  return `${day} ${monthFull} ${y}`;
  return `${day} ${monthShort} ${y}`;
};

const daysBetween = (a, b) => {
  const A = typeof a === "string" ? new Date(a) : a;
  const B = typeof b === "string" ? new Date(b) : b;
  return Math.round((B - A) / 86400000);
};

const addDays = (d, n) => {
  const dt = new Date(d);
  dt.setDate(dt.getDate() + n);
  return dt;
};

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

const stageLabel = (id) => {
  const s = (window.CRM_DATA?.stages || []).find(s => s.id === id);
  return s?.label || id;
};
const stageColor = (id) => {
  const s = (window.CRM_DATA?.stages || []).find(s => s.id === id);
  return s?.color || "#94a3b8";
};

// Simple sparkline
const Sparkline = ({ values, color = "var(--accent)", width = 80, height = 32, fill = true }) => {
  if (!values || !values.length) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = (max - min) || 1;
  const pts = values.map((v, i) => [
    (i / (values.length - 1)) * width,
    height - ((v - min) / range) * height
  ]);
  const path = pts.map((p, i) => (i === 0 ? "M" : "L") + p[0].toFixed(1) + "," + p[1].toFixed(1)).join(" ");
  const area = path + ` L${width},${height} L0,${height} Z`;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: "block" }}>
      {fill && <path d={area} fill={color} opacity="0.10" />}
      <path d={path} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
};

// Highlight template variables
const renderTemplateBody = (txt) => {
  const parts = [];
  let m;
  let last = 0;
  const re = /\{\{([^}]+)\}\}/g;
  while ((m = re.exec(txt))) {
    if (m.index > last) parts.push(txt.slice(last, m.index));
    parts.push(<span key={parts.length} className="var">{`{{${m[1]}}}`}</span>);
    last = m.index + m[0].length;
  }
  if (last < txt.length) parts.push(txt.slice(last));
  return parts;
};

// Channel icon meta
const channelMeta = {
  wa:    { color: "#25D366", icon: "wa",    label: "WhatsApp" },
  email: { color: "#5b6cff", icon: "mail",  label: "Email" },
  call:  { color: "#ea580c", icon: "phone", label: "Llamada" },
  note:  { color: "#71717a", icon: "note",  label: "Nota IA" },
  mention: { color: "#2563eb", icon: "users", label: "Mención" },
  task:  { color: "#8b5cf6", icon: "check", label: "Tarea" },
  deal:  { color: "#16a34a", icon: "dollar", label: "Trato" },
  ai:    { color: "#8b5cf6", icon: "sparkles", label: "AI" }
};

Object.assign(window, { fmtMoney, fmtNum, fmtDate, daysBetween, addDays, clamp, stageLabel, stageColor, Sparkline, renderTemplateBody, channelMeta, CURRENCIES, getCurrency });
