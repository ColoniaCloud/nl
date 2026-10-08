# modelPANEL — Auditoría del Panel de Administración de Sitios (lite_plus)

> Revisión del panel CMS (`components/manu-dev/CmsPanel.tsx`), el generador
> (`lib/manu-dev-lite-plus.ts`) y las rutas API que consume (`content`, `css`,
> `design`, `rebuild`, `social-links`, `store`, `blog`).
> Fecha: 2026-06-19.

---

## Causa raíz común

El panel de administración y sus APIs fueron escritos para **dos modos**:
`next` (Next.js) y `lite` (landing de una sola página). El modo **`lite_plus`**
(multi-página, HTML estático servido por nginx) se agregó después y **se cae por
casi todos los checks** `mode === "lite"` / `isLiteMode`, quedando tratado como si
fuera Next.js. Además, el `rebuild` **nunca regenera el HTML** desde la base de
datos: solo sincroniza diseño (roto para lite_plus) y hace `docker build/run`.

---

## Lista de errores

### ✅ 1. [RESUELTO] "Editar Páginas" y "Corregir con IA" rotos en lite_plus
> **Estado:** corregido. Se agregaron helpers `isStaticMode` y `slugToStaticFile`
> en `lib/manu-dev-lite-site.ts`; `content/route.ts` ahora trata `lite_plus` como
> estático, edita el `.html` real por slug (multi-página), evita el truncado
> (slice 60 KB + `max_tokens` 16000) y redepliega en modo `lite`.

**Archivo:** `app/api/manu-dev/content/route.ts:151`

```js
const isLiteMode = projectMode === "lite";   // lite_plus NO entra aquí
```

Para un sitio lite_plus, `isLiteMode` es `false`, entonces (líneas 154-158)
intenta leer `app/page.jsx` / `app/[slug]/page.jsx`, que **no existen** en un
sitio estático → `currentContent = "// File not found"`. Le pide a Claude que
edite un JSX inexistente y **escribe un `app/page.jsx` fantasma** que nginx nunca
sirve. El `.html` real (`index.html`, `contacto.html`) **nunca se modifica**.

`PagesModal` y `AiFixModal` (ambos usan este endpoint) no hacen nada visible en
lite_plus.

**Sub-bug:** aun cuando `isLiteMode` es `true`, siempre edita `index.html`
(línea 154-155) ignorando `page.slug`. Para lite_plus que es **multi-página**,
jamás se podría editar `contacto.html`, etc.

### ✅ 2. [RESUELTO] Cambios de colores/fuentes ("Layout") no se aplican en lite_plus
> **Estado:** corregido. `syncDesignToFiles` ahora ramifica por modo: para estático
> (`lite`/`lite_plus`) recorre todos los `.html` y aplica colores (en la
> `tailwind.config` inline), fuentes (`fontFamily`, bloque `<style>` y `<link>` de
> Google Fonts). Next sigue usando `app/globals.css`. Además el rebuild de sitios
> estáticos ahora corre en modo `lite` (no `next`) — esto también cierra el #6 en
> `rebuild/route.ts`.

**Archivo:** `app/api/manu-dev/rebuild/route.ts:34` (`syncDesignToFiles`)

```js
const cssPath = path.join(SITES_DIR, subdomain, "app", "globals.css");
```

lite_plus no tiene `app/globals.css` (usa Tailwind por CDN con config inline en
cada `.html`). El `readFile` falla → el `catch` hace `return` silencioso. El
`LayoutModal` guarda en `md_design` pero **nunca se refleja** en el sitio.

### ✅ 3. [RESUELTO] Editor de CSS roto en lite_plus
> **Estado:** corregido. Para sitios estáticos el CSS vive en `assets/custom.css`
> (en vez de `app/globals.css`). El GET abre el editor vacío si aún no existe
> (sin 404); el PUT crea el archivo y enlaza `<link href="assets/custom.css">` en
> todos los `.html` (idempotente) para que los estilos apliquen. Next sigue con
> `app/globals.css`.

**Archivo:** `app/api/manu-dev/css/route.ts:41`

```js
return path.join(SITES_DIR, safe, "app", "globals.css");
```

Mismo problema: no existe en lite_plus. El GET devuelve vacío/error y el PUT
escribe un `globals.css` que nginx no sirve.

### ✅ 4. [RESUELTO] El rebuild nunca regenera el HTML → Tienda y Blog no aparecen
> **Estado:** corregido. Nuevo módulo `lib/manu-dev-static-render.ts` que renderiza
> **determinísticamente** (sin IA) `tienda.html`, `blog.html` y `blog-<slug>.html`
> desde la DB, reutilizando el layout existente del sitio (head con
> Tailwind/colores/fuentes + header + footer + scripts) para que combinen con el
> diseño. El rebuild lo invoca para sitios estáticos tras el sync de diseño. Inyecta
> links de navegación (desktop + menú móvil) clonando el estilo de los links
> existentes, de forma idempotente.
>
> **Ajuste tras probar en hexa:** el sync de colores ahora también reemplaza los hex
> hardcodeados inline (`style="color:#..."`), no solo la `tailwind.config`, porque
> algunos sitios (hexa) hornean el color en estilos inline. Y la actualización de
> redes contempla links de **texto** (no solo íconos SVG), detectando la clase
> `social`, y limpia los `<li>` que quedan vacíos.
>
> **Decisión de diseño:** NO se regenera con IA en cada rebuild (cambiaría el sitio
> completo de forma no-determinista); solo se (re)generan las páginas dinámicas.
>
> **Pendiente menor:** detalle/edición de producto individual (hoy grid + info de
> tienda); paginación del blog si hay muchas entradas.

**Archivo:** `app/api/manu-dev/rebuild/route.ts` (flujo completo)

`rebuild` solo hace `syncDesignToFiles` (roto para lite_plus) + `docker build/run`
de los archivos existentes. **Nunca llama a `generateLitePlusSite`.** Además, el
generador lite_plus solo genera `input.pages`; **no renderiza productos ni
entradas de blog en ninguna parte**. Resultado: activar Tienda/Blog y cargar
productos/posts guarda todo en la DB, los modales dicen *"se redesplegará y
aparecerá"*, pero **nunca aparece** en un sitio lite_plus.

### ✅ 5. [RESUELTO] Redes sociales no se actualizan en lite_plus
> **Estado:** corregido. La ruta ahora usa `isStaticMode`: para estáticos escribe
> `assets/social-links.json` (incluye lite_plus, antes solo `lite`) y actualiza el
> footer de **todas** las páginas vía `applyFooterSocialLinks` (helper nuevo en
> `manu-dev-static-render.ts`): reescribe el `href` de cada red habilitada por host
> y elimina el ícono (`<a>` con `<svg>`) de las deshabilitadas. Para Next sigue
> escribiendo `app/social-links.js` (ya no se crea el archivo fantasma en estáticos).
> Como los sitios estáticos se sirven con volumen montado, el cambio se refleja en vivo.
>
> **Limitación documentada:** habilitar una plataforma que NO existía al generar el
> sitio (sin su ícono SVG) no se agrega aquí; requiere regeneración completa.

**Archivo:** `app/api/manu-dev/social-links/route.ts:150`

```js
if (mode === "lite") {   // lite_plus excluido
  await fs.writeFile(liteSocialPath, ...);
}
```

Solo actualiza `assets/social-links.json` en modo `lite`. Para lite_plus siempre
escribe un `app/social-links.js` fantasma. Sumado a que el footer de lite_plus
tiene las redes **incrustadas en el HTML** al generarse, cambiarlas luego no tiene
efecto. Tampoco dispara rebuild.

### 🟠 6. Modo de build inconsistente entre creación y rebuild
**Archivos:** `app/api/manu-dev/create-site/route.ts:1322`,
`app/api/manu-dev/rebuild/route.ts:140`, `app/api/manu-dev/content/route.ts:233`

- Creación: lite_plus → `buildAndDeploy("lite")` → nginx con **volumen montado
  read-only** (archivos en vivo).
- Rebuild: `normalizeGenerationMode(...) === "lite" ? "lite" : "next"` → lite_plus
  cae en **`"next"`** → hace `docker build` horneando los archivos en la imagen,
  sin volumen.
- `content/route.ts:233` lanza `queueBuild` **sin `mode`** → default `"next"`.

No crashea (el Dockerfile de lite_plus es nginx, así que `docker build`
funciona), pero tras el primer rebuild el sitio deja de servir los archivos
montados en vivo y queda "congelado" en la imagen — comportamiento distinto al de
su creación.

### ✅ 7. [RESUELTO] Botón "Auto-Fix" es idéntico a "Redesplegar"
> **Estado:** corregido. Se eliminó el botón "Auto-Fix" (duplicaba `rebuild()` sin
> acción distinta). La corrección con IA sigue disponible en su propio modal
> ("Corregir con IA"). El import `faWandMagicSparkles` se conserva porque lo usa el
> modal de Páginas.

**Archivo:** `components/manu-dev/CmsPanel.tsx:1282` y `:1287`

Ambos llaman a `rebuild()`. "Auto-Fix" sugiere que corrige algo, pero ejecuta
exactamente el mismo redespliegue plano. Es engañoso / código duplicado muerto.

### 🟡 8. Riesgo de truncado al editar contenido en lite_plus
**Archivo:** `app/api/manu-dev/content/route.ts:171`

Corta el archivo a `slice(0, 16000)`. Las páginas lite_plus ensambladas (layout
completo + `<main>`) suelen superar 16 KB, así que incluso arreglando el bug #1,
Claude recibiría el HTML truncado y podría devolver una página incompleta
(perdiendo footer/cierre).

---

## Resumen de impacto

De los 7 botones del toolbar del panel, en sitios **lite_plus** prácticamente
funciona solo **Mensajes** (lee de DB). **Layout, Páginas, Redes, Tienda, Blog y
Corregir con IA** no impactan el sitio renderizado. El denominador común es el
check `mode === "lite"` que excluye `lite_plus`, más el hecho de que el rebuild no
regenera HTML.

## Estado final (2026-06-19)

✅ **Todos los puntos resueltos** (#1–#8).

Cambios principales:
- **Helpers compartidos** en `lib/manu-dev-lite-site.ts`: `isStaticMode`,
  `slugToStaticFile`.
- **Módulo nuevo** `lib/manu-dev-static-render.ts`: render determinista de
  Tienda/Blog desde DB, inyección de nav y actualización de redes en el footer.
- `content/route.ts`, `rebuild/route.ts`, `css/route.ts`, `social-links/route.ts`
  ahora tratan `lite_plus` como estático.
- `CmsPanel.tsx`: botón duplicado "Auto-Fix" eliminado.

Verificado con `tsc --noEmit` (sin errores en los archivos tocados) y dry-runs de
la lógica de regex/render contra sitios reales en `/opt/docker-apps/sites`.

Limitaciones conocidas (documentadas arriba): editor CSS estático usa
`assets/custom.css`; Tienda sin página de detalle por producto; Blog sin
paginación; habilitar una red social nueva (sin SVG previo) requiere regeneración.

---

## Plan de corrección

> Principio rector: introducir un helper único de detección de modo y, donde
> aplique, una función `slugToFile()` compartida, para que `lite_plus` deje de
> caer en la rama `next`. Las correcciones se ordenan por dependencia e impacto.

### Fase 0 — Infraestructura compartida (prerequisito)
1. **Helper `isStaticMode(mode)`** que devuelva `true` para `"lite"` **y**
   `"lite_plus"`. Centralizarlo en `lib/manu-dev-lite-site.ts` (junto a
   `normalizeGenerationMode`).
2. **Exportar `slugToFile(slug)`** desde `lib/manu-dev-lite-plus.ts` (hoy es
   privada) para reutilizarla en las rutas que necesitan mapear página → archivo
   `.html`.
3. **Helper `staticPageFile(subdomain, slug)`** que use `slugToFile` para
   devolver la ruta correcta (`index.html` para `home`, `<slug>.html` resto).

### Fase 1 — Edición de páginas / Corregir con IA (bug #1, #8) 🔴
**`app/api/manu-dev/content/route.ts`**
1. Cambiar `const isLiteMode = projectMode === "lite"` por
   `const isStatic = isStaticMode(projectMode)`.
2. Para modo estático, resolver el archivo con `staticPageFile(subdomain, page.slug)`
   en lugar de forzar `index.html` (soporta multi-página de lite_plus).
3. Subir el límite del `slice` a un valor seguro (p. ej. 64 000) **o** enviar el
   archivo completo / por secciones para no truncar páginas lite_plus.
4. Verificar que el formato de salida (`===FILE:<archivo>===`) use el nombre real
   del `.html`.

### Fase 2 — Diseño: colores/fuentes y CSS (bugs #2, #3) 🔴
1. **`rebuild/route.ts` (`syncDesignToFiles`)**: detectar modo estático y, en ese
   caso, aplicar los colores/fuentes al/los `.html` (reemplazo de la config inline
   de Tailwind y del `<link>`/`@import` de Google Fonts) en vez de a
   `app/globals.css`. Iterar sobre todos los `.html` del sitio.
2. **`css/route.ts` (`getCssPath`)**: para modo estático, o bien deshabilitar el
   editor de CSS (devolver mensaje claro), o bien apuntar a un `assets/custom.css`
   real que el layout lite_plus incluya con `<link>`. Decisión de producto: ver
   nota al final.

### Fase 3 — Regeneración de HTML en rebuild (bug #4) 🔴 (la más grande)
> Es el cambio estructural: hoy el contenido del CMS (Tienda/Blog/Redes) vive en
> la DB pero el HTML estático no se regenera.
1. En `rebuild/route.ts`, para modo `lite_plus`, **llamar a
   `generateLitePlusSite`** (o a una variante de regeneración) con los datos
   actualizados de la DB **antes** del `docker build/run`, en lugar de reusar los
   archivos viejos.
2. Extender el generador lite_plus para **renderizar Tienda (productos,
   categorías, info) y Blog (entradas)** como páginas/secciones cuando estén
   activos. Alternativa de menor alcance: páginas dedicadas `tienda.html` /
   `blog.html` generadas a partir de la DB.
3. Si la regeneración por IA es costosa, considerar plantillas deterministas
   (no-LLM) para tienda/blog y reservar el LLM para las páginas de marketing.

### Fase 4 — Redes sociales (bug #5) 🟠
**`social-links/route.ts`**
1. Incluir `lite_plus` en la rama que escribe `assets/social-links.json`
   (usar `isStaticMode`).
2. Hacer que el footer del layout lite_plus **lea** ese JSON en runtime (pequeño
   `<script>`), **o** que el rebuild regenere el footer con las redes actuales
   (encaja con Fase 3).
3. Disparar rebuild tras guardar (o marcar `pendingChanges`, ya lo hace el panel).

### Fase 5 — Consistencia de build (bug #6) 🟠
1. En `rebuild/route.ts:140` y `content/route.ts:233`, derivar el `mode` de build
   con un único helper: estático → `"lite"`, Next → `"next"`. Que lite_plus use
   `"lite"` igual que en la creación (mantiene el volumen montado y evita el
   `docker build` innecesario).
2. Revisar que `queueBuild` acepte explícitamente el modo resuelto en todos los
   call-sites (hoy `content` no pasa `mode`).

### Fase 6 — Limpieza UI (bug #7) 🟡
**`components/manu-dev/CmsPanel.tsx`**
1. Eliminar el botón "Auto-Fix" (duplica "Redesplegar") **o** reconectarlo a una
   acción real (p. ej. el endpoint de Corregir con IA / auto-fix de build).

---

## Orden recomendado de ejecución
1. **Fase 0** (helpers) — desbloquea el resto.
2. **Fase 1** (edición de páginas) — alto impacto, riesgo acotado.
3. **Fase 2** (diseño/CSS).
4. **Fase 5** (consistencia de build) — barato y reduce efectos colaterales.
5. **Fase 4** (redes).
6. **Fase 3** (regeneración de HTML / Tienda / Blog) — la más grande; hacerla con
   diseño previo.
7. **Fase 6** (limpieza UI) — cosmético, en cualquier momento.

## Decisiones de producto pendientes (requieren confirmación)
- **Editor de CSS en lite_plus:** ¿se deshabilita o se soporta vía
  `assets/custom.css`?
- **Tienda/Blog en lite_plus:** ¿se renderizan con plantillas deterministas o con
  el LLM? Impacta costo y tiempo de rebuild.
- **Modelo de servido:** ¿unificar lite_plus a volumen montado (sin `docker
  build` en rebuild) para que las ediciones de archivos se reflejen sin recompilar?
