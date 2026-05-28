# CRM AGILE

CRM bi-workspace (NOVIT × SHARKY) construido sobre React Router v7 + Prisma + Postgres (Neon) + Vercel.

🌐 **Producción**: https://crm-agile.vercel.app
🔐 **Login**: `ltelles@novit.pe` / `NOVIT2023`

---

## Estructura del repo

```
.
├── app/                  ← Aplicación principal (React Router v7 + Prisma)
│   ├── app/              ← Código fuente (routes, components, lib)
│   ├── prisma/           ← Schema + migraciones + seed
│   └── package.json
│
├── DESIGN/               ← Handoff de diseño original (Open Design)
│   └── design_handoff_crm_agile/
│
├── login/                ← Prototipo del login standalone (HTML+CSS+JS vanilla)
│   ├── agile-crm-login.html
│   ├── SPEC.md           ← Especificación técnica del login
│   └── PROMPT.md         ← Instrucciones del handoff
│
└── CRM Agile _standalone_.html  ← Prototipo original del CRM completo
```

## Correr local

```bash
cd app
npm install
npx prisma generate
npm run dev          # → http://localhost:5174
```

Necesitás `.env.local` con `DATABASE_URL` (Neon) + `SESSION_SECRET`. Ver `app/.env.example`.

## Stack

- **Framework**: React Router v7 (framework mode)
- **Lenguaje**: TypeScript 5 strict
- **DB**: PostgreSQL (Neon) + Prisma 6
- **Auth**: cookie session firmada (bcryptjs)
- **UI**: Tailwind v4 + Geist font + tokens CSS custom
- **State**: Zustand (UI only) + loaders (data)
- **Deploy**: Vercel (`@vercel/react-router` preset)
- **Drag & drop**: @dnd-kit/core (Pipeline Kanban)
- **Charts**: SVG inline (sparklines, donuts, gantt)

## Features

- 📊 Dashboard con 16 KPIs (todos con sustento drill-down)
- 🎯 Pipeline editable (etapas CRUD por workspace) — vista Kanban + Lista (Agrupada + Plana)
- 🏢 Cliente 360 con semáforo AI Score + propuestas agrupadas por etapa
- 📅 Forecast 12/24/36 meses (GANTT + SaaS MRR projection)
- 📥 Inbox unificado (WA + email + LinkedIn + menciones)
- 👥 Mantenimiento de usuarios (admin)
- 🏛️ Empresas (SUNAT) — RUC, ubigeo, representante legal
- 🧬 Login con doble hélice ADN animada (canvas)

## Producción

Deploy a Vercel: `cd app && npx vercel --prod`

Env vars necesarias en Vercel:
- `DATABASE_URL` (Neon pooled)
- `DIRECT_URL` (Neon directo, para migraciones)
- `SESSION_SECRET` (cualquier string aleatorio de 32+ chars)
