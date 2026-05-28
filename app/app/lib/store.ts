import { useMemo } from "react";
import { useRouteLoaderData } from "react-router";
import { create } from "zustand";
import type {
  ActiveWorkspaceId,
  Deal,
  OwnersByKey,
  StageId,
  Workspace,
  WorkspaceId,
} from "./types";
import { STAGES_DEFAULT } from "./stages";

export type Currency = "USD" | "PEN";
export type Density = "compact" | "cozy";
export type Theme = "light" | "dark";

export type Filters = {
  stages: StageId[];
  owners: string[];
  minValue: number | null;
  maxValue: number | null;
  minAI: number | null;
  maxAI: number | null;
};

export const EMPTY_FILTERS: Filters = {
  stages: [],
  owners: [],
  minValue: null,
  maxValue: null,
  minAI: null,
  maxAI: null,
};

type UIState = {
  cmdkOpen: boolean;
  aiOpen: boolean;
  aiHint: string | null;
  newLeadOpen: boolean;
  filtersOpen: boolean;
  selectedDealId: string | null;
};

type State = {
  workspace: ActiveWorkspaceId;
  currency: Currency;
  density: Density;
  theme: Theme;
  ui: UIState;
  filters: Filters;

  setWorkspace: (w: ActiveWorkspaceId) => void;
  setCurrency: (c: Currency) => void;
  setDensity: (d: Density) => void;
  setTheme: (t: Theme) => void;

  openCmdK: () => void;
  closeCmdK: () => void;
  toggleCmdK: () => void;
  openAI: (hint?: string | null) => void;
  closeAI: () => void;
  toggleAI: () => void;
  openNewLead: () => void;
  closeNewLead: () => void;
  setSelectedDeal: (id: string | null) => void;
  setFiltersOpen: (open: boolean) => void;

  setFilters: (patch: Partial<Filters>) => void;
  resetFilters: () => void;
};

/**
 * Store SOLO para state efímero de UI: workspace activo, currency, density,
 * theme, filtros, flags de drawers/modales. Los deals viven en Postgres y
 * llegan vía loader (_app.tsx) — useActiveWorkspace los lee de ahí.
 */
export const useAppStore = create<State>((set) => ({
  workspace: "novit",
  currency: "USD",
  density: "compact",
  theme: "light",
  ui: {
    cmdkOpen: false,
    aiOpen: false,
    aiHint: null,
    newLeadOpen: false,
    filtersOpen: false,
    selectedDealId: null,
  },
  filters: EMPTY_FILTERS,
  setWorkspace: (workspace) =>
    set((s) => ({
      workspace,
      filters: EMPTY_FILTERS,
      ui: { ...s.ui, selectedDealId: null },
    })),
  setCurrency: (currency) => set({ currency }),
  setDensity: (density) => set({ density }),
  setTheme: (theme) => set({ theme }),
  openCmdK: () => set((s) => ({ ui: { ...s.ui, cmdkOpen: true } })),
  closeCmdK: () => set((s) => ({ ui: { ...s.ui, cmdkOpen: false } })),
  toggleCmdK: () => set((s) => ({ ui: { ...s.ui, cmdkOpen: !s.ui.cmdkOpen } })),
  openAI: (hint = null) =>
    set((s) => ({ ui: { ...s.ui, aiOpen: true, aiHint: hint ?? null } })),
  closeAI: () => set((s) => ({ ui: { ...s.ui, aiOpen: false, aiHint: null } })),
  toggleAI: () =>
    set((s) => ({ ui: { ...s.ui, aiOpen: !s.ui.aiOpen, aiHint: null } })),
  openNewLead: () => set((s) => ({ ui: { ...s.ui, newLeadOpen: true } })),
  closeNewLead: () => set((s) => ({ ui: { ...s.ui, newLeadOpen: false } })),
  setSelectedDeal: (id) =>
    set((s) => ({ ui: { ...s.ui, selectedDealId: id } })),
  setFiltersOpen: (open) => set((s) => ({ ui: { ...s.ui, filtersOpen: open } })),
  setFilters: (patch) => set((s) => ({ filters: { ...s.filters, ...patch } })),
  resetFilters: () => set({ filters: EMPTY_FILTERS }),
}));

// ---------- selectors ----------

export function applyFilters(deals: Deal[], f: Filters): Deal[] {
  return deals.filter((d) => {
    if (f.stages.length && !f.stages.includes(d.stage)) return false;
    if (f.owners.length && !f.owners.includes(d.owner)) return false;
    if (f.minValue != null && d.value < f.minValue) return false;
    if (f.maxValue != null && d.value > f.maxValue) return false;
    if (f.minAI != null && d.ai < f.minAI) return false;
    if (f.maxAI != null && d.ai > f.maxAI) return false;
    return true;
  });
}

export function countActiveFilters(f: Filters): number {
  let n = 0;
  if (f.stages.length) n++;
  if (f.owners.length) n++;
  if (f.minValue != null || f.maxValue != null) n++;
  if (f.minAI != null || f.maxAI != null) n++;
  return n;
}

// ---------- loader data shape (matches _app.tsx loader return) ----------

export type WorkspaceLoaderData = {
  novit: { deals: Deal[]; owners: OwnersByKey; companies: import("./types").CompanyLite[]; stages: import("./types").Stage[] };
  sharky: { deals: Deal[]; owners: OwnersByKey; companies: import("./types").CompanyLite[]; stages: import("./types").Stage[] };
};

const EMPTY_DATA: WorkspaceLoaderData = {
  novit: { deals: [], owners: {}, companies: [], stages: [] },
  sharky: { deals: [], owners: {}, companies: [], stages: [] },
};

export type CurrentUserData = {
  id: string;
  email: string;
  name: string;
  role: string;
  initials: string;
  color: string;
  permissions: string | null;
  workspaceSlug: string;
};

/**
 * Lee la data del loader de _app.tsx. Si el loader aún no corrió (o el
 * componente está fuera de ese route tree), devuelve estructuras vacías.
 */
export function useWorkspaceLoaderData(): WorkspaceLoaderData {
  const data = useRouteLoaderData("routes/_app") as
    | (WorkspaceLoaderData & { currentUser?: CurrentUserData })
    | undefined;
  return data ?? EMPTY_DATA;
}

/** Lee el usuario logueado actual desde el _app loader. */
export function useCurrentUser(): CurrentUserData | null {
  const data = useRouteLoaderData("routes/_app") as
    | (WorkspaceLoaderData & { currentUser?: CurrentUserData })
    | undefined;
  return data?.currentUser ?? null;
}

/**
 * Workspace activo, con filtros aplicados.
 * Reemplazó al hook que leía dealsByWs de Zustand — ahora la fuente es el loader.
 */
export function useActiveWorkspace(): Workspace {
  const workspace = useAppStore((s) => s.workspace);
  const filters = useAppStore((s) => s.filters);
  const data = useWorkspaceLoaderData();

  return useMemo(() => {
    const todayDate = new Date();
    // Stages dinámicos del workspace; cuando es "all" usamos los de novit
    // como base (si los slugs default coinciden, los stages de ambos son
    // intercambiables; las diferencias se resuelven via key).
    const novitStages = data.novit.stages?.length ? data.novit.stages : STAGES_DEFAULT;
    const sharkyStages = data.sharky.stages?.length ? data.sharky.stages : STAGES_DEFAULT;

    let base: Workspace;
    if (workspace === "all") {
      base = {
        id: "all",
        isAll: true,
        deals: [
          ...data.novit.deals.map((d) => ({
            ...d,
            _ws: "novit" as WorkspaceId,
          })),
          ...data.sharky.deals.map((d) => ({
            ...d,
            _ws: "sharky" as WorkspaceId,
          })),
        ],
        owners: { ...data.novit.owners, ...data.sharky.owners },
        companies: [...data.novit.companies, ...data.sharky.companies],
        stages: novitStages,
        today: todayDate,
      };
    } else {
      base = {
        id: workspace,
        deals: data[workspace].deals,
        owners: data[workspace].owners,
        companies: data[workspace].companies,
        stages: workspace === "sharky" ? sharkyStages : novitStages,
        today: todayDate,
      };
    }
    return { ...base, deals: applyFilters(base.deals, filters) };
  }, [workspace, data, filters]);
}

// ---------- static metadata (no DB, branding constants) ----------

export const WORKSPACE_META: Record<
  ActiveWorkspaceId,
  { name: string; url: string; tagline: string; mark: string }
> = {
  novit: {
    name: "NOVIT",
    url: "novit.crm",
    tagline: "Tech & enterprise",
    mark: "N",
  },
  sharky: {
    name: "SHARKY",
    url: "sharky.crm",
    tagline: "Growth studio",
    mark: "S",
  },
  all: {
    name: "Todas las empresas",
    url: "vista.consolidada",
    tagline: "Comparación NOVIT + SHARKY",
    mark: "★",
  },
};

export const CURRENT_USER: Record<
  ActiveWorkspaceId,
  { initials: string; name: string; role: string }
> = {
  novit: { initials: "MP", name: "María Paz I.", role: "AE · NOVIT" },
  sharky: { initials: "AV", name: "Ariana Vélez", role: "Growth · SHARKY" },
  all: { initials: "MP", name: "María Paz I.", role: "AE · NOVIT" },
};
