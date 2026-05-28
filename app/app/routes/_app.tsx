import { useEffect } from "react";
import { Outlet, useLoaderData } from "react-router";
import { Sidebar } from "../components/shell/Sidebar";
import { Topbar } from "../components/shell/Topbar";
import { CommandMenu } from "../components/shell/CommandMenu";
import { AIDrawer } from "../components/shell/AIDrawer";
import { DealDetail } from "../components/deal/DealDetail";
import { NewLeadDrawer } from "../components/lead/NewLeadDrawer";
import { FiltersPopover } from "../components/filters/FiltersPopover";
import { FiltersBar } from "../components/filters/FiltersBar";
import {
  countActiveFilters,
  useActiveWorkspace,
  useAppStore,
  type WorkspaceLoaderData,
} from "../lib/store";
import { isDbConfigured, prisma } from "../lib/db.server";
import { ownersByInitials, toClientDeal } from "../lib/serialize";
import { requireUser } from "../lib/session.server";

const EMPTY_DEALS: WorkspaceLoaderData = {
  novit: { deals: [], owners: {}, stages: [] },
  sharky: { deals: [], owners: {}, stages: [] },
};

export type AppLoaderData = WorkspaceLoaderData & {
  currentUser: {
    id: string;
    email: string;
    name: string;
    role: string;
    initials: string;
    color: string;
    permissions: string | null;
    workspaceSlug: string;
  };
};

/**
 * Loader del layout — guard de auth + data de ambos workspaces.
 * Si no hay sesión, redirige a /login.
 */
export async function loader({ request }: { request: Request }): Promise<AppLoaderData> {
  const user = await requireUser(request);

  if (!isDbConfigured) {
    console.warn("[_app loader] DATABASE_URL missing — devolviendo data vacía.");
    return {
      ...EMPTY_DEALS,
      currentUser: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        initials: user.initials,
        color: user.color,
        permissions: user.permissions,
        workspaceSlug: user.workspace.slug,
      },
    };
  }
  try {
    const [novitWs, sharkyWs] = await Promise.all([
      prisma.workspace.findUnique({
        where: { slug: "novit" },
        include: {
          users: true,
          companies: { orderBy: { name: "asc" } },
          deals: { include: { company: true, owner: true } },
          pipelineStages: { orderBy: { position: "asc" } },
        },
      }),
      prisma.workspace.findUnique({
        where: { slug: "sharky" },
        include: {
          users: true,
          companies: { orderBy: { name: "asc" } },
          deals: { include: { company: true, owner: true } },
          pipelineStages: { orderBy: { position: "asc" } },
        },
      }),
    ]);

    const mapStages = (rows: Array<{ key: string; label: string; color: string; probability: number; position: number; isWon: boolean; isLost: boolean }>) =>
      rows.map((s) => ({
        id: s.key,
        label: s.label,
        color: s.color,
        prob: s.probability,
        position: s.position,
        isWon: s.isWon,
        isLost: s.isLost,
      }));

    const mapCompanies = (rows: Array<{ id: string; name: string; industry: string | null }>) =>
      rows.map((c) => ({ id: c.id, name: c.name, industry: c.industry ?? null }));

    return {
      novit: {
        deals: (novitWs?.deals ?? []).map(toClientDeal),
        owners: ownersByInitials(novitWs?.users ?? []),
        companies: mapCompanies(novitWs?.companies ?? []),
        stages: mapStages(novitWs?.pipelineStages ?? []),
      },
      sharky: {
        deals: (sharkyWs?.deals ?? []).map(toClientDeal),
        owners: ownersByInitials(sharkyWs?.users ?? []),
        companies: mapCompanies(sharkyWs?.companies ?? []),
        stages: mapStages(sharkyWs?.pipelineStages ?? []),
      },
      currentUser: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        initials: user.initials,
        color: user.color,
        permissions: user.permissions,
        workspaceSlug: user.workspace.slug,
      },
    };
  } catch (err) {
    console.error("[_app loader] Falló la query a Postgres:", err);
    return {
      ...EMPTY_DEALS,
      currentUser: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        initials: user.initials,
        color: user.color,
        permissions: user.permissions,
        workspaceSlug: user.workspace.slug,
      },
    };
  }
}

export default function AppLayout() {
  const data = useLoaderData<typeof loader>();
  const workspace = useAppStore((s) => s.workspace);
  const density = useAppStore((s) => s.density);
  const theme = useAppStore((s) => s.theme);
  const filters = useAppStore((s) => s.filters);

  const cmdkOpen = useAppStore((s) => s.ui.cmdkOpen);
  const aiOpen = useAppStore((s) => s.ui.aiOpen);
  const aiHint = useAppStore((s) => s.ui.aiHint);
  const newLeadOpen = useAppStore((s) => s.ui.newLeadOpen);
  const closeNewLead = useAppStore((s) => s.closeNewLead);
  const filtersOpen = useAppStore((s) => s.ui.filtersOpen);
  const setFiltersOpen = useAppStore((s) => s.setFiltersOpen);
  const selectedDealId = useAppStore((s) => s.ui.selectedDealId);
  const setSelectedDeal = useAppStore((s) => s.setSelectedDeal);
  const closeCmdK = useAppStore((s) => s.closeCmdK);
  const closeAI = useAppStore((s) => s.closeAI);
  const toggleCmdK = useAppStore((s) => s.toggleCmdK);
  const toggleAI = useAppStore((s) => s.toggleAI);

  const ws = useActiveWorkspace();
  // Total deals = sin filtros aplicados, contra el dataset crudo del loader.
  const totalDeals =
    workspace === "all"
      ? data.novit.deals.length + data.sharky.deals.length
      : data[workspace].deals.length;
  const hasFilters = countActiveFilters(filters) > 0;

  useEffect(() => {
    const body = document.body;
    body.classList.remove("ws-novit", "ws-sharky", "ws-all");
    body.classList.add(`ws-${workspace}`);
    body.classList.remove("density-compact", "density-cozy");
    body.classList.add(`density-${density}`);
    body.classList.toggle("theme-dark", theme === "dark");
  }, [workspace, density, theme]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isMeta = e.metaKey || e.ctrlKey;
      if (isMeta && e.key.toLowerCase() === "k") {
        e.preventDefault();
        toggleCmdK();
      } else if (isMeta && e.key.toLowerCase() === "j") {
        e.preventDefault();
        toggleAI();
      } else if (e.key === "Escape") {
        if (cmdkOpen) closeCmdK();
        if (aiOpen) closeAI();
        if (filtersOpen) setFiltersOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    toggleCmdK,
    toggleAI,
    closeCmdK,
    closeAI,
    cmdkOpen,
    aiOpen,
    filtersOpen,
    setFiltersOpen,
  ]);

  return (
    <div className="app">
      <Sidebar />
      <main className="main">
        <div className="topbar-wrap">
          <Topbar />
          {filtersOpen && (
            <div className="filters-popover-wrap">
              <FiltersPopover onClose={() => setFiltersOpen(false)} />
            </div>
          )}
        </div>
        {hasFilters && (
          <FiltersBar totalDeals={totalDeals} filteredCount={ws.deals.length} />
        )}
        <section className="view">
          {selectedDealId ? (
            <DealDetail
              dealId={selectedDealId}
              onClose={() => setSelectedDeal(null)}
            />
          ) : (
            <Outlet />
          )}
        </section>
      </main>
      {cmdkOpen && <CommandMenu onClose={closeCmdK} />}
      {aiOpen && <AIDrawer onClose={closeAI} hint={aiHint} />}
      {newLeadOpen && <NewLeadDrawer onClose={closeNewLead} />}
    </div>
  );
}
