// Settings view — appearance, brand colors per workspace, currency, user access matrix.

function SettingsView({ workspace, currency, setCurrency, exchangeRates, setExchangeRates, brandColors, setBrandColors, accessMatrix, setAccessMatrix, theme, setTheme, accent, setAccent, density, setDensity, onNavigate }) {
  const [section, setSection] = useState("appearance");

  const sections = [
    { id: "appearance", label: "Apariencia",       icon: "sparkles" },
    { id: "currency",   label: "Moneda",           icon: "dollar" },
    { id: "brand",      label: "Empresas y marca", icon: "users" },
    { id: "users",      label: "Usuarios y roles", icon: "user" },
    { id: "templates",  label: "Plantillas",       icon: "template", external: "templates" },
    { id: "channels",   label: "Canales",          icon: "zap",      external: "channels" },
    { id: "schema",     label: "Schema (Prisma)",  icon: "code",     external: "schema" }
  ];

  return (
    <div className="settings" data-screen-label="Configuración">
      <div className="settings__intro">
        <h1>Configuración</h1>
        <p>Apariencia, monedas, accesos por usuario, integraciones y schema.</p>
      </div>

      <div className="settings__layout">
        <aside className="settings__nav">
          {sections.map(s => (
            <button
              key={s.id}
              className={`settings__nav-item ${section === s.id ? "is-active" : ""}`}
              onClick={() => s.external ? onNavigate?.(s.external) : setSection(s.id)}
            >
              <Icon name={s.icon} size={14} />
              <span>{s.label}</span>
              {s.external && <Icon name="external" size={11} style={{ marginLeft: "auto", color: "var(--fg-4)" }} />}
            </button>
          ))}
        </aside>

        <div className="settings__body">
          {section === "appearance" && (
            <AppearanceSection theme={theme} setTheme={setTheme} accent={accent} setAccent={setAccent} density={density} setDensity={setDensity} />
          )}
          {section === "currency" && (
            <CurrencySection currency={currency} setCurrency={setCurrency} exchangeRates={exchangeRates} setExchangeRates={setExchangeRates} />
          )}
          {section === "brand" && (
            <BrandSection brandColors={brandColors} setBrandColors={setBrandColors} />
          )}
          {section === "users" && (
            <UsersSection accessMatrix={accessMatrix} setAccessMatrix={setAccessMatrix} />
          )}
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   Appearance
   ============================================================ */
function AppearanceSection({ theme, setTheme, accent, setAccent, density, setDensity }) {
  const accents = [
    { id: "indigo",   label: "Indigo",    color: "#4f46e5" },
    { id: "blue",     label: "Azul",      color: "#2563eb" },
    { id: "emerald",  label: "Esmeralda", color: "#0d9488" },
    { id: "orange",   label: "Naranja",   color: "#ea580c" },
    { id: "rose",     label: "Rosa",      color: "#e11d48" },
    { id: "slate",    label: "Pizarra",   color: "#1e293b" }
  ];

  return (
    <>
      <SettingsCard title="Tema" subtitle="Cambia entre claro y oscuro. La preferencia se guarda en este navegador.">
        <div className="seg">
          <button className={`seg__opt ${theme === "light" ? "is-active" : ""}`} onClick={() => setTheme("light")}>Claro</button>
          <button className={`seg__opt ${theme === "dark" ? "is-active" : ""}`} onClick={() => setTheme("dark")}>Oscuro</button>
        </div>
      </SettingsCard>

      <SettingsCard title="Color de acento" subtitle="Aplica al botón primario, links y resaltados del producto.">
        <div className="accent-swatches">
          {accents.map(a => (
            <button
              key={a.id}
              className={`accent-swatch ${accent === a.id ? "is-active" : ""}`}
              onClick={() => setAccent(a.id)}
              style={{ "--swatch": a.color }}
            >
              <span className="accent-swatch__dot" />
              {a.label}
            </button>
          ))}
        </div>
      </SettingsCard>

      <SettingsCard title="Densidad" subtitle="Cómoda usa más respiración; densa muestra más contenido por pantalla.">
        <div className="seg">
          <button className={`seg__opt ${density === "cozy" ? "is-active" : ""}`} onClick={() => setDensity("cozy")}>Cómoda</button>
          <button className={`seg__opt ${density === "compact" ? "is-active" : ""}`} onClick={() => setDensity("compact")}>Densa</button>
        </div>
      </SettingsCard>
    </>
  );
}

/* ============================================================
   Currency
   ============================================================ */
function CurrencySection({ currency, setCurrency, exchangeRates, setExchangeRates }) {
  const currencies = window.CURRENCIES;
  const list = ["USD", "PEN", "EUR", "MXN", "BRL"];

  const setRate = (code, rate) => {
    setExchangeRates(prev => ({ ...prev, [code]: rate }));
    window.CURRENCIES[code].rate = rate;
  };

  return (
    <>
      <SettingsCard
        title="Moneda activa"
        subtitle="Cómo se muestran los valores en todo el producto. Los importes se almacenan en USD; las otras monedas se calculan con la tasa de cambio configurada."
      >
        <div className="currency-cards">
          {list.map(code => {
            const c = currencies[code];
            return (
              <button
                key={code}
                className={`currency-card ${currency === code ? "is-active" : ""}`}
                onClick={() => setCurrency(code)}
              >
                <div className="currency-card__sym">{c.symbol}</div>
                <div className="currency-card__code">{code}</div>
                <div className="currency-card__rate mono">1 USD = {c.rate} {code}</div>
                {currency === code && <Icon name="check" size={12} className="currency-card__check" />}
              </button>
            );
          })}
        </div>
      </SettingsCard>

      <SettingsCard
        title="Tipo de cambio"
        subtitle="Valores manuales (se pueden auto-sincronizar con un feed FX). El cambio aplica de inmediato en todo el CRM."
      >
        <div className="fx-table">
          <div className="fx-row fx-row--head">
            <span>Moneda</span>
            <span>Símbolo</span>
            <span>1 USD =</span>
            <span style={{ textAlign: "right" }}>Acción</span>
          </div>
          {list.filter(c => c !== "USD").map(code => {
            const c = currencies[code];
            return (
              <div key={code} className="fx-row">
                <span>
                  <b>{code}</b>
                  <small>{code === "PEN" ? "Soles peruanos" : code === "ARS" ? "Pesos argentinos" : code === "MXN" ? "Pesos mexicanos" : code === "BRL" ? "Reales" : "Euros"}</small>
                </span>
                <span className="mono">{c.symbol}</span>
                <span>
                  <input
                    type="number"
                    className="fx-input mono"
                    step="0.01"
                    value={c.rate}
                    onChange={(e) => setRate(code, Number(e.target.value) || 0)}
                  />
                  <small className="mono">{code}</small>
                </span>
                <button className="btn btn--ghost" style={{ marginLeft: "auto" }}>
                  <Icon name="zap" size={11} /> Sincronizar
                </button>
              </div>
            );
          })}
        </div>
        <div className="fx-meta">
          <Icon name="clock" size={11} />
          Última sincronización: hace 12 minutos · Proveedor: openexchangerates.org
        </div>
      </SettingsCard>

      <SettingsCard
        title="Visualización dual"
        subtitle="Mostrar siempre el contravalor en USD como referencia entre paréntesis. Útil para reportes en mercados con alta inflación."
      >
        <label className="cfg-toggle">
          <input type="checkbox" />
          <span>Mostrar <b>USD</b> como referencia junto a la moneda activa</span>
        </label>
        <label className="cfg-toggle">
          <input type="checkbox" defaultChecked />
          <span>Redondear a miles en cards y dashboard ($145k en vez de $145,000)</span>
        </label>
      </SettingsCard>
    </>
  );
}

/* ============================================================
   Brand colors per workspace ("empresas")
   ============================================================ */
function BrandSection({ brandColors, setBrandColors }) {
  const workspaces = window.WORKSPACES;
  const presets = ["#4f46e5", "#2563eb", "#0d9488", "#ea580c", "#dc2626", "#e11d48", "#7c3aed", "#0891b2", "#16a34a", "#f59e0b", "#0a0a0a", "#475569"];

  const update = (wsId, patch) => {
    setBrandColors(prev => ({ ...prev, [wsId]: { ...prev[wsId], ...patch } }));
  };

  return (
    <SettingsCard
      title="Empresas y branding"
      subtitle="Cada empresa puede tener su propio color corporativo, logo y nombre comercial. El color se aplica al avatar del workspace y a los headers del CRM."
    >
      <div className="brand-list">
        {workspaces.map(w => {
          const cfg = brandColors[w.id] || { color: w.id === "novit" ? "#4f46e5" : "#0d9488", label: w.name, tagline: w.tagline };
          return (
            <div key={w.id} className="brand-card">
              <div className="brand-card__h">
                <div className="brand-card__avatar" style={{ background: cfg.color }}>{w.mark}</div>
                <div style={{ flex: 1 }}>
                  <input
                    className="brand-card__name"
                    value={cfg.label}
                    onChange={(e) => update(w.id, { label: e.target.value })}
                  />
                  <input
                    className="brand-card__tagline"
                    value={cfg.tagline}
                    onChange={(e) => update(w.id, { tagline: e.target.value })}
                  />
                </div>
                <button className="btn">
                  <Icon name="upload" size={11} /> Logo
                </button>
              </div>

              <div className="brand-card__row">
                <label className="brand-card__lbl">Color corporativo</label>
                <div className="brand-presets">
                  {presets.map(p => (
                    <button
                      key={p}
                      className={`brand-preset ${cfg.color === p ? "is-active" : ""}`}
                      style={{ background: p }}
                      onClick={() => update(w.id, { color: p })}
                      title={p}
                    />
                  ))}
                  <span className="brand-card__hex mono">
                    <input
                      type="text"
                      value={cfg.color}
                      onChange={(e) => update(w.id, { color: e.target.value })}
                      maxLength={7}
                    />
                  </span>
                </div>
              </div>

              <div className="brand-card__row">
                <label className="brand-card__lbl">Moneda por defecto</label>
                <select
                  className="brand-card__select"
                  value={cfg.defaultCurrency || "USD"}
                  onChange={(e) => update(w.id, { defaultCurrency: e.target.value })}
                >
                  <option value="USD">USD · Dólares</option>
                  <option value="PEN">PEN · Soles peruanos</option>
                  <option value="EUR">EUR · Euros</option>
                  <option value="MXN">MXN · Pesos mexicanos</option>
                  <option value="BRL">BRL · Reales</option>
                </select>
              </div>

              <div className="brand-card__preview">
                <span className="mono brand-card__preview-lbl">Vista previa:</span>
                <span className="ws-mark" style={{ background: cfg.color }}>{w.mark}</span>
                <button className="btn" style={{ background: cfg.color, color: "#fff", border: "none" }}>
                  Botón primario
                </button>
                <span className="chip" style={{ background: cfg.color + "18", color: cfg.color, borderColor: cfg.color + "55" }}>
                  Chip de marca
                </span>
              </div>
            </div>
          );
        })}

        <button className="brand-add">
          <Icon name="plus" size={14} />
          <span>Agregar empresa / workspace</span>
        </button>
      </div>
    </SettingsCard>
  );
}

/* ============================================================
   Users + access matrix
   ============================================================ */
function UsersSection({ accessMatrix, setAccessMatrix }) {
  const workspaces = window.WORKSPACES;
  // Build a flat user list across workspaces
  const allUsers = useMemo(() => {
    const arr = [];
    Object.entries(window.CRM_DATA.workspaces).forEach(([wsId, ws]) => {
      Object.entries(ws.owners).forEach(([key, owner]) => {
        // Dedup by name
        if (!arr.find(u => u.name === owner.name)) {
          arr.push({ key, ...owner, primaryWs: wsId });
        }
      });
    });
    // Add a couple of admin-ish users for variety
    arr.push({ key: "DS", name: "Diego Salazar", role: "Admin", color: "#7c3aed", primaryWs: "novit", isAdmin: true });
    arr.push({ key: "VC", name: "Valentina Caro", role: "Sales Ops", color: "#0891b2", primaryWs: "sharky" });
    return arr;
  }, []);

  const roleOptions = ["Admin", "Sales Manager", "Account Executive", "Senior AE", "BDR", "SDR", "Sales Ops", "Read-only"];

  const [search, setSearch] = useState("");
  const filtered = allUsers.filter(u => u.name.toLowerCase().includes(search.toLowerCase()) || u.role.toLowerCase().includes(search.toLowerCase()));

  const toggleAccess = (userName, wsId) => {
    setAccessMatrix(prev => {
      const userKey = userName;
      const cur = prev[userKey] || { workspaces: [], role: null };
      const has = cur.workspaces.includes(wsId);
      return {
        ...prev,
        [userKey]: {
          ...cur,
          workspaces: has ? cur.workspaces.filter(w => w !== wsId) : [...cur.workspaces, wsId]
        }
      };
    });
  };

  const setRole = (userName, role) => {
    setAccessMatrix(prev => ({
      ...prev,
      [userName]: { ...(prev[userName] || { workspaces: [] }), role }
    }));
  };

  return (
    <>
      <SettingsCard
        title="Acceso por usuario y empresa"
        subtitle="Cada usuario ve solo las empresas en las que tiene acceso. El rol determina qué puede editar dentro de cada una. Admins ven todo."
      >
        <div className="users-toolbar">
          <div className="filters-search" style={{ flex: 1 }}>
            <Icon name="search" size={12} />
            <input
              placeholder="Buscar usuario o rol…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button className="btn btn--primary">
            <Icon name="plus" size={12} /> Invitar usuario
          </button>
        </div>

        <div className="access-matrix">
          <div className="access-matrix__head">
            <span>Usuario</span>
            <span>Rol</span>
            {workspaces.map(w => (
              <span key={w.id} className="access-matrix__col">
                <span className="ws-mark" style={{ background: `var(--ws-color-${w.id}, ${w.id === "novit" ? "#4f46e5" : "#0d9488"})`, width: 18, height: 18, fontSize: 9 }}>{w.mark}</span>
                {w.name}
              </span>
            ))}
            <span style={{ textAlign: "right" }}>Acciones</span>
          </div>

          {filtered.map(u => {
            const am = accessMatrix[u.name] || { workspaces: [u.primaryWs], role: u.role };
            return (
              <div key={u.name} className="access-matrix__row">
                <span className="access-matrix__user">
                  <span className="avatar" style={{ background: `linear-gradient(135deg, ${u.color}aa, ${u.color})`, width: 26, height: 26, fontSize: 10 }}>
                    {u.name.split(" ").map(s => s[0]).slice(0, 2).join("")}
                  </span>
                  <div>
                    <div className="access-matrix__name">{u.name}</div>
                    <div className="access-matrix__email mono">{u.name.toLowerCase().replace(/\s/g, ".") + "@novit.com"}</div>
                  </div>
                  {u.isAdmin && <span className="chip chip--accent" style={{ fontSize: 9, marginLeft: 4 }}>Admin</span>}
                </span>
                <span>
                  <select
                    className="access-matrix__role"
                    value={am.role || u.role}
                    onChange={(e) => setRole(u.name, e.target.value)}
                  >
                    {roleOptions.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </span>
                {workspaces.map(w => {
                  const has = u.isAdmin || am.workspaces.includes(w.id);
                  return (
                    <span key={w.id} className="access-matrix__cell">
                      <button
                        className={`access-toggle ${has ? "is-on" : ""} ${u.isAdmin ? "is-locked" : ""}`}
                        onClick={() => !u.isAdmin && toggleAccess(u.name, w.id)}
                        disabled={u.isAdmin}
                        title={u.isAdmin ? "Los admins tienen acceso a todas las empresas" : has ? "Quitar acceso" : "Otorgar acceso"}
                      >
                        {has ? <Icon name="check" size={11} /> : <Icon name="x" size={11} />}
                      </button>
                    </span>
                  );
                })}
                <span className="access-matrix__actions">
                  <button className="btn btn--icon" title="Editar"><Icon name="settings" size={12} /></button>
                  <button className="btn btn--icon" title="Eliminar"><Icon name="trash" size={12} /></button>
                </span>
              </div>
            );
          })}
        </div>

        <div className="access-matrix__legend">
          <span><Icon name="check" size={10} /> Acceso completo según rol</span>
          <span><Icon name="x" size={10} /> Sin acceso · no ve la empresa en el switcher</span>
          <span>· {filtered.length} usuarios mostrados</span>
        </div>
      </SettingsCard>

      <SettingsCard
        title="Roles y permisos"
        subtitle="Matriz de qué puede hacer cada rol dentro de una empresa con acceso."
      >
        <div className="roles-table">
          <div className="roles-row roles-row--head">
            <span>Capacidad</span>
            {["Admin", "Sales Mgr", "AE / BDR", "Read-only"].map(r => <span key={r}>{r}</span>)}
          </div>
          {[
            { cap: "Ver dashboards y reportes", a: [1, 1, 1, 1] },
            { cap: "Crear y editar tratos",      a: [1, 1, 1, 0] },
            { cap: "Reasignar tratos a otros",   a: [1, 1, 0, 0] },
            { cap: "Editar etapas del pipeline", a: [1, 1, 0, 0] },
            { cap: "Configurar canales (WA/email)", a: [1, 0, 0, 0] },
            { cap: "Invitar usuarios",           a: [1, 0, 0, 0] },
            { cap: "Cambiar branding / colores", a: [1, 0, 0, 0] },
            { cap: "Borrar tratos definitivamente", a: [1, 0, 0, 0] }
          ].map(r => (
            <div key={r.cap} className="roles-row">
              <span>{r.cap}</span>
              {r.a.map((on, i) => (
                <span key={i}>
                  {on ? <Icon name="check" size={11} style={{ color: "var(--success)" }} /> : <span style={{ color: "var(--fg-4)" }}>—</span>}
                </span>
              ))}
            </div>
          ))}
        </div>
      </SettingsCard>
    </>
  );
}

function SettingsCard({ title, subtitle, children }) {
  return (
    <section className="settings-card">
      <div className="settings-card__h">
        <h3>{title}</h3>
        {subtitle && <p>{subtitle}</p>}
      </div>
      <div className="settings-card__b">
        {children}
      </div>
    </section>
  );
}

window.SettingsView = SettingsView;
