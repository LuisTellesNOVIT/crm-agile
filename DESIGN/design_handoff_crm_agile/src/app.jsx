// App shell — Sidebar, Topbar, view routing, command menu host.
const { useState, useEffect, useMemo, useRef, useCallback } = React;

const VIEWS = [
  { id: "dashboard",  label: "Dashboard",      icon: "dashboard",  group: "main"  },
  { id: "inbox",      label: "Inbox",          icon: "inbox",      group: "main", badge: "9" },
  { id: "pipeline",   label: "Pipeline",       icon: "kanban",     group: "main"  },
  { id: "forecast",   label: "Forecast (GANTT)", icon: "gantt",    group: "main"  },
  { id: "customers",  label: "Cliente 360",    icon: "user",       group: "main"  },
  { id: "chat",       label: "Conversaciones", icon: "chat",       group: "main"  },
  { id: "templates",  label: "Templates",      icon: "template",   group: "auto"  },
  { id: "sequences",  label: "Secuencias",     icon: "zap",        group: "auto"  },
  { id: "objects",    label: "Custom objects", icon: "database",   group: "data"  },
  { id: "schema",     label: "Schema (Prisma)",icon: "code",       group: "data"  }
];

const WORKSPACES = [
  { id: "novit",  name: "NOVIT",  url: "novit.crm",   tagline: "Tech & enterprise · 24 tratos", mark: "N" },
  { id: "sharky", name: "SHARKY", url: "sharky.crm",  tagline: "Growth studio · 24 tratos",      mark: "S" },
  { id: "all",    name: "Todas las empresas", url: "vista.consolidada", tagline: "Comparación NOVIT + SHARKY", mark: "★", isAll: true }
];

function Sidebar({ workspace, setWorkspace, view, setView, openCmdK, inboxCount, openSettings }) {
  const [open, setOpen] = useState(false);
  const ws = WORKSPACES.find(w => w.id === workspace);
  return (
    <aside className="sidebar" data-screen-label="Sidebar">
      <div className="sidebar__brand">
        <div className="ws-switcher" onClick={() => setOpen(o => !o)}>
          <div className={`ws-mark ws-mark--${ws.id}`}>{ws.mark}</div>
          <div className="ws-name">
            <b>{ws.name}</b>
            <span>{ws.url}</span>
          </div>
          <Icon name="chevron-down" size={14} className="ws-chevron" />
        </div>
        {open && (
          <div className="ws-menu" onMouseLeave={() => setOpen(false)}>
            {WORKSPACES.map(w => (
              <div key={w.id} className="ws-menu__item" onClick={() => { setWorkspace(w.id); setOpen(false); }}>
                <div className={`ws-mark ws-mark--${w.id}`}>{w.mark}</div>
                <div className="ws-name">
                  <b>{w.name}</b>
                  <span>{w.tagline}</span>
                </div>
                {w.id === workspace && <Icon name="check" size={14} className="check" />}
              </div>
            ))}
            <div style={{ borderTop: "1px solid var(--border-2)", margin: "4px 0" }} />
            <div className="ws-menu__item" style={{ color: "var(--fg-3)" }}>
              <Icon name="plus" size={14} />
              <span>Nuevo workspace</span>
            </div>
          </div>
        )}
      </div>

      <div className="sidebar__search" onClick={openCmdK}>
        <Icon name="search" size={13} />
        <span>Buscar o ejecutar…</span>
        <span className="kbd">⌘</span><span className="kbd">K</span>
      </div>

      <nav className="sidebar__nav">
        <div className="nav-group">
          {VIEWS.filter(v => v.group === "main").map(v => (
            <NavItem key={v.id} v={v} active={view === v.id} onClick={() => setView(v.id)} badge={v.id === "inbox" ? inboxCount : null} />
          ))}
        </div>
        <div className="nav-group">
          <div className="nav-group__label">Automation</div>
          {VIEWS.filter(v => v.group === "auto").map(v => (
            <NavItem key={v.id} v={v} active={view === v.id} onClick={() => setView(v.id)} />
          ))}
        </div>
        <div className="nav-group">
          <div className="nav-group__label">Data model</div>
          {VIEWS.filter(v => v.group === "data").map(v => (
            <NavItem key={v.id} v={v} active={view === v.id} onClick={() => setView(v.id)} />
          ))}
        </div>
      </nav>

      <div className="sidebar__foot">
        <div className="avatar" style={ws.id === "sharky" ? { background: "linear-gradient(135deg,#fdba74,#ea580c)" } : null}>
          {ws.id === "novit" ? "MP" : "AV"}
        </div>
        <div className="meta">
          <b>{ws.id === "novit" ? "María Paz I." : "Ariana Vélez"}</b>
          <span>{ws.id === "novit" ? "AE · NOVIT" : "Growth · SHARKY"}</span>
        </div>
        <Icon name="settings" size={14} style={{ color: "var(--fg-3)", marginLeft: "auto", cursor: "pointer" }} onClick={openSettings} title="Configuración" />
      </div>
    </aside>
  );
}

function NavItem({ v, active, onClick, badge }) {
  return (
    <div className={`nav-item ${active ? "is-active" : ""}`} onClick={onClick}>
      <Icon name={v.icon} className="icon" />
      <span>{v.label}</span>
      {badge && <span className="nav-item__badge">{badge}</span>}
    </div>
  );
}

function Topbar({ view, workspace, openCmdK, openAI, openNewLead, extraActions, filtersOpen, setFiltersOpen, activeFilterCount, currency, setCurrency, openSettings }) {
  const meta = VIEWS.find(v => v.id === view) || { label: "Configuración" };
  const wsName = WORKSPACES.find(w => w.id === workspace).name;
  return (
    <header className="topbar">
      <div className="topbar__crumbs">
        <span>{wsName}</span>
        <Icon name="chevron-right" size={12} />
        <span style={{ color: "var(--fg)" }}>{meta.label}</span>
      </div>
      <div className="topbar__spacer" />
      {extraActions}
      <div className="ccy-toggle" title="Moneda activa">
        {["USD", "PEN"].map(c => (
          <button
            key={c}
            className={`ccy-toggle__btn ${currency === c ? "is-active" : ""}`}
            onClick={() => setCurrency(c)}
          >
            {c}
          </button>
        ))}
      </div>
      <button className="btn btn--ghost" onClick={openCmdK} title="Cmd+K">
        <Icon name="command" size={14} /> <span className="kbd">K</span>
      </button>
      <button
        className={`btn ${activeFilterCount > 0 ? "btn--filtered" : ""}`}
        data-filter-trigger
        onClick={() => setFiltersOpen(o => !o)}
      >
        <Icon name="filter" size={13} /> Filtros
        {activeFilterCount > 0 && <span className="btn__badge mono">{activeFilterCount}</span>}
      </button>
      <button className="topbar__ai" onClick={openAI} title="Pedir informe IA">
        <Icon name="sparkles" size={13} /> Pedir a la IA
      </button>
      <button className="btn btn--primary" onClick={openNewLead}>
        <Icon name="plus" size={13} /> Nuevo lead
      </button>
      <button className="btn btn--icon" onClick={openSettings} title="Configuración">
        <Icon name="settings" size={14} />
      </button>
    </header>
  );
}

function App() {
  const [workspace, setWorkspace] = useState("novit");
  const [view, setView] = useState("dashboard");
  const [cmdkOpen, setCmdkOpen] = useState(false);
  const [selectedDealId, setSelectedDealId] = useState(null);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiHint, setAiHint] = useState(null);
  const [newLeadOpen, setNewLeadOpen] = useState(false);
  const [dataVersion, setDataVersion] = useState(0);
  const [t, setTweak] = useTweaks({ density: "compact" });
  const [filters, setFilters] = useState(window.FILTER_DEFAULTS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [customerInitial, setCustomerInitial] = useState({ name: null, nonce: 0 });
  const [currency, _setCurrency] = useState("USD");
  // Wrap setCurrency to write window.__currency SYNCHRONOUSLY before triggering
  // the re-render. Otherwise children render with the stale value before the
  // useEffect mirror runs.
  const setCurrency = useCallback((c) => {
    window.__currency = c;
    _setCurrency(c);
  }, []);
  const [exchangeRates, _setExchangeRates] = useState({ PEN: 3.75, EUR: 0.92, MXN: 17.2, BRL: 5.05 });
  // Same idea for FX rates — mutate the global synchronously
  const setExchangeRates = useCallback((updater) => {
    _setExchangeRates(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      Object.entries(next).forEach(([code, rate]) => {
        if (window.CURRENCIES[code]) window.CURRENCIES[code].rate = rate;
      });
      return next;
    });
  }, []);
  const [brandColors, setBrandColors] = useState({
    novit:  { color: "#4f46e5", label: "NOVIT",  tagline: "Tech & enterprise · 24 tratos", defaultCurrency: "USD" },
    sharky: { color: "#0d9488", label: "SHARKY", tagline: "Growth studio · 24 tratos",     defaultCurrency: "USD" }
  });
  const [accessMatrix, setAccessMatrix] = useState({});
  const [theme, setTheme] = useState("light");
  const [accent, setAccent] = useState("indigo");

  // Apply brand colors as CSS variables so the workspace mark + sidebar mark pick them up
  useEffect(() => {
    Object.entries(brandColors).forEach(([wsId, cfg]) => {
      document.documentElement.style.setProperty(`--ws-color-${wsId}`, cfg.color);
    });
  }, [brandColors]);
  // Theme
  useEffect(() => {
    document.body.classList.toggle("theme-dark", theme === "dark");
  }, [theme]);

  // Reset filters on workspace switch
  useEffect(() => { setFilters(window.FILTER_DEFAULTS); }, [workspace]);

  // Reset deal selection on workspace switch
  useEffect(() => { setSelectedDealId(null); }, [workspace]);

  const openDeal = useCallback((dealId) => {
    window.__lastView = view;
    setSelectedDealId(dealId);
  }, [view]);
  const closeDeal = useCallback(() => setSelectedDealId(null), []);
  const openAI = useCallback((hint) => { setAiHint(hint || null); setAiOpen(true); }, []);
  const openCustomer = useCallback((companyName) => {
    setSelectedDealId(null);
    setCustomerInitial(prev => ({ name: companyName, nonce: prev.nonce + 1 }));
    setView("customers");
  }, []);

  // Mutate a deal in the global store and force a re-render so all views reflect it.
  const updateDeal = useCallback((dealId, patch) => {
    const stages = window.CRM_DATA.stages;
    for (const wsId of Object.keys(window.CRM_DATA.workspaces)) {
      const deal = window.CRM_DATA.workspaces[wsId].deals.find(d => d.id === dealId);
      if (deal) {
        Object.assign(deal, patch);
        if (patch.stage) {
          const stg = stages.find(s => s.id === patch.stage);
          if (stg) deal.probability = stg.prob;
        }
        break;
      }
    }
    setDataVersion(v => v + 1);
  }, []);

  // Apply density + workspace class to <body>
  useEffect(() => {
    document.body.classList.remove("ws-novit", "ws-sharky");
    document.body.classList.add(`ws-${workspace}`);
  }, [workspace]);
  useEffect(() => {
    document.body.classList.remove("density-compact", "density-cozy");
    document.body.classList.add(`density-${t.density}`);
  }, [t.density]);

  // Cmd+K / Cmd+J
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCmdkOpen(o => !o);
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j") {
        e.preventDefault();
        setAiOpen(o => !o);
      }
      if (e.key === "Escape") { setCmdkOpen(false); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Build a merged "all workspaces" view (deals + owners combined) so the dashboard
  // and pipeline can show consolidated metrics. Other views fall back to NOVIT.
  const mergedAllWs = useMemo(() => {
    const novit = window.CRM_DATA.workspaces.novit;
    const sharky = window.CRM_DATA.workspaces.sharky;
    return {
      id: "all",
      isAll: true,
      deals: [
        ...novit.deals.map(d => ({ ...d, _ws: "novit" })),
        ...sharky.deals.map(d => ({ ...d, _ws: "sharky" }))
      ],
      owners: { ...novit.owners, ...sharky.owners },
      stages: novit.stages,
      today: novit.today
    };
  }, [dataVersion]);

  const ws = workspace === "all"
    ? mergedAllWs
    : window.CRM_DATA.workspaces[workspace];
  const rich = window.CRM_RICH;
  const inboxCount = workspace === "all"
    ? rich.inbox.novit.filter(i => i.unread).length + rich.inbox.sharky.filter(i => i.unread).length
    : rich.inbox[workspace].filter(i => i.unread).length;
  // dataVersion is read to make linter happy; the value forces a re-render when deals are mutated.
  void dataVersion;

  // Apply global filters to deals — produces a wsFiltered for views to consume.
  const filteredDeals = useMemo(() => window.applyFilters(ws.deals, filters, ws), [ws, filters, dataVersion]);
  const wsFiltered = useMemo(() => ({ ...ws, deals: filteredDeals }), [ws, filteredDeals]);
  const activeFilterCount = window.countActiveFilters(filters);
  const isFiltered = activeFilterCount > 0;

  // Render the active view (deal detail overrides everything)
  let viewEl;
  if (selectedDealId) {
    viewEl = <DealDetailView ws={ws} workspace={workspace} dealId={selectedDealId} onBack={closeDeal} onUpdateDeal={updateDeal} onNavigate={(v) => { setSelectedDealId(null); setView(v); }} onOpenAI={() => openAI(`El usuario está viendo el trato ${selectedDealId}`)} onOpenCustomer={openCustomer} />;
  } else {
    switch (view) {
      case "dashboard": viewEl = <DashboardView ws={wsFiltered} workspace={workspace} onOpenDeal={openDeal} onOpenAI={() => openAI()} onOpenCustomer={openCustomer} />; break;
      case "inbox":     viewEl = <InboxView ws={workspace === "all" ? window.CRM_DATA.workspaces.novit : ws} workspace={workspace === "all" ? "novit" : workspace} />; break;
      case "pipeline":  viewEl = <PipelineView ws={wsFiltered} workspace={workspace} onOpenDeal={openDeal} onUpdateDeal={updateDeal} onOpenCustomer={openCustomer} />; break;
      case "forecast":  viewEl = <ForecastView ws={wsFiltered} workspace={workspace} onOpenDeal={openDeal} onOpenCustomer={openCustomer} />; break;
      case "customers": viewEl = <CustomerView ws={wsFiltered} workspace={workspace === "all" ? "novit" : workspace} onOpenDeal={openDeal} initialCompany={customerInitial} />; break;
      case "chat":      viewEl = <InboxView ws={workspace === "all" ? window.CRM_DATA.workspaces.novit : ws} workspace={workspace === "all" ? "novit" : workspace} chatOnly />; break;
      case "templates": viewEl = <TemplatesView workspace={workspace} />; break;
      case "sequences": viewEl = <SequencesView workspace={workspace} />; break;
      case "objects":   viewEl = <ObjectsView workspace={workspace} />; break;
      case "schema":    viewEl = <SchemaView />; break;
      case "settings":  viewEl = <SettingsView
                                    workspace={workspace}
                                    currency={currency}
                                    setCurrency={setCurrency}
                                    exchangeRates={exchangeRates}
                                    setExchangeRates={setExchangeRates}
                                    brandColors={brandColors}
                                    setBrandColors={setBrandColors}
                                    accessMatrix={accessMatrix}
                                    setAccessMatrix={setAccessMatrix}
                                    theme={theme}
                                    setTheme={setTheme}
                                    accent={accent}
                                    setAccent={setAccent}
                                    density={t.density}
                                    setDensity={(d) => setTweak("density", d)}
                                    onNavigate={(v) => setView(v === "channels" ? "templates" : v)}
                                  />; break;
      default: viewEl = null;
    }
  }

  const VIEW_LABEL = VIEWS.find(v => v.id === view) || { label: "Configuración" };

  return (
    <div className="app">
      <Sidebar
        workspace={workspace}
        setWorkspace={setWorkspace}
        view={selectedDealId ? null : view}
        setView={(v) => { setSelectedDealId(null); setView(v); }}
        openCmdK={() => setCmdkOpen(true)}
        inboxCount={inboxCount}
        openSettings={() => { setSelectedDealId(null); setView("settings"); }}
      />
      <main className="main" data-screen-label={`Main · ${VIEW_LABEL.label}`}>
        <div className="topbar-wrap">
          <Topbar
            view={view}
            workspace={workspace}
            openCmdK={() => setCmdkOpen(true)}
            openAI={() => openAI()}
            openNewLead={() => setNewLeadOpen(true)}
            filtersOpen={filtersOpen}
            setFiltersOpen={setFiltersOpen}
            activeFilterCount={activeFilterCount}
            currency={currency}
            setCurrency={setCurrency}
            openSettings={() => { setSelectedDealId(null); setView("settings"); }}
          />
          {filtersOpen && (
            <FiltersPopover
              filters={filters}
              setFilters={setFilters}
              ws={ws}
              workspace={workspace}
              onClose={() => setFiltersOpen(false)}
            />
          )}
        </div>
        {isFiltered && (
          <FiltersBar
            filters={filters}
            setFilters={setFilters}
            ws={ws}
            totalDeals={ws.deals.length}
            filteredCount={filteredDeals.length}
          />
        )}
        <section className="view">
          {viewEl}
        </section>
      </main>

      {aiOpen && (
        <AIDrawer
          open={aiOpen}
          onClose={() => setAiOpen(false)}
          workspace={workspace}
          ws={ws}
          contextHint={aiHint}
        />
      )}

      {newLeadOpen && (
        <NewLeadDrawer
          open={newLeadOpen}
          onClose={() => setNewLeadOpen(false)}
          workspace={workspace}
          ws={ws}
          onCreated={(form) => { /* demo: lead is in confirmation screen */ }}
        />
      )}

      {cmdkOpen && (
        <CommandMenu
          workspace={workspace}
          onClose={() => setCmdkOpen(false)}
          onNavigate={(v) => { setSelectedDealId(null); setView(v); setCmdkOpen(false); }}
          onSwitchWorkspace={(w) => { setWorkspace(w); setCmdkOpen(false); }}
          onOpenDeal={(id) => { openDeal(id); setCmdkOpen(false); }}
          onOpenAI={() => { openAI(); setCmdkOpen(false); }}
          onOpenNewLead={() => { setNewLeadOpen(true); setCmdkOpen(false); }}
        />
      )}

      <TweaksPanel title="Tweaks · CRM Agile">
        <TweakSection label="Workspace activo">
          <TweakSelect
            label="Workspace"
            value={workspace}
            onChange={setWorkspace}
            options={[
              { label: "NOVIT",  value: "novit" },
              { label: "SHARKY", value: "sharky" },
              { label: "Todas las empresas (comparación)", value: "all" }
            ]}
          />
        </TweakSection>
        <TweakSection label="Densidad">
          <TweakRadio
            label="Densidad"
            value={t.density}
            onChange={(v) => setTweak("density", v)}
            options={[
              { label: "Compacta", value: "compact" },
              { label: "Cómoda",   value: "cozy" }
            ]}
          />
        </TweakSection>
      </TweaksPanel>
    </div>
  );
}

window.App = App;
window.VIEWS = VIEWS;
window.WORKSPACES = WORKSPACES;
