// Deal-scoped composer (WhatsApp + Email), conversation thread, and channel setup modal.

/* ============================================================
   DealComposer — slide-in drawer for sending WA or Email
   ============================================================ */
function DealComposer({ deal, ws, workspace, owner, contacts, initialChannel = "wa", initialTemplate = null, onClose }) {
  const [channel, setChannel] = useState(initialChannel);
  const templates = window.CRM_RICH.templates.filter(t => t.channel === channel);
  const [templateId, setTemplateId] = useState(initialTemplate || null);
  const [body, setBody] = useState("");
  const [subject, setSubject] = useState("");
  const [selectedContacts, setSelectedContacts] = useState(contacts.slice(0, 1).map(c => c.name));
  const [showSetup, setShowSetup] = useState(false);

  const variableMap = {
    first_name: contacts[0]?.name?.split(" ")[0] || "",
    full_name:  contacts[0]?.name || "",
    company:    deal.company,
    deal_name:  deal.name,
    deal_value: fmtMoney(deal.value),
    owner_name: owner?.name || "",
    workspace_name: (workspace || ws.id || "").toUpperCase(),
    meeting_time: "10:00",
    meeting_link: "calendly.com/" + (owner?.name || "").toLowerCase().replace(/\s/g, "-"),
    start_date: fmtDate(deal.estimatedCloseAt, { format: "short" }),
    scope_summary: "Discovery + Implementación + Soporte 6m",
    timeline: "8 semanas",
    payment_terms: "60d net",
    industry: "tecnología",
    similar_company: workspace === "novit" ? "Banco Galicia" : "Mercado Pago",
    case_link: "novit.com/casos/" + deal.company.toLowerCase().replace(/\s/g, "-"),
    kickoff_date: fmtDate(addDays(ws.today, 14), { format: "short" }),
    portal_url: "portal.novit.com"
  };

  const fillFromTemplate = (tpl) => {
    setTemplateId(tpl.id);
    let filled = tpl.body;
    Object.entries(variableMap).forEach(([k, v]) => {
      filled = filled.replace(new RegExp(`\\{\\{${k}\\}\\}`, "g"), v);
    });
    setBody(filled);
    if (tpl.channel === "email") {
      setSubject(tpl.subject || `${deal.name} · ${deal.company}`);
    }
  };

  const startBlank = () => {
    setTemplateId("blank");
    setBody("");
    if (channel === "email") setSubject(`${deal.name} · ${deal.company}`);
  };

  const insertVar = (k) => setBody(b => b + ` {{${k}}}`);

  const toggleContact = (name) => {
    setSelectedContacts(prev => prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]);
  };

  // Reset template when channel switches
  useEffect(() => { setTemplateId(null); setBody(""); }, [channel]);

  // Esc to close
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const sendDisabled = !body.trim() || selectedContacts.length === 0 || (channel === "email" && !subject.trim());

  return (
    <div className="cmp-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <aside className="cmp-drawer" onMouseDown={(e) => e.stopPropagation()}>
        <header className="cmp-h">
          <div className="cmp-tabs">
            <button className={`cmp-tab ${channel === "wa" ? "is-active" : ""}`} onClick={() => setChannel("wa")}>
              <Icon name="wa" size={13} /> WhatsApp
            </button>
            <button className={`cmp-tab ${channel === "email" ? "is-active" : ""}`} onClick={() => setChannel("email")}>
              <Icon name="mail" size={13} /> Email
            </button>
          </div>
          <span className="cmp-ctx mono">{deal.id} · {deal.company}</span>
          <button className="cmp-close" onClick={onClose} title="Cerrar (Esc)"><Icon name="x" size={14} /></button>
        </header>

        <ChannelStatusBanner channel={channel} onSetup={() => setShowSetup(true)} />

        <div className="cmp-body">
          {/* Left: templates */}
          <div className="cmp-templates">
            <div className="cmp-section-label">
              <Icon name="template" size={11} /> Plantillas {channel === "wa" ? "WhatsApp" : "Email"}
              <span className="mono" style={{ marginLeft: "auto", color: "var(--fg-4)" }}>{templates.length}</span>
            </div>
            <button
              className={`cmp-tpl cmp-tpl--blank ${templateId === "blank" ? "is-active" : ""}`}
              onClick={startBlank}
            >
              <span className="cmp-tpl__name"><Icon name="plus" size={11} /> Mensaje manual</span>
              <span className="cmp-tpl__desc">Empezá desde cero. Insertá variables con {"{{ }}"}.</span>
            </button>
            {templates.map(t => (
              <button
                key={t.id}
                className={`cmp-tpl ${templateId === t.id ? "is-active" : ""}`}
                onClick={() => fillFromTemplate(t)}
              >
                <span className="cmp-tpl__name">{t.name}</span>
                <span className="cmp-tpl__desc">{t.desc}</span>
                <span className="cmp-tpl__meta mono">
                  {t.uses.toLocaleString()} usos · {t.replyRate}% respuesta
                </span>
              </button>
            ))}
          </div>

          {/* Right: editor */}
          <div className="cmp-editor">
            <div className="cmp-field">
              <label>Para</label>
              <div className="cmp-recipients">
                {contacts.map((c, i) => {
                  const sel = selectedContacts.includes(c.name);
                  return (
                    <button
                      key={i}
                      className={`cmp-recipient ${sel ? "is-selected" : ""}`}
                      onClick={() => toggleContact(c.name)}
                    >
                      <span className="avatar avatar--xs" style={{ background: `linear-gradient(135deg, ${["#93c5fd","#fbbf24","#c4b5fd","#6ee7b7"][i%4]}, ${["#2563eb","#ea580c","#8b5cf6","#059669"][i%4]})`, width: 16, height: 16, fontSize: 8 }}>
                        {c.name.split(" ").map(s => s[0]).slice(0, 2).join("")}
                      </span>
                      <span>{c.name}</span>
                      {channel === "email" && (
                        <span className="mono cmp-recipient__email">{c.email}</span>
                      )}
                      {channel === "wa" && (
                        <span className="mono cmp-recipient__email">+54 11 {String(5000 + i * 137).slice(0,4)}-{String(1000 + i * 219).slice(0,4)}</span>
                      )}
                      {sel && <Icon name="check" size={10} />}
                    </button>
                  );
                })}
              </div>
            </div>

            {channel === "email" && (
              <div className="cmp-field">
                <label>Asunto</label>
                <input
                  className="cmp-input"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Asunto del email…"
                />
              </div>
            )}

            <div className="cmp-field cmp-field--body">
              <label>
                Mensaje
                {templateId && templateId !== "blank" && (
                  <span className="cmp-tpl-pill">
                    <Icon name="template" size={10} />
                    {templates.find(t => t.id === templateId)?.name}
                    <button onClick={() => { setTemplateId(null); setBody(""); }} title="Quitar plantilla">
                      <Icon name="x" size={9} />
                    </button>
                  </span>
                )}
              </label>
              <textarea
                className="cmp-textarea"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={channel === "email" ? 12 : 9}
                placeholder={channel === "wa"
                  ? "Escribí tu mensaje o elegí una plantilla…"
                  : "Cuerpo del email. Podés usar variables como {{first_name}}, {{deal_name}}, {{deal_value}}…"}
              />
            </div>

            <div className="cmp-vars">
              <span className="cmp-vars__label mono">Insertar variable:</span>
              {["first_name", "company", "deal_name", "deal_value", "owner_name", "meeting_link"].map(v => (
                <button key={v} className="cmp-var" onClick={() => insertVar(v)} title={`{{${v}}} → "${variableMap[v]}"`}>
                  {`{{${v}}}`}
                </button>
              ))}
            </div>

            {/* Preview rendered */}
            {body && (
              <div className="cmp-preview">
                <div className="cmp-section-label">
                  <Icon name="eye" size={11} /> Vista previa con variables resueltas
                </div>
                <div className={`cmp-preview__bubble cmp-preview__bubble--${channel}`}>
                  {channel === "email" && subject && (
                    <div className="cmp-preview__subject"><b>Asunto:</b> {renderVars(subject, variableMap)}</div>
                  )}
                  <div className="cmp-preview__body">{renderVars(body, variableMap)}</div>
                </div>
              </div>
            )}
          </div>
        </div>

        <footer className="cmp-foot">
          <button className="btn btn--ghost" onClick={onClose}>Cancelar</button>
          <div style={{ flex: 1 }} />
          <button className="btn">
            <Icon name="clock" size={12} /> Programar envío
          </button>
          <button className="btn">
            <Icon name="doc" size={12} /> Guardar borrador
          </button>
          <button
            className="btn btn--accent"
            disabled={sendDisabled}
            onClick={() => {
              // Demo: register an entry in the deal timeline + close
              window.__demoNotify?.(`${channel === "wa" ? "WhatsApp" : "Email"} enviado a ${selectedContacts.join(", ")}`);
              onClose();
            }}
            title={sendDisabled ? "Completá destinatario y mensaje" : "Enviar ahora"}
          >
            <Icon name={channel === "wa" ? "wa" : "mail"} size={13} />
            Enviar {channel === "wa" ? "WhatsApp" : "Email"}
          </button>
        </footer>

        {showSetup && <ChannelSetupModal initialChannel={channel} onClose={() => setShowSetup(false)} />}
      </aside>
    </div>
  );
}

function renderVars(text, map) {
  let out = text;
  Object.entries(map).forEach(([k, v]) => {
    out = out.replace(new RegExp(`\\{\\{${k}\\}\\}`, "g"), v);
  });
  return out;
}

function ChannelStatusBanner({ channel, onSetup }) {
  const status = channel === "wa"
    ? { label: "Conectado vía WhatsApp Business Cloud API", tone: "ok", info: "Meta WABA · +54 11 5555-0987" }
    : { label: "Conectado vía Google Workspace · ventas@novit.com", tone: "ok", info: "SPF/DKIM/DMARC ✓" };

  return (
    <div className={`cmp-status cmp-status--${status.tone}`}>
      <span className="dot" style={{ background: "var(--success)", width: 7, height: 7 }} />
      <span className="cmp-status__label">{status.label}</span>
      <span className="cmp-status__info mono">{status.info}</span>
      <button className="cmp-status__cfg" onClick={onSetup}>
        <Icon name="settings" size={11} /> Configurar
      </button>
    </div>
  );
}

/* ============================================================
   DealWhatsAppThread — embedded conversation for this deal
   ============================================================ */
function whatsAppConversationForDeal(deal, ws, owner, contacts) {
  const seed = (deal.id || "x").split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const champion = contacts[0] || { name: deal.company, role: "Stakeholder" };
  const co = deal.company;
  const ownerName = owner?.name || "Owner";
  const valueShort = fmtMoney(deal.value, true);
  const isProposalOrLater = ["proposal", "negotiation", "won"].includes(deal.stage);
  const isNegotiation = ["negotiation", "won"].includes(deal.stage);
  const today = ws.today;

  const msgs = [
    { dir: "out", at: addDays(today, -20), time: "10:14", text: `Hola ${champion.name.split(" ")[0]} 👋\n\nSoy ${ownerName} de NOVIT. Gracias por interesarte en lo que hablamos sobre ${deal.name}. ¿Tenés 15 min esta semana para una primera charla?` },
    { dir: "in",  at: addDays(today, -20), time: "11:42", text: `Hola ${ownerName}! Sí, contame. ¿Mañana 16hs?` },
    { dir: "out", at: addDays(today, -20), time: "11:43", text: `Perfecto, te mando invite ahora. ✅` },
    { dir: "out", at: addDays(today, -19), time: "15:55", text: `Listo, calendar invite enviado. Charlamos mañana 16hs. Si surge algo, escribime por acá.` },
    { dir: "in",  at: addDays(today, -15), time: "09:08", text: `Buenos días, mil gracias por el call. Te mando los specs técnicos que pediste por mail.` },
    { dir: "out", at: addDays(today, -15), time: "09:30", text: `Joya, los recibí. Voy armando una primera versión de la propuesta. ¿Quiénes más del lado de ${co} deberían participar? CTO + Procurement?` },
    { dir: "in",  at: addDays(today, -14), time: "16:21", text: `Sí, y también nuestro CFO. Les voy comentando.` }
  ];

  if (isProposalOrLater) {
    msgs.push(
      { dir: "out", at: addDays(today, -8), time: "10:00", text: `${champion.name.split(" ")[0]}, ya te mandé la propuesta por mail con valor total ${valueShort}. Avisame cuando puedas revisarla.` },
      { dir: "in",  at: addDays(today, -7), time: "17:42", text: `Recibida. La estoy mirando con Procurement, te respondo el lunes.` },
      { dir: "out", at: addDays(today, -5), time: "11:12", text: `Recordatorio amistoso 🙂 ¿pudieron revisar la propuesta?` },
      { dir: "in",  at: addDays(today, -5), time: "14:30", text: `Sí! Tenemos algunas dudas sobre el alcance de la fase 2. ¿Podés explicarme?` },
      { dir: "out", at: addDays(today, -5), time: "14:55", text: `Claro. La fase 2 incluye integración con tu data warehouse + dashboards custom. Te paso un loom de 3min explicando: novit.com/loom/${deal.id.toLowerCase()}` }
    );
  }

  if (isNegotiation) {
    msgs.push(
      { dir: "in",  at: addDays(today, -3), time: "11:18", text: `Procurement nos pidió un descuento del 8%. ¿Hay margen?` },
      { dir: "out", at: addDays(today, -3), time: "11:25", text: `Puedo ofrecer 5% si firmamos antes de fin de mes y con commitment de 18 meses.` },
      { dir: "in",  at: addDays(today, -3), time: "16:00", text: `Lo elevamos al CFO. Te contesto mañana.` },
      { dir: "out", at: addDays(today, -1), time: "10:30", text: `${champion.name.split(" ")[0]}, ¿alguna novedad del CFO?` }
    );
  }

  if (deal.stage === "won") {
    msgs.push(
      { dir: "in",  at: addDays(today, -1), time: "18:42", text: `Aprobado! 🎉 Mandanos el contrato cuando quieras.` },
      { dir: "out", at: today, time: "08:55", text: `${champion.name.split(" ")[0]}, qué gran noticia 🚀 Te envío contrato firmable hoy mismo.` }
    );
  } else if (!["lost"].includes(deal.stage)) {
    msgs.push(
      { dir: "in",  at: today, time: "09:14", text: `Veo el loom y te confirmo. ¿Podemos hacer kickoff en agosto?` }
    );
  }

  return msgs;
}

function DealWhatsAppThread({ deal, ws, workspace, owner, contacts, onCompose, onSetup }) {
  const msgs = useMemo(() => whatsAppConversationForDeal(deal, ws, owner, contacts), [deal.id]);
  const [quickReply, setQuickReply] = useState("");
  const champion = contacts[0];
  const isLost = deal.stage === "lost";

  // Group by date
  const groups = [];
  let cur = null;
  msgs.forEach(m => {
    const key = fmtDate(m.at, { format: "long" });
    if (!cur || cur.key !== key) {
      cur = { key, msgs: [] };
      groups.push(cur);
    }
    cur.msgs.push(m);
  });

  const quickReplies = [
    "👍 Recibido, lo reviso.",
    "¿Tenés 15 min hoy?",
    "Te mando propuesta actualizada.",
    "Confirmado, agendado."
  ];

  return (
    <div className="deal-wa">
      <div className="deal-wa__h">
        <div className="deal-wa__contact">
          <span className="avatar" style={{ background: "linear-gradient(135deg, #34d399, #059669)", width: 32, height: 32, fontSize: 12 }}>
            {champion?.name.split(" ").map(s => s[0]).slice(0, 2).join("") || "WA"}
          </span>
          <div>
            <div className="deal-wa__name">{champion?.name || deal.company}</div>
            <div className="deal-wa__sub">
              <span className="mono">+54 11 5511-{String(deal.id).slice(-4)}</span>
              <span style={{ color: "var(--fg-4)" }}>·</span>
              <span style={{ color: "#128c4c", fontWeight: 500 }}>● Conectado vía WhatsApp Business</span>
            </div>
          </div>
          <div className="deal-wa__actions">
            <button className="btn" onClick={onSetup} title="Configurar canal">
              <Icon name="settings" size={12} />
            </button>
            <button className="btn">
              <Icon name="phone" size={12} /> Llamar
            </button>
            <button className="btn btn--accent" onClick={() => onCompose("wa")}>
              <Icon name="wa" size={12} /> Responder con plantilla
            </button>
          </div>
        </div>
      </div>

      <div className="deal-wa__thread">
        {groups.map((g, i) => (
          <React.Fragment key={i}>
            <div className="deal-wa__day">{g.key}</div>
            {g.msgs.map((m, j) => (
              <div key={j} className={`bubble bubble--${m.dir} bubble--wa`}>
                {m.text}
                <small>{m.time} {m.dir === "out" ? "✓✓" : ""}</small>
              </div>
            ))}
          </React.Fragment>
        ))}

        {isLost && (
          <div className="deal-wa__closed">
            <Icon name="x" size={11} /> Conversación archivada · trato cerrado como Lost
          </div>
        )}
      </div>

      {!isLost && (
        <div className="deal-wa__composer">
          <div className="deal-wa__quick">
            {quickReplies.map((q, i) => (
              <button key={i} className="deal-wa__quick-chip" onClick={() => setQuickReply(q)}>{q}</button>
            ))}
            <button className="deal-wa__quick-chip deal-wa__quick-chip--tpl" onClick={() => onCompose("wa")}>
              <Icon name="template" size={11} /> Más plantillas
            </button>
          </div>
          <div className="deal-wa__input">
            <Icon name="wa" size={14} style={{ color: "#25D366" }} />
            <input
              placeholder="Escribí un mensaje rápido o usá / para plantillas…"
              value={quickReply}
              onChange={(e) => setQuickReply(e.target.value)}
            />
            <button className="btn">
              <Icon name="template" size={11} />
            </button>
            <button className="btn btn--accent" disabled={!quickReply.trim()}>
              Enviar <span className="kbd" style={{ background: "rgba(255,255,255,.18)", borderColor: "rgba(255,255,255,.3)", color: "#fff" }}>⌘ ↵</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================================================
   ChannelSetupModal — how to connect WA Business + phone + email
   ============================================================ */
function ChannelSetupModal({ initialChannel = "wa", onClose }) {
  const [tab, setTab] = useState(initialChannel === "email" ? "email" : initialChannel === "phone" ? "phone" : "wa");

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="cfg-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="cfg-modal" onMouseDown={(e) => e.stopPropagation()}>
        <header className="cfg-h">
          <Icon name="settings" size={14} />
          <h3>Configurar canales de comunicación</h3>
          <button className="cfg-close" onClick={onClose}><Icon name="x" size={14} /></button>
        </header>

        <div className="cfg-tabs">
          <button className={`cfg-tab ${tab === "wa" ? "is-active" : ""}`} onClick={() => setTab("wa")}>
            <Icon name="wa" size={13} /> WhatsApp Business
            <span className="chip chip--success" style={{ marginLeft: 6 }}>Conectado</span>
          </button>
          <button className={`cfg-tab ${tab === "phone" ? "is-active" : ""}`} onClick={() => setTab("phone")}>
            <Icon name="phone" size={13} /> Telefonía
            <span className="chip chip--warn" style={{ marginLeft: 6 }}>Pendiente</span>
          </button>
          <button className={`cfg-tab ${tab === "email" ? "is-active" : ""}`} onClick={() => setTab("email")}>
            <Icon name="mail" size={13} /> Email
            <span className="chip chip--success" style={{ marginLeft: 6 }}>Conectado</span>
          </button>
        </div>

        <div className="cfg-body">
          {tab === "wa" && <WaSetup />}
          {tab === "phone" && <PhoneSetup />}
          {tab === "email" && <EmailSetup />}
        </div>

        <footer className="cfg-foot">
          <a className="cfg-help" href="#" onClick={(e) => e.preventDefault()}>
            <Icon name="external" size={11} /> Docs completas en developers.novit.com/channels
          </a>
          <button className="btn" onClick={onClose}>Cerrar</button>
          <button className="btn btn--primary" onClick={onClose}>Guardar cambios</button>
        </footer>
      </div>
    </div>
  );
}

function WaSetup() {
  return (
    <>
      <div className="cfg-intro">
        Conectá tu número de WhatsApp Business usando la <b>Cloud API de Meta</b>. Una vez configurado, todos los mensajes salientes (manuales o por plantilla) viajan por tu número verificado, y los entrantes aparecen en el Inbox y en cada trato.
      </div>

      <div className="cfg-step">
        <span className="cfg-step__n">1</span>
        <div className="cfg-step__body">
          <h4>Crear cuenta de WhatsApp Business (WABA)</h4>
          <p>Entrá a Meta Business Manager → <a href="#" onClick={(e) => e.preventDefault()}>Configuración → Cuentas de WhatsApp Business</a> y creá una WABA asociada a tu negocio. Necesitás ser administrador de la página de Facebook de la empresa.</p>
        </div>
      </div>

      <div className="cfg-step">
        <span className="cfg-step__n">2</span>
        <div className="cfg-step__body">
          <h4>Asociar número de teléfono</h4>
          <p>Asociá un número <b>dedicado al CRM</b> (no puede tener WhatsApp personal). Recibirás un código de verificación por SMS o llamada.</p>
          <div className="cfg-field">
            <label>Número activo</label>
            <div className="cfg-input-row">
              <input className="cfg-input" defaultValue="+54 11 5555-0987" />
              <span className="chip chip--success">Verificado</span>
            </div>
          </div>
        </div>
      </div>

      <div className="cfg-step">
        <span className="cfg-step__n">3</span>
        <div className="cfg-step__body">
          <h4>Generar token permanente</h4>
          <p>Desde <a href="#" onClick={(e) => e.preventDefault()}>developers.facebook.com → Tu App → WhatsApp → API Setup</a>, generá un <b>System User Token</b> con permisos <code>whatsapp_business_messaging</code> y <code>whatsapp_business_management</code>.</p>
          <div className="cfg-field">
            <label>Access Token (Meta)</label>
            <div className="cfg-input-row">
              <input className="cfg-input mono" defaultValue="EAAG3R••••••••••••••••••••6F8w" type="password" />
              <button className="btn">
                <Icon name="eye" size={11} />
              </button>
              <button className="btn">
                <Icon name="copy" size={11} />
              </button>
            </div>
          </div>
          <div className="cfg-field">
            <label>Phone Number ID</label>
            <input className="cfg-input mono" defaultValue="109876543210987" />
          </div>
          <div className="cfg-field">
            <label>Business Account ID (WABA)</label>
            <input className="cfg-input mono" defaultValue="208765432109876" />
          </div>
        </div>
      </div>

      <div className="cfg-step">
        <span className="cfg-step__n">4</span>
        <div className="cfg-step__body">
          <h4>Configurar webhook entrante</h4>
          <p>Para recibir mensajes que te mandan los clientes, copiá esta URL y pegala en <b>Meta → WhatsApp → Configuration → Webhook</b>. Subscribite al evento <code>messages</code>.</p>
          <div className="cfg-callout">
            <span className="mono cfg-callout__url">https://crm.novit.com/api/webhooks/whatsapp</span>
            <button className="btn"><Icon name="copy" size={11} /> Copiar</button>
          </div>
          <div className="cfg-field">
            <label>Verify Token</label>
            <input className="cfg-input mono" defaultValue="novit-crm-wa-2026-prod" />
          </div>
        </div>
      </div>

      <div className="cfg-step">
        <span className="cfg-step__n">5</span>
        <div className="cfg-step__body">
          <h4>Aprobar plantillas en Meta</h4>
          <p>Los mensajes outbound a contactos que no respondieron en 24hs requieren <b>plantillas pre-aprobadas</b> por Meta (welcome, follow-up, recordatorio, etc). Las plantillas marcadas como <i>WhatsApp</i> en la sección <a href="#" onClick={(e) => e.preventDefault()}>Templates</a> se sincronizan automáticamente.</p>
          <div className="cfg-callout cfg-callout--ok">
            <Icon name="check" size={12} />
            6 plantillas sincronizadas · 6 aprobadas
          </div>
        </div>
      </div>

      <div className="cfg-step">
        <span className="cfg-step__n">6</span>
        <div className="cfg-step__body">
          <h4>Mapear contactos del CRM</h4>
          <p>Cada contacto del CRM puede tener un campo <code>phone</code> con formato E.164 (<code>+54 9 11 5555-1234</code>). El número se usa para emparejar conversaciones entrantes con su trato y stakeholder.</p>
          <label className="cfg-toggle">
            <input type="checkbox" defaultChecked />
            <span>Crear automáticamente un contacto cuando entra un WA de un número nuevo</span>
          </label>
        </div>
      </div>
    </>
  );
}

function PhoneSetup() {
  return (
    <>
      <div className="cfg-intro">
        Integrá un proveedor SIP/cloud (Twilio, Vonage o Aircall) para hacer llamadas, registrar grabaciones y enviar SMS desde la app.
      </div>

      <div className="cfg-step">
        <span className="cfg-step__n">1</span>
        <div className="cfg-step__body">
          <h4>Elegí un proveedor</h4>
          <div className="cfg-providers">
            <button className="cfg-provider">
              <b>Twilio</b>
              <span>SIP, SMS, grabación. ~$0.013/min en AR.</span>
            </button>
            <button className="cfg-provider is-recommended">
              <b>Aircall</b>
              <span>Click-to-dial + integración nativa. Recomendado.</span>
              <span className="chip chip--accent">Recomendado</span>
            </button>
            <button className="cfg-provider">
              <b>Vonage</b>
              <span>API simple, buena latencia en LATAM.</span>
            </button>
          </div>
        </div>
      </div>

      <div className="cfg-step">
        <span className="cfg-step__n">2</span>
        <div className="cfg-step__body">
          <h4>Credenciales del proveedor</h4>
          <div className="cfg-field">
            <label>Account SID (Twilio) / API Key (Aircall)</label>
            <input className="cfg-input mono" placeholder="ACxxxxxxxx…" />
          </div>
          <div className="cfg-field">
            <label>Auth Token / API Secret</label>
            <input className="cfg-input mono" placeholder="••••••••••" type="password" />
          </div>
          <div className="cfg-field">
            <label>Número de origen</label>
            <input className="cfg-input mono" placeholder="+54 11 5555-0987" />
          </div>
        </div>
      </div>

      <div className="cfg-step">
        <span className="cfg-step__n">3</span>
        <div className="cfg-step__body">
          <h4>Webhook de eventos de llamada</h4>
          <p>Configurá esta URL en tu provider para que las llamadas (entrantes, salientes, grabaciones) se registren en el timeline del trato.</p>
          <div className="cfg-callout">
            <span className="mono cfg-callout__url">https://crm.novit.com/api/webhooks/voice</span>
            <button className="btn"><Icon name="copy" size={11} /> Copiar</button>
          </div>
          <label className="cfg-toggle">
            <input type="checkbox" defaultChecked />
            <span>Transcribir grabaciones automáticamente con IA</span>
          </label>
          <label className="cfg-toggle">
            <input type="checkbox" defaultChecked />
            <span>Generar resumen + next actions al colgar</span>
          </label>
        </div>
      </div>
    </>
  );
}

function EmailSetup() {
  return (
    <>
      <div className="cfg-intro">
        Conectá tu cuenta corporativa (Google Workspace u Office365) o configurá SMTP directo. Los hilos se asocian al trato por <code>thread-id</code> + dominio del cliente.
      </div>

      <div className="cfg-step">
        <span className="cfg-step__n">1</span>
        <div className="cfg-step__body">
          <h4>Cuenta principal de envío</h4>
          <div className="cfg-field">
            <label>From address</label>
            <div className="cfg-input-row">
              <input className="cfg-input mono" defaultValue="ventas@novit.com" />
              <span className="chip chip--success">SPF · DKIM · DMARC ✓</span>
            </div>
          </div>
          <div className="cfg-field">
            <label>Reply-to dinámico (por usuario)</label>
            <input className="cfg-input mono" defaultValue="{{owner_first}}@novit.com" />
          </div>
        </div>
      </div>

      <div className="cfg-step">
        <span className="cfg-step__n">2</span>
        <div className="cfg-step__body">
          <h4>OAuth con Google Workspace</h4>
          <p>Cada AE conecta su Gmail/Workspace personal para que los emails se envíen <i>desde</i> su nombre (mejor deliverability + warm replies). El CRM solo guarda el <code>thread-id</code>.</p>
          <div className="cfg-callout cfg-callout--ok">
            <Icon name="check" size={12} />
            3 usuarios conectados · María Paz, Carlos, Julián
          </div>
        </div>
      </div>

      <div className="cfg-step">
        <span className="cfg-step__n">3</span>
        <div className="cfg-step__body">
          <h4>Tracking</h4>
          <label className="cfg-toggle">
            <input type="checkbox" defaultChecked />
            <span>Pixel de open-tracking (anónimo, sin imágenes externas)</span>
          </label>
          <label className="cfg-toggle">
            <input type="checkbox" defaultChecked />
            <span>Reescribir links para click-tracking</span>
          </label>
          <label className="cfg-toggle">
            <input type="checkbox" />
            <span>BCC automático a {`{{owner}}@crm-archive.novit.com`} (compliance)</span>
          </label>
        </div>
      </div>
    </>
  );
}

window.DealComposer = DealComposer;
window.DealWhatsAppThread = DealWhatsAppThread;
window.ChannelSetupModal = ChannelSetupModal;
