// AI Assistant — sliding drawer with chat, suggestions, and real LLM via window.claude
function AIDrawer({ open, onClose, workspace, ws, contextHint }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef(null);

  // Reset chat when workspace changes
  useEffect(() => {
    setMessages([{
      role: "ai",
      text: greetingFor(workspace, ws)
    }]);
  }, [workspace]);

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => { scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight); });
    }
  }, [open, messages, busy]);

  if (!open) return null;

  const suggestions = [
    { icon: "trending", text: "¿Cuál es mi forecast para los próximos 90 días?" },
    { icon: "alert",    text: "¿Qué tratos están en riesgo de stalling?" },
    { icon: "users",    text: "Resumime los top 3 tratos por valor" },
    { icon: "clock",    text: "¿Cuál es mi Sales Velocity por etapa?" },
    { icon: "sparkles", text: "Genera un email de follow-up para mi mejor lead" }
  ];

  const send = async (text) => {
    const t = text || input.trim();
    if (!t || busy) return;
    setInput("");
    const newMessages = [...messages, { role: "user", text: t }];
    setMessages(newMessages);
    setBusy(true);

    try {
      const ctx = buildContext(workspace, ws, contextHint);
      const prompt =
        `Sos un asistente de IA dentro de un CRM Agile multi-tenant. El usuario está en el workspace "${workspace.toUpperCase()}".\n\n` +
        `Contexto actual (datos del workspace):\n${ctx}\n\n` +
        `Responde en español rioplatense, conciso pero útil. Cuando haga sentido, usá listas con guiones (-) o numeradas. ` +
        `Si el usuario pide un informe o resumen, hacelo accionable con bullets cortos. Si te piden generar texto (email, mensaje), devolvélo entre comillas. ` +
        `Usá los datos del contexto cuando sean relevantes. Si te falta info, decilo en una línea.\n\n` +
        `Pregunta del usuario: ${t}`;

      const response = await window.claude.complete(prompt);
      setMessages([...newMessages, { role: "ai", text: response }]);
    } catch (err) {
      setMessages([...newMessages, { role: "ai", text: "No pude conectarme al modelo. Probá de nuevo en un momento.", error: true }]);
    } finally {
      setBusy(false);
    }
  };

  const onKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div className="ai-drawer" data-screen-label="AI Assistant Drawer">
      <div className="ai-drawer__h">
        <h3>
          <Icon name="sparkles" size={16} style={{ color: "var(--accent)" }} />
          AI Assistant
          <span className="badge">beta</span>
        </h3>
        <div className="actions">
          <button className="btn btn--ghost btn--icon" title="Nueva conversación" onClick={() => setMessages([{ role: "ai", text: greetingFor(workspace, ws) }])}>
            <Icon name="plus" size={14} />
          </button>
          <button className="btn btn--ghost btn--icon" onClick={onClose} title="Cerrar"><Icon name="x" size={14} /></button>
        </div>
      </div>

      <div className="ai-chat" ref={scrollRef}>
        {messages.map((m, i) => (
          <div key={i} className={`ai-msg ai-msg--${m.role}`}>
            <div className="ai-msg__avatar">{m.role === "ai" ? "AI" : (workspace === "novit" ? "MP" : "AV")}</div>
            <div>
              <div className="ai-msg__name">{m.role === "ai" ? "CRM Assistant" : "Vos"}</div>
              <div className="ai-msg__body">{m.role === "ai" ? renderMarkdown(m.text) : m.text}</div>
            </div>
          </div>
        ))}
        {busy && (
          <div className="ai-msg ai-msg--ai">
            <div className="ai-msg__avatar">AI</div>
            <div>
              <div className="ai-msg__name">CRM Assistant</div>
              <div className="ai-thinking">
                <span className="dot"></span><span className="dot"></span><span className="dot"></span>
                Analizando {ws.deals.length} tratos de {workspace.toUpperCase()}…
              </div>
            </div>
          </div>
        )}

        {messages.length <= 1 && !busy && (
          <div className="ai-suggestions">
            <div style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--fg-3)", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 2 }}>
              Sugerencias
            </div>
            {suggestions.map(s => (
              <button key={s.text} className="ai-suggestion" onClick={() => send(s.text)}>
                <Icon name={s.icon} size={13} className="icon" />
                <span>{s.text}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="ai-composer">
        <textarea
          placeholder={`Preguntale al asistente · contexto: ${workspace.toUpperCase()}`}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKey}
          rows={1}
          autoFocus
        />
        <button className="btn btn--accent" onClick={() => send()} disabled={busy || !input.trim()}>
          {busy ? "…" : <><Icon name="arrow-right" size={13} /> Enviar</>}
        </button>
      </div>
    </div>
  );
}

function greetingFor(workspace, ws) {
  const wsName = workspace === "novit" ? "NOVIT" : "SHARKY";
  const open = ws.deals.filter(d => d.stage !== "won" && d.stage !== "lost");
  const forecast = open.reduce((acc, d) => acc + d.value * d.probability, 0);
  return `Hola 👋 Soy tu asistente del CRM. Estás en **${wsName}** con **${open.length} tratos abiertos** y un forecast ponderado de **${fmtMoney(forecast, true)}**.\n\nPodés pedirme análisis, generar informes, redactar emails o WhatsApp, o navegar a cualquier vista.`;
}

function buildContext(workspace, ws, contextHint) {
  const open = ws.deals.filter(d => d.stage !== "won" && d.stage !== "lost");
  const top = [...ws.deals].sort((a, b) => b.value - a.value).slice(0, 8);
  const won = ws.deals.filter(d => d.stage === "won");
  const stalled = open.filter(d => daysBetween(d.createdAt, ws.today) > 30);
  const forecast = open.reduce((acc, d) => acc + d.value * d.probability, 0);
  const stagesSummary = window.CRM_DATA.stages
    .filter(s => s.id !== "lost")
    .map(s => `${s.label}: ${ws.deals.filter(d => d.stage === s.id).length}`)
    .join(", ");

  let out = `Workspace: ${workspace.toUpperCase()}\n`;
  out += `Tratos abiertos: ${open.length}. Tratos ganados: ${won.length}. Forecast ponderado: ${fmtMoney(forecast)}.\n`;
  out += `Pipeline por etapa: ${stagesSummary}.\n`;
  out += `Tratos stalling (>30d abierto): ${stalled.length}.\n\n`;

  out += `Top tratos por valor:\n`;
  top.forEach((d, i) => {
    out += `${i + 1}. ${d.name} (${d.company}) · ${fmtMoney(d.value)} · ${stageLabel(d.stage)} · AI ${d.ai}% · cierre ${fmtDate(d.estimatedCloseAt, { format: "short" })}\n`;
  });

  if (contextHint) out += `\nContexto adicional: ${contextHint}\n`;
  return out;
}

// Minimal markdown: **bold**, *italic*, `code`, bullets, numbered lists
function renderMarkdown(text) {
  const lines = text.split("\n");
  const blocks = [];
  let listType = null;
  let listItems = [];
  const flushList = () => {
    if (listItems.length) {
      const Tag = listType === "ol" ? "ol" : "ul";
      blocks.push(<Tag key={blocks.length}>{listItems.map((it, i) => <li key={i}>{renderInline(it)}</li>)}</Tag>);
      listItems = [];
      listType = null;
    }
  };
  for (const line of lines) {
    const bullet = line.match(/^\s*[-•]\s+(.+)/);
    const numbered = line.match(/^\s*\d+[.)]\s+(.+)/);
    if (bullet) {
      if (listType !== "ul") flushList();
      listType = "ul";
      listItems.push(bullet[1]);
    } else if (numbered) {
      if (listType !== "ol") flushList();
      listType = "ol";
      listItems.push(numbered[1]);
    } else {
      flushList();
      if (line.trim()) blocks.push(<p key={blocks.length}>{renderInline(line)}</p>);
    }
  }
  flushList();
  return blocks;
}
function renderInline(text) {
  // **bold**, *italic*, `code`
  const out = [];
  let rest = text;
  const re = /(\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`)/;
  let key = 0;
  while (rest) {
    const m = rest.match(re);
    if (!m) { out.push(rest); break; }
    if (m.index > 0) out.push(rest.slice(0, m.index));
    if (m[2]) out.push(<strong key={key++}>{m[2]}</strong>);
    else if (m[3]) out.push(<em key={key++}>{m[3]}</em>);
    else if (m[4]) out.push(<code key={key++}>{m[4]}</code>);
    rest = rest.slice(m.index + m[0].length);
  }
  return out;
}

window.AIDrawer = AIDrawer;
