import { useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";

type Msg = { role: "user" | "assistant"; text: string };

export function AIDrawer({
  onClose,
  hint,
}: {
  onClose: () => void;
  hint: string | null;
}) {
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      text: hint
        ? `Hola — listo para ayudarte. Contexto: ${hint}`
        : "Hola — pedime un informe, una acción o un resumen del workspace activo.",
    },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setMessages((m) => [...m, { role: "user", text }]);
    setInput("");
    setSending(true);
    try {
      const r = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, hint }),
      });
      const j = (await r.json()) as { reply?: string };
      setMessages((m) => [
        ...m,
        { role: "assistant", text: j.reply ?? "(sin respuesta)" },
      ]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setMessages((m) => [...m, { role: "assistant", text: `Error: ${msg}` }]);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside className="ai-drawer" onClick={(e) => e.stopPropagation()}>
        <header className="ai-drawer__head">
          <span className="topbar__ai" style={{ pointerEvents: "none" }}>
            <Icon name="sparkles" size={13} /> Asistente IA
          </span>
          <button
            type="button"
            className="btn btn--icon"
            onClick={onClose}
            title="Cerrar"
            aria-label="Cerrar"
          >
            ×
          </button>
        </header>
        <div className="ai-drawer__msgs">
          {messages.map((m, i) => (
            <div key={i} className={`ai-msg ai-msg--${m.role}`}>
              {m.text}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
        <div className="ai-drawer__input">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Pedile algo a la IA… (Enter para enviar)"
            disabled={sending}
            rows={2}
          />
          <button
            type="button"
            className="btn btn--primary"
            onClick={send}
            disabled={sending || !input.trim()}
          >
            {sending ? "…" : "Enviar"}
          </button>
        </div>
      </aside>
    </div>
  );
}
