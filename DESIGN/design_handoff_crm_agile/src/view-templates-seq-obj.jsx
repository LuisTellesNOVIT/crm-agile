// Templates + Sequences + Custom Objects + Schema views

function TemplatesView({ workspace }) {
  const templates = window.CRM_RICH.templates;
  const [filter, setFilter] = useState("all");
  const filtered = filter === "all" ? templates : templates.filter(t => t.channel === filter);
  const [selectedId, setSelectedId] = useState(templates[0].id);
  const sel = filtered.find(t => t.id === selectedId) || filtered[0];

  // Variables that appear in the body
  const vars = sel ? Array.from(new Set((sel.body.match(/\{\{[^}]+\}\}/g) || []).map(v => v.replace(/[{}]/g, "")))) : [];

  // Demo values
  const demoValues = {
    first_name: workspace === "novit" ? "Lucía" : "Sofía",
    workspace_name: workspace === "novit" ? "NOVIT" : "SHARKY",
    owner_name: workspace === "novit" ? "María Paz" : "Ariana",
    company: workspace === "novit" ? "Mercado Libre" : "Rappi",
    deal_name: workspace === "novit" ? "Data Lake + Snowflake" : "Onboarding Pro — Tier 2",
    deal_value: workspace === "novit" ? "$540,000" : "$48,000",
    start_date: "01 Jun 2026",
    scope_summary: workspace === "novit" ? "Modernización analítica" : "Onboarding + Growth ops",
    team_size: workspace === "novit" ? "8" : "3",
    duration: workspace === "novit" ? "18 meses" : "6 meses",
    meeting_time: "10:00",
    meeting_link: "meet.crm/x9k2",
    kickoff_date: "27 May 2026",
    portal_url: "portal.crm/" + workspace,
    csm_name: workspace === "novit" ? "Carlos G." : "Rodrigo T.",
    similar_company: workspace === "novit" ? "BBVA" : "Mercado Pago",
    case_link: "crm.io/case/123",
    industry: workspace === "novit" ? "Banca" : "E-commerce"
  };

  return (
    <div className="templates" data-screen-label="Templates">
      <div className="tpl__rail">
        <div className="nav-group__label" style={{ marginTop: 0 }}>Canales</div>
        {[
          { id: "all",   label: "Todos",     icon: "template", count: templates.length },
          { id: "wa",    label: "WhatsApp",  icon: "wa",       count: templates.filter(t => t.channel === "wa").length },
          { id: "email", label: "Email",     icon: "mail",     count: templates.filter(t => t.channel === "email").length }
        ].map(f => (
          <div key={f.id} className={`nav-item ${filter === f.id ? "is-active" : ""}`} onClick={() => setFilter(f.id)}>
            <Icon name={f.icon} className="icon" /><span>{f.label}</span>
            <span className="nav-item__badge">{f.count}</span>
          </div>
        ))}
        <div className="nav-group__label">Categorías</div>
        {["Welcome", "Follow-up", "Propuesta", "Onboarding", "Nurture"].map(cat => (
          <div key={cat} className="nav-item">
            <span style={{ marginLeft: 24 }}>{cat}</span>
          </div>
        ))}
      </div>

      <div className="tpl__list">
        {filtered.map(t => (
          <div key={t.id} className={`tpl-item ${sel?.id === t.id ? "is-active" : ""}`} onClick={() => setSelectedId(t.id)}>
            <div className="tpl-item__h">
              <div className="tpl-item__name">{t.name}</div>
              <span className="tpl-item__channel">
                <span className={`inbox__channel inbox__channel--${t.channel}`} style={{ width: 18, height: 18 }}>
                  <Icon name={t.channel === "wa" ? "wa" : "mail"} size={10} />
                </span>
              </span>
            </div>
            <div className="tpl-item__desc">{t.desc}</div>
            <div className="tpl-item__stats">
              <span>{fmtNum(t.uses)} usos</span>
              <span>·</span>
              <span style={{ color: t.replyRate > 50 ? "var(--success)" : t.replyRate > 30 ? "var(--warning)" : "var(--fg-3)" }}>
                {t.replyRate}% reply
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="tpl__preview">
        {sel ? (
          <>
            <div className="tpl-preview-card">
              <div className="h">
                <span className={`inbox__channel inbox__channel--${sel.channel}`} style={{ width: 22, height: 22 }}>
                  <Icon name={sel.channel === "wa" ? "wa" : "mail"} size={12} />
                </span>
                <span>{sel.name}</span>
                <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                  <button className="btn"><Icon name="external" size={13} /> Usar</button>
                  <button className="btn btn--icon"><Icon name="more" size={14} /></button>
                </div>
              </div>
              <div className="b">{renderTemplateBody(sel.body)}</div>
            </div>

            <div className="tpl-preview-card">
              <div className="h">
                <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--fg-3)", textTransform: "uppercase", letterSpacing: ".08em" }}>
                  Variables dinámicas · {vars.length}
                </span>
              </div>
              <div className="tpl-variables">
                {vars.map(v => (
                  <div key={v} className="tpl-variable">
                    <span style={{ color: "var(--accent)" }}>{`{{${v}}}`}</span>
                    <input defaultValue={demoValues[v] || ""} />
                  </div>
                ))}
              </div>
            </div>

            <div className="tpl-preview-card">
              <div className="h">
                <Icon name="sparkles" size={13} style={{ color: "var(--accent)" }} />
                Preview con datos reales
              </div>
              <div className="b">
                {sel.body.replace(/\{\{([^}]+)\}\}/g, (_, k) => demoValues[k] || `{{${k}}}`)}
              </div>
            </div>
          </>
        ) : <div className="empty-hint">Elegí una plantilla</div>}
      </div>
    </div>
  );
}

window.TemplatesView = TemplatesView;

/* ==================== Sequences ==================== */
function SequencesView({ workspace }) {
  const seq = window.CRM_RICH.sequences[0];
  const nodeMeta = {
    trigger: { color: "var(--accent)", icon: "zap",      label: "Trigger" },
    delay:   { color: "#71717a",      icon: "clock",    label: "Delay" },
    wa:      { color: "#25D366",      icon: "wa",       label: "WhatsApp" },
    email:   { color: "#5b6cff",      icon: "mail",     label: "Email" },
    branch:  { color: "#8b5cf6",      icon: "branch",   label: "Condition" },
    exit:    { color: "#ef4444",      icon: "x",        label: "Exit" }
  };

  return (
    <div className="seq" data-screen-label="Secuencias">
      <div className="seq__canvas">
        <div className="seq-flow">
          {seq.nodes.map((n, i) => {
            const meta = nodeMeta[n.kind] || nodeMeta.delay;
            const klass = n.kind === "trigger" ? "seq-node--trigger" : n.kind === "exit" ? "seq-node--exit" : "";
            return (
              <React.Fragment key={i}>
                {i > 0 && <div className="seq-arrow" />}
                <div className={`seq-node ${klass}`}>
                  <div className="seq-node__h">
                    <div className="seq-node__icon" style={{ background: meta.color }}>
                      <Icon name={meta.icon} size={14} />
                    </div>
                    <div>
                      <div className="seq-node__label">{meta.label}</div>
                      <div className="seq-node__title">{n.title}</div>
                    </div>
                    <div style={{ marginLeft: "auto", color: "var(--fg-4)" }}>
                      <Icon name="more" size={14} />
                    </div>
                  </div>
                  <div className="seq-node__body">{n.body}</div>
                </div>
              </React.Fragment>
            );
          })}
          <div className="seq-arrow" />
          <button className="btn" style={{ borderStyle: "dashed", color: "var(--fg-3)" }}>
            <Icon name="plus" size={12} /> Añadir paso
          </button>
        </div>
      </div>

      <div className="seq__side">
        <div className="card">
          <div className="card__h">
            <Icon name="zap" size={14} style={{ color: "var(--accent)" }} />
            {seq.name}
            <span className="chip chip--success" style={{ marginLeft: "auto", fontSize: 10 }}>
              <span className="dot" style={{ background: "var(--success)", width: 6, height: 6 }} /> Activa
            </span>
          </div>
          <div style={{ padding: 12, display: "grid", gap: 8 }}>
            <Stat label="Enrolados"        v={fmtNum(seq.stats.enrolled)} />
            <Stat label="Completaron"      v={fmtNum(seq.stats.completed)} />
            <Stat label="Reply rate"       v={seq.stats.replyRate + "%"} color="var(--success)" />
            <Stat label="Reuniones agendadas" v={fmtNum(seq.stats.meetingBooked)} />
          </div>
        </div>

        <div className="card">
          <div className="card__h">
            <Icon name="sparkles" size={14} style={{ color: "var(--accent)" }} />
            Exit triggers IA
          </div>
          <div style={{ padding: 12, fontSize: 12, color: "var(--fg-2)", display: "grid", gap: 8 }}>
            <ExitTrigger text="Lead responde por WhatsApp" />
            <ExitTrigger text="Lead agenda reunión" />
            <ExitTrigger text="Lead descarga el caso" />
            <ExitTrigger text="Lead marca 'no interesado'" />
            <ExitTrigger text="Cambio de etapa manual" />
          </div>
        </div>

        <div className="card">
          <div className="card__h">
            <Icon name="users" size={14} />
            Audiencia
          </div>
          <div style={{ padding: 12 }}>
            <div style={{ fontSize: 11, color: "var(--fg-3)", fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 6 }}>
              Reglas de entrada
            </div>
            <div style={{ fontSize: 12 }}>
              <div style={{ marginBottom: 4 }}><b>Etapa</b> = "Lead"</div>
              <div style={{ marginBottom: 4 }}><b>Fuente</b> ∈ <span className="chip">FB Ads</span> <span className="chip">Web</span> <span className="chip">LinkedIn</span></div>
              <div><b>Owner</b> ≠ ∅</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, v, color }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", fontSize: 12 }}>
      <span style={{ color: "var(--fg-3)" }}>{label}</span>
      <span className="mono" style={{ marginLeft: "auto", color: color || "var(--fg)", fontWeight: 500 }}>{v}</span>
    </div>
  );
}
function ExitTrigger({ text }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span className="dot" style={{ background: "var(--danger)", width: 6, height: 6 }} />
      <span>{text}</span>
    </div>
  );
}

window.SequencesView = SequencesView;

/* ==================== Custom Objects ==================== */
function ObjectsView({ workspace }) {
  const objs = window.CRM_RICH.customObjects;
  const [sel, setSel] = useState(objs[2].id); // Deals by default
  const obj = objs.find(o => o.id === sel);

  const typeIcon = (t) => {
    switch (t) {
      case "text": return "doc";
      case "email": return "mail";
      case "phone": return "phone";
      case "select": return "chevron-down";
      case "number": case "currency": return "dollar";
      case "date": case "datetime": return "calendar";
      case "checkbox": return "check";
      case "record": return "external";
      case "file": return "doc";
      default: return "doc";
    }
  };

  return (
    <div className="objects" data-screen-label="Custom Objects">
      <aside className="objects__rail">
        <div className="nav-group__label" style={{ marginTop: 0 }}>Objects</div>
        {objs.map(o => (
          <div key={o.id} className={`obj-card ${sel === o.id ? "is-active" : ""}`} onClick={() => setSel(o.id)}>
            <div className="icon-tile" style={{ background: o.color }}>{o.icon}</div>
            <span style={{ fontWeight: 500 }}>{o.name}</span>
            <span className="count">{fmtNum(o.count)}</span>
          </div>
        ))}
        <button className="btn" style={{ marginTop: 10, width: "100%", justifyContent: "center", color: "var(--fg-3)" }}>
          <Icon name="plus" size={12} /> Nuevo objeto
        </button>

        <div className="nav-group__label" style={{ marginTop: 20 }}>Workspace</div>
        <div style={{ padding: "8px 10px", fontSize: 11, color: "var(--fg-3)", fontFamily: "var(--font-mono)", lineHeight: 1.5 }}>
          Schema aislado por tenant.<br />
          Cambios en {workspace.toUpperCase()} no afectan al otro workspace.
        </div>
      </aside>

      <div className="objects__main">
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
          <div className="icon-tile" style={{ background: obj.color, width: 36, height: 36, borderRadius: 8, fontSize: 16 }}>{obj.icon}</div>
          <div>
            <h1 style={{ margin: 0, fontSize: 20, letterSpacing: "-0.02em" }}>{obj.name}</h1>
            <div style={{ fontSize: 12, color: "var(--fg-3)", fontFamily: "var(--font-mono)" }}>
              {fmtNum(obj.count)} registros · {obj.attrs.length} atributos · workspaces.{workspace}.objects.{obj.name.toLowerCase()}
            </div>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
            <button className="btn"><Icon name="grid" size={13} /> Vista</button>
            <button className="btn btn--primary"><Icon name="plus" size={13} /> Atributo</button>
          </div>
        </div>

        <div className="obj-attrs">
          <div className="obj-attrs__h">
            <span></span>
            <span>Atributo</span>
            <span>Tipo</span>
            <span>Descripción</span>
            <span>Required</span>
            <span></span>
          </div>
          {obj.attrs.map((a, i) => (
            <div key={i} className="obj-attr">
              <Icon name="drag" size={14} className="obj-attr__handle" />
              <span style={{ fontWeight: 500 }}>{a.name}</span>
              <span>
                <span className="obj-attr__type">
                  <Icon name={typeIcon(a.type)} size={10} />
                  {a.type}
                </span>
              </span>
              <span style={{ color: "var(--fg-3)", fontSize: 12, overflow: "hidden", textOverflow: "ellipsis" }}>{a.desc || "—"}</span>
              <span>{a.required ? <span className="chip chip--accent">required</span> : <span className="chip">opt</span>}</span>
              <Icon name="more" size={14} style={{ color: "var(--fg-3)", cursor: "pointer" }} />
            </div>
          ))}
        </div>

        <div style={{ marginTop: 18, padding: 14, background: "var(--bg-2)", borderRadius: 6, border: "1px solid var(--border-2)" }}>
          <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--fg-3)", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 6 }}>
            Cómo se traduce a Prisma
          </div>
          <pre style={{ margin: 0, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-2)", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
{`// El sistema mantiene los atributos custom en una tabla flexible
// (key-value tipado) que NO modifica el schema principal.
model ${obj.name.replace(/s$/, "")}Attribute {
  id          String   @id @default(cuid())
  workspaceId String
  recordId    String
  key         String   // ej: "${obj.attrs[0].name.toLowerCase()}"
  type        AttrType // ${obj.attrs.map(a => a.type).filter((v,i,a)=>a.indexOf(v)===i).slice(0,4).join(" | ")}
  value       Json
  @@index([workspaceId, recordId])
}`}
          </pre>
        </div>
      </div>
    </div>
  );
}

window.ObjectsView = ObjectsView;
