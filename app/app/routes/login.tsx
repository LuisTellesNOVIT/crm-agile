import { useEffect } from "react";
import {
  Form,
  redirect,
  useActionData,
  useNavigation,
  useSearchParams,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "react-router";
import bcrypt from "bcryptjs";
import { commitSession, getCurrentUser, getSession } from "../lib/session.server";
import { prisma } from "../lib/db.server";
import {
  Annotations,
  BrandMark,
  HelixCanvas,
  SequenceTicker,
} from "../components/auth/AuthStage";

/**
 * /login — Acceso al CRM AGILE.
 *
 * Diseño: lienzo único full-viewport con doble hélice + card flotante
 * a la derecha (translúcida, brackets brutalistas, hilo conector cyan→green).
 * Portado del prototipo agile-crm-login.html / PROMPT.md / SPEC.md.
 *
 * Auth: bcrypt + cookie session (sin cambios — el action sigue siendo
 * el mismo que antes, solo cambió la presentación).
 */
export async function loader({ request }: LoaderFunctionArgs) {
  const user = await getCurrentUser(request);
  if (user) throw redirect("/");
  return null;
}

export async function action({ request }: ActionFunctionArgs) {
  const fd = await request.formData();
  const email = String(fd.get("email") ?? "").toLowerCase().trim();
  const password = String(fd.get("password") ?? "");
  const next = String(fd.get("next") ?? "/");

  if (!email || !password) {
    return Response.json({ error: "Ingresá email y contraseña." }, { status: 400 });
  }

  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true, passwordHash: true },
  });

  if (!user || !user.passwordHash) {
    return Response.json({ error: "Credenciales inválidas." }, { status: 401 });
  }
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    return Response.json({ error: "Credenciales inválidas." }, { status: 401 });
  }

  const session = await getSession(request);
  session.set("userId", user.id);
  return redirect(next || "/", {
    headers: { "Set-Cookie": await commitSession(session) },
  });
}

export default function LoginRoute() {
  const data = useActionData<{ error?: string }>();
  const nav = useNavigation();
  const [search] = useSearchParams();
  const next = search.get("next") ?? "/";
  const submitting = nav.state === "submitting";

  // Agregamos la clase auth-stage al body para que los tokens OKLch del
  // login no afecten al resto del CRM (el body normal tiene otros tokens).
  useEffect(() => {
    const body = document.body;
    body.classList.add("auth-stage");
    return () => body.classList.remove("auth-stage");
  }, []);

  return (
    <main className="auth-stage-root">
      <HelixCanvas />
      <BrandMark />
      <Annotations />
      <SequenceTicker />

      <div className="auth-headline">
        <div className="auth-kicker">
          <span className="bar" /> Acceso seguro · CRM AGILE Workspace
        </div>
        <h1 className="auth-headline-title">
          Tu pipeline ahora<br />se <em>secuencia</em>.
        </h1>
        <p className="auth-lede">
          CRM AGILE lee tu pipeline como una hebra de ADN: cada lead, cada
          interacción, cada cierre — codificado, ordenado y predecible.
        </p>
      </div>

      {/* Hilo conector horizontal helix → card */}
      <div className="auth-connector" aria-hidden="true">
        <span className="auth-connector-dot" />
      </div>

      {/* Card flotante translúcida con brackets brutalistas */}
      <aside className="auth-card">
        <span className="auth-bracket auth-bracket--tl" aria-hidden="true" />
        <span className="auth-bracket auth-bracket--tr" aria-hidden="true" />
        <span className="auth-bracket auth-bracket--bl" aria-hidden="true" />
        <span className="auth-bracket auth-bracket--br" aria-hidden="true" />

        <div className="auth-eyebrow">
          <span className="left">
            <span className="dot" /> ACCESO · CRM AGILE
          </span>
          <span className="right">04.2 / 2026</span>
        </div>

        <h2 className="auth-title">Reanuda la secuencia.</h2>
        <p className="auth-sub">
          Inicia sesión en tu workspace AGILE para retomar tu pipeline activo.
        </p>

        <Form method="POST" className="auth-form" noValidate>
          <input type="hidden" name="next" value={next} />

          <label className="auth-field">
            <span className="auth-field-label">Correo corporativo</span>
            <div className="input-wrap">
              <input
                type="email"
                name="email"
                autoComplete="email"
                required
                autoFocus
                placeholder="tu@empresa.com"
                aria-invalid={data?.error ? "true" : "false"}
              />
            </div>
          </label>

          <label className="auth-field">
            <span className="auth-field-label">Contraseña</span>
            <div className="input-wrap">
              <input
                type="password"
                name="password"
                autoComplete="current-password"
                required
                minLength={8}
                placeholder="••••••••"
                aria-invalid={data?.error ? "true" : "false"}
              />
            </div>
          </label>

          {data?.error && (
            <div className="auth-form-error" role="alert">
              {data.error}
            </div>
          )}

          <button type="submit" className="auth-primary" disabled={submitting}>
            <span className="label">
              {submitting ? "Secuenciando…" : "Descifrar acceso"}
            </span>
            <span className="arrow">{submitting ? "∿" : "→"}</span>
          </button>
        </Form>

        <div className="auth-card-foot">
          <div className="status-pill">
            <span className="dot" /> Sistema operacional
          </div>
          <div>v0.4.2 · build 26.05</div>
        </div>
      </aside>

      <style>{`
        /* ============================================================
           Tokens OKLch — scoped a body.auth-stage para no afectar al
           resto del CRM AGILE (que usa otros tokens en app.css).
           ============================================================ */
        body.auth-stage {
          --auth-bg:           oklch(98% 0.004 250);
          --auth-bg-2:         oklch(99% 0.003 250);
          --auth-surface:      oklch(100% 0 0);
          --auth-surface-2:    oklch(96% 0.006 250);
          --auth-fg:           oklch(20% 0.025 250);
          --auth-muted:        oklch(46% 0.020 250);
          --auth-muted-2:      oklch(62% 0.018 250);
          --auth-border:       oklch(90% 0.008 250);
          --auth-border-strong: oklch(80% 0.012 250);
          --auth-accent:       oklch(58% 0.18 215);
          --auth-accent-2:     oklch(55% 0.18 155);
          --auth-accent-3:     oklch(62% 0.20 25);
          --auth-accent-4:     oklch(70% 0.16 75);
          --auth-danger:       oklch(58% 0.22 25);
          --auth-n-a: oklch(58% 0.18 215);
          --auth-n-t: oklch(62% 0.20 15);
          --auth-n-g: oklch(55% 0.18 155);
          --auth-n-c: oklch(70% 0.17 80);
          --auth-font-display: "Geist", -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
          --auth-font-body: -apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif;
          --auth-font-mono: "Geist Mono", "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace;

          background: var(--auth-bg) !important;
          color: var(--auth-fg);
          font-family: var(--auth-font-body);
          overflow: hidden;
        }
        body.auth-stage::before {
          content: "";
          position: fixed;
          inset: 0;
          background-image:
            linear-gradient(to right, oklch(80% 0.012 250 / .35) 1px, transparent 1px),
            linear-gradient(to bottom, oklch(80% 0.012 250 / .35) 1px, transparent 1px);
          background-size: 80px 80px;
          mask-image: radial-gradient(ellipse at center, rgba(0,0,0,.55) 0%, transparent 78%);
          -webkit-mask-image: radial-gradient(ellipse at center, rgba(0,0,0,.55) 0%, transparent 78%);
          pointer-events: none;
          z-index: 0;
        }

        /* ============================================================
           Stage (lienzo único full-viewport)
           ============================================================ */
        .auth-stage-root {
          position: relative;
          height: 100vh;
          width: 100%;
          overflow: hidden;
          background:
            radial-gradient(ellipse at 30% 50%, oklch(88% 0.10 215 / .35), transparent 60%),
            radial-gradient(ellipse at 70% 30%, oklch(90% 0.10 155 / .28), transparent 65%),
            var(--auth-bg);
          z-index: 1;
        }

        /* ============================================================
           BrandMark (top-left)
           ============================================================ */
        .auth-brand-mark { position: absolute; top: 36px; left: 44px; z-index: 4; }
        .auth-brand-name { display: inline-flex; flex-direction: column; gap: 6px; }
        .auth-brand-letters {
          font-family: var(--auth-font-display);
          font-weight: 700;
          font-size: 38px;
          letter-spacing: -0.035em;
          line-height: 1;
          color: var(--auth-fg);
          display: inline-flex;
          align-items: flex-end;
          gap: 1px;
          user-select: none;
        }
        .auth-al {
          position: relative;
          display: inline-block;
          padding-bottom: 16px;
          transition: transform .35s ease, color .35s ease;
        }
        .auth-al::after {
          content: "";
          position: absolute;
          left: 50%;
          bottom: 6px;
          transform: translateX(-50%);
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: var(--c);
          box-shadow: 0 0 8px var(--c), 0 0 1px var(--c);
          animation: authNucPulse 2.4s ease-in-out infinite;
          animation-delay: var(--d, 0s);
        }
        .auth-al:hover { color: var(--c); transform: translateY(-1px); }
        .auth-al-sep {
          color: var(--auth-muted-2);
          font-weight: 300;
          padding: 0 8px 16px;
          align-self: flex-end;
        }
        @keyframes authNucPulse {
          0%, 100% { transform: translateX(-50%) scale(1); opacity: .85; }
          50%      { transform: translateX(-50%) scale(1.35); opacity: 1; }
        }
        .auth-brand-meta {
          font-family: var(--auth-font-mono);
          font-size: 10.5px;
          letter-spacing: 0.22em;
          text-transform: uppercase;
          color: var(--auth-muted-2);
          margin-top: 6px;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .auth-brand-meta::before {
          content: "";
          width: 18px;
          height: 1px;
          background: var(--auth-border-strong);
        }

        /* ============================================================
           Annotations
           ============================================================ */
        .auth-annot {
          position: absolute;
          font-family: var(--auth-font-mono);
          font-size: 10.5px;
          color: var(--auth-muted-2);
          letter-spacing: 0.16em;
          text-transform: uppercase;
          pointer-events: none;
          z-index: 3;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .auth-annot::before {
          content: "";
          display: inline-block;
          width: 30px;
          height: 1px;
          background: var(--auth-border-strong);
        }
        .auth-annot--left::before { display: none; }
        .auth-annot--left::after {
          content: "";
          display: inline-block;
          width: 30px;
          height: 1px;
          background: var(--auth-border-strong);
        }
        .auth-annot .v { color: var(--auth-accent); }
        .auth-annot-1 { top: 22%;   right: 52px; }
        .auth-annot-2 { top: 58%;   right: 76px; }
        .auth-annot-3 { bottom: 28%; right: 38px; }
        .auth-annot-4 { top: 30%;   left: 44px; }

        /* ============================================================
           Headline (sobre la hélice, mitad inferior izquierda)
           ============================================================ */
        .auth-headline {
          position: absolute;
          bottom: 92px;
          left: 44px;
          max-width: 540px;
          z-index: 4;
          pointer-events: none;
        }
        .auth-kicker {
          font-family: var(--auth-font-mono);
          font-size: 11px;
          color: var(--auth-accent);
          letter-spacing: 0.22em;
          text-transform: uppercase;
          margin-bottom: 22px;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .auth-kicker .bar {
          display: inline-block;
          width: 28px;
          height: 1px;
          background: var(--auth-accent);
        }
        .auth-headline-title {
          font-family: var(--auth-font-display);
          font-weight: 500;
          font-size: clamp(34px, 3.6vw, 52px);
          line-height: 1.02;
          letter-spacing: -0.035em;
          color: var(--auth-fg);
          margin-bottom: 20px;
        }
        .auth-headline-title em {
          font-style: normal;
          background: linear-gradient(96deg, var(--auth-accent) 10%, var(--auth-accent-2) 90%);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
        }
        .auth-lede {
          max-width: 460px;
          color: var(--auth-muted);
          font-size: 14.5px;
          line-height: 1.55;
        }

        /* ============================================================
           Hilo conector horizontal helix → card
           ============================================================ */
        .auth-connector {
          position: absolute;
          top: 50%;
          left: 38%;
          width: calc(62% - 540px);
          height: 1px;
          background: linear-gradient(
            90deg,
            transparent 0%,
            oklch(58% 0.18 215 / .35) 30%,
            oklch(55% 0.18 155 / .55) 80%,
            oklch(55% 0.18 155 / .8) 100%
          );
          z-index: 4;
          pointer-events: none;
        }
        .auth-connector-dot {
          position: absolute;
          right: -3px;
          top: 50%;
          transform: translateY(-50%);
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: var(--auth-accent-2);
          box-shadow: 0 0 8px var(--auth-accent-2), 0 0 18px oklch(55% 0.18 155 / .35);
          animation: authConnectorPulse 2.2s ease-in-out infinite;
        }
        @keyframes authConnectorPulse {
          0%, 100% { transform: translateY(-50%) scale(1); opacity: 0.85; }
          50%      { transform: translateY(-50%) scale(1.35); opacity: 1; }
        }

        /* ============================================================
           Card flotante translúcida
           ============================================================ */
        .auth-card {
          position: absolute;
          top: 50%;
          right: 60px;
          transform: translateY(-50%);
          width: 440px;
          max-width: calc(100vw - 80px);
          padding: 44px 40px 36px;
          background: oklch(100% 0 0 / .60);
          border: 1px solid oklch(80% 0.012 250 / .55);
          border-radius: 4px;
          backdrop-filter: blur(18px) saturate(1.1);
          -webkit-backdrop-filter: blur(18px) saturate(1.1);
          box-shadow:
            0 24px 60px oklch(40% 0.02 250 / .12),
            0 0 0 1px oklch(100% 0 0 / .5) inset;
          z-index: 5;
        }

        /* Brackets brutalistas en cada esquina */
        .auth-bracket {
          position: absolute;
          width: 14px;
          height: 14px;
          border-color: var(--auth-accent);
          border-style: solid;
          pointer-events: none;
        }
        .auth-bracket--tl { top: -1px; left: -1px;   border-width: 1.5px 0 0 1.5px; }
        .auth-bracket--tr { top: -1px; right: -1px;  border-width: 1.5px 1.5px 0 0; }
        .auth-bracket--bl { bottom: -1px; left: -1px; border-width: 0 0 1.5px 1.5px; }
        .auth-bracket--br { bottom: -1px; right: -1px; border-width: 0 1.5px 1.5px 0; }

        .auth-eyebrow {
          font-family: var(--auth-font-mono);
          font-size: 11px;
          letter-spacing: 0.24em;
          text-transform: uppercase;
          color: var(--auth-muted-2);
          margin-bottom: 24px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .auth-eyebrow .left { display: flex; align-items: center; gap: 10px; }
        .auth-eyebrow .left .dot {
          width: 7px;
          height: 7px;
          background: var(--auth-accent-2);
          border-radius: 50%;
          box-shadow: 0 0 8px var(--auth-accent-2);
          animation: authBlink 1.8s ease-in-out infinite;
        }
        @keyframes authBlink {
          0%, 100% { opacity: 1; } 50% { opacity: 0.35; }
        }

        .auth-title {
          font-family: var(--auth-font-display);
          font-weight: 500;
          font-size: 28px;
          line-height: 1.1;
          letter-spacing: -0.025em;
          margin-bottom: 8px;
          color: var(--auth-fg);
        }
        .auth-sub {
          color: var(--auth-muted);
          font-size: 13.5px;
          line-height: 1.5;
          margin-bottom: 24px;
        }

        /* ============================================================
           Form
           ============================================================ */
        .auth-form { display: flex; flex-direction: column; gap: 16px; }
        .auth-field { display: flex; flex-direction: column; gap: 8px; }
        .auth-field-label {
          font-family: var(--auth-font-mono);
          font-size: 10.5px;
          letter-spacing: 0.22em;
          text-transform: uppercase;
          color: var(--auth-muted);
        }
        .input-wrap { position: relative; display: flex; }
        .auth-form input {
          width: 100%;
          height: 46px;
          background: var(--auth-surface);
          border: 1px solid var(--auth-border);
          color: var(--auth-fg);
          padding: 0 16px;
          font-family: var(--auth-font-body);
          font-size: 14.5px;
          border-radius: 4px;
          transition: border-color .15s, background .15s, box-shadow .15s;
          outline: none;
        }
        .auth-form input::placeholder {
          color: var(--auth-muted-2);
          font-family: var(--auth-font-mono);
          font-size: 12.5px;
          letter-spacing: 0.05em;
        }
        .auth-form input:hover { border-color: var(--auth-border-strong); }
        .auth-form input:focus {
          border-color: var(--auth-accent);
          box-shadow: 0 0 0 3px oklch(58% 0.18 215 / .14);
        }
        .auth-form input[aria-invalid="true"] {
          border-color: var(--auth-danger);
        }

        .auth-form-error {
          font-family: var(--auth-font-mono);
          font-size: 11.5px;
          letter-spacing: 0.05em;
          color: var(--auth-danger);
          background: oklch(58% 0.22 25 / .08);
          border: 1px solid oklch(58% 0.22 25 / .25);
          border-radius: 4px;
          padding: 10px 12px;
          margin-top: -2px;
        }

        .auth-primary {
          margin-top: 4px;
          height: 50px;
          background: linear-gradient(96deg, var(--auth-accent) 0%, var(--auth-accent-2) 100%);
          border: 0;
          color: #fff;
          font-family: var(--auth-font-display);
          font-weight: 600;
          font-size: 14.5px;
          letter-spacing: -0.01em;
          border-radius: 4px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 22px;
          position: relative;
          overflow: hidden;
          transition: filter .15s, transform .1s, box-shadow .15s;
          box-shadow: 0 6px 18px oklch(58% 0.18 215 / .25);
        }
        .auth-primary::after {
          content: "";
          position: absolute;
          inset: 0;
          background: linear-gradient(120deg, transparent 35%, rgba(255,255,255,.35) 50%, transparent 65%);
          transform: translateX(-100%);
          transition: transform .8s;
        }
        .auth-primary:hover::after { transform: translateX(100%); }
        .auth-primary:hover {
          filter: brightness(1.06);
          box-shadow: 0 8px 22px oklch(58% 0.18 215 / .32);
        }
        .auth-primary:active { transform: translateY(1px); }
        .auth-primary:disabled { opacity: 0.7; cursor: progress; }
        .auth-primary .arrow {
          font-family: var(--auth-font-mono);
          font-weight: 500;
          font-size: 18px;
        }

        .auth-card-foot {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 28px;
          padding-top: 18px;
          border-top: 1px solid var(--auth-border);
          font-family: var(--auth-font-mono);
          font-size: 10.5px;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: var(--auth-muted-2);
        }
        .status-pill { display: inline-flex; align-items: center; gap: 8px; }
        .status-pill .dot {
          width: 7px;
          height: 7px;
          background: var(--auth-accent-2);
          border-radius: 50%;
          box-shadow: 0 0 6px var(--auth-accent-2);
        }

        /* ============================================================
           Ticker (banda inferior)
           ============================================================ */
        .auth-ticker {
          position: absolute;
          bottom: 28px;
          left: 44px;
          right: 540px;
          display: flex;
          align-items: center;
          gap: 18px;
          font-family: var(--auth-font-mono);
          font-size: 11.5px;
          letter-spacing: 0.12em;
          color: var(--auth-muted);
          z-index: 4;
          border-top: 1px solid var(--auth-border);
          padding-top: 20px;
        }
        .auth-ticker-label {
          color: var(--auth-muted-2);
          text-transform: uppercase;
          letter-spacing: 0.22em;
        }
        .auth-ticker-seq { color: var(--auth-fg); font-weight: 500; }
        .auth-ticker-seq.dim { color: var(--auth-muted); }
        .auth-ticker-pulse {
          color: var(--auth-accent);
          animation: authPulse 1.4s ease-in-out infinite;
        }
        .auth-ticker-dot {
          width: 8px;
          height: 8px;
          background: var(--auth-accent-2);
          border-radius: 50%;
          box-shadow: 0 0 8px var(--auth-accent-2);
          animation: authBlinkD 1.8s ease-in-out infinite;
        }
        @keyframes authBlinkD { 0%,100% { opacity: 1; } 50% { opacity: 0.35; } }
        @keyframes authPulse  { 0%,100% { opacity: 0.4; } 50% { opacity: 1; } }

        /* ============================================================
           Responsive
           ============================================================ */
        @media (max-width: 980px) {
          body.auth-stage { overflow: auto; }
          .auth-stage-root { height: auto; min-height: 100vh; overflow: visible; }
          .auth-headline {
            position: relative;
            bottom: auto;
            left: 24px;
            right: 24px;
            margin: 320px 0 32px;
            max-width: none;
            pointer-events: auto;
          }
          .auth-connector { display: none; }
          .auth-bracket { display: none; }
          .auth-card {
            position: relative;
            top: auto;
            right: auto;
            transform: none;
            margin: 0 auto 80px;
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
            background: oklch(100% 0 0 / .85);
            box-shadow: 0 12px 40px oklch(40% 0.02 250 / .15);
          }
          .auth-annot-2, .auth-annot-4 { display: none; }
          .auth-ticker { right: 24px; }
        }
        @media (max-width: 560px) {
          .auth-brand-mark { top: 22px; left: 22px; }
          .auth-brand-letters { font-size: 30px; }
          .auth-card { padding: 36px 24px 30px; }
          .auth-headline-title { font-size: 32px; }
          .auth-ticker { left: 24px; right: 24px; gap: 10px; flex-wrap: wrap; }
        }

        /* prefers-reduced-motion: detener pulsos del wordmark */
        @media (prefers-reduced-motion: reduce) {
          .auth-al::after,
          .auth-connector-dot,
          .auth-eyebrow .dot,
          .status-pill .dot,
          .auth-ticker-dot,
          .auth-ticker-pulse {
            animation: none !important;
          }
        }
      `}</style>
    </main>
  );
}
