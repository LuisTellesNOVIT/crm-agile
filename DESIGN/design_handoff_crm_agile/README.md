# Handoff: CRM Agile (NOVIT × SHARKY)

> **Para Claude Code (o cualquier dev):** este paquete describe un CRM multi-workspace pensado para equipos comerciales B2B. El diseño está implementado como un **prototipo HTML/React (Babel in-browser)**. **No es código de producción** — es una **referencia visual y de comportamiento** para reconstruirlo en el codebase real con sus patrones, framework y design system existentes.

---

## 0 · Cómo usar este handoff

1. Lee este README **completo** antes de tocar código.
2. Abrí `CRM Agile.html` en un navegador para explorar el prototipo en vivo. Está todo cableado: navegación, filtros, drawers, command menu (`⌘K`), AI drawer (`⌘J`), tweaks.
3. Los archivos en `src/` son la fuente del prototipo. Léelos como **especificación**, no como código a copiar/pegar.
4. Recreá las pantallas en el codebase de destino usando:
   - Su framework (React, Vue, Next, SvelteKit, etc.) y su design system.
   - Si no hay codebase aún, elegí stack (recomendación al final).
5. Respetá los **tokens, layout y comportamientos** descritos acá — son lo importante.

---

## 1 · Overview

**CRM Agile** es un CRM B2B inspirado en Attio/Linear/Notion: denso, rápido, con teclado de primera, multi-workspace (NOVIT = tech enterprise, SHARKY = growth agency) y una capa de IA conversacional sobre los datos del pipeline.

**Problema que resuelve.** Los CRMs tradicionales (Salesforce, Hubspot) son lentos, sobrecargados y orientados al admin. CRM Agile apunta al **AE/BDR que vive en él 8h/día**: cada acción a un atajo, datos densos sin perder legibilidad, IA contextual, y secuencias de automation que reemplazan el seguimiento manual.

**Workspaces.** Una sola cuenta puede operar **N empresas** con datos aislados (NOVIT y SHARKY de demo). El switcher en la sidebar cambia color de marca, owner por defecto, moneda, y dataset. Hay un modo **"Todas las empresas"** que consolida ambos para comparación.

---

## 2 · Sobre los archivos del paquete

| Carpeta / archivo | Qué es |
|---|---|
| `CRM Agile.html` | Entry point. Carga React 18, Babel standalone, todas las hojas de estilo y todos los componentes JSX. |
| `src/styles.css` | **Design tokens + shell** (sidebar, topbar, botones, chips, tablas, cards). Leer PRIMERO. |
| `src/views.css`, `views2.css`, `views3.css` | Estilos por vista (dashboard, pipeline, forecast, etc). |
| `src/odoo-files.css`, `cust360.css` | Estilos del visor de archivos y de Cliente 360. |
| `src/data.js`, `data-rich.js` | Datos sintéticos (deals, owners, inbox, conversaciones, archivos). En producción esto sale de la API. |
| `src/icons.jsx` | Set de íconos SVG inline. |
| `src/utils.jsx` | Helpers (formato de moneda, fechas, etc). |
| `src/app.jsx` | Shell: Sidebar + Topbar + router de vistas + command menu + tweaks. |
| `src/view-*.jsx` | Una vista por archivo. Cada una exporta su componente a `window`. |
| `src/command-menu.jsx` | `⌘K` palette. |
| `src/tweaks-panel.jsx` | Panel de tweaks (workspace / densidad). |

**Importante:** los `.jsx` se transpilan con Babel-standalone **en el navegador**. Esto es OK para un prototipo pero **inaceptable en producción** — en el codebase real, transpilá normalmente con tu bundler.

---

## 3 · Fidelidad

**Alta fidelidad (hi-fi).** Colores, tipografía, spacing, microcopy y estados están finalizados. El dev debe reconstruirlo **pixel-cercano**, no como wireframe. Las únicas excepciones son los datos (sintéticos, reemplazar con API real) y la IA (acá llama a `window.claude.complete` del runtime de Anthropic.com — en producción usá tu propio backend con la API de Anthropic o el LLM que prefieras).

---

## 4 · Stack del prototipo vs. recomendación de producción

| Capa | Prototipo | Recomendación de producción |
|---|---|---|
| UI | React 18 + JSX in-browser (Babel) | **Next.js 14 (App Router) o Remix** + React 18 con build real |
| Estado | `useState` local + globals en `window.CRM_DATA` | **TanStack Query** para server state, **Zustand** para UI state |
| Estilos | CSS plano + tokens en `:root` | **CSS Modules** o **Tailwind** mapeado a los tokens de `styles.css` |
| Tipografía | Geist + Geist Mono (Google Fonts) | Misma, hosteada via `next/font` |
| Iconos | SVG inline (`src/icons.jsx`) | **Lucide** o **Phosphor** (los íconos del proto son inspirados en Lucide) |
| Datos | JS hardcoded | **API REST/GraphQL** + Prisma (ya hay schema sugerido en la vista `Schema`) |
| Realtime (Inbox / chat) | No implementado | **WebSockets** o Pusher/Ably |
| IA | `window.claude.complete` | **Anthropic API** (Claude Sonnet) + tool use para acciones sobre el CRM |
| Auth | No implementada | **Clerk** o **NextAuth** (multi-tenant) |
| Multi-workspace | Switch en cliente | **Row-level scoping** por `workspace_id` + middleware |

---

## 5 · Design tokens

Copiar **literalmente** del `src/styles.css` — son la fuente de verdad. Resumen:

### Colors (light, default)

```css
/* Surfaces */
--bg: #ffffff;
--bg-2: #fafafa;
--bg-3: #f4f4f5;
--bg-hover: #f4f4f5;
--bg-inverse: #0a0a0a;

/* Borders */
--border: #e7e7e7;
--border-2: #ededed;
--border-strong: #d4d4d4;

/* Text */
--fg: #0a0a0a;
--fg-2: #525252;
--fg-3: #8a8a8a;
--fg-4: #a3a3a3;
--fg-inverse: #fafafa;

/* Workspace accent — mutado por .ws-novit / .ws-sharky */
--accent: #2563eb;        /* NOVIT: indigo */
--accent: #ea580c;        /* SHARKY: naranja */
--accent-fg: #ffffff;

/* Semantic */
--success: #16a34a;  --success-soft: #ecfdf3;
--warning: #d97706;  --warning-soft: #fef6e3;
--danger:  #dc2626;  --danger-soft:  #fdecec;
--info:    #0ea5e9;  --info-soft:    #ecf6fd;
```

### Typography

```css
--font-sans: "Geist", "Inter", system-ui, -apple-system, sans-serif;
--font-mono: "Geist Mono", "JetBrains Mono", ui-monospace, monospace;

--fs-xs: 11px;
--fs-sm: 12px;
--fs-base: 13px;   /* base = 13px, NO 16px — esto es denso a propósito */
--fs-md: 14px;
--fs-lg: 16px;
--fs-xl: 22px;
--fs-2xl: 30px;
```

**Mono** se usa para: IDs de deals (`NOVIT-0012`), URLs del workspace, números financieros (`tnum` activado), KPIs, badges, labels de columnas. El feel "data-app" depende de esto — no lo borres.

### Spacing + geometry

```css
--row-h: 32px;       /* alto fila tabla compact */
--row-h-sm: 26px;
--pad-x: 14px;
--pad-y: 8px;
--gap: 10px;

--radius-sm: 4px;
--radius:    6px;
--radius-lg: 10px;

--shadow-sm: 0 1px 2px rgba(0,0,0,.04);
--shadow:    0 4px 16px rgba(15,23,42,.08), 0 1px 2px rgba(15,23,42,.04);
--shadow-lg: 0 24px 56px -12px rgba(15,23,42,.25), 0 4px 12px rgba(15,23,42,.06);

--nav-w: 232px;       /* ancho sidebar */
```

### Density modes

Body class `density-compact` (default) y `density-cozy` cambian `--row-h`, `--pad-x`, `--fs-base`. La cozy sube fila a 38px y base a 14px — útil para usuarios con monitores chicos.

---

## 6 · App shell

```
┌──────────┬────────────────────────────────────────────────┐
│          │  Topbar (48px)                                 │
│ Sidebar  ├────────────────────────────────────────────────┤
│ (232px)  │                                                │
│          │  View (scrollable)                             │
│          │                                                │
└──────────┴────────────────────────────────────────────────┘
```

`grid-template-columns: 232px 1fr; height: 100vh; overflow: hidden;`

### Sidebar (`src/app.jsx` → `Sidebar`)

- **Brand block** (48px): `WsSwitcher` dropdown con avatar de letra (NOVIT="N" indigo, SHARKY="S" naranja, Todas="★") + nombre + URL en mono. Click abre menú con las 3 opciones + "Nuevo workspace".
- **Search row**: pseudo-input que abre `⌘K`. Muestra `kbd ⌘ K` a la derecha.
- **Nav groups**:
  - *(sin label)* Dashboard, Inbox (badge unread), Pipeline, Forecast (GANTT), Cliente 360, Conversaciones.
  - **AUTOMATION**: Templates, Secuencias.
  - **DATA MODEL**: Custom objects, Schema (Prisma).
- **Footer**: avatar del usuario actual (MP/AV) + nombre + rol + icono settings.

### Topbar (`src/app.jsx` → `Topbar`)

`workspace › view-actual` (breadcrumbs en mono) … `extraActions` (por vista) · `USD|PEN` toggle · `⌘K` button · `Filtros (n)` · `✦ Pedir a la IA` · `+ Nuevo lead` (primary, negro) · settings icon.

---

## 7 · Vistas (10 + drawers)

### 7.1 Dashboard (`view-dashboard.jsx` + `view-dashboard-addons.jsx`)

KPIs en cards (Pipeline total, Deals abiertos, Reuniones agendadas, Reply rate, etc) + gráficos de tendencia (sparklines con `path` + `linearGradient`) + lista de deals "necesitan atención" + actividad reciente.

**Comportamiento:** click en KPI abre `KPIDetailView`. Cards respetan `--accent` del workspace activo. En modo "Todas las empresas" los datos son agregados de NOVIT + SHARKY.

### 7.2 Inbox (`view-inbox-pipeline.jsx`)

Cliente de mensajería tipo Front/Missive. Lista de hilos a la izquierda (con avatar, snippet, timestamp, unread dot), conversación al centro (WhatsApp + Email + LinkedIn unificado), panel de contexto a la derecha (deal asociado, próximas acciones, AI suggestions).

**Filtros en topbar:** Todos / No leídos / Asignados a mí / Sin respuesta.

### 7.3 Pipeline (`view-inbox-pipeline.jsx` → `PipelineView`)

Kanban por stage (Discovery → Qualified → Proposal → Negotiation → Closed Won/Lost). Cards: nombre del deal, empresa, valor en mono, owner avatar, AI score (0–100), días en stage.

**Drag-and-drop entre columnas** muta `window.CRM_DATA` vía `onUpdateDeal` y recalcula probability automáticamente (cada stage tiene `prob` fijo: 10/25/50/75/100/0%).

### 7.4 Forecast / GANTT (`view-forecast.jsx`)

Vista temporal de deals abiertos con barra horizontal desde `startDate` hasta `closeDate`. Cada barra coloreada por stage, con tooltip del valor y AI score. Útil para ver carga por trimestre.

### 7.5 Cliente 360 (`view-customer.jsx` + `cust360.css`)

Detalle de empresa: razón social, industria, sitio web, empleados, región, deals asociados (tabla), histórico de actividad, archivos compartidos. Estilo "ficha" con `FormRow` (k=label, v=value).

### 7.6 Deal detail (`view-deal.jsx`, `view-deal-files.jsx`, `view-deal-composer.jsx`)

Overlay full-page que reemplaza la vista cuando hay `selectedDealId`. Tabs: **Detalle · Archivos · Componer**.

- **Detalle**: campos editables inline, próxima acción, timeline.
- **Archivos** (`view-deal-files.jsx`): grid de thumbnails + viewer estilo Odoo. Soporta drag-drop con `URL.createObjectURL` (preview de imágenes subidas por el usuario). Archivos sintéticos usan SVG generado on-the-fly.
- **Componer**: editor multi-canal (Email / WhatsApp / LinkedIn) con plantillas, variables `{{first_name}}`, vista previa, y configuración WABA (Meta WhatsApp Business) paso a paso.

### 7.7 Templates · Secuencias · Custom Objects (`view-templates-seq-obj.jsx`)

- **Templates**: catálogo de plantillas de mensaje por canal con uso y reply rate.
- **Secuencias**: editor de flujos automáticos (trigger → delay → action → condition → exit). Cada paso es una card. Exit triggers en panel lateral. Ejemplo: "Lead inbound — onboarding 7 días" con 1284 enrolados, 41% reply rate.
- **Custom objects**: builder de objetos custom (fields, types, relations) tipo Notion/Airtable.

### 7.8 Schema / Prisma (`view-schema.jsx`)

Vista del modelo de datos como código Prisma + diagrama de relaciones. Es la **fuente de verdad para la API**.

### 7.9 Settings (`view-settings.jsx`)

Workspace, currency + tipos de cambio editables (PEN/EUR/MXN/BRL), colores de marca por workspace, matriz de permisos por rol, tema light/dark, densidad.

### 7.10 New Lead drawer (`view-newlead.jsx`)

Drawer desde la derecha. Form: nombre, empresa, valor estimado, fuente (FB Ads / Web / LinkedIn / Referido), owner, stage. Crea el lead y lo agrega al pipeline.

### 7.11 AI drawer (`view-ai.jsx`)

Drawer derecho con chat. Recibe `contextHint` (ej: "el usuario está viendo deal NOVIT-0012") y arma el prompt. **En el proto** llama a `window.claude.complete`; **en producción** apuntá a tu backend con la API de Anthropic + tool use para que el modelo pueda leer/escribir deals.

### 7.12 Command menu (`command-menu.jsx`)

Modal `⌘K` con búsqueda fuzzy sobre: vistas, deals, workspaces, acciones rápidas (Crear lead, Abrir IA…). Inspiración: Linear / Raycast.

---

## 8 · Componentes reusables (atomic)

Todos están en `src/styles.css`. Mapealos 1:1 a tu DS:

| Clase | Componente | Notas |
|---|---|---|
| `.btn`, `.btn--primary`, `.btn--accent`, `.btn--ghost`, `.btn--icon`, `.btn--filtered` | Button | Primary es **inverse** (negro/blanco), no accent. |
| `.kbd` | Keycap | Mono 10px, borde inferior 1.5px. |
| `.chip`, `.chip--accent`, `.chip--success`, `.chip--warn`, `.chip--danger`, `.chip--info`, `.chip--dot` | Badge / Pill | Mono. `--dot` agrega ::before circular. |
| `.dot--success`, `--warn`, `--danger`, `--info`, `--muted` | Status dot | 8×8 circle. |
| `.tabs`, `.tab.is-active` | Tabs | Underline 2px en activo. |
| `.card`, `.card__h`, `.card__b`, `.card__sub` | Card | Header con label mono uppercase. |
| `.table` | Data table | Header sticky, mono uppercase, hover row. |
| `.mono`, `.muted`, `.muted-2` | Type utilities | |
| `.avatar` | Avatar | 26×26, gradient by workspace. |

---

## 9 · Interacciones & atajos

| Atajo | Acción |
|---|---|
| `⌘K` / `Ctrl+K` | Abre command menu |
| `⌘J` / `Ctrl+J` | Abre AI drawer |
| `Esc` | Cierra command menu / drawers |
| Click en row | Abre deal detail (overlay) |
| Drag card entre columnas (Pipeline) | Cambia stage + recalcula probability |
| Click workspace en sidebar | Abre switcher, cambia accent + dataset |

**Transiciones globales:** `transition: background .12s, border-color .12s;` en botones y rows. No usar transiciones de más de 200ms — el feel es snappy.

---

## 10 · Estado global (sugerencia para producción)

En el proto está en `window.CRM_DATA` + `useState` por componente. Para producción:

```ts
// Zustand store sugerido
{
  workspace: 'novit' | 'sharky' | 'all',
  currency: 'USD' | 'PEN',
  density: 'compact' | 'cozy',
  theme: 'light' | 'dark',
  filters: { stage?, owner?, valueMin?, valueMax?, source?, ... },
  ui: {
    cmdkOpen, aiOpen, newLeadOpen, filtersOpen,
    selectedDealId, customerInitial
  }
}

// React Query keys
['deals', workspace, filters]
['deal', dealId]
['customer', companyName]
['inbox', workspace]
['kpis', workspace, dateRange]
['sequences', workspace]
```

---

## 11 · Datos sintéticos → API real

Reemplazá `src/data.js` y `src/data-rich.js` por endpoints reales. El shape mínimo de un deal:

```ts
type Deal = {
  id: string;              // "NOVIT-0012"
  name: string;
  company: string;
  value: number;           // USD base
  stage: 'discovery' | 'qualified' | 'proposal' | 'negotiation' | 'won' | 'lost';
  probability: number;     // 0..1, derivado de stage pero override-able
  ai: number;              // 0..100 score IA
  owner: string;           // owner key, ej "MP"
  startDate: string;       // ISO
  closeDate: string;       // ISO
  workspace: 'novit' | 'sharky';
  source?: 'fb_ads' | 'web' | 'linkedin' | 'referral';
  // ...campos custom según workspace
}
```

Mirá el schema completo en la vista **Schema (Prisma)** del proto.

---

## 12 · Cosas que el dev DEBE conservar (no negociables)

1. **Densidad por defecto.** `--fs-base: 13px` y filas de 32px. Si los subís a 16/40 perdés el feel completo.
2. **Mono para todo lo "técnico"**: IDs, URLs, money, KPIs, labels uppercase. Sin mono el producto se ve como un Hubspot más.
3. **Accent dinámico por workspace.** No hardcodees indigo — leé `--accent`.
4. **Primary button = inverse (negro).** No es accent. Convención Linear.
5. **`⌘K` y `⌘J`.** Son la identidad del producto. Sin ellos es solo otro CRM.
6. **Sidebar fija a 232px, topbar fija a 48px, body con `overflow:hidden`.** El scroll vive en `.view`. Cualquier "scroll de la página entera" rompe el shell.
7. **Filtros consolidados arriba con count badge.** Los filtros NO van en cada vista — son globales.

---

## 13 · Cosas que se pueden mejorar / fuera de scope del proto

- **Mobile / responsive.** El proto es desktop-only (1280+). Para mobile habrá que rediseñar sidebar como bottom-nav.
- **Accesibilidad.** Hay basics (semántica, contrast OK) pero falta foco visible consistente y aria en command menu.
- **Tests.** Cero. Agregar Playwright para flujos críticos (crear lead → mover stage → ganar).
- **i18n.** Hardcodeado en español. Si hace falta inglés, externalizar copies.
- **Permisos.** La matriz en Settings es decorativa — la lógica real va en el backend.
- **Realtime.** Inbox/Conversaciones necesitan WebSockets para producción.

---

## 14 · Decisiones de diseño explicadas

Por si el dev se pregunta "¿por qué esto así?":

- **¿Por qué Geist?** Geometría neutra, óptima para datos densos. Es lo que usa Vercel/Linear/Resend — encaja con la audiencia (devs y operadores técnicos).
- **¿Por qué negro como primary?** Linear lo hizo regla; visualmente "pesa" más que un accent color y deja al accent libre para estados de selección.
- **¿Por qué multi-workspace en sidebar?** El usuario objetivo gestiona varias empresas (consultoría, agencia, holding). Aislamiento de datos + switch rápido es feature core, no edge case.
- **¿Por qué IA como drawer y no chat de pantalla completa?** Tiene que convivir con la vista actual para que el contexto (deal seleccionado, filtros aplicados) entre al prompt. Drawer = contexto visual + acción rápida.
- **¿Por qué tweaks de densidad?** Hay 2 personas reales: la que tiene un MBP 14" y necesita ver todo, y la que tiene un 27" y prefiere descansar la vista. Una sola densidad no las contenta.

---

## 15 · Checklist de implementación

```
[ ] Tokens copiados a tailwind.config.ts o tokens.css
[ ] Geist + Geist Mono cargadas (next/font)
[ ] Sidebar + Topbar shell con grid 232px 1fr
[ ] Componentes atomic: Button, Chip, Kbd, Card, Table, Avatar
[ ] Workspace switcher + accent dinámico (CSS vars mutadas por clase en body)
[ ] Command menu (⌘K) con fuzzy search
[ ] AI drawer (⌘J) conectado a /api/ai (Anthropic SDK)
[ ] Dashboard con KPIs + sparklines
[ ] Pipeline kanban con DnD entre stages (dnd-kit)
[ ] Forecast (GANTT) con barras temporales
[ ] Cliente 360
[ ] Deal detail overlay con tabs (Detalle / Archivos / Componer)
[ ] Inbox unificado (Email + WhatsApp + LinkedIn)
[ ] Templates / Secuencias / Custom Objects
[ ] Schema viewer (renderizar el Prisma actual del repo)
[ ] Settings: workspace, currency, FX, brand colors, permisos, theme, density
[ ] New Lead drawer
[ ] Filters globales con count badge en topbar
[ ] Auth multi-tenant (workspace_id en cada query)
[ ] Tests Playwright de flujos críticos
```

---

## 16 · Contacto

Si hay dudas al reconstruir, lo más rápido es:
1. Abrí el HTML, encontrá el componente que te confunde, inspeccionalo con devtools.
2. Buscá la clase CSS en `src/styles.css` (o `views*.css`).
3. Si sigue confuso, hablá con Sharky (el diseñador) y pedile el contexto.

Suerte. ✦
