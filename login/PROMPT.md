# Prompt para Claude Code

Pega este bloque completo como **primer mensaje** en Claude Code, en una carpeta donde estén también `SPEC.md` y `agile-crm-login.html`.

---

## Versión recomendada — Next.js 14 + TypeScript + Tailwind

```
Hola. Tienes 3 archivos en esta carpeta:

1. `SPEC.md` — especificación técnica completa del login. Léelo entero antes de empezar.
2. `agile-crm-login.html` — prototipo visual de referencia (HTML/CSS/JS vanilla, todo inline). Es el target visual exacto: cópialo pixel a pixel en cuanto a paleta, tipografía, animaciones canvas, y sobre todo la INTEGRACIÓN VISUAL (la caja de login flota encima de la hélice como una sola unidad, no es un layout de dos columnas).
3. `PROMPT.md` — este mensaje.

Tu tarea: portar el prototipo a una aplicación Next.js 14 (App Router) + TypeScript + Tailwind CSS, siguiendo exactamente la estructura de archivos, tokens, contratos de auth y criterios de aceptación que están en `SPEC.md`.

Empieza por:

1. Leer `SPEC.md` completo y `agile-crm-login.html` para tener el contexto visual.
2. Crear el proyecto Next.js con `pnpm dlx create-next-app@latest . --typescript --tailwind --app --no-src-dir --import-alias "@/*"`.
3. Configurar los tokens OKLch en `app/globals.css` y extender el theme de Tailwind.
4. Implementar componentes en este orden, validando cada uno visualmente:
   a. `app/(auth)/layout.tsx` — AuthStage: lienzo único con la hélice ocupando todo el viewport + caja flotante encima (NO un grid de dos columnas).
   b. `components/visuals/HelixCanvas.tsx` — doble hélice vertical principal, centro horizontal al ~30-35% del ancho del viewport para que la caja a la derecha la tenga de fondo sin que el eje principal pase por encima del formulario.
   c. `components/visuals/AppStrandCanvas.tsx` — strand horizontal en sentido inverso (tiempo negativo).
   d. `components/auth/BrandMark.tsx` — "C R M · A G I L E" con nucleótidos pulsantes desfasados.
   e. `components/auth/AuthCard.tsx` — caja translúcida con `backdrop-filter: blur`, 4 esquinas brutalistas, hilo conector horizontal (`::before` con gradiente) y nucleótido luminoso de conexión (`::after`).
   f. `components/auth/LoginForm.tsx` — email + password + recuperar + ir a registro.
   g. `components/auth/RegisterForm.tsx` — nombre + email + password + confirm + PasswordStrength.
   h. `components/auth/RecoverSheet.tsx` — sheet que entra desde abajo dentro del área de la caja (NO modal centrado, NO full-screen).
   i. `components/visuals/Annotations.tsx` y `components/visuals/SequenceTicker.tsx` — capa de UI de laboratorio (anotaciones en esquinas, ticker inferior con secuencia viva).
   j. `lib/auth.ts`, `lib/validators.ts`, `lib/dna.ts`.

5. Verificar contra la checklist de aceptación de `SPEC.md` sección 11. PRESTAR ATENCIÓN ESPECIAL a:
   - La caja debe estar visualmente integrada con la hélice — no debe haber una línea vertical que separe el lienzo en dos.
   - El `backdrop-filter` debe verse activo: la hélice debe verse esmerilada cruzando por detrás del formulario.
   - El hilo conector horizontal con gradiente cyan→green sale de la izquierda y entra al borde izquierdo de la caja.
   - Las 4 esquinas brutalistas (brackets) están en las esquinas de la caja.
   - El responsive < 980px desacopla la caja del flotado y oculta hilo conector + esquinas.

6. Ejecutar `pnpm dev`, abrir el navegador y comparar visualmente con `agile-crm-login.html` lado a lado.

Restricciones:
- Toda la UI en español.
- No inventes campos extra (Recordarme, SSO, 2FA) — el brief son solo email + password + recuperar + registro.
- No uses Inter como fuente display — es Space Grotesk.
- No conviertas el sheet de recuperación en un modal centrado.
- Si tienes dudas sobre cualquier decisión, consulta primero `SPEC.md`; ahí están todas las decisiones tomadas.

Cuando termines, dime qué hiciste y qué quedó pendiente.
```

---

## Variantes según stack

### Si prefieres Vite + React SPA (sin Next.js)

Reemplaza el paso 2 por:

```
2. Crear el proyecto con `pnpm create vite@latest . --template react-ts` + instalar Tailwind manualmente (`pnpm add -D tailwindcss postcss autoprefixer`) y configurar `tailwind.config.js`, `postcss.config.js`, `src/index.css`.
```

Y mueve la estructura `app/(auth)` a `src/routes/auth/*` con `react-router-dom`.

### Si prefieres HTML/CSS/JS vanilla (sin framework)

Reemplaza el paso 2 por:

```
2. Crear estructura: `index.html` + `assets/css/tokens.css` + `assets/css/layout.css` + `assets/css/components.css` + `assets/js/helix.js` + `assets/js/strand.js` + `assets/js/auth.js` + `assets/js/validators.js`. No uses bundler. ES modules nativos. Importa fuentes de Google Fonts.
```

Salta los componentes React y trabaja con módulos JS clásicos. El `SPEC.md` sigue siendo válido como contrato (ignora la sección de tipos `.tsx` y RSC).

### Si solo quieres frontend (sin auth real)

Añade al final del prompt:

```
NOTA: el integrador conectará el provider real después. Implementa `lib/auth.ts` como stubs que devuelven `{ ok: true, userId: 'demo', redirectTo: '/dashboard' }` tras 600ms de delay. No instales Supabase, Auth0, NextAuth ni configures middleware de protección de rutas.
```

---

## Cómo usar este prompt

1. Crea una carpeta nueva en tu máquina.
2. Copia los 3 archivos del proyecto Open Design ahí (`agile-crm-login.html`, `SPEC.md`, `PROMPT.md`).
3. `cd` a la carpeta y abre Claude Code (`claude`).
4. Pega el bloque de la versión recomendada (o la variante que apliques) como primer mensaje.
5. Claude Code leerá `SPEC.md` y `agile-crm-login.html` automáticamente porque el prompt se lo indica.
6. Responde a sus preguntas basándote en `SPEC.md`; ahí están todas las decisiones tomadas.

Si hay tweaks visuales que quieras hacer después (cambiar acento, ajustar tamaños), edítalos primero en `SPEC.md` antes de pedírselos a Claude Code — el SPEC es la fuente de verdad.
