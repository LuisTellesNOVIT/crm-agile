// Conversores Prisma → client. Se usan en loaders (server-side) para mapear
// el shape rico de Prisma al shape compacto que la UI espera.
//
// IMPORTANTE: este archivo solo se importa desde loaders (.server o routes).
// No usa el cliente Prisma directamente — opera sobre objetos planos.

import type { Deal, Owner, OwnersByKey, StageId } from "./types";

type PrismaDeal = {
  publicId: string;
  name: string;
  value: number;
  mrr: number | null;
  isRecurring: boolean;
  stage: string;
  probability: number;
  ai: number;
  source?: string | null;
  createdAt: Date | string;
  estimatedCloseAt: Date | string;
  lastActivityAt: Date | string;
  company: { id: string; name: string };
  owner: { id: string; initials: string };
};

type PrismaUser = {
  id?: string;
  initials: string;
  name: string;
  role: string;
  color: string;
};

const DAY_MS = 1000 * 60 * 60 * 24;

export function toClientDeal(d: PrismaDeal): Deal {
  const last = new Date(d.lastActivityAt).getTime();
  const ageDays = Math.max(0, Math.floor((Date.now() - last) / DAY_MS));
  return {
    id: d.publicId,
    name: d.name,
    company: d.company.name,
    companyId: d.company.id,
    value: d.value,
    stage: d.stage as StageId,
    ai: d.ai,
    owner: d.owner.initials,
    ownerId: d.owner.id,
    probability: d.probability,
    createdAt: new Date(d.createdAt).toISOString(),
    estimatedCloseAt: new Date(d.estimatedCloseAt).toISOString(),
    lastActivity: Math.min(ageDays, 90),
    contacts: 0,
    isRecurring: d.isRecurring,
    arr: d.mrr ? d.mrr * 12 : 0,
    source: d.source ?? null,
  };
}

export function toClientOwner(u: PrismaUser): Owner {
  return { id: u.id, name: u.name, role: u.role, color: u.color };
}

export function ownersByInitials(users: PrismaUser[]): OwnersByKey {
  const out: OwnersByKey = {};
  for (const u of users) out[u.initials] = toClientOwner(u);
  return out;
}
