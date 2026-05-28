import type {
  ConversationMsg,
  CustomObject,
  FeaturedCustomer,
  InboxItem,
  Sequence,
  Template,
  WorkspaceId,
} from "../types";

export const inbox: Record<WorkspaceId, InboxItem[]> = {
  novit: [
    { id: "i1", ch: "wa", from: "Lucía Mendoza", co: "Mercado Libre", subj: "Confirmamos reunión jueves 10am", preview: "Perfecto María, nos vemos por Meet. ¿Podrías mandar la agenda?", t: "12m", unread: true, type: "message" },
    { id: "i2", ch: "mention", from: "Carlos Giménez", subj: "Te mencionó en BBVA · Data Mesh — fase 2", preview: "@maria.paz ¿pueden revisar el alcance con infra antes del viernes?", t: "1h", unread: true, type: "mention" },
    { id: "i3", ch: "email", from: "javier@ypf.com.ar", co: "YPF", subj: "RE: Propuesta migración multi-región", preview: "Hola María, leímos la propuesta. Necesitamos ajustar la fase 2 a Q4.", t: "2h", unread: true, type: "message" },
    { id: "i4", ch: "wa", from: "Tomás Aguirre", co: "Naranja X", subj: "Microservicios Onboarding", preview: "Hola, gracias por la demo. ¿Cuándo podemos hacer el deep-dive técnico?", t: "3h", unread: false, type: "message" },
    { id: "i5", ch: "note", from: "AI Assistant", subj: "Riesgo de stalling en Telecom · AI Co-pilot", preview: "Sin contacto hace 6 días. Sugerencia: enviar caso de uso similar de Personal.", t: "4h", unread: true, type: "task" },
    { id: "i6", ch: "call", from: "Mariana Cofré", co: "Banco Galicia", subj: "Llamada perdida · 4:32 PM", preview: "Recording disponible. Resumen IA: discusión de SLAs y penalidades.", t: "6h", unread: false, type: "message" },
    { id: "i7", ch: "wa", from: "Andrés Tobio", co: "Arcor", subj: "ERP Microsoft Dynamics", preview: "María buenos días, te paso el contacto del CFO para la próxima reunión.", t: "1d", unread: false, type: "message" },
    { id: "i8", ch: "email", from: "compras@pampaenergia.com", co: "Pampa Energía", subj: "Salesforce — pedido de cotización", preview: "Estimados, necesitamos cotización para 120 licencias Service Cloud.", t: "1d", unread: false, type: "message" },
    { id: "i9", ch: "mention", from: "Julián Lazarte", subj: "Compartió un contrato · Edenor", preview: "Subí el SOW final firmado para tu visado en Customer 360.", t: "2d", unread: false, type: "mention" },
  ],
  sharky: [
    { id: "i1", ch: "wa", from: "Sofía Marín", co: "Rappi", subj: "Onboarding Pro — Tier 2", preview: "Ariana hola! Estamos listas para arrancar. ¿Cuándo nos pasan el kickoff?", t: "8m", unread: true, type: "message" },
    { id: "i2", ch: "email", from: "growth@pomelo.la", co: "Pomelo", subj: "Growth retainer 6m — última versión", preview: "Aprobamos internamente. Falta firma del CFO. Te aviso esta semana.", t: "45m", unread: true, type: "message" },
    { id: "i3", ch: "mention", from: "Nicole Funes", subj: "@ariana en Cervecería Andes", preview: "El brief del cliente necesita tu revisión antes del jueves.", t: "1h", unread: true, type: "mention" },
    { id: "i4", ch: "wa", from: "Federico Klein", co: "Mercado Pago", subj: "Funnel CRO checkout", preview: "Ariana podemos avanzar con la fase 2 si bajamos el alcance del A/B.", t: "2h", unread: true, type: "message" },
    { id: "i5", ch: "note", from: "AI Assistant", subj: "Lead score subió · Buenbit a 92%", preview: "Match alto con perfil ICP. Sugerencia: agendar discovery esta semana.", t: "3h", unread: true, type: "task" },
    { id: "i6", ch: "call", from: "Camila Reyes", co: "Cabify", subj: "Llamada · 32 min · Lifecycle email", preview: "Recording disponible. Resumen IA: dolor en retención semana 4.", t: "5h", unread: false, type: "message" },
    { id: "i7", ch: "wa", from: "Mateo Suarez", co: "Brubank", subj: "Eventos Q4", preview: "Hola Ariana, ¿podrías mandarnos casos de éxito de fintechs?", t: "1d", unread: false, type: "message" },
    { id: "i8", ch: "email", from: "ops@tiendanube.com", co: "Tiendanube", subj: "WhatsApp commerce — firmado", preview: "Adjunto el SOW firmado. Pueden facturar la primera cuota.", t: "2d", unread: false, type: "message" },
  ],
};

export const conversations: Record<string, ConversationMsg[]> = {
  "novit:i1": [
    { dir: "in", text: "Hola María! Te confirmo la reunión del jueves a las 10am.", at: "Hoy · 10:42", ch: "wa" },
    { dir: "out", text: "Genial Lucía, te paso el link de Meet ahora mismo 🚀", at: "Hoy · 10:43", ch: "wa" },
    { dir: "out", text: "Voy a llevar a Carlos (Senior AE) y a un arquitecto de infra. ¿Te suma alguien?", at: "Hoy · 10:44", ch: "wa" },
    { dir: "in", text: "Perfecto María, nos vemos por Meet. ¿Podrías mandar la agenda?", at: "Hoy · 10:46", ch: "wa" },
  ],
  "novit:i3": [
    { dir: "in", text: "Hola María, leímos la propuesta. Necesitamos ajustar la fase 2 a Q4 para alinearnos con el cierre fiscal.", at: "Hoy · 09:12", ch: "email" },
    { dir: "in", text: "También nos gustaría sumar una sesión de discovery con el equipo de plataforma antes de firmar.", at: "Hoy · 09:12", ch: "email" },
  ],
  "sharky:i1": [
    { dir: "in", text: "Ariana hola! Estamos listas para arrancar el onboarding.", at: "Hoy · 14:32", ch: "wa" },
    { dir: "in", text: "¿Cuándo nos pasan el kickoff?", at: "Hoy · 14:33", ch: "wa" },
    { dir: "out", text: "Hola Sofi! 🎉 Te paso 3 opciones para el kickoff esta semana, decime cuál les calza mejor.", at: "Hoy · 14:40", ch: "wa" },
  ],
};

// Cliente destacado por workspace.
// `name` debe matchear EXACTAMENTE con el campo `company` de los deals reales
// en Postgres — el filter de routes/customers.tsx hace toLowerCase() match.
export const featured: Record<WorkspaceId, FeaturedCustomer> = {
  novit: {
    id: "MAP-001",
    name: "Mapfre",
    industry: "Seguros · Multinacional",
    logo: "Mp",
    website: "mapfre.pe",
    arr: 0, // se computa en runtime via customerDeals
    employees: "30,000+",
    tier: "Strategic",
    mrr: 0,
    churnRisk: "Low",
    nps: 58,
    aiScore: 74,
    stage: "negotiation",
    owner: "MP",
    contacts: [
      { name: "Andrés Rivas", role: "CIO", email: "a.rivas@mapfre.pe" },
      { name: "Patricia Ñahui", role: "VP Tecnología & Datos", email: "p.nahui@mapfre.pe" },
      { name: "Sergio Quispe", role: "Procurement Lead", email: "s.quispe@mapfre.pe" },
    ],
    timeline: [
      { day: "Hoy", events: [
        { type: "wa", text: "Andrés Rivas confirmó steering committee del jueves 10am.", who: "Andrés Rivas", at: "10:42" },
        { type: "ai", text: "AI Score subió 70 → 74 por avance en Migración Oracle Forms y Sistema HIS.", who: "AI", at: "09:00" },
      ]},
      { day: "Ayer", events: [
        { type: "email", text: "Propuesta enviada · Sistema HIS — 226K USD setup + 7.2K USD mensual.", who: "María Paz", at: "16:20" },
        { type: "note", text: "Nota IA: 14 oportunidades activas en Mapfre. Principal foco: modernización core insurance.", who: "AI · Meeting recap", at: "15:00" },
      ]},
      { day: "Esta semana", events: [
        { type: "call", text: "Llamada técnica · 47 min · revisión arquitectura para Migración OIM.", who: "Patricia Ñahui", at: "14:00" },
        { type: "wa", text: "Sergio pidió referencias de implementaciones similares en aseguradoras LATAM.", who: "Sergio Quispe", at: "10:15" },
      ]},
      { day: "Hace 2 semanas", events: [
        { type: "task", text: "Tarea: armar caso DESCARGA MASIVA PÓLIZAS para próximo steering.", who: "María Paz", at: "11:30" },
      ]},
      { day: "Hace 1 mes", events: [
        { type: "deal", text: "Modernización mainframe — Power Centros Médicos pasó a Won.", who: "María Paz", at: "17:00" },
      ]},
    ],
  },
  sharky: {
    id: "BCR-007",
    name: "Becerra Brokers",
    industry: "Brokers · Seguros",
    logo: "Bb",
    website: "becerrabrokers.pe",
    arr: 0,
    employees: "50-100",
    tier: "Growth",
    mrr: 0,
    churnRisk: "Medium",
    nps: 51,
    aiScore: 78,
    stage: "signing",
    owner: "AV",
    contacts: [
      { name: "Carlos Becerra", role: "CEO", email: "c.becerra@becerrabrokers.pe" },
      { name: "Andrea Soto", role: "Head of Operations", email: "a.soto@becerrabrokers.pe" },
    ],
    timeline: [
      { day: "Hoy", events: [
        { type: "wa", text: "Carlos pidió fechas para kickoff del Sistema de Brokers.", who: "Carlos Becerra", at: "14:32" },
        { type: "ai", text: "Engagement alto últimas 72hs · ambos deals avanzando en paralelo.", who: "AI", at: "12:00" },
      ]},
      { day: "Ayer", events: [
        { type: "email", text: "SOW Automatización de Agentes — listo para firma.", who: "Ariana", at: "11:00" },
        { type: "note", text: "Nota IA: ICP fit alto (94%). Vertical: brokers de seguros LATAM.", who: "AI", at: "09:30" },
      ]},
      { day: "Esta semana", events: [
        { type: "call", text: "Demo personalizada · 28 min. Carlos interesado en módulo de comisiones.", who: "Carlos Becerra", at: "15:00" },
      ]},
      { day: "Hace 2 semanas", events: [
        { type: "deal", text: "Automatización de Agentes pasó: Propuesta → Firma del Contrato.", who: "Ariana", at: "16:45" },
      ]},
    ],
  },
};

export const templates: Template[] = [
  { id: "t1", channel: "wa", name: "Welcome new lead", desc: "Primer mensaje al recibir un lead inbound", body: "Hola {{first_name}} 👋\n\nGracias por contactarte con {{workspace_name}}. Soy {{owner_name}} y voy a ser tu punto de contacto para {{company}}.\n\n¿Tenés 15 min esta semana para una primera charla? Te paso 3 opciones:\n\n• Martes 10:00\n• Miércoles 16:00\n• Jueves 11:30", uses: 1248, replyRate: 67 },
  { id: "t2", channel: "wa", name: "Follow-up sin respuesta", desc: "2do toque cuando no hay respuesta en 48hs", body: "Hola {{first_name}}, sé que estás ocupado/a. ¿Te queda en el radar lo de {{deal_name}}? Si querés, te mando un loom de 3min con los próximos pasos.", uses: 892, replyRate: 41 },
  { id: "t3", channel: "email", name: "Propuesta enviada — recap", desc: "Email recap luego de enviar propuesta", body: "Hola {{first_name}},\n\nAdjunto la propuesta de {{deal_name}} con valor total {{deal_value}} y fecha estimada de inicio {{start_date}}.\n\nPuntos clave:\n• Alcance: {{scope_summary}}\n• Equipo: {{team_size}} personas\n• Plazo: {{duration}}\n\nQuedo atento/a a tus comentarios.\n\n{{owner_name}}", uses: 412, replyRate: 78 },
  { id: "t4", channel: "wa", name: "Recordatorio reunión", desc: "24h antes de meeting agendado", body: "Hola {{first_name}}! Te recuerdo nuestra reunión mañana a las {{meeting_time}}. Link: {{meeting_link}}\n\nNos vemos! 🚀", uses: 2104, replyRate: 22 },
  { id: "t5", channel: "email", name: "Contrato ganado — bienvenida", desc: "Welcome al ganar el deal", body: "{{first_name}}, qué alegría tenerte como cliente de {{workspace_name}} 🎉\n\nEstos son los próximos pasos:\n\n1. Kickoff el {{kickoff_date}}\n2. Acceso al portal: {{portal_url}}\n3. Tu Customer Success Manager: {{csm_name}}", uses: 156, replyRate: 92 },
  { id: "t6", channel: "wa", name: "Nurture — caso de éxito", desc: "Compartir caso relevante para destrabar", body: "Hola {{first_name}}, te comparto cómo {{similar_company}} resolvió un problema parecido al de {{company}}. Caso completo: {{case_link}}", uses: 645, replyRate: 38 },
];

export const sequences: Sequence[] = [
  {
    id: "s1",
    name: "Lead inbound — onboarding 7 días",
    active: true,
    stats: { enrolled: 1284, completed: 612, replyRate: 41, meetingBooked: 187 },
    nodes: [
      { kind: "trigger", title: "Lead creado", body: "Disparador: nuevo lead desde formulario web, Facebook Ads o referido." },
      { kind: "delay", title: "Inmediato", body: "0 minutos" },
      { kind: "wa", title: "WhatsApp · Welcome new lead", body: "Plantilla: {{first_name}}, gracias por contactarte…" },
      { kind: "delay", title: "Esperar 2 días", body: "Si no responde, continuar" },
      { kind: "branch", title: "¿Respondió?", body: "Exit trigger en respuesta" },
      { kind: "email", title: "Email · Caso de éxito", body: "Caso similar de {{industry}} + invitación a 15min" },
      { kind: "delay", title: "Esperar 3 días", body: "Si no responde, continuar" },
      { kind: "wa", title: "WhatsApp · Nurture", body: "Último toque manual antes de marcar como cold" },
      { kind: "exit", title: "Salida → marcar Cold", body: "Después de 7 días sin respuesta" },
    ],
  },
];

export const customObjects: CustomObject[] = [
  { id: "co1", name: "Leads", icon: "L", color: "#0ea5e9", count: 3842, attrs: [
    { name: "Nombre completo", type: "text", required: true, desc: "Nombre y apellido del prospecto" },
    { name: "Empresa", type: "record", required: true, desc: "Vinculado a objeto Companies" },
    { name: "Email", type: "email", required: true, desc: "Email corporativo" },
    { name: "WhatsApp", type: "phone", required: false, desc: "Formato E.164" },
    { name: "Source", type: "select", required: true, desc: "FB Ads · LinkedIn · Referral · Web" },
    { name: "Lead Score", type: "number", required: false, desc: "Calculado por ML — 0 a 100" },
    { name: "Utm Campaign", type: "text", required: false, desc: "Atribución de marketing" },
    { name: "First Touch", type: "datetime", required: false, desc: "Primera interacción registrada" },
  ]},
  { id: "co2", name: "Companies", icon: "C", color: "#8b5cf6", count: 1284, attrs: [
    { name: "Razón social", type: "text", required: true, desc: "" },
    { name: "Industria", type: "select", required: false, desc: "Tech · Finance · Retail · Gov · …" },
    { name: "Tamaño", type: "select", required: false, desc: "1-10 · 11-50 · 51-200 · 200+" },
    { name: "ARR estimado", type: "currency", required: false, desc: "" },
    { name: "País", type: "select", required: false, desc: "" },
    { name: "Tier", type: "select", required: false, desc: "Strategic · Growth · SMB" },
  ]},
  { id: "co3", name: "Deals", icon: "D", color: "#16a34a", count: 642, attrs: [
    { name: "Nombre del trato", type: "text", required: true, desc: "" },
    { name: "Compañía", type: "record", required: true, desc: "" },
    { name: "Valor (USD)", type: "currency", required: true, desc: "" },
    { name: "Etapa", type: "select", required: true, desc: "Discovery → Won/Lost" },
    { name: "Fecha cierre estimada", type: "date", required: true, desc: "Usada en GANTT" },
    { name: "AI Probability", type: "number", required: false, desc: "Calculado por ML" },
    { name: "Es recurrente?", type: "checkbox", required: false, desc: "SaaS / one-shot" },
    { name: "MRR", type: "currency", required: false, desc: "Si es recurrente" },
  ]},
  { id: "co4", name: "Contracts", icon: "K", color: "#f59e0b", count: 218, attrs: [
    { name: "Trato", type: "record", required: true, desc: "Vinculado a Deals" },
    { name: "Estado", type: "select", required: true, desc: "Draft · Sent · Signed" },
    { name: "PDF", type: "file", required: false, desc: "Auto-generado al ganar" },
    { name: "Fecha firma", type: "date", required: false, desc: "" },
    { name: "Valor", type: "currency", required: true, desc: "" },
  ]},
];
