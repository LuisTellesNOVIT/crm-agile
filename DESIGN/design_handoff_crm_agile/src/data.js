// Synthetic data for NOVIT + SHARKY workspaces
(function() {
  const NOVIT_DEALS = [
    // [name, company, value, stage, daysToClose, ai, owner, since]
    ["Implementación SAP Cloud", "Banco Galicia", 285000, "negotiation", 18, 78, "MP", 42],
    ["Migración AWS multi-región", "YPF", 420000, "proposal", 35, 64, "CG", 30],
    ["Data Lake + Snowflake", "Mercado Libre", 540000, "negotiation", 22, 82, "MP", 55],
    ["Microservicios Onboarding", "Naranja X", 180000, "qualified", 60, 48, "JL", 14],
    ["AI Co-pilot interno", "Telecom", 320000, "proposal", 40, 71, "CG", 28],
    ["Salesforce Service Cloud", "Pampa Energía", 145000, "discovery", 75, 35, "JL", 8],
    ["ERP Microsoft Dynamics", "Arcor", 680000, "negotiation", 28, 74, "MP", 60],
    ["Plataforma e-commerce B2B", "Bagley", 220000, "proposal", 50, 58, "CG", 22],
    ["Data Mesh — fase 2", "BBVA", 380000, "qualified", 65, 52, "JL", 19],
    ["Observabilidad Datadog", "Personal", 95000, "discovery", 80, 28, "MP", 6],
    ["IAM Okta enterprise", "Edenor", 165000, "won", 0, 100, "CG", 92],
    ["Renovación Azure", "Loma Negra", 240000, "won", 0, 100, "MP", 110],
    ["Reskilling Cloud — bootcamp", "Tenaris", 75000, "discovery", 90, 22, "JL", 4],
    ["Plataforma de loyalty", "Carrefour AR", 310000, "proposal", 45, 67, "CG", 26],
    ["Modernización mainframe", "Banco Macro", 920000, "qualified", 110, 56, "MP", 35],
    ["Auditoría Kubernetes", "Despegar", 58000, "negotiation", 12, 81, "JL", 18],
    ["LLM RAG legales", "Estudio Bruchou", 110000, "discovery", 70, 40, "CG", 9],
    ["Renovación licencias VMware", "Aerolíneas", 195000, "proposal", 32, 69, "MP", 24],
    ["Plataforma datos clientes", "Banco Patagonia", 280000, "qualified", 95, 44, "JL", 16],
    ["Cybersecurity assessment", "TGS", 88000, "negotiation", 14, 76, "CG", 20],
    ["Headless CMS", "La Nación", 145000, "discovery", 85, 32, "MP", 11],
    ["MLops platform", "Globant", 260000, "proposal", 48, 63, "JL", 25],
    ["DataBricks adoption", "Pan American Energy", 410000, "qualified", 70, 50, "CG", 17],
    ["Renovación M365 E5", "Techint", 520000, "won", 0, 100, "MP", 130],
    ["Migración SAP S/4HANA", "YPF", 1200000, "lost", 0, 0, "MP", 145],
    ["Service Desk outsourcing", "Banco Galicia", 320000, "lost", 0, 0, "CG", 88],
    ["Renovación Citrix", "Edesur", 175000, "lost", 0, 0, "JL", 72]
  ];

  const SHARKY_DEALS = [
    ["Onboarding Pro — Tier 2", "Rappi", 48000, "negotiation", 20, 80, "AV", 38],
    ["Performance Marketing Q3", "Tiendanube", 36000, "proposal", 30, 62, "RT", 24],
    ["Brand sprint", "Ualá", 28000, "qualified", 55, 45, "NF", 12],
    ["Funnel CRO — checkout", "Mercado Pago", 84000, "negotiation", 25, 77, "AV", 40],
    ["TikTok ads — fase 1", "Bagó Pharma", 22000, "discovery", 75, 30, "NF", 5],
    ["LinkedIn ABM", "Banza", 56000, "proposal", 42, 66, "RT", 28],
    ["SEO técnico", "Almundo", 18000, "negotiation", 10, 84, "AV", 22],
    ["Lifecycle email", "Cabify", 32000, "qualified", 50, 49, "NF", 14],
    ["Webinar funnel", "Hotmart", 14000, "discovery", 88, 26, "RT", 4],
    ["Growth retainer 6m", "Pomelo", 144000, "negotiation", 16, 79, "AV", 45],
    ["Influencers Q3", "Cervecería Andes", 24000, "proposal", 38, 60, "NF", 20],
    ["Whatsapp commerce", "Tiendanube", 41000, "won", 0, 100, "AV", 95],
    ["SaaS landing relaunch", "Wormhole", 19000, "won", 0, 100, "RT", 88],
    ["Product Hunt launch", "Cobre", 28000, "discovery", 65, 34, "NF", 7],
    ["Programa partners", "Auth0 LATAM", 72000, "qualified", 60, 53, "AV", 18],
    ["SDR-as-a-service", "Pedidos Ya", 96000, "proposal", 45, 71, "RT", 30],
    ["UA performance — App", "Cabify", 58000, "discovery", 80, 36, "AV", 8],
    ["Webflow rebuild", "Increase", 22000, "negotiation", 14, 82, "NF", 24],
    ["Marketing audit", "Naranja Café", 12000, "qualified", 52, 47, "RT", 10],
    ["Demand gen LATAM", "Buenbit", 86000, "proposal", 36, 69, "AV", 26],
    ["Eventos Q4", "Brubank", 44000, "discovery", 92, 24, "NF", 3],
    ["Outbound sequence", "Pago Fácil", 33000, "negotiation", 22, 75, "RT", 19],
    ["Webinar production", "Lemon Cash", 18000, "qualified", 58, 42, "AV", 13],
    ["Posicionamiento marca", "Crehana", 65000, "proposal", 50, 64, "NF", 23],
    ["Annual retainer", "Mercado Libre", 240000, "lost", 0, 0, "AV", 95],
    ["Brand campaign", "Naranja X", 78000, "lost", 0, 0, "RT", 60]
  ];

  const STAGES = [
    { id: "discovery",   label: "Discovery",   color: "#94a3b8", prob: 0.10 },
    { id: "qualified",   label: "Qualified",   color: "#0ea5e9", prob: 0.25 },
    { id: "proposal",    label: "Proposal",    color: "#8b5cf6", prob: 0.50 },
    { id: "negotiation", label: "Negotiation", color: "#f59e0b", prob: 0.75 },
    { id: "won",         label: "Closed Won",  color: "#16a34a", prob: 1.00 },
    { id: "lost",        label: "Closed Lost", color: "#94a3b8", prob: 0.00 }
  ];

  const OWNERS = {
    novit: {
      MP: { name: "María Paz Iribarren", role: "Account Executive", color: "#2563eb" },
      CG: { name: "Carlos Giménez",       role: "Senior AE",        color: "#0891b2" },
      JL: { name: "Julián Lazarte",       role: "BDR",              color: "#7c3aed" }
    },
    sharky: {
      AV: { name: "Ariana Vélez", role: "Growth Lead",   color: "#ea580c" },
      RT: { name: "Rodrigo Toledo", role: "Account Manager", color: "#dc2626" },
      NF: { name: "Nicole Funes",  role: "SDR",          color: "#db2777" }
    }
  };

  function expandDeal(d, idx, wsId, today) {
    const [name, company, value, stage, daysToClose, ai, owner, since] = d;
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - since);
    let closeDate;
    if (stage === "won" || stage === "lost") {
      closeDate = new Date(today);
      closeDate.setDate(closeDate.getDate() - Math.floor(since * 0.1));
    } else {
      closeDate = new Date(today);
      closeDate.setDate(closeDate.getDate() + daysToClose);
    }
    return {
      id: `${wsId.toUpperCase()}-${String(idx + 1).padStart(4, "0")}`,
      name, company, value,
      stage, ai, owner,
      probability: STAGES.find(s => s.id === stage).prob,
      createdAt: startDate.toISOString(),
      estimatedCloseAt: closeDate.toISOString(),
      lastActivity: Math.floor(Math.random() * 6),
      contacts: Math.floor(Math.random() * 4) + 1,
      isRecurring: Math.random() < 0.35,
      arr: Math.random() < 0.35 ? Math.round(value * (0.6 + Math.random() * 0.8)) : 0
    };
  }

  function buildWorkspace(wsId, deals) {
    const today = new Date(2026, 4, 18); // May 18, 2026
    return {
      id: wsId,
      deals: deals.map((d, i) => expandDeal(d, i, wsId, today)),
      owners: OWNERS[wsId],
      stages: STAGES,
      today
    };
  }

  window.CRM_DATA = {
    workspaces: {
      novit: buildWorkspace("novit", NOVIT_DEALS),
      sharky: buildWorkspace("sharky", SHARKY_DEALS)
    },
    stages: STAGES
  };
})();
