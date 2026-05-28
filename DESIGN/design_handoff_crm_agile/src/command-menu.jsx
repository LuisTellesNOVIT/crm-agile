// Command Menu (⌘K)
function CommandMenu({ workspace, onClose, onNavigate, onSwitchWorkspace, onOpenDeal, onOpenAI, onOpenNewLead }) {
  const [query, setQuery] = useState("");
  const [idx, setIdx] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const ws = window.CRM_DATA.workspaces[workspace];
  const otherWs = workspace === "novit" ? "sharky" : "novit";

  // Build groups of commands dynamically based on query
  const items = useMemo(() => {
    const navItems = window.VIEWS.map(v => ({
      group: "Ir a",
      label: v.label,
      sub: `Vista · ${v.id}`,
      icon: v.icon,
      run: () => onNavigate(v.id),
      kbd: v.id === "inbox" ? "G I" : v.id === "forecast" ? "G F" : v.id === "pipeline" ? "G P" : null
    }));

    const createItems = [
      { group: "Crear", label: "Nuevo lead",        icon: "user",    sub: "L",  kbd: "L", run: onOpenNewLead },
      { group: "Crear", label: "Nuevo trato",        icon: "dollar", sub: "D",  kbd: "D", run: onOpenNewLead },
      { group: "Crear", label: "Enviar WhatsApp",    icon: "wa",     sub: "W",  kbd: "W", run: () => onNavigate("chat") },
      { group: "Crear", label: "Enviar email",       icon: "mail",   sub: "E",  kbd: "E", run: () => onNavigate("chat") },
      { group: "Crear", label: "Crear nota IA",      icon: "sparkles", sub: "N", kbd: "N", run: () => onNavigate("customers") },
      { group: "Crear", label: "Nueva tarea",        icon: "check",  sub: "T",  kbd: "T", run: () => onNavigate("inbox") }
    ];

    const actionItems = [
      { group: "Acción", label: "Mover trato a etapa…",   icon: "kanban",   sub: "M",  run: () => onNavigate("pipeline") },
      { group: "Acción", label: "Aplicar plantilla rápida", icon: "template", sub: "/", run: () => onNavigate("templates") },
      { group: "Acción", label: "Iniciar secuencia",        icon: "zap",      sub: "S", run: () => onNavigate("sequences") },
      { group: "Acción", label: "Generar contrato PDF",     icon: "doc",      sub: "C", run: () => alert("[demo] Contrato generado automáticamente al ganar el trato") },
      { group: "Acción", label: "Generar factura PDF",      icon: "doc",      sub: "F", run: () => alert("[demo] Factura emitida") }
    ];

    const dealItems = ws.deals.slice(0, 8).map(d => ({
      group: "Saltar a trato",
      label: d.name,
      sub: `${d.company} · ${fmtMoney(d.value, true)} · ${stageLabel(d.stage)}`,
      icon: "kanban",
      run: () => onOpenDeal?.(d.id)
    }));

    const aiItems = [
      { group: "IA", label: "Abrir AI Assistant", sub: "Chat con la IA del CRM", icon: "sparkles", run: onOpenAI, kbd: "⌘ J" },
      { group: "IA", label: "Pedir informe de forecast", sub: "Genera un brief ejecutivo", icon: "trending", run: onOpenAI },
      { group: "IA", label: "Sugerir mejor lead a contactar", sub: "Ranking por AI Score + engagement", icon: "users", run: onOpenAI }
    ];

    const wsItems = [
      {
        group: "Workspace",
        label: `Cambiar a ${otherWs.toUpperCase()}`,
        sub: otherWs === "novit" ? "Tech & enterprise" : "Growth studio",
        icon: "users",
        run: () => onSwitchWorkspace(otherWs),
        kbd: "⌘ ⇧ O"
      }
    ];

    return [...navItems, ...createItems, ...actionItems, ...aiItems, ...dealItems, ...wsItems];
  }, [workspace]);

  const filtered = useMemo(() => {
    if (!query) return items;
    const q = query.toLowerCase();
    return items.filter(i =>
      i.label.toLowerCase().includes(q) ||
      (i.sub && i.sub.toLowerCase().includes(q)) ||
      i.group.toLowerCase().includes(q)
    );
  }, [items, query]);

  useEffect(() => { setIdx(0); }, [query]);

  // Group results
  const grouped = useMemo(() => {
    const g = {};
    filtered.forEach((it, i) => {
      g[it.group] = g[it.group] || [];
      g[it.group].push({ ...it, _i: i });
    });
    return g;
  }, [filtered]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setIdx(i => Math.min(filtered.length - 1, i + 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setIdx(i => Math.max(0, i - 1));
      } else if (e.key === "Enter") {
        e.preventDefault();
        filtered[idx]?.run();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [filtered, idx]);

  return (
    <div className="cmdk-backdrop" onClick={onClose}>
      <div className="cmdk" onClick={(e) => e.stopPropagation()}>
        <div className="cmdk__input">
          <Icon name="search" size={16} style={{ color: "var(--fg-3)" }} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Escribí un comando, busca un trato, navega…"
          />
          <span className="chip mono">{workspace.toUpperCase()}</span>
        </div>
        <div className="cmdk__list">
          {Object.entries(grouped).map(([group, list]) => (
            <div key={group} className="cmdk__group">
              <div className="cmdk__group-label">{group}</div>
              {list.map((it) => (
                <div
                  key={it._i}
                  className={`cmdk__item ${idx === it._i ? "is-active" : ""}`}
                  onMouseEnter={() => setIdx(it._i)}
                  onClick={() => it.run()}
                >
                  <div className="icon-tile">
                    <Icon name={it.icon} size={13} />
                  </div>
                  <div>
                    <div>{it.label}</div>
                  </div>
                  <span className="sub">{it.sub}</span>
                  {it.kbd && (
                    <span className="kbd-row">
                      {it.kbd.split(" ").map((k, i) => <span key={i} className="kbd">{k}</span>)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="empty-hint">No hay coincidencias para "{query}"</div>
          )}
        </div>
        <div className="cmdk__foot">
          <span className="hint"><span className="kbd">↑</span><span className="kbd">↓</span> navegar</span>
          <span className="hint"><span className="kbd">↵</span> ejecutar</span>
          <span className="hint"><span className="kbd">esc</span> cerrar</span>
          <span style={{ marginLeft: "auto" }}>NOVIT &amp; SHARKY · {window.CRM_DATA.workspaces[workspace].deals.length} tratos indexados</span>
        </div>
      </div>
    </div>
  );
}

window.CommandMenu = CommandMenu;
