// Odoo-style attachments panel for the deal detail view.
// - Drag & drop upload
// - Grid of file tiles with thumbnails
// - Hover actions (preview · download · delete)
// - Fullscreen viewer modal with prev/next navigation

const FILE_TYPE_META = {
  pdf:  { label: "PDF",  color: "#dc2626", bg: "#fdecec" },
  doc:  { label: "DOC",  color: "#2563eb", bg: "#e0eaff" },
  docx: { label: "DOCX", color: "#2563eb", bg: "#e0eaff" },
  xls:  { label: "XLS",  color: "#16a34a", bg: "#e0f5e6" },
  xlsx: { label: "XLSX", color: "#16a34a", bg: "#e0f5e6" },
  png:  { label: "PNG",  color: "#8b5cf6", bg: "#f0e6fc" },
  jpg:  { label: "JPG",  color: "#8b5cf6", bg: "#f0e6fc" },
  jpeg: { label: "JPEG", color: "#8b5cf6", bg: "#f0e6fc" },
  webp: { label: "WEBP", color: "#8b5cf6", bg: "#f0e6fc" },
  gif:  { label: "GIF",  color: "#8b5cf6", bg: "#f0e6fc" },
  svg:  { label: "SVG",  color: "#0891b2", bg: "#dff4f9" },
  fig:  { label: "FIG",  color: "#a855f7", bg: "#f3e8ff" },
  sketch:{ label: "SKE", color: "#f59e0b", bg: "#fef3c7" },
  zip:  { label: "ZIP",  color: "#64748b", bg: "#eef1f5" },
  csv:  { label: "CSV",  color: "#16a34a", bg: "#e0f5e6" },
  txt:  { label: "TXT",  color: "#64748b", bg: "#eef1f5" },
  md:   { label: "MD",   color: "#64748b", bg: "#eef1f5" },
  ppt:  { label: "PPT",  color: "#ea580c", bg: "#feebd6" },
  pptx: { label: "PPTX", color: "#ea580c", bg: "#feebd6" }
};

function getExt(name) {
  const m = (name || "").toLowerCase().match(/\.([a-z0-9]+)$/);
  return m ? m[1] : "bin";
}

function getMeta(ext) {
  return FILE_TYPE_META[ext] || { label: ext.toUpperCase().slice(0, 4), color: "#64748b", bg: "#eef1f5" };
}

function isImage(ext) {
  return ["png", "jpg", "jpeg", "webp", "gif", "svg"].includes(ext);
}

function fmtBytes(n) {
  if (n < 1024) return n + " B";
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + " KB";
  return (n / (1024 * 1024)).toFixed(1) + " MB";
}

function fmtAgo(iso, today) {
  const d = new Date(iso);
  const t = today instanceof Date ? today : new Date();
  const ms = t - d;
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  if (days === 0) return "Hoy";
  if (days === 1) return "Ayer";
  if (days < 7) return `Hace ${days} días`;
  if (days < 30) return `Hace ${Math.floor(days / 7)} sem`;
  return d.toLocaleDateString("es", { day: "numeric", month: "short", year: "numeric" });
}

// Per-deal file store (kept in memory, persists across tab switches within the session)
window.__dealFiles = window.__dealFiles || {};

function seedFilesForDeal(deal, ws) {
  if (window.__dealFiles[deal.id]) return window.__dealFiles[deal.id];
  const today = ws.today;
  const ownerName = ws.owners[deal.owner]?.name || deal.owner;
  const day = (n) => new Date(today.getTime() - n * 86400000).toISOString();
  const seed = [
    { id: "f1", name: `Propuesta — ${deal.name}.pdf`, ext: "pdf", size: 1238912, by: ownerName, at: day(2), kind: "synthetic-pdf", title: deal.name, company: deal.company },
    { id: "f2", name: `MSA ${deal.company}.pdf`,    ext: "pdf", size: 254000,  by: ownerName, at: day(5), kind: "synthetic-pdf", title: "Master Service Agreement", company: deal.company },
    { id: "f3", name: "Pricing-y-rampa.xlsx",       ext: "xlsx", size: 84000,  by: ownerName, at: day(7), kind: "synthetic-xlsx" },
    { id: "f4", name: "Arquitectura-target.png",    ext: "png", size: 312000,  by: ownerName, at: day(9), kind: "synthetic-image", hue: 220 },
    { id: "f5", name: "Mockup-dashboard.png",       ext: "png", size: 412000,  by: ownerName, at: day(11), kind: "synthetic-image", hue: 270 }
  ];
  window.__dealFiles[deal.id] = seed;
  return seed;
}

function DealFilesPanel({ deal, ws }) {
  const [files, setFiles] = useState(() => seedFilesForDeal(deal, ws));
  const [dragOver, setDragOver] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(null);
  const inputRef = useRef(null);

  useEffect(() => {
    window.__dealFiles[deal.id] = files;
  }, [files, deal.id]);

  useEffect(() => {
    setFiles(seedFilesForDeal(deal, ws));
    // eslint-disable-next-line
  }, [deal.id]);

  const addFiles = useCallback((fileList) => {
    const today = ws.today;
    const ownerName = ws.owners[deal.owner]?.name || "Tú";
    const adds = Array.from(fileList).map((f, i) => {
      const ext = getExt(f.name);
      const item = {
        id: "u" + Date.now() + "_" + i,
        name: f.name,
        ext,
        size: f.size,
        by: ownerName,
        at: new Date(today.getTime()).toISOString(),
        kind: "uploaded"
      };
      if (isImage(ext) && typeof URL !== "undefined" && URL.createObjectURL) {
        try { item.objectUrl = URL.createObjectURL(f); } catch (e) {}
      } else if (ext === "txt" || ext === "md" || ext === "csv") {
        // Read text content for in-app preview
        const reader = new FileReader();
        reader.onload = (e) => {
          item.textContent = String(e.target.result || "").slice(0, 5000);
          setFiles(prev => prev.map(x => x.id === item.id ? { ...x, textContent: item.textContent } : x));
        };
        try { reader.readAsText(f); } catch (e) {}
      }
      return item;
    });
    setFiles(prev => [...adds, ...prev]);
  }, [deal.owner, ws]);

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
  };
  const onDragOver = (e) => { e.preventDefault(); setDragOver(true); };
  const onDragLeave = (e) => { e.preventDefault(); setDragOver(false); };

  const onPickFiles = () => inputRef.current?.click();
  const onInputChange = (e) => {
    if (e.target.files?.length) addFiles(e.target.files);
    e.target.value = "";
  };

  const deleteFile = (id) => {
    setFiles(prev => {
      const next = prev.filter(f => f.id !== id);
      // If viewer is open on this file, close or shift
      if (viewerIndex !== null) {
        const idx = prev.findIndex(f => f.id === id);
        if (idx === viewerIndex) setViewerIndex(next.length === 0 ? null : Math.min(idx, next.length - 1));
        else if (idx < viewerIndex) setViewerIndex(viewerIndex - 1);
      }
      return next;
    });
  };

  return (
    <div className="odoo-files">
      <input ref={inputRef} type="file" multiple onChange={onInputChange} style={{ display: "none" }} />

      {/* Drop zone */}
      <div
        className={`odoo-files__drop ${dragOver ? "is-over" : ""}`}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onClick={onPickFiles}
      >
        <Icon name="upload" size={20} />
        <div>
          <div className="odoo-files__drop-title">
            {dragOver ? "Soltá los archivos acá" : "Arrastrá archivos acá o "}
            {!dragOver && <span className="lnk">elegí desde tu dispositivo</span>}
          </div>
          <div className="odoo-files__drop-sub">PDF, imágenes, hojas de cálculo · hasta 50MB por archivo</div>
        </div>
      </div>

      {/* Header */}
      <div className="odoo-files__head">
        <span>Adjuntos</span>
        <span className="odoo-files__count">{files.length}</span>
        <span style={{ marginLeft: "auto", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-3)" }}>
          {fmtBytes(files.reduce((a, f) => a + (f.size || 0), 0))} total
        </span>
      </div>

      {/* Grid */}
      <div className="odoo-files__grid">
        {files.map((f, i) => (
          <FileTile
            key={f.id}
            file={f}
            onOpen={() => setViewerIndex(i)}
            onDelete={() => deleteFile(f.id)}
          />
        ))}
        {files.length === 0 && (
          <div className="odoo-files__empty">
            Sin adjuntos todavía. Arrastrá archivos arriba para empezar.
          </div>
        )}
      </div>

      {/* Viewer */}
      {viewerIndex !== null && files[viewerIndex] && (
        <FileViewer
          files={files}
          index={viewerIndex}
          onClose={() => setViewerIndex(null)}
          onPrev={() => setViewerIndex((viewerIndex - 1 + files.length) % files.length)}
          onNext={() => setViewerIndex((viewerIndex + 1) % files.length)}
          onDelete={() => deleteFile(files[viewerIndex].id)}
          ws={ws}
        />
      )}
    </div>
  );
}

function FileTile({ file, onOpen, onDelete }) {
  const meta = getMeta(file.ext);
  return (
    <div className="odoo-file-tile" onClick={onOpen}>
      <div className="odoo-file-tile__thumb" style={{ background: meta.bg }}>
        <FileThumbnail file={file} meta={meta} />
        <div className="odoo-file-tile__actions" onClick={(e) => e.stopPropagation()}>
          <button title="Ver" onClick={onOpen}><Icon name="eye" size={13} /></button>
          <button title="Descargar" onClick={(e) => { e.stopPropagation(); /* mock */ }}><Icon name="download" size={13} /></button>
          <button title="Borrar" className="is-danger" onClick={(e) => { e.stopPropagation(); onDelete(); }}><Icon name="trash" size={13} /></button>
        </div>
        <span className="odoo-file-tile__ext" style={{ color: meta.color, borderColor: meta.color }}>{meta.label}</span>
      </div>
      <div className="odoo-file-tile__meta">
        <div className="odoo-file-tile__name" title={file.name}>{file.name}</div>
        <div className="odoo-file-tile__sub">
          <span>{fmtBytes(file.size)}</span>
          <span style={{ color: "var(--fg-4)" }}>·</span>
          <span>{file.by}</span>
        </div>
      </div>
    </div>
  );
}

function FileThumbnail({ file, meta }) {
  if (file.objectUrl) return <img src={file.objectUrl} alt={file.name} />;
  if (file.kind === "synthetic-image") {
    return (
      <svg viewBox="0 0 200 140" preserveAspectRatio="xMidYMid slice" style={{ width: "100%", height: "100%" }}>
        <defs>
          <linearGradient id={`g-${file.id}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={`hsl(${file.hue || 220}, 60%, 70%)`} />
            <stop offset="100%" stopColor={`hsl(${(file.hue || 220) + 40}, 60%, 50%)`} />
          </linearGradient>
        </defs>
        <rect width="200" height="140" fill={`url(#g-${file.id})`} />
        <g opacity="0.5" stroke="white" fill="none" strokeWidth="1">
          <rect x="20" y="20" width="50" height="30" rx="2" />
          <rect x="80" y="20" width="50" height="30" rx="2" />
          <rect x="140" y="20" width="40" height="30" rx="2" />
          <rect x="20" y="60" width="160" height="60" rx="2" />
        </g>
      </svg>
    );
  }
  if (file.kind === "synthetic-pdf") {
    return (
      <svg viewBox="0 0 200 140" style={{ width: "100%", height: "100%" }}>
        <rect width="200" height="140" fill="#fff" />
        <rect x="20" y="22" width="120" height="8" fill="#1f2937" />
        <rect x="20" y="36" width="80" height="5" fill="#6b7280" />
        <rect x="20" y="55" width="160" height="3" fill="#d1d5db" />
        <rect x="20" y="62" width="160" height="3" fill="#d1d5db" />
        <rect x="20" y="69" width="140" height="3" fill="#d1d5db" />
        <rect x="20" y="80" width="160" height="3" fill="#d1d5db" />
        <rect x="20" y="87" width="120" height="3" fill="#d1d5db" />
        <rect x="20" y="100" width="60" height="24" fill={meta.color} opacity="0.15" />
        <rect x="90" y="100" width="60" height="24" fill={meta.color} opacity="0.08" />
      </svg>
    );
  }
  if (file.kind === "synthetic-xlsx") {
    return (
      <svg viewBox="0 0 200 140" style={{ width: "100%", height: "100%" }}>
        <rect width="200" height="140" fill="#fff" />
        {[0,1,2,3,4].map(r => (
          <g key={r}>
            {[0,1,2,3].map(c => (
              <rect key={c} x={10 + c * 45} y={15 + r * 22} width="42" height="20" fill="none" stroke="#d1d5db" strokeWidth="1" />
            ))}
          </g>
        ))}
        <rect x="10" y="15" width="180" height="20" fill={meta.color} opacity="0.18" />
        <rect x="15" y="42" width="20" height="3" fill="#6b7280" />
        <rect x="60" y="42" width="32" height="3" fill="#6b7280" />
        <rect x="105" y="42" width="28" height="3" fill="#6b7280" />
      </svg>
    );
  }
  // Generic icon for other types
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{
        fontFamily: "var(--font-mono)", fontWeight: 600, fontSize: 22,
        color: meta.color, letterSpacing: "0.05em"
      }}>{meta.label}</div>
    </div>
  );
}

function FileViewer({ files, index, onClose, onPrev, onNext, onDelete, ws }) {
  const file = files[index];
  const meta = getMeta(file.ext);
  useEffect(() => {
    const h = (e) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") onPrev();
      else if (e.key === "ArrowRight") onNext();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose, onPrev, onNext]);

  return (
    <div className="odoo-viewer" onClick={onClose}>
      <div className="odoo-viewer__bar" onClick={(e) => e.stopPropagation()}>
        <span className="odoo-viewer__chip" style={{ color: meta.color, borderColor: meta.color }}>{meta.label}</span>
        <span className="odoo-viewer__title">{file.name}</span>
        <span className="odoo-viewer__sub">{fmtBytes(file.size)} · subido por {file.by} · {fmtAgo(file.at, ws.today)}</span>
        <span className="odoo-viewer__pager">{index + 1} / {files.length}</span>
        <button title="Descargar" onClick={(e) => e.stopPropagation()}><Icon name="download" size={14} /></button>
        <button title="Borrar" className="is-danger" onClick={(e) => { e.stopPropagation(); onDelete(); }}><Icon name="trash" size={14} /></button>
        <button title="Cerrar" onClick={(e) => { e.stopPropagation(); onClose(); }}><Icon name="x" size={14} /></button>
      </div>

      <button className="odoo-viewer__nav odoo-viewer__nav--prev" onClick={(e) => { e.stopPropagation(); onPrev(); }} title="Anterior (←)">
        <Icon name="arrow-right" size={18} style={{ transform: "rotate(180deg)" }} />
      </button>
      <button className="odoo-viewer__nav odoo-viewer__nav--next" onClick={(e) => { e.stopPropagation(); onNext(); }} title="Siguiente (→)">
        <Icon name="arrow-right" size={18} />
      </button>

      <div className="odoo-viewer__stage" onClick={(e) => e.stopPropagation()}>
        <FilePreview file={file} />
      </div>
    </div>
  );
}

function FilePreview({ file }) {
  const meta = getMeta(file.ext);

  if (file.objectUrl && isImage(file.ext)) {
    return <img src={file.objectUrl} alt={file.name} className="odoo-viewer__img" />;
  }

  if (file.kind === "synthetic-image") {
    return (
      <svg viewBox="0 0 1200 800" className="odoo-viewer__img" style={{ background: "#fff" }}>
        <defs>
          <linearGradient id={`gv-${file.id}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={`hsl(${file.hue || 220}, 60%, 70%)`} />
            <stop offset="100%" stopColor={`hsl(${(file.hue || 220) + 40}, 60%, 45%)`} />
          </linearGradient>
        </defs>
        <rect width="1200" height="800" fill={`url(#gv-${file.id})`} />
        <g opacity="0.6" stroke="white" fill="white" fillOpacity="0.05" strokeWidth="2">
          <rect x="80" y="80" width="320" height="200" rx="8" />
          <rect x="440" y="80" width="320" height="200" rx="8" />
          <rect x="800" y="80" width="320" height="200" rx="8" />
          <rect x="80" y="320" width="1040" height="400" rx="8" />
        </g>
        <text x="100" y="120" fill="white" fontSize="24" fontFamily="sans-serif" fontWeight="600" opacity="0.9">
          {file.name.replace(/\.[a-z]+$/i, "")}
        </text>
      </svg>
    );
  }

  if (file.kind === "synthetic-pdf") {
    return (
      <div className="odoo-viewer__pdf">
        <div className="pdf-page">
          <div className="pdf-page__brand" style={{ color: meta.color }}>● {file.company || "Propuesta"}</div>
          <h1>{file.title || file.name.replace(/\.pdf$/i, "")}</h1>
          <p style={{ color: "#6b7280" }}>Propuesta comercial preparada para {file.company || "el cliente"}.<br/>Documento confidencial — uso interno y del destinatario.</p>
          <h3>1. Resumen ejecutivo</h3>
          <p>Esta propuesta detalla la modernización de plataforma y el alcance del trabajo a ejecutar en las próximas 12 semanas, incluyendo fases de discovery, implementación piloto y rollout productivo.</p>
          <h3>2. Alcance</h3>
          <ul>
            <li>Discovery técnico + arquitectura target (semanas 1–2)</li>
            <li>Piloto con un caso de uso priorizado (semanas 3–6)</li>
            <li>Rollout completo con soporte L2 (semanas 7–12)</li>
          </ul>
          <h3>3. Inversión</h3>
          <table>
            <thead><tr><th>Concepto</th><th>Cant.</th><th>Subtotal</th></tr></thead>
            <tbody>
              <tr><td>Discovery + arquitectura</td><td>1</td><td>$45,000</td></tr>
              <tr><td>Piloto técnico</td><td>1</td><td>$120,000</td></tr>
              <tr><td>Rollout + capacitación</td><td>1</td><td>$215,000</td></tr>
              <tr><td colSpan="2"><b>Total</b></td><td><b>$380,000</b></td></tr>
            </tbody>
          </table>
          <p style={{ marginTop: 24, color: "#9ca3af", fontSize: 11 }}>Página 1 de 8 · Confidencial</p>
        </div>
      </div>
    );
  }

  if (file.kind === "synthetic-xlsx") {
    const rows = [
      ["Mes",        "Plan",      "Usuarios", "ARR",     "Notas"],
      ["Mes 1",      "Standard",  "150",      "$45,000", "Onboarding"],
      ["Mes 2",      "Standard",  "180",      "$54,000", ""],
      ["Mes 3",      "Standard",  "210",      "$63,000", "Expansion 1"],
      ["Mes 4",      "Pro",       "210",      "$84,000", "Upgrade plan"],
      ["Mes 5",      "Pro",       "240",      "$96,000", ""],
      ["Mes 6",      "Pro",       "260",      "$104,000", "Expansion 2"],
      ["Mes 7",      "Enterprise","260",      "$130,000", "Upgrade plan"],
      ["Mes 8",      "Enterprise","285",      "$142,500", ""],
      ["Mes 9",      "Enterprise","300",      "$150,000", "Q3 review"],
      ["Mes 10",     "Enterprise","320",      "$160,000", ""],
      ["Mes 11",     "Enterprise","340",      "$170,000", ""],
      ["Mes 12",     "Enterprise","360",      "$180,000", "Renewal"],
    ];
    return (
      <div className="odoo-viewer__sheet">
        <table>
          <tbody>
            <tr>
              <th style={{ width: 32 }}></th>
              {rows[0].map((_, c) => <th key={c}>{String.fromCharCode(65 + c)}</th>)}
            </tr>
            {rows.map((r, i) => (
              <tr key={i}>
                <th>{i + 1}</th>
                {r.map((cell, c) => (
                  <td key={c} className={i === 0 ? "is-header" : ""}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (file.textContent) {
    return <pre className="odoo-viewer__text">{file.textContent}</pre>;
  }

  // Fallback — no native preview available
  return (
    <div className="odoo-viewer__fallback">
      <div className="odoo-viewer__fallback-icon" style={{ background: meta.bg, color: meta.color }}>{meta.label}</div>
      <div style={{ fontSize: 16, fontWeight: 500, marginTop: 16 }}>Vista previa no disponible</div>
      <div style={{ fontSize: 13, color: "var(--fg-3)", marginTop: 4 }}>Descargá el archivo para abrirlo en tu aplicación.</div>
      <button className="btn btn--primary" style={{ marginTop: 16 }}>
        <Icon name="download" size={13} /> Descargar {file.name}
      </button>
    </div>
  );
}

window.DealFilesPanel = DealFilesPanel;
window.getFileMeta = getMeta;
window.FileThumbnail = FileThumbnail;
