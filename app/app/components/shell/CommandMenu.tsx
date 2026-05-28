import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { Icon, type IconName } from "./Icon";
import { Kbd } from "../ui/Kbd";
import { WORKSPACE_META, useActiveWorkspace, useAppStore } from "../../lib/store";

type Item = {
  id: string;
  label: string;
  sub?: string;
  icon: IconName;
  kind: "view" | "deal" | "action" | "workspace";
  onSelect: () => void;
};

export function CommandMenu({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const setWorkspace = useAppStore((s) => s.setWorkspace);
  const openAI = useAppStore((s) => s.openAI);
  const openNewLead = useAppStore((s) => s.openNewLead);
  const ws = useActiveWorkspace();

  const [q, setQ] = useState("");
  const [hi, setHi] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const items: Item[] = useMemo(() => {
    const go = (path: string) => () => navigate(path);
    const views: Item[] = [
      { id: "v-dashboard", label: "Dashboard", icon: "dashboard", kind: "view", onSelect: go("/") },
      { id: "v-inbox", label: "Inbox", icon: "inbox", kind: "view", onSelect: go("/inbox") },
      { id: "v-pipeline", label: "Pipeline", icon: "kanban", kind: "view", onSelect: go("/pipeline") },
      { id: "v-forecast", label: "Forecast (GANTT)", icon: "gantt", kind: "view", onSelect: go("/forecast") },
      { id: "v-customers", label: "Cliente 360", icon: "user", kind: "view", onSelect: go("/customers") },
      { id: "v-chat", label: "Conversaciones", icon: "chat", kind: "view", onSelect: go("/chat") },
      { id: "v-templates", label: "Templates", icon: "template", kind: "view", onSelect: go("/templates") },
      { id: "v-sequences", label: "Secuencias", icon: "zap", kind: "view", onSelect: go("/sequences") },
      { id: "v-objects", label: "Custom objects", icon: "database", kind: "view", onSelect: go("/objects") },
      { id: "v-schema", label: "Schema (Prisma)", icon: "code", kind: "view", onSelect: go("/schema") },
      { id: "v-settings", label: "Configuración", icon: "settings", kind: "view", onSelect: go("/settings") },
    ];
    const actions: Item[] = [
      { id: "a-newlead", label: "Crear nuevo lead", icon: "plus", kind: "action", onSelect: openNewLead },
      { id: "a-ai", label: "Pedir a la IA", icon: "sparkles", kind: "action", onSelect: () => openAI() },
    ];
    const wsItems: Item[] = (["novit", "sharky", "all"] as const).map((w) => ({
      id: `ws-${w}`,
      label: `Cambiar a ${WORKSPACE_META[w].name}`,
      sub: WORKSPACE_META[w].tagline,
      icon: "check",
      kind: "workspace",
      onSelect: () => setWorkspace(w),
    }));
    const deals: Item[] = ws.deals.slice(0, 30).map((d) => ({
      id: `d-${d.id}`,
      label: d.name,
      sub: `${d.id} · ${d.company}`,
      icon: "kanban",
      kind: "deal",
      onSelect: go("/pipeline"),
    }));
    return [...views, ...actions, ...wsItems, ...deals];
  }, [navigate, openAI, openNewLead, setWorkspace, ws]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return items.slice(0, 12);
    return items
      .filter(
        (it) =>
          it.label.toLowerCase().includes(needle) ||
          (it.sub?.toLowerCase().includes(needle) ?? false),
      )
      .slice(0, 40);
  }, [items, q]);

  useEffect(() => {
    setHi(0);
  }, [q]);

  const select = (item: Item) => {
    item.onSelect();
    onClose();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHi((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHi((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const it = filtered[hi];
      if (it) select(it);
    }
  };

  return (
    <div
      className="cmdk-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div className="cmdk-modal" onClick={(e) => e.stopPropagation()}>
        <div className="cmdk-search">
          <Icon name="search" size={16} />
          <input
            ref={inputRef}
            className="cmdk-input"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Buscar vistas, deals, acciones…"
          />
          <Kbd>Esc</Kbd>
        </div>
        <ul className="cmdk-list">
          {filtered.map((it, i) => (
            <li
              key={it.id}
              className={`cmdk-item ${i === hi ? "is-active" : ""}`.trim()}
              onMouseEnter={() => setHi(i)}
              onClick={() => select(it)}
            >
              <Icon name={it.icon} size={14} />
              <div className="cmdk-item__body">
                <span>{it.label}</span>
                {it.sub && <span className="cmdk-item__sub">{it.sub}</span>}
              </div>
              <span className="cmdk-item__kind mono">{it.kind}</span>
            </li>
          ))}
          {filtered.length === 0 && <li className="cmdk-empty">Sin resultados</li>}
        </ul>
      </div>
    </div>
  );
}
