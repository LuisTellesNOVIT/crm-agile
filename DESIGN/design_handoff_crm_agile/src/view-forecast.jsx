// GANTT Forecast view — drag-to-reschedule deals on a timeline
function ForecastView({ ws, workspace, onOpenDeal }) {
  const [deals, setDeals] = useState(ws.deals);
  const [zoom, setZoom] = useState("month"); // week | month | quarter
  const [tooltip, setTooltip] = useState(null);
  const [hoveredId, setHoveredId] = useState(null);

  useEffect(() => { setDeals(ws.deals); }, [ws]);

  const today = ws.today;

  // Zoom -> pixels per day
  const pxPerDay = zoom === "week" ? 22 : zoom === "month" ? 6 : zoom === "quarter" ? 2.4 : 6;

  // Timeline range: 1 month behind today + 8 months ahead, snapped to month boundaries
  const rangeStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const rangeEnd = new Date(today.getFullYear(), today.getMonth() + 9, 1);

  // Generate months array
  const months = [];
  const m = new Date(rangeStart);
  while (m < rangeEnd) {
    const next = new Date(m.getFullYear(), m.getMonth() + 1, 1);
    const days = (next - m) / 86400000;
    months.push({
      start: new Date(m),
      end: next,
      days,
      width: days * pxPerDay,
      label: ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"][m.getMonth()],
      year: m.getFullYear()
    });
    m.setMonth(m.getMonth() + 1);
  }
  const totalWidth = months.reduce((acc, mo) => acc + mo.width, 0);

  const dayToX = (date) => {
    const d = typeof date === "string" ? new Date(date) : date;
    return Math.max(0, (d - rangeStart) / 86400000 * pxPerDay);
  };
  const xToDate = (x) => {
    const d = new Date(rangeStart);
    d.setDate(d.getDate() + Math.round(x / pxPerDay));
    return d;
  };
  const todayX = dayToX(today);

  // Group deals by stage
  const stages = window.CRM_DATA.stages;
  const groups = stages
    .map(s => ({
      stage: s,
      deals: deals.filter(d => d.stage === s.id).sort((a, b) => new Date(a.estimatedCloseAt) - new Date(b.estimatedCloseAt))
    }))
    .filter(g => g.deals.length > 0);

  // Drag handlers
  const dragRef = useRef(null);
  const startDrag = (deal, mode) => (e) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const origStart = new Date(deal.createdAt);
    const origEnd = new Date(deal.estimatedCloseAt);
    dragRef.current = { deal, mode, startX, origStart, origEnd };

    const onMove = (mv) => {
      const dx = mv.clientX - startX;
      const dDays = Math.round(dx / pxPerDay);
      let newStart = new Date(origStart);
      let newEnd = new Date(origEnd);
      if (mode === "move") {
        newStart.setDate(newStart.getDate() + dDays);
        newEnd.setDate(newEnd.getDate() + dDays);
      } else if (mode === "resize-r") {
        newEnd.setDate(newEnd.getDate() + dDays);
        if (newEnd <= newStart) newEnd = addDays(newStart, 1);
      } else if (mode === "resize-l") {
        newStart.setDate(newStart.getDate() + dDays);
        if (newStart >= newEnd) newStart = addDays(newEnd, -1);
      }
      setDeals(prev => prev.map(d => d.id === deal.id
        ? { ...d, createdAt: newStart.toISOString(), estimatedCloseAt: newEnd.toISOString() }
        : d
      ));
      setTooltip({
        x: mv.clientX + 14, y: mv.clientY - 36,
        deal: { ...deal, createdAt: newStart.toISOString(), estimatedCloseAt: newEnd.toISOString() },
        mode
      });
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      setTooltip(null);
      dragRef.current = null;
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  // Forecast aggregate header
  const open = deals.filter(d => d.stage !== "won" && d.stage !== "lost");
  const forecast = open.reduce((acc, d) => acc + d.value * d.probability, 0);
  const dealsBeyond = open.filter(d => new Date(d.estimatedCloseAt) > rangeEnd).length;

  return (
    <div className="gantt" data-screen-label="Forecast GANTT">
      <div className="gantt__toolbar">
        <div className="segmented">
          <button className={zoom === "week" ? "is-active" : ""} onClick={() => setZoom("week")}>Semana</button>
          <button className={zoom === "month" ? "is-active" : ""} onClick={() => setZoom("month")}>Mes</button>
          <button className={zoom === "quarter" ? "is-active" : ""} onClick={() => setZoom("quarter")}>Trimestre</button>
        </div>
        <div style={{ fontSize: 12, color: "var(--fg-3)" }}>
          Rango: <b className="mono" style={{ color: "var(--fg-2)" }}>{fmtDate(rangeStart, { format: "short" })} → {fmtDate(rangeEnd, { format: "short" })}</b>
        </div>
        <div style={{ flex: 1 }} />
        <span className="chip chip--accent chip--dot">Forecast {fmtMoney(forecast, true)}</span>
        <span className="chip">{open.length} tratos abiertos</span>
        {dealsBeyond > 0 && <span className="chip chip--warn">{dealsBeyond} fuera de rango</span>}
        <div style={{ width: 1, height: 18, background: "var(--border)" }} />
        <button className="btn"><Icon name="filter" size={13} /> Etapa</button>
        <button className="btn"><Icon name="users" size={13} /> Owner</button>
        <span style={{ fontSize: 11, color: "var(--fg-3)", marginLeft: 6 }}>
          Tip: arrastra las barras o sus bordes para mover las fechas.
        </span>
      </div>

      <div className="gantt__body">
        {/* Left panel: deals list */}
        <div className="gantt__deals">
          <div className="gantt__deals-head">Trato · Compañía</div>
          {groups.map(g => (
            <React.Fragment key={g.stage.id}>
              <div className="gantt__group-row">
                <span className="dot" style={{ background: g.stage.color }} />
                <span>{g.stage.label}</span>
                <span style={{ marginLeft: "auto", color: "var(--fg-4)" }}>{g.deals.length}</span>
              </div>
              {g.deals.map(d => (
                <div key={d.id} className="gantt__deal-row" style={hoveredId === d.id ? { background: "var(--bg-2)" } : null} onClick={() => onOpenDeal?.(d.id)}>
                  <div className="gantt__deal-info">
                    <div className="gantt__deal-name">{d.name}</div>
                    <div className="gantt__deal-co">
                      {d.company}
                      {d.isRecurring && <span className="chip" style={{ fontSize: 9, padding: "0 4px", height: 14 }}>SaaS</span>}
                    </div>
                  </div>
                  <div className="gantt__deal-meta">
                    <span>{fmtMoney(d.value, true)}</span>
                    <span style={{ color: "var(--accent)" }}>{d.ai}%</span>
                  </div>
                </div>
              ))}
            </React.Fragment>
          ))}
        </div>

        {/* Right panel: timeline */}
        <div className="gantt__timeline" style={{ minWidth: totalWidth }}>
          <div className="gantt__head" style={{ width: totalWidth }}>
            {months.map((mo, i) => (
              <div key={i} className="gantt__head-month" style={{ width: mo.width }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                  <span className="m">{mo.label}</span>
                  <span className="y">{mo.year}</span>
                </div>
                <div className="gantt__head-weeks">
                  {zoom === "week" || zoom === "month" ? (
                    Array.from({ length: Math.ceil(mo.days / 7) }, (_, w) => {
                      const startDay = w * 7 + 1;
                      return (
                        <div key={w} className="gantt__head-week" style={{ flex: Math.min(7, mo.days - w * 7) }}>
                          {zoom === "week" ? `${startDay}` : ""}
                        </div>
                      );
                    })
                  ) : null}
                </div>
              </div>
            ))}
          </div>

          {/* Today marker */}
          <div className="gantt__today" style={{ left: todayX }} />

          {/* Rows */}
          {groups.map(g => (
            <React.Fragment key={g.stage.id}>
              <div className="gantt__group-divider" />
              {g.deals.map(d => {
                const left = dayToX(d.createdAt);
                const right = dayToX(d.estimatedCloseAt);
                const width = Math.max(40, right - left);
                const isWon = d.stage === "won";
                const barBg = isWon
                  ? "linear-gradient(90deg, #16a34a, #22c55e)"
                  : `linear-gradient(90deg, ${g.stage.color}, ${shade(g.stage.color, -12)})`;
                return (
                  <div
                    key={d.id}
                    className="gantt__row"
                    onMouseEnter={() => setHoveredId(d.id)}
                    onMouseLeave={() => setHoveredId(null)}
                  >
                    <div
                      className={`gantt__bar ${dragRef.current?.deal?.id === d.id ? "is-dragging" : ""}`}
                      style={{ left, width, "--bar-bg": barBg, background: barBg }}
                      onMouseDown={startDrag(d, "move")}
                      title={`${d.name} · ${d.company}`}
                    >
                      <div className="gantt__bar-handle gantt__bar-handle--l" onMouseDown={startDrag(d, "resize-l")} />
                      <span className="label">{d.name}</span>
                      {width > 90 && <span className="ai-pct">{d.ai}%</span>}
                      <div className="gantt__bar-handle gantt__bar-handle--r" onMouseDown={startDrag(d, "resize-r")} />
                    </div>
                  </div>
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </div>

      {tooltip && (
        <div className="gantt__tooltip" style={{ left: tooltip.x, top: tooltip.y }}>
          <div><b>{tooltip.deal.name}</b></div>
          <div style={{ opacity: .8, marginTop: 2 }}>
            {fmtDate(tooltip.deal.createdAt, { format: "short" })} → <b>{fmtDate(tooltip.deal.estimatedCloseAt, { format: "short" })}</b>
          </div>
          <div style={{ opacity: .6, fontSize: 10, marginTop: 2 }}>
            {daysBetween(tooltip.deal.createdAt, tooltip.deal.estimatedCloseAt)} días · {tooltip.mode === "move" ? "moviendo" : "ajustando cierre"}
          </div>
        </div>
      )}
    </div>
  );
}

// Tiny color shade helper
function shade(hex, percent) {
  const n = parseInt(hex.slice(1), 16);
  const r = clamp((n >> 16) + Math.round(255 * percent / 100), 0, 255);
  const g = clamp(((n >> 8) & 0xff) + Math.round(255 * percent / 100), 0, 255);
  const b = clamp((n & 0xff) + Math.round(255 * percent / 100), 0, 255);
  return "#" + ((r << 16) | (g << 8) | b).toString(16).padStart(6, "0");
}

window.ForecastView = ForecastView;
