// Schema view — Prisma schema with syntax highlighting + architecture notes
function SchemaView() {
  const tokens = (code) => {
    // Simple tokenizer for prisma
    const lines = code.split("\n");
    return lines.map((line, i) => {
      // comments
      if (/^\s*\/\//.test(line)) {
        return <div key={i}><span className="cm">{line}</span></div>;
      }
      // colorize keywords
      let parts = [];
      let rest = line;
      const kwRe = /\b(model|enum|datasource|generator|provider|url|env|String|Int|Float|DateTime|Boolean|Json|Decimal|Bytes|BigInt)\b/g;
      const atRe = /(@\w+(?:\.\w+)?(?:\([^)]*\))?)/g;
      const strRe = /("(?:[^"\\]|\\.)*")/g;
      // Just colorize per regex iteration
      const colored = line
        .replace(strRe, '\0S\0$1\0/S\0')
        .replace(/\b(model|enum|datasource|generator)\b/g, '\0K\0$1\0/K\0')
        .replace(/\b(String|Int|Float|DateTime|Boolean|Json|Decimal|Bytes|BigInt)\b/g, '\0T\0$1\0/T\0')
        .replace(atRe, '\0A\0$1\0/A\0');
      // Split by markers
      const segs = colored.split(/\0([SKAT]|\/[SKAT])\0/);
      const out = [];
      let mode = null;
      for (let s = 0; s < segs.length; s++) {
        const piece = segs[s];
        if (piece === "S") { mode = "st"; continue; }
        if (piece === "/S") { mode = null; continue; }
        if (piece === "K") { mode = "kw"; continue; }
        if (piece === "/K") { mode = null; continue; }
        if (piece === "A") { mode = "at"; continue; }
        if (piece === "/A") { mode = null; continue; }
        if (piece === "T") { mode = "ty"; continue; }
        if (piece === "/T") { mode = null; continue; }
        if (!piece) continue;
        if (mode) out.push(<span key={s} className={mode}>{piece}</span>);
        else out.push(piece);
      }
      return <div key={i}>{out}{line === "" && <span>&nbsp;</span>}</div>;
    });
  };

  const code = `// CRM Agile — Multi-tenant Prisma schema
// Workspaces (NOVIT / SHARKY) están aislados a nivel de fila por workspaceId.
// Para aislamiento físico de DB, usar Prisma multi-schema o un connection-pool por tenant.

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ─── Tenancy ────────────────────────────────────────────────
model Workspace {
  id          String   @id @default(cuid())
  slug        String   @unique  // "novit" | "sharky"
  name        String
  brandColor  String   @default("#2563eb")
  createdAt   DateTime @default(now())

  users       User[]
  leads       Lead[]
  contacts    Contact[]
  companies   Company[]
  deals       Deal[]
  activities  Activity[]
  templates   Template[]
  sequences   Sequence[]
  attributes  CustomAttribute[]
}

model User {
  id          String   @id @default(cuid())
  workspaceId String
  workspace   Workspace @relation(fields: [workspaceId], references: [id])
  email       String
  name        String
  role        UserRole @default(AE)
  deals       Deal[]
  @@unique([workspaceId, email])
}

enum UserRole {
  ADMIN
  AE
  BDR
  CSM
}

// ─── Core CRM objects ───────────────────────────────────────
model Company {
  id          String   @id @default(cuid())
  workspaceId String
  workspace   Workspace @relation(fields: [workspaceId], references: [id])
  name        String
  industry    String?
  size        String?
  tier        String?
  deals       Deal[]
  contacts    Contact[]
  @@index([workspaceId, name])
}

model Contact {
  id          String   @id @default(cuid())
  workspaceId String
  workspace   Workspace @relation(fields: [workspaceId], references: [id])
  companyId   String?
  company     Company? @relation(fields: [companyId], references: [id])
  fullName    String
  email       String?
  whatsapp    String?  // E.164
  role        String?
  @@index([workspaceId, email])
}

model Lead {
  id          String   @id @default(cuid())
  workspaceId String
  workspace   Workspace @relation(fields: [workspaceId], references: [id])
  contactId   String?
  source      LeadSource
  utmCampaign String?
  aiScore     Float?
  firstTouchAt DateTime?
  createdAt   DateTime @default(now())
  @@index([workspaceId, createdAt])
}

enum LeadSource {
  FB_ADS
  LINKEDIN
  REFERRAL
  WEB
  WHATSAPP
  COLD_OUTREACH
}

model Deal {
  id              String   @id @default(cuid())
  workspaceId     String
  workspace       Workspace @relation(fields: [workspaceId], references: [id])
  companyId       String
  company         Company  @relation(fields: [companyId], references: [id])
  ownerId         String?
  owner           User?    @relation(fields: [ownerId], references: [id])
  name            String
  value           Decimal
  stage           DealStage @default(DISCOVERY)
  probability     Float    // AI predicted, 0..1
  isRecurring     Boolean  @default(false)
  arr             Decimal? // si isRecurring = true
  mrr             Decimal?
  estimatedCloseAt DateTime
  createdAt       DateTime @default(now())
  closedAt        DateTime?
  activities      Activity[]
  contract        Contract?
  @@index([workspaceId, stage])
  @@index([workspaceId, estimatedCloseAt]) // GANTT query
}

enum DealStage {
  DISCOVERY
  QUALIFIED
  PROPOSAL
  NEGOTIATION
  WON
  LOST
}

// ─── Timeline / 360 ─────────────────────────────────────────
model Activity {
  id          String   @id @default(cuid())
  workspaceId String
  workspace   Workspace @relation(fields: [workspaceId], references: [id])
  dealId      String?
  deal        Deal?    @relation(fields: [dealId], references: [id])
  contactId   String?
  channel     Channel
  direction   Direction
  subject     String?
  body        String?
  aiSummary   String?
  aiSentiment Float?
  recordingUrl String?
  occurredAt  DateTime @default(now())
  @@index([workspaceId, occurredAt])
  @@index([dealId, occurredAt])
}

enum Channel {
  WHATSAPP
  EMAIL
  CALL
  NOTE
  AI_NOTE
  TASK
}

enum Direction {
  IN
  OUT
  INTERNAL
}

// ─── Automation ─────────────────────────────────────────────
model Template {
  id          String   @id @default(cuid())
  workspaceId String
  workspace   Workspace @relation(fields: [workspaceId], references: [id])
  name        String
  channel     Channel
  body        String   // contiene {{variables}}
  category    String?
  uses        Int      @default(0)
  replyRate   Float    @default(0)
}

model Sequence {
  id          String   @id @default(cuid())
  workspaceId String
  workspace   Workspace @relation(fields: [workspaceId], references: [id])
  name        String
  active      Boolean  @default(true)
  triggerType String
  steps       Json     // array de nodos (Trigger / Delay / WA / Email / Branch / Exit)
  exitTriggers Json
}

model Contract {
  id          String   @id @default(cuid())
  dealId      String   @unique
  deal        Deal     @relation(fields: [dealId], references: [id])
  status      String
  pdfUrl      String?  // auto-generado al ganar el trato
  signedAt    DateTime?
}

// ─── Custom Objects / Attributes (estilo Attio) ─────────────
model CustomAttribute {
  id          String   @id @default(cuid())
  workspaceId String
  workspace   Workspace @relation(fields: [workspaceId], references: [id])
  objectType  String   // "Deal" | "Company" | "Contact" | "Lead"
  recordId    String
  key         String
  type        AttrType
  value       Json
  @@index([workspaceId, objectType, recordId])
  @@index([workspaceId, key])
}

enum AttrType {
  TEXT
  NUMBER
  CURRENCY
  DATE
  DATETIME
  SELECT
  BOOLEAN
  RECORD
  FILE
  EMAIL
  PHONE
}`;

  const archNotes = [
    { t: "Aislamiento multi-tenant", b: "Row-level con workspaceId + index forzado en cada query. Para enterprise: schemas Prisma separados (datasource override) o pools de conexión por tenant." },
    { t: "WhatsApp Business API", b: "Webhook entrante → crea Activity(WHATSAPP, IN) + actualiza Deal.lastActivity. Plantillas aprobadas por Meta sincronizadas en Template." },
    { t: "Generación de PDF", b: "Trigger on Deal.stage = WON → encola job en Inngest/QStash → renderiza Contract.pdfUrl + Factura.pdfUrl con React-PDF." },
    { t: "AI Score", b: "Modelo gradient-boost entrenado offline (Vercel cron). Features: tiempo en etapa, # stakeholders, engagement WA, tamaño de cuenta, sentiment IA. Actualiza Deal.probability cada 6h." },
    { t: "GANTT performance", b: "Index compuesto (workspaceId, estimatedCloseAt). Edge function que devuelve viewport (rango de fechas) — paginación virtual del lado del cliente." },
    { t: "Sales Velocity (KPI)", b: "AVG(closedAt - createdAt) WHERE stage = WON. Particionado por owner / industria / source. Refrescado cada 15m." }
  ];

  return (
    <div className="schema-view" data-screen-label="Schema Prisma">
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <Icon name="code" size={16} />
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>schema.prisma</h2>
          <span className="chip mono">prisma 5.x · postgresql</span>
          <button className="btn" style={{ marginLeft: "auto" }}>
            <Icon name="external" size={13} /> Descargar
          </button>
        </div>
        <div className="schema-code">{tokens(code)}</div>
      </div>

      <div style={{ display: "grid", gap: 12 }}>
        <div className="card">
          <div className="card__h">
            <Icon name="sparkles" size={14} style={{ color: "var(--accent)" }} />
            Arquitectura · decisiones clave
          </div>
          <div style={{ padding: 4 }}>
            {archNotes.map((n, i) => (
              <div key={i} style={{ padding: "10px 12px", borderBottom: i < archNotes.length - 1 ? "1px solid var(--border-2)" : "none" }}>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 3 }}>{n.t}</div>
                <div style={{ fontSize: 12, color: "var(--fg-2)", lineHeight: 1.5 }}>{n.b}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card__h">
            <Icon name="zap" size={14} />
            Stack desplegado en Vercel
          </div>
          <div style={{ padding: 12, display: "grid", gap: 6, fontSize: 12 }}>
            <StackRow t="Next.js 15"     d="App Router + Server Actions" />
            <StackRow t="Prisma 5.x"     d="Postgres (Neon serverless)" />
            <StackRow t="Inngest"        d="Workflows · Secuencias · Exit triggers" />
            <StackRow t="Resend + WhatsApp Business" d="Canales transaccionales" />
            <StackRow t="React PDF"      d="Contratos + facturas" />
            <StackRow t="OpenAI o3-mini" d="Resumen IA · clasificación de intent" />
            <StackRow t="Vercel KV"      d="Rate-limit + sesiones" />
            <StackRow t="tRPC + Zod"     d="Capa de API tipada" />
          </div>
        </div>
      </div>
    </div>
  );
}

function StackRow({ t, d }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
      <span style={{ minWidth: 130, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg)" }}>{t}</span>
      <span style={{ color: "var(--fg-3)" }}>{d}</span>
    </div>
  );
}

window.SchemaView = SchemaView;
