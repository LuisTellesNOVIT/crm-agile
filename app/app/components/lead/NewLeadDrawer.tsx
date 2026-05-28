import { useState } from "react";
import { Icon } from "../shell/Icon";
import { Chip } from "../ui/Chip";
import { useActiveWorkspace, useAppStore } from "../../lib/store";

const STEPS = ["Contacto", "Empresa", "Detalles", "Confirmar"] as const;

type FormState = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  company: string;
  industry: string;
  source: "fb_ads" | "linkedin" | "web" | "referral" | "";
  estimatedValue: string;
  owner: string;
  stage: string;
};

const INITIAL: FormState = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  company: "",
  industry: "",
  source: "",
  estimatedValue: "",
  owner: "",
  stage: "qualified",
};

export function NewLeadDrawer({ onClose }: { onClose: () => void }) {
  const ws = useActiveWorkspace();
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);
  const [form, setForm] = useState<FormState>(INITIAL);
  const update = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }));

  const submit = () => {
    setDone(true);
    // Real impl: dispatch a store action to push a new deal. Stub here.
  };

  const reset = () => {
    setForm(INITIAL);
    setStep(0);
    setDone(false);
  };

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside
        className="ai-drawer"
        style={{ width: "min(520px, 100vw)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="ai-drawer__head">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Icon name="plus" size={14} />
            <span style={{ fontWeight: 600 }}>Nuevo lead</span>
            <Chip tone="accent">{ws.id}</Chip>
          </div>
          <button type="button" className="btn btn--icon" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </header>

        {!done && (
          <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--border-2)" }}>
            <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
              {STEPS.map((label, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 11,
                      background: i <= step ? "var(--accent)" : "var(--bg-3)",
                      color: i <= step ? "var(--accent-fg)" : "var(--fg-3)",
                      display: "grid",
                      placeItems: "center",
                      fontSize: 10,
                      fontWeight: 600,
                      flex: "0 0 auto",
                    }}
                  >
                    {i + 1}
                  </div>
                  <div style={{ marginLeft: 8, fontSize: "var(--fs-xs)", color: i === step ? "var(--fg)" : "var(--fg-3)", flex: 1, minWidth: 0 }}>
                    {label}
                  </div>
                  {i < STEPS.length - 1 && (
                    <div style={{ height: 1, flex: 1, background: "var(--border-2)" }} />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="ai-drawer__msgs" style={{ gap: 12 }}>
          {done ? (
            <Success form={form} onAnother={reset} onClose={onClose} />
          ) : (
            <>
              {step === 0 && <Step1 form={form} update={update} />}
              {step === 1 && <Step2 form={form} update={update} />}
              {step === 2 && <Step3 form={form} update={update} owners={Object.entries(ws.owners)} />}
              {step === 3 && <Step4 form={form} stages={ws.stages} />}
            </>
          )}
        </div>

        {!done && (
          <footer className="ai-drawer__input" style={{ justifyContent: "space-between", alignItems: "center" }}>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step === 0}
            >
              Atrás
            </button>
            {step < STEPS.length - 1 ? (
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => setStep((s) => s + 1)}
                disabled={
                  (step === 0 && (!form.firstName || !form.email)) ||
                  (step === 1 && !form.company) ||
                  (step === 2 && !form.owner)
                }
              >
                Siguiente
              </button>
            ) : (
              <button type="button" className="btn btn--primary" onClick={submit}>
                Crear lead
              </button>
            )}
          </footer>
        )}
      </aside>
    </div>
  );
}

function Field({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <label style={{ display: "grid", gap: 4, fontSize: "var(--fs-sm)" }}>
      <span style={{ color: "var(--fg-2)" }}>
        {label} {required && <span style={{ color: "var(--danger)" }}>*</span>}
      </span>
      {children}
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-sm)",
  fontSize: "var(--fs-sm)",
  fontFamily: "var(--font-sans)",
  background: "var(--bg)",
  color: "var(--fg)",
};

function Step1({ form, update }: { form: FormState; update: (p: Partial<FormState>) => void }) {
  return (
    <div style={{ display: "grid", gap: 10 }}>
      <Field label="Nombre" required>
        <input style={inputStyle} value={form.firstName} onChange={(e) => update({ firstName: e.target.value })} />
      </Field>
      <Field label="Apellido">
        <input style={inputStyle} value={form.lastName} onChange={(e) => update({ lastName: e.target.value })} />
      </Field>
      <Field label="Email" required>
        <input type="email" style={inputStyle} value={form.email} onChange={(e) => update({ email: e.target.value })} />
      </Field>
      <Field label="WhatsApp">
        <input style={inputStyle} value={form.phone} onChange={(e) => update({ phone: e.target.value })} placeholder="+54 911..." />
      </Field>
    </div>
  );
}

function Step2({ form, update }: { form: FormState; update: (p: Partial<FormState>) => void }) {
  return (
    <div style={{ display: "grid", gap: 10 }}>
      <Field label="Empresa" required>
        <input style={inputStyle} value={form.company} onChange={(e) => update({ company: e.target.value })} />
      </Field>
      <Field label="Industria">
        <input style={inputStyle} value={form.industry} onChange={(e) => update({ industry: e.target.value })} placeholder="Tech, Retail, Finance…" />
      </Field>
      <Field label="Source" required>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {(["fb_ads", "linkedin", "web", "referral"] as const).map((s) => (
            <button
              key={s}
              type="button"
              className={`btn ${form.source === s ? "btn--accent" : ""}`.trim()}
              onClick={() => update({ source: s })}
            >
              {s === "fb_ads" ? "FB Ads" : s === "linkedin" ? "LinkedIn" : s === "web" ? "Web" : "Referido"}
            </button>
          ))}
        </div>
      </Field>
    </div>
  );
}

function Step3({
  form,
  update,
  owners,
}: {
  form: FormState;
  update: (p: Partial<FormState>) => void;
  owners: [string, { name: string; role: string; color: string }][];
}) {
  return (
    <div style={{ display: "grid", gap: 10 }}>
      <Field label="Valor estimado (USD)">
        <input type="number" style={inputStyle} value={form.estimatedValue} onChange={(e) => update({ estimatedValue: e.target.value })} placeholder="0" />
      </Field>
      <Field label="Owner" required>
        <div style={{ display: "grid", gap: 4 }}>
          {owners.map(([key, o]) => (
            <button
              key={key}
              type="button"
              onClick={() => update({ owner: key })}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 10px",
                border: form.owner === key ? "1px solid var(--accent)" : "1px solid var(--border)",
                background: form.owner === key ? "var(--accent-soft)" : "var(--bg)",
                borderRadius: "var(--radius-sm)",
                fontSize: "var(--fs-sm)",
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <span style={{ width: 22, height: 22, borderRadius: 11, background: o.color, color: "#fff", display: "inline-grid", placeItems: "center", fontSize: 9, fontFamily: "var(--font-mono)", fontWeight: 600 }}>
                {key}
              </span>
              <span>{o.name}</span>
              <span style={{ marginLeft: "auto", color: "var(--fg-3)", fontSize: "var(--fs-xs)" }}>{o.role}</span>
            </button>
          ))}
        </div>
      </Field>
    </div>
  );
}

function Step4({ form, stages }: { form: FormState; stages: { id: string; label: string }[] }) {
  const Row = ({ k, v }: { k: string; v: React.ReactNode }) => (
    <div className="form-row">
      <div className="form-row__k">{k}</div>
      <div className="form-row__v">{v}</div>
    </div>
  );
  return (
    <div>
      <p style={{ fontSize: "var(--fs-sm)", color: "var(--fg-3)", marginBottom: 10 }}>Revisá los datos:</p>
      <div style={{ background: "var(--bg-2)", borderRadius: "var(--radius)", padding: 12 }}>
        <Row k="Nombre" v={`${form.firstName} ${form.lastName}`.trim()} />
        <Row k="Email" v={<span className="mono">{form.email}</span>} />
        <Row k="WhatsApp" v={<span className="mono">{form.phone || "—"}</span>} />
        <Row k="Empresa" v={form.company} />
        <Row k="Industria" v={form.industry || "—"} />
        <Row k="Source" v={<Chip tone="accent">{form.source}</Chip>} />
        <Row k="Valor estimado" v={<span className="mono">${form.estimatedValue || "0"}</span>} />
        <Row k="Owner" v={form.owner} />
        <Row k="Stage inicial" v={stages.find((s) => s.id === form.stage)?.label} />
      </div>
    </div>
  );
}

function Success({
  form,
  onAnother,
  onClose,
}: {
  form: FormState;
  onAnother: () => void;
  onClose: () => void;
}) {
  return (
    <div style={{ textAlign: "center", padding: "30px 20px" }}>
      <div style={{ width: 56, height: 56, borderRadius: 28, background: "var(--success-soft)", color: "var(--success)", display: "grid", placeItems: "center", margin: "0 auto 14px", fontSize: 28 }}>
        ✓
      </div>
      <h2 style={{ fontSize: "var(--fs-lg)", fontWeight: 600, marginBottom: 6 }}>Lead creado</h2>
      <p style={{ color: "var(--fg-3)", fontSize: "var(--fs-sm)", marginBottom: 20 }}>
        {form.firstName} {form.lastName} ({form.company}) fue agregado al pipeline.
      </p>
      <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
        <button type="button" className="btn" onClick={onAnother}>
          Crear otro
        </button>
        <button type="button" className="btn btn--primary" onClick={onClose}>
          Cerrar
        </button>
      </div>
    </div>
  );
}
