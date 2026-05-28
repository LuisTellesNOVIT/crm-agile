# CRM AGILE — Login · Especificación técnica

Brief para handoff a Claude Code. El prototipo visual de referencia está en `agile-crm-login.html` (HTML + CSS + JS vanilla, todo inline). Tu trabajo es portarlo a una aplicación real, manteniendo **exactamente** la dirección de arte, la integración visual (la caja de login flota sobre la hélice como una sola unidad) y las animaciones.

---

## 1. Stack recomendado

Si no hay restricción previa, usa:

- **Next.js 14+ (App Router)** con TypeScript.
- **Tailwind CSS** para utilities + un archivo `globals.css` con los tokens OKLch del prototipo bajo `:root`.
- **Fuentes**: `Space Grotesk` (display) y `JetBrains Mono` (mono) vía `next/font/google`. El body usa la system stack (`-apple-system, BlinkMacSystemFont, ...`).
- **Componentes**: React Server Components donde aplique; los componentes con animación canvas y estado de formulario son `'use client'`.
- **Validación de formularios**: `react-hook-form` + `zod`.
- **Auth**: dejar abstraído detrás de un `lib/auth.ts` con tres funciones (`signIn`, `signUp`, `requestPasswordReset`) que el integrador conecta a Supabase, Auth0, NextAuth o backend propio.

Si el equipo prefiere otro stack (Vue, Vite SPA, Remix), portar los mismos contratos.

---

## 2. Estructura de archivos esperada

```
app/
├── (auth)/
│   ├── layout.tsx              # AuthStage: lienzo único con hélice + card flotante
│   ├── login/page.tsx          # tab activa: login
│   ├── register/page.tsx       # tab activa: registro
│   └── recover/page.tsx        # sheet de recuperación (también accesible como pseudo-modal)
├── globals.css                 # tokens OKLch + reset + grid de fondo
└── layout.tsx                  # root layout, fuentes, metadata

components/
├── auth/
│   ├── AuthStage.tsx           # lienzo único: hélice ocupa todo + card flotante encima
│   ├── AuthCard.tsx            # caja translúcida con backdrop-filter blur + esquinas decorativas
│   ├── LoginForm.tsx
│   ├── RegisterForm.tsx
│   ├── RecoverSheet.tsx        # sheet animada (no modal centrado)
│   ├── BrandMark.tsx           # "C R M · A G I L E" con nucleótidos pulsantes
│   ├── PasswordStrength.tsx    # 4 barras según fuerza
│   └── PasswordReveal.tsx      # botón mostrar/ocultar
└── visuals/
    ├── HelixCanvas.tsx         # doble hélice vertical principal (canvas #helix, full viewport)
    ├── AppStrandCanvas.tsx     # strand horizontal bajo el wordmark, sentido inverso
    ├── Annotations.tsx         # coordenadas tipo laboratorio (esquinas del lienzo)
    ├── CardConnector.tsx       # hilo horizontal que conecta hélice → caja (puede ser CSS puro)
    └── SequenceTicker.tsx      # banda inferior ATCG en vivo

lib/
├── auth.ts                     # contrato signIn / signUp / requestReset (mockeable)
├── validators.ts               # esquemas zod
└── dna.ts                      # utilidades: generar secuencia, complemento, etc.

public/
└── (favicon, og)
```

---

## 3. Tokens de diseño (copiar literal a `globals.css`)

```css
:root {
  --bg:        oklch(98% 0.004 250);
  --bg-2:      oklch(99% 0.003 250);
  --surface:   oklch(100% 0 0);
  --surface-2: oklch(96% 0.006 250);
  --fg:        oklch(20% 0.025 250);
  --fg-2:      oklch(30% 0.025 250);
  --muted:     oklch(46% 0.020 250);
  --muted-2:   oklch(62% 0.018 250);
  --border:    oklch(90% 0.008 250);
  --border-strong: oklch(80% 0.012 250);
  --accent:    oklch(58% 0.18 215);   /* cian principal */
  --accent-2:  oklch(55% 0.18 155);   /* verde bio */
  --accent-3:  oklch(62% 0.20 25);    /* rojo/coral */
  --accent-4:  oklch(70% 0.16 75);    /* ámbar */
  --danger:    oklch(58% 0.22 25);

  /* nucleótidos — usar por letra del wordmark y por par de bases del helix */
  --n-a: oklch(58% 0.18 215);   /* A → cian */
  --n-t: oklch(62% 0.20 15);    /* T → rosa/coral */
  --n-g: oklch(55% 0.18 155);   /* G → verde */
  --n-c: oklch(70% 0.17 80);    /* C → ámbar */

  --font-display: 'Space Grotesk', system-ui, sans-serif;
  --font-body:    -apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif;
  --font-mono:    'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
}
```

Configurar Tailwind `theme.extend.colors` para exponer estos tokens como `bg`, `surface`, `fg`, `muted`, `border`, `accent`, `accent-2`, `n-a`, `n-t`, `n-g`, `n-c`, etc.

---

## 4. Layout — **lienzo único, NO split de dos columnas**

**Este es el cambio más importante.** El login y la hélice forman **una sola unidad espacial**, no dos paneles divididos. La hélice ocupa todo el viewport y la caja de login flota encima como un instrumento translúcido.

### 4.1 Estructura

```
.stage (position: relative; height: 100vh; width: 100%; overflow: hidden)
├── body::before               → grid de fondo (líneas cada 80px, fade radial al centro)
├── .canvas-side (absolute; inset:0; pointer-events:none)
│   ├── <canvas id="helix">    → doble hélice ocupa el viewport completo
│   ├── .brand-mark            → top:36px; left:44px  (CRM AGILE + strand horizontal)
│   ├── .annot (×4)            → esquinas, coordenadas de laboratorio
│   ├── .headline-block        → bottom:96px; left:44px (kicker + headline + lede)
│   └── .ticker                → bottom:28px; left:44px; right:44px (sequence live)
└── .auth-side (absolute; top:50%; right:6vw; translateY(-50%); z-index:5)
    └── .auth-card             → caja translúcida + esquinas decorativas + conector
```

- **No hay `display: grid` con dos columnas.** El `.stage` es `position: relative` y todos los hijos son `position: absolute`.
- La caja vive **encima** de la hélice. La transparencia + `backdrop-filter: blur` es lo que crea la sensación de "una sola pieza": la hélice cruza por detrás de la caja y se ve esmerilada a través del cristal.
- `.canvas-side` lleva `pointer-events: none` para que clicks pasen al fondo, **excepto** el wordmark, ticker, anotaciones y headline que reactivan `pointer-events: auto`.

### 4.2 La caja de login (`.auth-card`)

```css
.auth-card {
  position: relative;
  width: 100%;
  min-width: 380px;
  max-width: 420px;
  padding: 40px 40px 32px;
  background: linear-gradient(180deg,
    oklch(99% 0.004 250 / .82),
    oklch(98% 0.005 250 / .78));
  backdrop-filter: blur(18px) saturate(140%);
  -webkit-backdrop-filter: blur(18px) saturate(140%);
  border: 1px solid oklch(85% 0.012 250 / .65);
  border-radius: 6px;
  box-shadow:
    0 1px 0 oklch(100% 0 0 / .8) inset,
    0 24px 56px -12px oklch(35% 0.06 250 / .18),
    0 6px 18px -6px oklch(35% 0.06 250 / .14),
    0 0 0 1px oklch(58% 0.18 215 / .03);
}
```

- Fondo **translúcido** (no sólido) — la hélice debe verse esmerilada detrás.
- Radio pequeño (6px), no `rounded-xl`. Es un instrumento, no una card de SaaS.
- Sombra suave + glow azul cyan al 3% para sugerir que la caja "irradia" desde la hélice.

### 4.3 Hilo conector (`.auth-card::before`)

Una línea horizontal sale del eje de la hélice (lado izquierdo del viewport) y entra al borde izquierdo de la caja. Termina en un punto luminoso verde (`.auth-card::after`).

```css
.auth-card::before {
  content: '';
  position: absolute;
  left: -14vw; top: 50%;
  width: 14vw; height: 1px;
  background: linear-gradient(90deg,
    transparent 0%,
    oklch(58% 0.18 215 / .35) 30%,
    oklch(55% 0.18 155 / .55) 80%,
    oklch(55% 0.18 155 / .9) 100%);
  pointer-events: none;
}
.auth-card::after {
  content: '';
  position: absolute;
  left: -5px; top: 50%;
  width: 10px; height: 10px;
  border-radius: 50%;
  background: var(--accent-2);
  box-shadow: 0 0 12px var(--accent-2);
  transform: translateY(-50%);
  animation: blink 1.8s ease-in-out infinite;
}
```

Este conector es **funcionalmente decorativo pero conceptualmente crítico**: es el "registro" que cose la hélice con el formulario. No lo simplifiques ni lo elimines.

### 4.4 Esquinas decorativas brutalistas

Cuatro brackets en `::before / ::after` de cuatro `<span>` (o usando un componente `<CardCorners />`) — refuerzan que la caja es parte de un aparato de laboratorio, no un panel aislado.

```css
.card-corner {
  position: absolute;
  width: 14px; height: 14px;
  border-color: var(--border-strong);
  border-style: solid;
  border-width: 0;
}
.card-corner.tl { top: -1px; left: -1px; border-top-width: 1px; border-left-width: 1px; }
.card-corner.tr { top: -1px; right: -1px; border-top-width: 1px; border-right-width: 1px; }
.card-corner.bl { bottom: -1px; left: -1px; border-bottom-width: 1px; border-left-width: 1px; }
.card-corner.br { bottom: -1px; right: -1px; border-bottom-width: 1px; border-right-width: 1px; }
```

### 4.5 Grid de fondo

```css
body::before {
  content: ''; position: fixed; inset: 0;
  background-image:
    linear-gradient(to right,  oklch(80% 0.012 250 / .35) 1px, transparent 1px),
    linear-gradient(to bottom, oklch(80% 0.012 250 / .35) 1px, transparent 1px);
  background-size: 80px 80px;
  mask-image: radial-gradient(ellipse at center, rgba(0,0,0,.55) 0%, transparent 78%);
  pointer-events: none; z-index: 0;
}
```

---

## 5. Animaciones canvas — lo crítico

Las animaciones son la firma del diseño. **No las simplifiques a una imagen estática ni a CSS puro.** Son dos canvas independientes:

### 5.1 `HelixCanvas` (principal, vertical, **full viewport**)

- Canvas absoluto que cubre toda `.canvas-side` (`position:absolute; inset:0; width:100%; height:100%`). **Ahora ocupa el viewport completo**, no solo la mitad izquierda.
- Doble hélice descendente con pares de bases conectándolas.
- Eje vertical: la hélice "fluye" hacia abajo con el tiempo. Eje horizontal: dos sinusoides desfasadas 180° (`x1 = cx + amp * sin(t)`, `x2 = cx + amp * sin(t + π)`).
- El centro horizontal (`cx`) debe colocarse aproximadamente al **30–35% del ancho del viewport** (no al 50%), para que la caja flotante a la derecha tenga la hélice de fondo pero sin que el eje principal pase por el centro de la caja. La hélice cruza por detrás de la caja a través de sus extremos, no atravesando el formulario.
- Pares de bases: cada N pasos se dibuja una línea entre las dos hebras + dos círculos en los extremos coloreados por nucleótido (A/T/C/G).
- Pareo correcto: A-T y G-C (complementarios).
- `requestAnimationFrame` loop. Resolución: `devicePixelRatio` (canvas scaling correcto en retina).
- Resize: re-escalar canvas en `window.resize` (debounced).
- Pause cuando `document.hidden` para no quemar CPU.

### 5.2 `AppStrandCanvas` (secundario, horizontal, sentido inverso)

- Canvas pequeño debajo del wordmark "CRM AGILE", aproximadamente 240px ancho × 22px alto.
- **Mismo efecto** que el principal pero **horizontal** y con la variable de tiempo **negativa** (`t = -performance.now() * speed`) para que corra en sentido opuesto.
- Mismas dos sinusoides desfasadas, mismos pares de bases coloreados.
- Loop independiente; comparte la utility `dna.ts` para generar la secuencia.

### Variables a tunear (exponer como props)

```ts
type HelixConfig = {
  amplitude: number;       // px — anchura de la onda
  wavelength: number;      // px — distancia vertical entre crestas
  speed: number;           // multiplicador de tiempo (negativo invierte)
  baseSpacing: number;     // px — cada cuántos px se dibuja un par
  strandWidth: number;     // grosor de la hebra
  baseRadius: number;      // radio del círculo en cada extremo del par
  fade: number;            // alpha aplicada por distancia al borde
  centerX: number | string;// posición horizontal del eje (px o '30%')
};
```

---

## 6. Componentes — comportamiento

### `BrandMark`

- Texto "C R M · A G I L E" con cada letra como `<span class="al">` independiente.
- Cada letra coloreada por nucleótido siguiendo un patrón cíclico A/T/G/C (cyan, rosa, verde, ámbar) — se pasa por inline `style="--c: var(--n-a)"`.
- Punto pulsante debajo de cada letra (`::after`), animación `nucPulse 2.4s` con `animation-delay` escalonado (`.15s` × índice).
- Tamaño: 38px display, weight 700, `letter-spacing: -0.035em`.
- Hover por letra: `translateY(-1px)` + `color` cambia al nucleótido asignado.
- Debajo del wordmark, el `AppStrandCanvas` horizontal (240×22).
- Debajo del strand, una micro-etiqueta mono uppercase `app-meta` con info de build/version (opcional).

### `LoginForm` (Email + contraseña — únicos campos del brief)

- Campos: `email` (required, formato email), `password` (required, min 8).
- Botón "Mostrar / Ocultar" en el input de contraseña (`PasswordReveal`).
- Link "¿Olvidaste tu contraseña?" abre `RecoverSheet`.
- CTA primario: "Descifrar acceso" (gradiente cyan→green, 52px altura).
- En submit: llamar `auth.signIn(email, password)`. Mostrar errores debajo de los campos.
- **No incluir** Recordarme, SSO, 2FA — no estaban en el brief.

### `RegisterForm`

- Campos: `nombre`, `email`, `password`, `confirmPassword`.
- `PasswordStrength` debajo del input de contraseña: 4 barras que se llenan según reglas (longitud ≥ 8, mayúsculas, números, símbolos).
- CTA: "Generar workspace".

### `RecoverSheet`

- **No es un modal centrado**. Es una sheet que entra desde abajo, *dentro* del área de la caja (no full-screen), con transición CSS (`transform: translateY(100%) → translateY(0)`, `transition: transform .35s cubic-bezier(.2, .8, .2, 1)`).
- Contiene: input email + CTA "Re-secuenciar acceso" + botón "Volver".
- Mantiene la misma estética translúcida que la caja madre.

### `SequenceTicker`

- Banda inferior del lienzo (`position: absolute; bottom: 28px; left: 44px; right: 44px`).
- Muestra una secuencia ATCG en vivo, scroll a la izquierda continuo, con un nucleótido pulsante destacado.
- Etiquetas: "SEQUENCE LIVE", coordenadas, dot verde pulsante.
- `pointer-events: auto` para permitir hover/tooltip futuro.

### `Annotations`

- Cuatro etiquetas tipo plano de laboratorio en las esquinas del lienzo: coordenadas, IDs de muestra, profundidad de secuenciación. Texto mono uppercase 10.5px, `letter-spacing: 0.16em`, color `--muted-2`.
- Cada anotación tiene una línea horizontal de 30px que la conecta al borde.
- `pointer-events: none`.

### `AuthCard` (contenedor)

- Renderiza `<CardCorners />` (los 4 brackets brutalistas).
- Renderiza el `::before` (hilo conector) y `::after` (nucleótido luminoso de conexión).
- Tabs internas (Login / Registro) con underline gradiente cyan→green de 2px en la activa.
- Eyebrow superior: dot verde pulsante + "ACCESO · SECUENCIA SEGURA" mono uppercase + coordenadas a la derecha.

---

## 7. Contrato de auth (`lib/auth.ts`)

```ts
export type AuthResult =
  | { ok: true; userId: string; redirectTo: string }
  | { ok: false; code: 'invalid_credentials' | 'rate_limited' | 'network' | 'unknown'; message: string };

export async function signIn(email: string, password: string): Promise<AuthResult>;
export async function signUp(name: string, email: string, password: string): Promise<AuthResult>;
export async function requestPasswordReset(email: string): Promise<{ ok: boolean; message: string }>;
```

Implementación inicial: stubs que devuelven `{ ok: true, userId: 'demo', redirectTo: '/dashboard' }` después de 600ms. El integrador conecta el provider real.

---

## 8. Validación (`lib/validators.ts`)

Esquemas `zod`:

```ts
export const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(8, 'Mínimo 8 caracteres'),
});

export const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8).regex(/[A-Z]/, 'Necesita una mayúscula').regex(/[0-9]/, 'Necesita un número'),
  confirmPassword: z.string(),
}).refine(d => d.password === d.confirmPassword, { path: ['confirmPassword'], message: 'No coinciden' });

export const recoverSchema = z.object({ email: z.string().email() });
```

---

## 9. Accesibilidad

- Todos los inputs tienen `<label>` visible (no solo placeholder).
- Tap targets ≥ 48px (inputs y CTA cumplen — verificar tabs y links).
- Contraste fg/bg ≥ 7:1. **Atención especial** a contraste del texto dentro de la caja translúcida: usar inputs con fondo blanco al 85% (no transparente) para garantizar legibilidad sobre la hélice animada.
- Foco visible: `outline: 2px solid var(--accent); outline-offset: 2px` (no quitar el outline por defecto sin reemplazo).
- Las animaciones canvas se pausan cuando `prefers-reduced-motion: reduce`. La pulsación del wordmark y el hilo conector también.
- El `BrandMark` lee como "CRM AGILE" para screen readers (envolver letras en `<span aria-hidden="true">` y poner `aria-label="CRM AGILE"` al contenedor).
- `backdrop-filter` puede afectar performance en navegadores antiguos: probar fallback `background: oklch(99% 0.004 250 / .95)` sin blur.

---

## 10. Responsive

- **Breakpoint principal: 980px.** Por debajo, la caja se **desacopla** del flotado y baja al flujo vertical (la unidad espacial deja de tener sentido en móvil).
- En modo móvil:
  - `.stage` deja de ser `overflow: hidden` y permite scroll vertical.
  - La hélice principal pasa a ser banner superior de 40vh.
  - La caja `.auth-card` se posiciona estática debajo (`position: static; margin: 24px auto; max-width: 92vw`).
  - **El hilo conector (`::before`) y las esquinas brutalistas se ocultan** (`display: none`) — solo tienen sentido en el layout flotante.
  - El wordmark y strand horizontal se reducen proporcionalmente (`font-size: 28px` para las letras, strand a 180×18).
  - Las anotaciones de esquina se ocultan.
  - El ticker inferior se simplifica a una sola línea sin coordenadas.
- Breakpoint secundario: 600px — compactar tipografías (`headline` a `clamp(28px, 8vw, 40px)`) y reducir padding del card a `28px 24px`.

---

## 11. Criterios de aceptación (checklist para el integrador)

- [ ] **La caja de login está visualmente integrada con la hélice** — no hay división vertical que separe el lienzo en dos columnas.
- [ ] La hélice canvas cubre el viewport completo y se ve esmerilada detrás de la caja (a través del `backdrop-filter`).
- [ ] El hilo conector (línea horizontal con gradiente cyan→green) sale del eje de la hélice y entra al borde izquierdo de la caja, terminando en un nucleótido verde luminoso.
- [ ] Los 4 brackets de esquina son visibles y respetan el color `--border-strong`.
- [ ] Las dos animaciones canvas corren a 60fps sin saltos visibles en un MBP M1.
- [ ] El strand horizontal corre **visualmente en sentido inverso** al vertical.
- [ ] Las 7 letras de "CRM AGILE" (sin contar el separador ·) tienen colores de nucleótido distintos y puntos pulsantes desfasados.
- [ ] El tab activo tiene un underline con gradiente cyan→green de 2px.
- [ ] El botón primario es un gradiente cyan→green de 52px y dispara la función `signIn` mock.
- [ ] El sheet de recuperación entra desde abajo dentro del área de la caja con transición de 350ms (no abre como modal centrado, no ocupa pantalla completa).
- [ ] Los inputs muestran outline cyan + glow suave al recibir foco.
- [ ] `prefers-reduced-motion: reduce` detiene las animaciones canvas, la pulsación del wordmark y el blink del conector.
- [ ] Por debajo de 980px, la caja se desacopla del flotado y el hilo conector + esquinas se ocultan.
- [ ] No hay errores de TypeScript ni warnings de React en `npm run build`.
- [ ] Lighthouse score: Performance ≥ 90, Accessibility ≥ 95.

---

## 12. Referencias en el proyecto

- `agile-crm-login.html` — prototipo HTML completo (versión integrada). **Copiar literal**: tokens OKLch, geometría del helix, animaciones del wordmark, transición del sheet, estilos de input/strength/reveal, posicionamiento absoluto del `.auth-side`, propiedades del `backdrop-filter` y el hilo conector.
- `index.html` — placeholder, ignorar.

---

## 13. Lo que NO debe pasar

- ❌ **Volver al layout de dos columnas (grid `1.15fr 0.85fr`).** El diseño actual es un lienzo único con caja flotante; un grid de columnas rompe la unidad visual.
- ❌ Eliminar el `backdrop-filter` y poner la caja con fondo blanco sólido. La translucidez es lo que hace que la caja "pertenezca" a la hélice.
- ❌ Quitar el hilo conector o las esquinas brutalistas por considerarlos "ornamentales". Son el registro físico que cose la caja a la hélice.
- ❌ Sustituir las animaciones canvas por una imagen estática o un SVG animado simple.
- ❌ Quitar el strand horizontal "porque ya está el vertical".
- ❌ Cambiar la paleta a un azul Tailwind genérico — los tokens OKLch están elegidos a mano.
- ❌ Usar `Inter` como display — el display es `Space Grotesk`.
- ❌ Convertir el sheet de recuperación en un modal centrado o full-screen.
- ❌ Inventar campos extra (Recordarme, SSO, 2FA) no estaban en el brief.
- ❌ Texto placeholder en inglés — toda la UI va en español.
- ❌ Centrar horizontalmente la hélice en el viewport — debe quedar desplazada hacia la izquierda (~30–35% del ancho) para que el hilo conector tenga distancia que recorrer hasta la caja.
