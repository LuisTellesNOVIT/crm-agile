// New Lead drawer — slide-in form, mirrors Lead/Deal Prisma fields.
function NewLeadDrawer({ open, onClose, workspace, ws, onCreated }) {
  const [step, setStep] = useState(0);
  const [created, setCreated] = useState(false);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    company: "",
    email: "",
    whatsapp: "",
    role: "",
    source: "WEB",
    utmCampaign: "",
    dealName: "",
    dealValue: "",
    stage: "discovery",
    estimatedCloseAt: "",
    isRecurring: false,
    arr: "",
    owner: Object.keys(ws.owners)[0]
  });

  useEffect(() => {
    if (open) {
      setStep(0);
      setCreated(false);
      // Pre-fill close date 60d from today
      const close = addDays(ws.today, 60).toISOString().slice(0, 10);
      setForm(f => ({ ...f, estimatedCloseAt: close, owner: Object.keys(ws.owners)[0] }));
    }
  }, [open, workspace]);

  if (!open) return null;

  const update = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const canNext = () => {
    if (step === 0) return form.firstName && form.lastName && form.company;
    if (step === 1) return form.email || form.whatsapp;
    if (step === 2) return form.dealName && form.dealValue;
    return true;
  };

  const submit = () => {
    onCreated?.(form);
    setCreated(true);
  };

  const steps = ["Contacto", "Canal", "Trato", "Revisar"];

  return (
    <div className="ai-drawer" data-screen-label="Nuevo Lead">
      <div className="ai-drawer__h">
        <h3>
          <Icon name="plus" size={16} style={{ color: "var(--accent)" }} />
          Nuevo lead
          <span className="badge" style={{ background: "var(--bg-3)", color: "var(--fg-3)" }}>
            {workspace.toUpperCase()}
          </span>
        </h3>
        <div className="actions">
          <button className="btn btn--ghost btn--icon" onClick={onClose}><Icon name="x" size={14} /></button>
        </div>
      </div>

      {/* Stepper */}
      <div style={{ display: "flex", padding: "10px 16px", gap: 4, borderBottom: "1px solid var(--border-2)", flexShrink: 0 }}>
        {steps.map((label, i) => (
          <div key={label} style={{ flex: 1, display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{
              width: 18, height: 18, borderRadius: "50%",
              background: i <= step ? "var(--accent)" : "var(--bg-3)",
              color: i <= step ? "#fff" : "var(--fg-3)",
              display: "grid", placeItems: "center",
              fontFamily: "var(--font-mono)", fontSize: 10,
              border: i === step ? "2px solid var(--accent-border)" : "none",
              flexShrink: 0
            }}>
              {i < step ? <Icon name="check" size={10} /> : (i + 1)}
            </div>
            <span style={{ fontSize: 11, color: i === step ? "var(--fg)" : "var(--fg-3)", fontWeight: i === step ? 600 : 400 }}>{label}</span>
            {i < steps.length - 1 && <div style={{ flex: 1, height: 1, background: i < step ? "var(--accent)" : "var(--border)", marginLeft: 4 }} />}
          </div>
        ))}
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: 16 }}>
        {created ? (
          <SuccessState form={form} onClose={onClose} onAnother={() => { setCreated(false); setStep(0); setForm(f => ({ ...f, firstName: "", lastName: "", email: "", dealName: "", dealValue: "" })); }} />
        ) : (
          <>
            {step === 0 && <Step1 form={form} update={update} />}
            {step === 1 && <Step2 form={form} update={update} />}
            {step === 2 && <Step3 form={form} update={update} ws={ws} />}
            {step === 3 && <Step4 form={form} ws={ws} />}
          </>
        )}
      </div>

      {!created && (
        <div style={{ display: "flex", gap: 8, padding: "12px 16px", borderTop: "1px solid var(--border)", flexShrink: 0, background: "var(--bg-2)" }}>
          <button className="btn" onClick={onClose}>Cancelar</button>
          {step > 0 && <button className="btn" onClick={() => setStep(s => s - 1)}>Atrás</button>}
          <div style={{ flex: 1 }} />
          {step < 3 ? (
            <button className="btn btn--accent" onClick={() => canNext() && setStep(s => s + 1)} disabled={!canNext()}>
              Continuar <Icon name="arrow-right" size={12} />
            </button>
          ) : (
            <button className="btn btn--accent" onClick={submit}>
              <Icon name="check" size={12} /> Crear lead + trato
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function Field({ label, hint, required, children }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{
        display: "block",
        fontSize: 10, fontFamily: "var(--font-mono)",
        textTransform: "uppercase", letterSpacing: "0.06em",
        color: "var(--fg-3)", marginBottom: 4
      }}>
        {label} {required && <span style={{ color: "var(--danger)" }}>*</span>}
      </label>
      {children}
      {hint && <div style={{ fontSize: 11, color: "var(--fg-3)", marginTop: 3 }}>{hint}</div>}
    </div>
  );
}

const inputStyle = {
  width: "100%",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  padding: "7px 10px",
  fontSize: "var(--fs-sm)",
  fontFamily: "inherit",
  background: "var(--bg)",
  outline: "none"
};
const monoInputStyle = { ...inputStyle, fontFamily: "var(--font-mono)" };

function Step1({ form, update }) {
  return (
    <>
      <SectionTitle>Datos del contacto</SectionTitle>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <Field label="Nombre" required>
          <input style={inputStyle} value={form.firstName} onChange={e => update("firstName", e.target.value)} placeholder="Lucía" autoFocus />
        </Field>
        <Field label="Apellido" required>
          <input style={inputStyle} value={form.lastName} onChange={e => update("lastName", e.target.value)} placeholder="Mendoza" />
        </Field>
      </div>
      <Field label="Empresa" required>
        <input style={inputStyle} value={form.company} onChange={e => update("company", e.target.value)} placeholder="Mercado Libre" />
      </Field>
      <Field label="Cargo" hint="Opcional — pero recomendado para personalizar el outreach">
        <input style={inputStyle} value={form.role} onChange={e => update("role", e.target.value)} placeholder="VP Data Platform" />
      </Field>
    </>
  );
}

function Step2({ form, update }) {
  const sources = [
    { id: "WEB", l: "Web form" },
    { id: "FB_ADS", l: "FB Ads" },
    { id: "LINKEDIN", l: "LinkedIn" },
    { id: "REFERRAL", l: "Referral" },
    { id: "WHATSAPP", l: "WhatsApp inbound" },
    { id: "COLD_OUTREACH", l: "Cold outreach" }
  ];
  return (
    <>
      <SectionTitle>Canales de contacto</SectionTitle>
      <Field label="Email" hint="Email corporativo del prospecto">
        <input style={monoInputStyle} type="email" value={form.email} onChange={e => update("email", e.target.value)} placeholder="lucia@mercadolibre.com" />
      </Field>
      <Field label="WhatsApp" hint="Formato E.164 — disparará la integración WhatsApp Business">
        <input style={monoInputStyle} value={form.whatsapp} onChange={e => update("whatsapp", e.target.value)} placeholder="+54 9 11 5555-1234" />
      </Field>

      <SectionTitle style={{ marginTop: 16 }}>Origen del lead</SectionTitle>
      <Field label="Source" required>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
          {sources.map(s => (
            <button key={s.id} type="button"
              onClick={() => update("source", s.id)}
              className="btn"
              style={form.source === s.id
                ? { background: "var(--accent)", color: "#fff", borderColor: "var(--accent)" }
                : null}>
              {s.l}
            </button>
          ))}
        </div>
      </Field>
      <Field label="UTM Campaign" hint="Si viene de paid media">
        <input style={monoInputStyle} value={form.utmCampaign} onChange={e => update("utmCampaign", e.target.value)} placeholder="2026_q2_data_platform" />
      </Field>
    </>
  );
}

function Step3({ form, update, ws }) {
  const stages = window.CRM_DATA.stages.filter(s => s.id !== "won" && s.id !== "lost");
  return (
    <>
      <SectionTitle>Trato vinculado</SectionTitle>
      <Field label="Nombre del trato" required>
        <input style={inputStyle} value={form.dealName} onChange={e => update("dealName", e.target.value)} placeholder="Data Lake + Snowflake" />
      </Field>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <Field label="Valor (USD)" required>
          <input style={monoInputStyle} type="number" value={form.dealValue} onChange={e => update("dealValue", e.target.value)} placeholder="125000" />
        </Field>
        <Field label="Fecha estimada de cierre" required>
          <input style={monoInputStyle} type="date" value={form.estimatedCloseAt} onChange={e => update("estimatedCloseAt", e.target.value)} />
        </Field>
      </div>
      <Field label="Etapa inicial">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
          {stages.map(s => (
            <button key={s.id} type="button"
              onClick={() => update("stage", s.id)}
              className="btn"
              style={form.stage === s.id
                ? { background: s.color, color: "#fff", borderColor: s.color }
                : null}>
              {s.label}
            </button>
          ))}
        </div>
      </Field>
      <Field label="Owner" hint="Quién es responsable">
        <select style={inputStyle} value={form.owner} onChange={e => update("owner", e.target.value)}>
          {Object.entries(ws.owners).map(([k, o]) => (
            <option key={k} value={k}>{o.name} — {o.role}</option>
          ))}
        </select>
      </Field>

      <div style={{
        background: "var(--bg-2)", border: "1px solid var(--border-2)",
        borderRadius: "var(--radius)", padding: 12, marginTop: 4
      }}>
        <label style={{ display: "flex", gap: 8, alignItems: "flex-start", cursor: "pointer" }}>
          <input type="checkbox" checked={form.isRecurring} onChange={e => update("isRecurring", e.target.checked)} style={{ marginTop: 2 }} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 500 }}>Es recurrente (SaaS)</div>
            <div style={{ fontSize: 11, color: "var(--fg-3)" }}>Habilita ARR/MRR y suma al forecast de SaaS</div>
          </div>
        </label>
        {form.isRecurring && (
          <Field label="ARR anual (USD)">
            <input style={monoInputStyle} type="number" value={form.arr} onChange={e => update("arr", e.target.value)} placeholder={form.dealValue} />
          </Field>
        )}
      </div>
    </>
  );
}

function Step4({ form, ws }) {
  const stage = window.CRM_DATA.stages.find(s => s.id === form.stage);
  const fullName = `${form.firstName} ${form.lastName}`.trim();
  const ai = Math.floor(35 + Math.random() * 35);
  return (
    <>
      <div style={{
        padding: 14,
        background: "linear-gradient(135deg, var(--bg) 0%, var(--accent-soft) 100%)",
        border: "1px solid var(--accent-border)",
        borderRadius: "var(--radius)",
        marginBottom: 14
      }}>
        <div style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
          <Icon name="sparkles" size={11} style={{ verticalAlign: "middle", marginRight: 4 }} />
          AI predicción inicial
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginTop: 6 }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 28, fontWeight: 500 }}>{ai}%</span>
          <span style={{ fontSize: 12, color: "var(--fg-3)" }}>de probabilidad de cierre</span>
        </div>
        <div style={{ fontSize: 12, color: "var(--fg-2)", marginTop: 4 }}>
          Basado en source ({form.source}), tamaño del trato y vertical.
        </div>
      </div>

      <SectionTitle>Resumen</SectionTitle>
      <ReviewRow k="Lead" v={fullName} />
      <ReviewRow k="Empresa" v={form.company} />
      <ReviewRow k="Cargo" v={form.role || "—"} />
      <ReviewRow k="Email" v={form.email || "—"} />
      <ReviewRow k="WhatsApp" v={form.whatsapp || "—"} />
      <ReviewRow k="Source" v={form.source} />
      <ReviewRow k="UTM" v={form.utmCampaign || "—"} />

      <SectionTitle style={{ marginTop: 14 }}>Trato</SectionTitle>
      <ReviewRow k="Nombre" v={form.dealName} />
      <ReviewRow k="Valor" v={fmtMoney(Number(form.dealValue || 0))} />
      <ReviewRow k="Etapa" v={<span className="chip" style={{ background: stage.color + "22", color: stage.color, border: `1px solid ${stage.color}55` }}>{stage.label}</span>} />
      <ReviewRow k="Cierre est." v={form.estimatedCloseAt} />
      <ReviewRow k="Owner" v={ws.owners[form.owner]?.name || "—"} />
      <ReviewRow k="SaaS recurrente" v={form.isRecurring ? `Sí · ${fmtMoney(Number(form.arr || form.dealValue))}/año` : "No"} />

      <div style={{ marginTop: 14, padding: 10, background: "var(--bg-2)", border: "1px solid var(--border-2)", borderRadius: "var(--radius)", fontSize: 11, color: "var(--fg-2)", display: "flex", gap: 8 }}>
        <Icon name="zap" size={13} style={{ color: "var(--accent)", flexShrink: 0, marginTop: 1 }} />
        <div>
          <b>Automatización activa:</b> al crear, se disparará la secuencia "Lead inbound — onboarding 7 días" que enviará un primer WhatsApp en segundos y agendará un follow-up para dentro de 48hs.
        </div>
      </div>
    </>
  );
}

function SuccessState({ form, onClose, onAnother }) {
  return (
    <div style={{ textAlign: "center", padding: "30px 14px" }}>
      <div style={{
        width: 56, height: 56,
        borderRadius: "50%",
        background: "var(--success-soft)",
        color: "var(--success)",
        margin: "0 auto",
        display: "grid", placeItems: "center"
      }}>
        <Icon name="check" size={28} />
      </div>
      <h3 style={{ marginTop: 14, marginBottom: 4, fontWeight: 600, letterSpacing: "-0.01em" }}>
        Lead creado
      </h3>
      <div style={{ fontSize: 13, color: "var(--fg-3)" }}>
        {form.firstName} {form.lastName} · {form.company}<br />
        Trato <b style={{ color: "var(--fg-2)" }}>{form.dealName}</b> · {fmtMoney(Number(form.dealValue || 0))}
      </div>
      <div style={{ display: "grid", gap: 6, maxWidth: 280, margin: "20px auto 0", textAlign: "left", fontSize: 12, color: "var(--fg-2)" }}>
        <Bulleted text="WhatsApp de bienvenida enviado" done />
        <Bulleted text="Secuencia 7-días activada" done />
        <Bulleted text="AI Score calculado" done />
        <Bulleted text="Tarea de follow-up agendada para +48h" done />
      </div>
      <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 22 }}>
        <button className="btn" onClick={onAnother}>Crear otro</button>
        <button className="btn btn--accent" onClick={onClose}>Ver en Pipeline</button>
      </div>
    </div>
  );
}

function Bulleted({ text, done }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span className="dot" style={{ background: done ? "var(--success)" : "var(--fg-4)", width: 6, height: 6 }} />
      {text}
    </div>
  );
}

function SectionTitle({ children, style }) {
  return <div style={{
    fontSize: 10, fontFamily: "var(--font-mono)",
    textTransform: "uppercase", letterSpacing: "0.08em",
    color: "var(--fg-3)", marginBottom: 8, ...style
  }}>{children}</div>;
}

function ReviewRow({ k, v }) {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "100px 1fr",
      gap: 8,
      padding: "5px 0",
      borderBottom: "1px solid var(--border-2)",
      fontSize: 12
    }}>
      <span style={{ color: "var(--fg-3)" }}>{k}</span>
      <span style={{ fontFamily: "var(--font-mono)" }}>{v}</span>
    </div>
  );
}

window.NewLeadDrawer = NewLeadDrawer;
