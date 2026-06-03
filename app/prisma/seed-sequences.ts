/**
 * seed-sequences.ts — Crea las plantillas (Template) y las secuencias (Sequence)
 * para los flujos automatizados de NOVIT. TODAS las secuencias quedan
 * DESACTIVADAS (active: false). Idempotente (borra por nombre y recrea).
 *
 *   npx tsx prisma/seed-sequences.ts
 *
 * Vínculo template ↔ secuencia: cada paso wa/email referencia un template por
 * `templateKey` (= Template.name). El motor reemplaza {{variables}} y envía.
 */
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── cargar .env.local (DATABASE_URL) ──
function loadEnvLocal() {
  try {
    const txt = readFileSync(join(__dirname, "..", ".env.local"), "utf8");
    for (const line of txt.split("\n")) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
      if (!m) continue;
      let v = m[2].trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      if (!process.env[m[1]]) process.env[m[1]] = v;
    }
  } catch {}
}
loadEnvLocal();

const prisma = new PrismaClient();

// ── Plantillas (key = name) ──
type Tpl = { key: string; channel: "wa" | "email"; description: string; body: string };
const TEMPLATES: Tpl[] = [
  // Grandes
  { key: "grandes_ack_cliente", channel: "wa", description: "Acuse inmediato al cliente Grande", body: "Hola {{nombre}} 👋 Recibimos tu requerimiento para {{empresa}}. Nuestro equipo ya lo está cotizando y te contactamos a la brevedad. — NOVIT" },
  { key: "grandes_alerta_interna", channel: "wa", description: "Alerta interna al equipo (Gerencia NOVIT)", body: "🔴 *Nuevo requerimiento GRANDE*\n{{empresa}} · {{trato}}\nValor: {{valor}}\nEjecutivo: {{ejecutivo}}\nAsignar y cotizar." },
  { key: "grandes_sla_1d", channel: "wa", description: "Recordatorio SLA 1 día (interno)", body: "⏰ *SLA Grandes* — {{trato}} ({{empresa}}) sigue sin propuesta tras 1 día. {{ejecutivo}}, ¿estado?" },
  { key: "grandes_escalado", channel: "wa", description: "Escalado a gerencia 3 días (interno)", body: "🚨 *Escalado a gerencia* — {{trato}} de {{empresa}} lleva 3 días sin propuesta. Requiere atención." },
  // Consolidación
  { key: "consol_bienvenida", channel: "wa", description: "Bienvenida del ejecutivo (cliente)", body: "Hola {{nombre}}, gracias por seguir confiando en NOVIT para {{empresa}}. {{ejecutivo}} te acompaña en esta propuesta — cualquier cosa, por acá. 🙌" },
  { key: "consol_caso_exito", channel: "email", description: "Caso de éxito + invitación 15 min (cliente)", body: "Asunto: Cómo mejora {{industria}} con NOVIT\n\nHola {{nombre}}, te comparto un caso similar en {{industria}} y cómo lo aplicamos. ¿Tenés 15 min esta semana para verlo?" },
  { key: "consol_checkin_upsell", channel: "wa", description: "Check-in + upsell (cliente)", body: "Hola {{nombre}}, además de lo que estamos viendo, identifiqué una mejora que podría sumarle a {{empresa}}. ¿Te la muestro en una llamada corta?" },
  // Regulares
  { key: "regular_welcome", channel: "wa", description: "Bienvenida + propuesta (cliente)", body: "¡Hola {{nombre}}! 👋 Gracias por escribir a NOVIT. Estamos preparando tu propuesta para {{empresa}} y te la enviamos en breve." },
  { key: "regular_followup", channel: "wa", description: "Follow-up de propuesta (cliente)", body: "Hola {{nombre}}, ¿pudiste revisar la propuesta de {{trato}}? Quedo atento a cualquier duda. 🙂" },
  { key: "regular_ultimo_toque", channel: "wa", description: "Último recordatorio (cliente)", body: "{{nombre}}, te dejo un último recordatorio por si seguís interesado en {{trato}}. ¡Quedo a la orden!" },
  // Test
  { key: "test_saludo", channel: "wa", description: "Saludo de prueba (cliente test)", body: "Hola {{nombre}} 👋 Este es un mensaje de *prueba* de la secuencia de NOVIT. Podés ignorarlo. ✅" },
  { key: "test_seguimiento", channel: "wa", description: "Seguimiento de prueba (cliente test)", body: "Hola {{nombre}}, segundo mensaje de *prueba* (seguimiento). Fin del test. 🧪" },
];

// ── Secuencias (nodes = { category, description, trigger, steps }) ──
type Step = {
  kind: "trigger" | "delay" | "wa" | "email" | "branch" | "exit";
  title: string;
  body: string;
  to?: "client" | "internal";
  templateKey?: string;
  delayDays?: number;
};
type Seq = { name: string; category: string; description: string; trigger: string; steps: Step[] };

const SEQUENCES: Seq[] = [
  {
    name: "Grandes — SLA de requerimientos",
    category: "Grande",
    description: "Cuentas grandes (Mapfre): cada requerimiento se acusa al cliente, se alerta al equipo y se vigila el SLA hasta enviar la propuesta.",
    trigger: "Nuevo trato/requerimiento en una empresa categoría Grande.",
    steps: [
      { kind: "trigger", title: "Requerimiento de cuenta GRANDE", body: "Nuevo trato creado en una empresa categoría Grande (ej. Mapfre)." },
      { kind: "wa", title: "WhatsApp · Acuse al cliente", body: "Confirmar recepción y que ya se está cotizando.", to: "client", templateKey: "grandes_ack_cliente" },
      { kind: "wa", title: "WhatsApp · Alerta interna", body: "Avisar al equipo en el grupo Gerencia NOVIT.", to: "internal", templateKey: "grandes_alerta_interna" },
      { kind: "delay", title: "Esperar 1 día", body: "Si el trato no pasó a Propuesta.", delayDays: 1 },
      { kind: "wa", title: "WhatsApp · Recordatorio SLA", body: "Recordatorio interno al ejecutivo.", to: "internal", templateKey: "grandes_sla_1d" },
      { kind: "delay", title: "Esperar 3 días", body: "Si sigue sin propuesta.", delayDays: 3 },
      { kind: "wa", title: "WhatsApp · Escalado a gerencia", body: "Escalar el caso (interno).", to: "internal", templateKey: "grandes_escalado" },
      { kind: "exit", title: "Salida → propuesta enviada", body: "Exit cuando el trato pasa a Propuesta/Negociación." },
    ],
  },
  {
    name: "Consolidación — Nurture + upsell",
    category: "Consolidación",
    description: "Cuentas en crecimiento (SANNA, La Positiva, Grandia): acompañamiento del ejecutivo, caso de éxito y propuesta de valor adicional.",
    trigger: "Nuevo trato en una empresa categoría Consolidación.",
    steps: [
      { kind: "trigger", title: "Trato de cuenta en Consolidación", body: "SANNA, La Positiva, Grandia." },
      { kind: "wa", title: "WhatsApp · Bienvenida del ejecutivo", body: "Mensaje cálido del ejecutivo asignado.", to: "client", templateKey: "consol_bienvenida" },
      { kind: "delay", title: "Esperar 2 días", body: "Si no responde, continuar.", delayDays: 2 },
      { kind: "branch", title: "¿Respondió?", body: "Si responde → alerta para agendar; si no → continúa." },
      { kind: "email", title: "Email · Caso de éxito + 15 min", body: "Caso similar de su industria + invitación.", to: "client", templateKey: "consol_caso_exito" },
      { kind: "delay", title: "Esperar 5 días", body: "Check-in posterior.", delayDays: 5 },
      { kind: "wa", title: "WhatsApp · Check-in + upsell", body: "Proponer una mejora adicional.", to: "client", templateKey: "consol_checkin_upsell" },
      { kind: "exit", title: "Salida → nurture mensual", body: "Pasa a un seguimiento mensual." },
    ],
  },
  {
    name: "Regulares — Onboarding 7 días",
    category: "Regular",
    description: "Clientes nuevos que piden propuestas día a día (Becerra, Caja Andes): bienvenida, follow-up y cierre o marcar Cold a los 7 días.",
    trigger: "Nuevo lead/trato en una empresa categoría Regular.",
    steps: [
      { kind: "trigger", title: "Lead Regular pide propuesta", body: "Becerra, Caja Andes." },
      { kind: "wa", title: "WhatsApp · Bienvenida + propuesta", body: "Saludo y aviso de propuesta en camino.", to: "client", templateKey: "regular_welcome" },
      { kind: "delay", title: "Esperar 2 días", body: "Si no responde, continuar.", delayDays: 2 },
      { kind: "wa", title: "WhatsApp · Follow-up propuesta", body: "Consultar si revisó la propuesta.", to: "client", templateKey: "regular_followup" },
      { kind: "branch", title: "¿Respondió?", body: "Exit si responde." },
      { kind: "delay", title: "Esperar 3 días", body: "Último intento.", delayDays: 3 },
      { kind: "wa", title: "WhatsApp · Último recordatorio", body: "Cierre suave.", to: "client", templateKey: "regular_ultimo_toque" },
      { kind: "exit", title: "Salida → marcar Cold", body: "Después de 7 días sin respuesta, marcar como Cold." },
    ],
  },
  {
    name: "TEST — Cliente básico (prueba)",
    category: "Test",
    description: "Secuencia de PRUEBA para validar el flujo con un cliente básico, sin riesgo. 2 mensajes claramente marcados como test.",
    trigger: "Manual: enrolar 1 cliente de prueba.",
    steps: [
      { kind: "trigger", title: "Inicio manual (cliente de prueba)", body: "Se enrola manualmente un cliente básico para probar." },
      { kind: "wa", title: "WhatsApp · Saludo de prueba", body: "Mensaje de prueba #1.", to: "client", templateKey: "test_saludo" },
      { kind: "delay", title: "Esperar 1 día", body: "Pausa de prueba.", delayDays: 1 },
      { kind: "wa", title: "WhatsApp · Seguimiento de prueba", body: "Mensaje de prueba #2.", to: "client", templateKey: "test_seguimiento" },
      { kind: "exit", title: "Fin de la prueba", body: "Termina el test." },
    ],
  },
];

// ── Empresas → categoría (Company.tier), best-effort ──
const TIER_MAP: { match: string; tier: string }[] = [
  { match: "Mapfre", tier: "Grande" },
  { match: "SANNA", tier: "Consolidación" },
  { match: "Positiva", tier: "Consolidación" },
  { match: "Grandia", tier: "Consolidación" },
  { match: "Becerra", tier: "Regular" },
  { match: "Caja Andes", tier: "Regular" },
];

async function main() {
  const ws = await prisma.workspace.findUnique({ where: { slug: "novit" }, select: { id: true } });
  if (!ws) throw new Error("Workspace 'novit' no encontrado");
  const workspaceId = ws.id;

  // Templates (idempotente: borra por nombre y recrea)
  await prisma.template.deleteMany({ where: { workspaceId, name: { in: TEMPLATES.map((t) => t.key) } } });
  for (const t of TEMPLATES) {
    await prisma.template.create({
      data: { workspaceId, channel: t.channel as any, name: t.key, description: t.description, body: t.body },
    });
  }
  console.log(`✓ ${TEMPLATES.length} plantillas creadas`);

  // Sequences (idempotente, DESACTIVADAS)
  await prisma.sequence.deleteMany({ where: { workspaceId, name: { in: SEQUENCES.map((s) => s.name) } } });
  for (const s of SEQUENCES) {
    await prisma.sequence.create({
      data: {
        workspaceId,
        name: s.name,
        active: false, // ← todas desactivadas
        nodes: { category: s.category, description: s.description, trigger: s.trigger, steps: s.steps } as any,
      },
    });
  }
  console.log(`✓ ${SEQUENCES.length} secuencias creadas (todas DESACTIVADAS)`);

  // Company.tier (best-effort)
  let tiered = 0;
  for (const { match, tier } of TIER_MAP) {
    const r = await prisma.company.updateMany({
      where: { workspaceId, name: { contains: match, mode: "insensitive" } },
      data: { tier },
    });
    tiered += r.count;
  }
  console.log(`✓ ${tiered} empresas categorizadas (tier)`);

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
