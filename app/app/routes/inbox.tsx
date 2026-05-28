import { useMemo, useState } from "react";
import { useAppStore } from "../lib/store";
import { conversations, inbox } from "../lib/mock/rich";
import { Chip } from "../components/ui/Chip";
import { Icon, type IconName } from "../components/shell/Icon";
import type { ChannelKind, InboxItem, WorkspaceId } from "../lib/types";

const CHANNEL_ICONS: Record<ChannelKind, IconName> = {
  wa: "chat",
  email: "inbox",
  mention: "sparkles",
  call: "user",
  note: "template",
  linkedin: "user",
};

type FilterId = "all" | "unread" | "mine";

const FILTERS: { id: FilterId; label: string }[] = [
  { id: "all", label: "Todos" },
  { id: "unread", label: "No leídos" },
  { id: "mine", label: "Asignados a mí" },
];

function workspaceForInbox(ws: string): WorkspaceId {
  // "all" mode shows NOVIT inbox by default (consistent with proto)
  return ws === "sharky" ? "sharky" : "novit";
}

export default function InboxRoute() {
  const workspace = useAppStore((s) => s.workspace);
  const wsKey = workspaceForInbox(workspace);
  const threads = inbox[wsKey];
  const [active, setActive] = useState<string>(threads[0]?.id ?? "");
  const [filter, setFilter] = useState<FilterId>("all");

  const visible = useMemo(() => {
    if (filter === "unread") return threads.filter((t) => t.unread);
    if (filter === "mine") return threads.filter((t) => t.type === "mention");
    return threads;
  }, [threads, filter]);

  const activeThread = threads.find((t) => t.id === active) ?? threads[0];
  const convoKey = `${wsKey}:${activeThread?.id}`;
  const messages = conversations[convoKey] ?? [];

  return (
    <div className="inbox">
      <header className="inbox__head">
        <div className="inbox__filters">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              className={`btn btn--ghost ${filter === f.id ? "btn--filtered" : ""}`.trim()}
              onClick={() => setFilter(f.id)}
            >
              {f.label}
              {f.id === "unread" && (
                <span className="btn__badge mono">
                  {threads.filter((t) => t.unread).length}
                </span>
              )}
            </button>
          ))}
        </div>
      </header>
      <div className="inbox__cols">
        <ThreadList
          threads={visible}
          activeId={activeThread?.id ?? ""}
          onSelect={setActive}
        />
        <Conversation thread={activeThread} messages={messages} />
        <ContextPanel thread={activeThread} />
      </div>
    </div>
  );
}

function ThreadList({
  threads,
  activeId,
  onSelect,
}: {
  threads: InboxItem[];
  activeId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="inbox__threads">
      {threads.length === 0 && (
        <div className="empty-hint">Sin mensajes con este filtro</div>
      )}
      {threads.map((t) => (
        <ThreadRow
          key={t.id}
          thread={t}
          active={t.id === activeId}
          onClick={() => onSelect(t.id)}
        />
      ))}
    </div>
  );
}

function ThreadRow({
  thread,
  active,
  onClick,
}: {
  thread: InboxItem;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <div
      className={`thread ${active ? "is-active" : ""} ${thread.unread ? "is-unread" : ""}`.trim()}
      onClick={onClick}
    >
      <div className="thread__ch">
        <Icon name={CHANNEL_ICONS[thread.ch]} size={14} />
      </div>
      <div className="thread__body">
        <div className="thread__top">
          <span className="thread__from">{thread.from}</span>
          <span className="thread__t mono">{thread.t}</span>
        </div>
        <div className="thread__subj">{thread.subj}</div>
        <div className="thread__preview">{thread.preview}</div>
      </div>
      {thread.unread && <span className="thread__dot" />}
    </div>
  );
}

function Conversation({
  thread,
  messages,
}: {
  thread: InboxItem | undefined;
  messages: { dir: "in" | "out"; text: string; at: string; ch: ChannelKind }[];
}) {
  if (!thread) return <div className="empty-hint">Seleccioná un hilo</div>;
  return (
    <div className="inbox__convo">
      <header className="convo__head">
        <div>
          <div className="convo__title">{thread.subj}</div>
          <div className="convo__sub mono">
            {thread.from} {thread.co ? `· ${thread.co}` : ""}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" className="btn btn--ghost">
            <Icon name="user" size={13} /> Asignar
          </button>
          <button type="button" className="btn btn--primary">
            <Icon name="sparkles" size={13} /> Responder con IA
          </button>
        </div>
      </header>
      <div className="convo__msgs">
        {messages.length === 0 && (
          <div className="empty-hint" style={{ padding: 32 }}>
            Sin mensajes anteriores · iniciá una respuesta abajo.
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`convo__msg convo__msg--${m.dir}`}>
            <div className="convo__msg-text">{m.text}</div>
            <div className="convo__msg-meta mono">
              {m.at} · {m.ch}
            </div>
          </div>
        ))}
      </div>
      <footer className="convo__compose">
        <textarea
          placeholder={`Responder por ${thread.ch}…`}
          rows={2}
        />
        <button type="button" className="btn btn--primary">
          Enviar
        </button>
      </footer>
    </div>
  );
}

function ContextPanel({ thread }: { thread: InboxItem | undefined }) {
  if (!thread) return null;
  return (
    <aside className="inbox__context">
      <div className="ctx__section">
        <div className="ctx__label">Contacto</div>
        <div className="ctx__row">
          <div className="ctx__name">{thread.from}</div>
          {thread.co && (
            <div className="ctx__co mono">{thread.co}</div>
          )}
        </div>
      </div>
      <div className="ctx__section">
        <div className="ctx__label">Canal</div>
        <Chip tone="accent">
          <Icon name={CHANNEL_ICONS[thread.ch]} size={11} /> {thread.ch}
        </Chip>
      </div>
      <div className="ctx__section">
        <div className="ctx__label">Sugerencias IA</div>
        <ul className="ctx__list">
          <li>📊 Resumir últimas 5 interacciones del contacto</li>
          <li>🤖 Borrador de respuesta basado en deal asociado</li>
          <li>🔗 Buscar deals abiertos de {thread.co ?? "este contacto"}</li>
        </ul>
      </div>
      <div className="ctx__section">
        <div className="ctx__label">Próximas acciones</div>
        <ul className="ctx__list">
          <li>Agendar follow-up esta semana</li>
          <li>Adjuntar caso de éxito relevante</li>
        </ul>
      </div>
    </aside>
  );
}
