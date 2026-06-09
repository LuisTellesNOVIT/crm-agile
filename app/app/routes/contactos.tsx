import { useMemo, useState } from "react";
import { Icon } from "../components/shell/Icon";
import { useActiveWorkspace } from "../lib/store";
import type { ContactLite } from "../lib/types";

/**
 * Maestro de Contactos — directorio único de personas (deduplicado por la DB),
 * con su cliente asociado. Buscable y agrupable por cliente. Mismo estándar
 * visual que el alta de lead (cards, avatares, mono).
 */

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
function avatarBg(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 360;
  return `oklch(64% 0.14 ${h})`;
}

export default function ContactosPage() {
  const ws = useActiveWorkspace();
  const [q, setQ] = useState("");
  const [grouped, setGrouped] = useState(true);

  const contacts = ws.contacts ?? [];

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const base = needle
      ? contacts.filter((c) =>
          [c.name, c.email, c.phone ?? "", c.role ?? "", c.companyName]
            .join(" ")
            .toLowerCase()
            .includes(needle),
        )
      : contacts;
    return [...base].sort((a, b) => a.name.localeCompare(b.name, "es"));
  }, [contacts, q]);

  // Agrupado por cliente
  const groups = useMemo(() => {
    const m = new Map<string, { companyName: string; items: ContactLite[] }>();
    for (const c of filtered) {
      const g = m.get(c.companyId) ?? { companyName: c.companyName, items: [] };
      g.items.push(c);
      m.set(c.companyId, g);
    }
    return [...m.values()].sort((a, b) => a.companyName.localeCompare(b.companyName, "es"));
  }, [filtered]);

  // KPIs
  const totalClientes = new Set(contacts.map((c) => c.companyId)).size;
  const conEmail = contacts.filter((c) => c.email).length;
  const conTel = contacts.filter((c) => c.phone).length;

  return (
    <div className="contacts-page">
      <header className="contacts-hd">
        <div className="contacts-hd__title">
          <span className="contacts-hd__ic"><Icon name="user" size={16} /></span>
          <div>
            <h1>Maestro de contactos</h1>
            <p>Directorio único de personas y su cliente — deduplicado.</p>
          </div>
        </div>
        <div className="contacts-kpis">
          <div className="contacts-kpi"><b>{contacts.length}</b><span>contactos</span></div>
          <div className="contacts-kpi"><b>{totalClientes}</b><span>clientes</span></div>
          <div className="contacts-kpi"><b>{conEmail}</b><span>con email</span></div>
          <div className="contacts-kpi"><b>{conTel}</b><span>con teléfono</span></div>
        </div>
      </header>

      <div className="contacts-toolbar">
        <div className="contacts-search">
          <Icon name="search" size={14} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nombre, email, teléfono o cliente…"
          />
          {q && (
            <button type="button" className="contacts-search__clear" onClick={() => setQ("")} aria-label="Limpiar">×</button>
          )}
        </div>
        <div className="contacts-seg" role="tablist">
          <button type="button" role="tab" aria-selected={grouped} className={grouped ? "is-on" : ""} onClick={() => setGrouped(true)}>Por cliente</button>
          <button type="button" role="tab" aria-selected={!grouped} className={!grouped ? "is-on" : ""} onClick={() => setGrouped(false)}>Lista plana</button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="contacts-empty">
          {contacts.length === 0
            ? "Aún no hay contactos en este grupo. Se crean al dar de alta un lead."
            : `Ningún contacto coincide con “${q.trim()}”.`}
        </div>
      ) : grouped ? (
        <div className="contacts-groups">
          {groups.map((g) => (
            <section key={g.companyName} className="contacts-card">
              <div className="contacts-card__head">
                <span className="contacts-card__logo" style={{ background: avatarBg(g.companyName) }}>{initialsOf(g.companyName)}</span>
                <span className="contacts-card__name">{g.companyName}</span>
                <span className="contacts-card__count">{g.items.length} contacto{g.items.length !== 1 ? "s" : ""}</span>
              </div>
              <div className="contacts-list">
                {g.items.map((c) => <ContactRow key={c.id} c={c} showClient={false} />)}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <section className="contacts-card">
          <div className="contacts-list contacts-list--flat">
            {filtered.map((c) => <ContactRow key={c.id} c={c} showClient />)}
          </div>
        </section>
      )}

      <style>{`
        .contacts-page { padding: 18px 22px 40px; display: flex; flex-direction: column; gap: 16px; max-width: 1100px; margin: 0 auto; }
        .contacts-hd { display: flex; align-items: flex-start; justify-content: space-between; gap: 18px; flex-wrap: wrap; }
        .contacts-hd__title { display: flex; align-items: center; gap: 12px; }
        .contacts-hd__ic { width: 34px; height: 34px; border-radius: 10px; display: grid; place-items: center; color: #fff; background: linear-gradient(135deg, var(--accent), oklch(58% 0.2 280)); box-shadow: 0 4px 12px rgba(99,102,241,.28); }
        .contacts-hd h1 { margin: 0; font-size: 19px; font-weight: 680; color: var(--fg); }
        .contacts-hd p { margin: 2px 0 0; font-size: 12.5px; color: var(--fg-3); }
        .contacts-kpis { display: flex; gap: 8px; }
        .contacts-kpi { display: flex; flex-direction: column; align-items: center; padding: 8px 14px; border: 1px solid var(--border-2); border-radius: 10px; background: var(--bg); min-width: 66px; }
        .contacts-kpi b { font-size: 17px; font-weight: 700; color: var(--fg); font-family: var(--font-mono); }
        .contacts-kpi span { font-size: 10px; color: var(--fg-4); text-transform: uppercase; letter-spacing: .04em; }

        .contacts-toolbar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
        .contacts-search { flex: 1; min-width: 240px; display: flex; align-items: center; gap: 8px; padding: 9px 12px; border: 1px solid var(--border); border-radius: 10px; background: var(--bg); color: var(--fg-4); transition: border-color .12s, box-shadow .12s; }
        .contacts-search:focus-within { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(99,102,241,.12); color: var(--accent); }
        .contacts-search input { flex: 1; border: none; outline: none; background: transparent; font: inherit; font-size: 13.5px; color: var(--fg); }
        .contacts-search__clear { border: 0; background: var(--bg-2); color: var(--fg-3); border-radius: 6px; width: 20px; height: 20px; cursor: pointer; font-size: 14px; line-height: 1; }
        .contacts-seg { display: inline-flex; padding: 3px; gap: 2px; background: var(--bg-2); border: 1px solid var(--border-2); border-radius: 10px; }
        .contacts-seg button { border: 0; background: transparent; padding: 6px 12px; border-radius: 7px; font: inherit; font-size: 12px; font-weight: 500; color: var(--fg-3); cursor: pointer; }
        .contacts-seg button.is-on { background: var(--bg); color: var(--fg); box-shadow: 0 1px 3px rgba(0,0,0,.08); font-weight: 600; }

        .contacts-empty { padding: 48px 20px; text-align: center; color: var(--fg-4); font-size: 13px; border: 1px dashed var(--border); border-radius: 12px; }

        .contacts-groups { display: flex; flex-direction: column; gap: 12px; }
        .contacts-card { border: 1px solid var(--border-2); border-radius: 12px; background: var(--bg); overflow: hidden; }
        .contacts-card__head { display: flex; align-items: center; gap: 10px; padding: 11px 14px; border-bottom: 1px solid var(--border-2); background: var(--bg-2); }
        .contacts-card__logo { width: 26px; height: 26px; border-radius: 7px; color: #fff; display: grid; place-items: center; font-size: 10px; font-weight: 700; font-family: var(--font-mono); flex-shrink: 0; }
        .contacts-card__name { font-weight: 650; font-size: 13.5px; color: var(--fg); }
        .contacts-card__count { margin-left: auto; font-size: 11px; color: var(--fg-4); font-family: var(--font-mono); }

        .contacts-list { display: flex; flex-direction: column; }
        .contact-row { display: grid; grid-template-columns: 34px 1.4fr 1.6fr 1fr; gap: 12px; align-items: center; padding: 9px 14px; border-bottom: 1px solid var(--border-2); }
        .contacts-list--flat .contact-row { grid-template-columns: 34px 1.3fr 1.5fr 1fr 1.1fr; }
        .contact-row:last-child { border-bottom: 0; }
        .contact-row:hover { background: var(--bg-2); }
        .contact-row__av { width: 30px; height: 30px; border-radius: 50%; color: #fff; display: grid; place-items: center; font-size: 11px; font-weight: 700; font-family: var(--font-mono); }
        .contact-row__id { display: flex; flex-direction: column; min-width: 0; }
        .contact-row__name { font-weight: 600; font-size: 13px; color: var(--fg); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .contact-row__role { font-size: 11px; color: var(--fg-4); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .contact-row__cell { font-size: 12.5px; color: var(--fg-2); min-width: 0; display: flex; align-items: center; gap: 6px; }
        .contact-row__cell.is-empty { color: var(--fg-4); }
        .contact-row__cell a { color: var(--fg-2); text-decoration: none; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .contact-row__cell a:hover { color: var(--accent); text-decoration: underline; }
        .contact-row__client { font-size: 12px; color: var(--fg-3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .contact-row__ic { color: var(--fg-4); flex-shrink: 0; }
      `}</style>
    </div>
  );
}

function ContactRow({ c, showClient }: { c: ContactLite; showClient: boolean }) {
  return (
    <div className="contact-row">
      <span className="contact-row__av" style={{ background: avatarBg(c.name) }}>{initialsOf(c.name)}</span>
      <span className="contact-row__id">
        <span className="contact-row__name">{c.name}</span>
        {c.role && <span className="contact-row__role">{c.role}</span>}
      </span>
      <span className={`contact-row__cell ${c.email ? "" : "is-empty"}`.trim()}>
        {c.email ? (
          <>
            <Icon name="mail" size={13} className="contact-row__ic" />
            <a href={`mailto:${c.email}`} onClick={(e) => e.stopPropagation()}>{c.email}</a>
          </>
        ) : "— sin email"}
      </span>
      <span className={`contact-row__cell ${c.phone ? "" : "is-empty"}`.trim()}>
        {c.phone ? (
          <>
            <Icon name="phone" size={13} className="contact-row__ic" />
            <span className="mono">{c.phone}</span>
          </>
        ) : "—"}
      </span>
      {showClient && (
        <span className="contact-row__client" title={c.companyName}>{c.companyName}</span>
      )}
    </div>
  );
}
