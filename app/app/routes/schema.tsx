const PRISMA_SCHEMA = `// Prisma schema — fuente de verdad para la API real.
// Cuando reemplaces los mocks por una API, esto es lo que genera los tipos.

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum Stage {
  discovery
  qualified
  proposal
  negotiation
  won
  lost
}

enum Channel {
  wa
  email
  linkedin
  call
  note
  mention
}

model Workspace {
  id        String   @id @default(cuid())
  slug      String   @unique
  name      String
  tagline   String?
  brandColor String  @default("#2563eb")
  currency  String   @default("USD")
  createdAt DateTime @default(now())

  users     User[]
  deals     Deal[]
  companies Company[]
}

model User {
  id          String   @id @default(cuid())
  email       String   @unique
  name        String
  role        String
  initials    String
  workspaceId String
  workspace   Workspace @relation(fields: [workspaceId], references: [id])
  deals       Deal[]
  createdAt   DateTime @default(now())
}

model Company {
  id          String  @id @default(cuid())
  name        String
  industry    String?
  website     String?
  employees   String?
  tier        String?
  workspaceId String
  workspace   Workspace @relation(fields: [workspaceId], references: [id])
  deals       Deal[]
  contacts    Contact[]
}

model Contact {
  id        String @id @default(cuid())
  name      String
  role      String?
  email     String
  phone     String?
  companyId String
  company   Company @relation(fields: [companyId], references: [id])
}

model Deal {
  id                 String   @id @default(cuid())
  publicId           String   @unique  // "NOVIT-0012"
  name               String
  value              Float
  stage              Stage
  probability        Float
  ai                 Int
  isRecurring        Boolean  @default(false)
  arr                Float?
  createdAt          DateTime @default(now())
  estimatedCloseAt   DateTime
  closedAt           DateTime?

  workspaceId        String
  workspace          Workspace @relation(fields: [workspaceId], references: [id])

  companyId          String
  company            Company @relation(fields: [companyId], references: [id])

  ownerId            String
  owner              User @relation(fields: [ownerId], references: [id])

  activities         Activity[]
  files              File[]
  conversations      Conversation[]
}

model Activity {
  id        String   @id @default(cuid())
  dealId    String
  deal      Deal @relation(fields: [dealId], references: [id])
  type      String
  text      String
  who       String
  at        DateTime @default(now())
}

model File {
  id        String @id @default(cuid())
  dealId    String
  deal      Deal @relation(fields: [dealId], references: [id])
  name      String
  mime      String
  size      Int
  url       String
  createdAt DateTime @default(now())
}

model Conversation {
  id        String   @id @default(cuid())
  dealId    String
  deal      Deal @relation(fields: [dealId], references: [id])
  channel   Channel
  messages  Message[]
  createdAt DateTime @default(now())
}

model Message {
  id              String   @id @default(cuid())
  conversationId  String
  conversation    Conversation @relation(fields: [conversationId], references: [id])
  direction       String  // "in" | "out"
  text            String
  at              DateTime @default(now())
}

model Template {
  id        String  @id @default(cuid())
  workspaceId String
  channel   Channel
  name      String
  description String
  body      String
  uses      Int @default(0)
  replyRate Int @default(0)
}

model Sequence {
  id        String @id @default(cuid())
  workspaceId String
  name      String
  active    Boolean @default(true)
  nodes     Json
}
`;

const MODELS = [
  { name: "Workspace", color: "#2563eb" },
  { name: "User", color: "#7c3aed" },
  { name: "Company", color: "#0891b2" },
  { name: "Contact", color: "#0ea5e9" },
  { name: "Deal", color: "#16a34a" },
  { name: "Activity", color: "#f59e0b" },
  { name: "File", color: "#ea580c" },
  { name: "Conversation", color: "#dc2626" },
  { name: "Message", color: "#db2777" },
  { name: "Template", color: "#8b5cf6" },
  { name: "Sequence", color: "#525252" },
];

export default function SchemaRoute() {
  return (
    <div style={{ padding: "20px 24px", display: "grid", gap: 16, maxWidth: 1100, height: "100%", overflow: "auto" }}>
      <header>
        <h1 style={{ fontSize: "var(--fs-xl)", fontWeight: 600, letterSpacing: "-0.01em" }}>
          Schema (Prisma)
        </h1>
        <p style={{ color: "var(--fg-3)", fontSize: "var(--fs-sm)" }}>
          Fuente de verdad para la API real. Reemplaza los mocks (lib/mock) cuando esté disponible.
        </p>
      </header>
      <section>
        <h2 style={{ fontSize: "var(--fs-md)", fontWeight: 600, marginBottom: 8 }}>Modelos ({MODELS.length})</h2>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {MODELS.map((m) => (
            <div
              key={m.name}
              style={{
                padding: "6px 10px",
                borderRadius: "var(--radius-sm)",
                border: `1px solid ${m.color}33`,
                background: `${m.color}10`,
                color: m.color,
                fontFamily: "var(--font-mono)",
                fontSize: "var(--fs-xs)",
                fontWeight: 600,
              }}
            >
              {m.name}
            </div>
          ))}
        </div>
      </section>
      <pre
        style={{
          background: "#0a0a0a",
          color: "#fafafa",
          padding: 16,
          borderRadius: "var(--radius)",
          fontFamily: "var(--font-mono)",
          fontSize: 12,
          lineHeight: 1.5,
          overflow: "auto",
          margin: 0,
        }}
      >
        {PRISMA_SCHEMA}
      </pre>
    </div>
  );
}
