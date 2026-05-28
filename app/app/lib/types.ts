export type WorkspaceId = "novit" | "sharky";
export type ActiveWorkspaceId = WorkspaceId | "all";

/**
 * StageId — clave estable de una etapa del pipeline.
 *
 * Antes era un enum cerrado. Ahora que las etapas son CRUD-able por workspace
 * (tabla PipelineStage), aceptamos cualquier string. El truco `string & {}`
 * mantiene el autocomplete para las 7 claves default sin restringir el tipo.
 */
export type DefaultStageId =
  | "discovery"
  | "qualified"
  | "proposal"
  | "negotiation"
  | "signing"
  | "won"
  | "lost";

export type StageId = DefaultStageId | (string & {});

export type ChannelKind = "wa" | "email" | "mention" | "call" | "note" | "linkedin";

export type Stage = {
  id: StageId;
  label: string;
  color: string;
  prob: number;
};

export type Owner = {
  id?: string; // User.id (Prisma) — necesario para editar owner vía API
  name: string;
  role: string;
  color: string;
};
export type OwnersByKey = Record<string, Owner>;

export type CompanyLite = {
  id: string;
  name: string;
  industry?: string | null;
};

export type Deal = {
  id: string;
  name: string;
  company: string; // nombre display
  companyId?: string; // Company.id (Prisma) — para editar vía API
  value: number;
  stage: StageId;
  ai: number;
  owner: string; // initials (display)
  ownerId?: string; // User.id (Prisma)
  probability: number;
  createdAt: string;
  estimatedCloseAt: string;
  lastActivity: number;
  contacts: number;
  isRecurring: boolean;
  arr: number;
  source?: string | null;
  _ws?: WorkspaceId;
};

export type Workspace = {
  id: ActiveWorkspaceId;
  deals: Deal[];
  owners: OwnersByKey;
  companies: CompanyLite[]; // lista de empresas del workspace (para pickers)
  stages: Stage[];
  today: Date;
  isAll?: boolean;
};

// ---------- Rich ----------

export type InboxItem = {
  id: string;
  ch: ChannelKind;
  from: string;
  co?: string;
  subj: string;
  preview: string;
  t: string;
  unread: boolean;
  type: "message" | "mention" | "task";
};

export type ConversationMsg = {
  dir: "in" | "out";
  text: string;
  at: string;
  ch: ChannelKind;
};

export type CustomerTimelineEvent = {
  type: string;
  text: string;
  who: string;
  at: string;
};

export type FeaturedCustomer = {
  id: string;
  name: string;
  industry: string;
  logo: string;
  website: string;
  arr: number;
  employees: string;
  tier: string;
  mrr: number;
  churnRisk: string;
  nps: number;
  aiScore: number;
  stage: StageId;
  owner: string;
  contacts: Array<{ name: string; role: string; email: string }>;
  timeline: Array<{ day: string; events: CustomerTimelineEvent[] }>;
};

export type Template = {
  id: string;
  channel: ChannelKind;
  name: string;
  desc: string;
  body: string;
  uses: number;
  replyRate: number;
};

export type SequenceNode = { kind: string; title: string; body: string };
export type Sequence = {
  id: string;
  name: string;
  active: boolean;
  stats: {
    enrolled: number;
    completed: number;
    replyRate: number;
    meetingBooked: number;
  };
  nodes: SequenceNode[];
};

export type CustomObjectAttr = {
  name: string;
  type: string;
  required: boolean;
  desc: string;
};
export type CustomObject = {
  id: string;
  name: string;
  icon: string;
  color: string;
  count: number;
  attrs: CustomObjectAttr[];
};
