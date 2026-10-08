# Manu Dev — Análisis Técnico Completo

> Generado: 2026-06-08  
> Propósito: Comprender el sistema antes de planificar mejoras

---

## 1. Visión General

**Manu-Dev** es un agente conversacional que crea, personaliza y administra sitios web profesionales de forma completamente automatizada. El usuario interactúa por chat y al final recibe un sitio desplegado en `https://{subdominio}.nl360.site`.

El sistema combina:
- Chat conversacional con marcadores invisibles para persistir estado
- Generación de código mediante LLMs (Opus 4.7 / Sonnet 4.6 / Haiku 4.5)
- Builds Docker automáticos con queue secuencial
- CMS post-generación para editar contenido sin re-generar

---

## 2. Arquitectura de Modelos

| Tarea | Modelo | Razón |
|-------|--------|-------|
| Chat conversacional | claude-sonnet-4-6 | Balance velocidad/inteligencia |
| Generación de código Next.js | claude-opus-4-7 | Máxima calidad de código |
| Edición de contenido CMS | claude-haiku-4-5-20251001 | Cambios simples, optimiza costo |
| Generación Lite+ (híbrido) | claude-sonnet-4-6 | Calidad media, rápido |

---

## 3. Flujo Conversacional (11 pasos)

El chat avanza por pasos definidos. Cada respuesta de la IA incluye un **marcador invisible** al final que indica la transición al siguiente paso y los datos a persistir.

```
welcome → subdomain → identity → address → logo → colors →
fonts → social → site_type → building → complete → cms
```

### Marcadores invisibles (HTML comments)

```html
<!--MANU:{"next":"subdomain","data":{"name":"Mi Cafe"}}-->
<!--COLORS:[{"hex":"#1a1a2e","name":"Navy"}]-->
<!--FONTS:[{"name":"Poppins"},{"name":"Open Sans"}]-->
<!--UPLOAD:logo-->
<!--LOGO_GENERATE:prompt-->
<!--OPTIONS:["Opcion A","Opcion B"]-->
```

El frontend parsea estos marcadores, los oculta al usuario y ejecuta la acción correspondiente (guardar datos, mostrar botones, abrir uploader, etc.).

### Persistencia por paso

```
welcome    → INSERT md_projects (draft)
subdomain  → UPDATE subdomain
identity   → UPDATE industry, audience
address    → UPDATE location, address_type
logo       → UPDATE logo_url (HuggingFace FLUX.1-schnell)
colors     → INSERT md_design
fonts      → UPDATE md_design
social     → UPDATE social_links (JSON)
site_type  → UPDATE site_type → dispara generación
```

---

## 4. Modos de Generación

### Modo `next` — Full Next.js 14
- **Tecnología**: Next.js 14 + React 18 + Tailwind + lucide-react
- **Modelo**: Opus 4.7
- **Tiempo**: 2-3 minutos (build Docker incluido)
- **Llamadas IA**: 3 secuenciales
  1. `globals.css` + `layout.jsx`
  2. `page.jsx` (home)
  3. `[slug]/page.jsx` (páginas internas)
- **Máximo recomendado**: 10-15 páginas

### Modo `lite` — HTML estático + Nginx
- **Tecnología**: HTML + CSS personalizado + Nginx
- **Modelo**: Ninguno (templates predefinidos)
- **Tiempo**: Segundos
- **Templates CSS**: `professional`, `bold`, `elegant`, `fresh`, `minimal`
- **Máximo**: 5 páginas

### Modo `lite+` — Híbrido con IA
- **Tecnología**: HTML personalizado + Nginx
- **Modelo**: Sonnet 4.6
- **Tiempo**: ~30 segundos
- **Fallback**: Automático a `lite` si falla

### Resolución automática de modo

```
validateModeForRoles(mode, userRoles):
  - free:   next → downgrade a lite_plus → lite
  - basic:  next OK
  - pro:    todos los modos
```

---

## 5. Estructura de Archivos Generados

### Archivos fijos (boilerplate, no cambian)
```
package.json           — Deps: Next 14, React 18, lucide-react
next.config.js         — Config básica
Dockerfile             — Node 20 Alpine
app/social-links.js    — Redes sociales (actualizable sin rebuild)
```

### Archivos generados por IA (modo next)
```
app/globals.css        — Variables CSS, @keyframes, reset, Google Fonts
app/layout.jsx         — Header sticky, nav, footer, hamburger mobile
app/page.jsx           — Home: hero + servicios + testimonios + CTA
app/[slug]/page.jsx    — Páginas internas (about, services, contact)
```

### Restricciones críticas en los prompts
- **NUNCA** usar `next/image`, solo `<img>` estándar
- **NUNCA** emojis como iconos, solo `lucide-react`
- Mobile-first con breakpoints Tailwind
- Hero pantalla completa con overlay oscuro
- Colores siempre via variables CSS (`--color-primary`, etc.)

---

## 6. Pipeline de Generación (create-site)

```
POST /api/manu-dev/create-site
  │
  ├─ [SSE] "Cargando proyecto..."
  │    └─ SELECT md_projects + md_design
  │
  ├─ [SSE] "Buscando imágenes..."
  │    └─ Unsplash API: query="industria ubicacion", count=6-8
  │
  ├─ [SSE] "Modo: next | Páginas: 4"
  │    └─ resolveEffectiveMode() según plan y cantidad de páginas
  │
  ├─ [SSE] "Generando estructura..."  ← Opus 4.7 (Prompt 1)
  │    └─ globals.css + layout.jsx
  │    └─ Parsea bloques ===FILE:===END===
  │    └─ sanitizeJSX() → isJSXComplete() → retry hasta 3x
  │
  ├─ [SSE] "Generando página principal..."  ← Opus 4.7 (Prompt 2)
  │    └─ page.jsx con hero + servicios + testimonios + CTA
  │    └─ Incluye clases CSS disponibles como contexto
  │
  ├─ [SSE] "Generando páginas internas..."  ← Sonnet 4.6 (Prompt 3, opcional)
  │    └─ about, services, contact
  │    └─ Best-effort: no bloquea si falla
  │
  ├─ [SSE] "Ejecutando preflight..."
  │    └─ removeLucideIconsFromReactImport()
  │    └─ deduplicateAllImports()
  │    └─ applyLucideImportFix()
  │    └─ findMissingLucideImports()
  │
  ├─ [SSE] "Escribiendo 12 archivos..."
  │    └─ Escribe en /opt/docker-apps/sites/{subdomain}/
  │
  └─ [SSE] "Construyendo imagen Docker..."
       └─ markBuildQueued()
       └─ queueBuild() → sh manu-dev-build.sh {subdomain} next
       └─ npm install → npm run build → npm start (puerto 3000)
       └─ Acceso: https://{subdomain}.nl360.site
       └─ markBuildSuccess() → UPDATE md_projects status='active'
```

### Sanitización de código

```typescript
sanitizeJSX(code)          // Remueve next/image imports, reemplaza <Image> por <img>
isJSXComplete(code)        // Verifica { } [ ] ( ) balanceados — detecta truncamiento
removeLucideIconsFromReactImport()  // Mueve icons de "react" a "lucide-react"
applyLucideImportFix()     // Añade imports faltantes de lucide-react
deduplicateAllImports()    // Elimina imports duplicados entre módulos
```

### Manejo de errores

- `MAX_ATTEMPTS = 3` por cada bloque de generación
- Retry solo en errores transitorios (timeout, red) — no en 429 o auth
- Fallback automático a `lite` si `next` genera errores
- Auto-fix de build: parsea `build.log`, corrige imports conocidos, reintenta

---

## 7. Base de Datos (MySQL: `manu_dev`)

### Tablas principales

```sql
md_projects
  id, user_id, name, subdomain, site_url, status (draft|building|active|error)
  industry, audience, location, address_type, description, extra_content
  site_type (store|blog|informational)
  generation_mode (next|lite|auto)
  social_links (JSON), logo_url
  has_blog, blog_config (JSON)
  has_store, store_info (JSON)
  container_id, shared_project_id
  build_started_at, build_finished_at, last_build_stage, last_build_error

md_design
  id, project_id, primary_color, secondary_color, accent_color
  font_heading, font_body

md_pages
  id, project_id, slug, title, content_json (secciones como array JSON)

md_chat_history
  id, user_id, project_id, role (user|assistant), content, step, created_at

md_messages           — Formularios de contacto enviados desde sitios
md_blog_posts         — Posts de blog (title, slug, content, published)
md_blog_categories    — Categorías de blog
md_products           — Productos (name, price, images JSON, active)
md_product_categories — Categorías de productos
```

---

## 8. Endpoints API (18 rutas)

### Chat
| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/api/manu-dev/chat` | POST | Streaming SSE del chat conversacional |

### Proyectos y diseño
| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/api/manu-dev/projects` | GET | Lista proyectos del usuario |
| `/api/manu-dev/check-subdomain` | GET | Valida disponibilidad de subdominio |
| `/api/manu-dev/design` | GET/PATCH | Lee/actualiza colores y fuentes |
| `/api/manu-dev/css` | GET/PUT | Lee/escribe globals.css |
| `/api/manu-dev/generation-mode` | GET/POST | Lee/cambia modo de generación |
| `/api/manu-dev/social-links` | GET/POST | Lee/guarda redes sociales |

### Generación y build
| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/api/manu-dev/create-site` | POST | Genera sitio + inicia build (SSE) |
| `/api/manu-dev/rebuild` | POST | Recompila sin re-generar (SSE) |
| `/api/manu-dev/logo` | POST | Sube logo (multipart/form-data) |

### Contenido CMS
| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/api/manu-dev/content` | GET/PATCH | Lista páginas / edita con IA |
| `/api/manu-dev/blog` | GET/POST | Activa/configura blog |
| `/api/manu-dev/blog-posts` | GET/POST/PATCH/DELETE | CRUD posts |
| `/api/manu-dev/products` | GET/POST/PATCH/DELETE | CRUD productos |
| `/api/manu-dev/categories` | GET/POST/DELETE | Categorías |
| `/api/manu-dev/store` | GET/POST | Activa/configura tienda |
| `/api/manu-dev/form-submit` | POST | Recibe forms de sitios generados |

---

## 9. Sistema de Build Docker

### Queue secuencial
```typescript
queueTail    // Promise chain — un solo build a la vez
queuedJobs   // Contador para informar posición en cola
```

### Script de build
```bash
sh /opt/docker-apps/scripts/manu-dev-build.sh {subdomain} {mode}
# Hace: docker build → docker stop anterior → docker run nuevo
# Output: container ID en última línea stdout
```

### Reconciliación de builds atascados
```
Cada 30s: reconcileStuckBuilds()
  Busca: status='building' AND build_started_at < NOW() - 45min
  Actualiza: status='error', stage='reconciled-timeout'
```

### Timeouts configurables (env vars)
```
MANU_DEV_BUILD_TIMEOUT_MS       default: 480000 (8 min)
MANU_DEV_GENERATION_TIMEOUT_MS  default: 240000 (4 min)
MANU_DEV_STUCK_BUILD_MINUTES    default: 45
```

---

## 10. Integraciones Externas

### Unsplash
```
GET https://api.unsplash.com/photos/random
  query: "{industry} {location}"
  count: 6-8
  timeout: 10s
  fallback: array vacío
```

### HuggingFace (Logo)
```
Model: black-forest-labs/FLUX.1-schnell
Prompt: "professional minimalist logo icon for {name}, {industry}, color {hex}"
Fallback: null (usuario puede subir logo propio)
```

### WordPress (Auth)
```
POST {WP_BASE_URL}/wp-json/nl360/v1/me    (custom)
POST {WP_BASE_URL}/wp-json/wp/v2/users/me (fallback)
Header: Authorization: Bearer {JWT}
Cookie: nl360_jwt
```

---

## 11. Frontend (page.tsx)

### Componentes clave
- **StepIndicator** — Barra de progreso visual con pasos
- **ColorSwatches** — Paleta con códigos hex
- **FontPreview** — Carga Google Fonts dinámicamente y muestra preview
- **BuildTerminal** — Terminal simulada con logs SSE en tiempo real (fullscreen disponible)
- **TemplateSelector** — Selector de template para modo Lite
- **CmsPanel** — Editar contenido, gestionar blog posts y productos

### Opciones interactivas
El chat parsea `<!--OPTIONS:-->` y renderiza botones. Al hacer click se envía la opción como mensaje de usuario automáticamente, sin que el usuario tenga que escribir.

---

## 12. Seguridad

### Path traversal
```typescript
const safePath = path.normalize(file.path).replace(/^(\.\.[/\\])+/, "");
if (!fullPath.startsWith(SITES_DIR)) continue; // descarta si sale del directorio
```

### Ownership
```typescript
// Todos los endpoints verifican propiedad:
SELECT id FROM md_projects WHERE id = ? AND user_id = ?
```

### Sanitización de output de IA
```typescript
sanitizeAssistantText(text, step, siteUrl)
// Detecta y reemplaza: "usuario:", "contraseña", "credenciales",
// emails de acceso, rutas /admin, /wp-admin
```

### Rate limiting (form-submit)
```
Max 10 submissions por IP por hora
In-memory Map<ip, {count, resetAt}>
```

---

## 13. Limitaciones Identificadas

| Limitación | Impacto | Notas |
|-----------|---------|-------|
| Builds secuenciales (no paralelos) | Esperas largas si hay cola | Diseño intencional por file system |
| JSX truncado si > ~32K tokens | Falla silenciosa con retry | isJSXComplete() lo detecta |
| Logo HuggingFace con timeouts | Flujo bloqueado | Sin timeout explícito |
| No hot-reload en edición CMS | Rebuild completo por cada cambio | 8 min de espera |
| Lite mode máx 5 páginas | Fallback automático silencioso | No siempre es lo que el usuario quería |
| No preview antes de publicar | UX: el usuario ve el sitio solo después del build | |
| Páginas internas best-effort | Pueden generarse incompletas o mal | No valida Prompt 3 con igual rigor |

---

## 14. Variables de Entorno Relevantes

```env
NL360_JWT_COOKIE_NAME        — Nombre de la cookie JWT
WP_BASE_URL                  — URL WordPress para auth
MYSQL_HOST / MYSQL_PORT      — DB connection
MYSQL_USER / MYSQL_PASSWORD  — DB credentials
MANU_DEV_DB                  — Nombre de la base de datos (default: manu_dev)
ANTHROPIC_API_KEY            — API key Claude
HUGGING_FACE_TOKEN           — HF API para logos
UNSPLASH_ACCESS_KEY          — Unsplash API key
MANU_DEV_BUILD_TIMEOUT_MS    — Timeout build (default: 480000)
MANU_DEV_GENERATION_TIMEOUT_MS — Timeout generación (default: 240000)
MANU_DEV_STUCK_BUILD_MINUTES — Umbral reconciliación (default: 45)
```

---

## 15. Árbol de Archivos del Sistema

```
/opt/docker-apps/
├── escritorio/
│   └── app/
│       ├── (app)/services/manu-dev/
│       │   └── page.tsx                  ← Frontend del agente
│       └── api/manu-dev/
│           ├── chat/route.ts             ← Chat conversacional + marcadores
│           ├── create-site/route.ts      ← Generación + build pipeline
│           ├── rebuild/route.ts          ← Rebuild sin re-generar
│           ├── design/route.ts           ← Colores y fuentes
│           ├── css/route.ts              ← CSS directo
│           ├── content/route.ts          ← CMS con IA
│           ├── social-links/route.ts     ← Redes sociales
│           ├── generation-mode/route.ts  ← Modo de generación
│           ├── check-subdomain/route.ts  ← Validación subdominio
│           ├── projects/route.ts         ← Lista proyectos
│           ├── logo/route.ts             ← Upload logo
│           ├── blog/route.ts             ← Config blog
│           ├── blog-posts/route.ts       ← CRUD posts
│           ├── products/route.ts         ← CRUD productos
│           ├── categories/route.ts       ← Categorías
│           ├── store/route.ts            ← Config tienda
│           └── form-submit/route.ts      ← Forms desde sitios
│
├── lib/
│   ├── db-manu.ts                        ← Pool MySQL manu_dev
│   ├── manu-dev-build.ts                 ← Orquestador de builds Docker
│   ├── manu-dev-lite-site.ts             ← Generador HTML para modo Lite
│   ├── manu-dev-lite-templates.ts        ← 5 templates CSS predefinidos
│   └── manu-dev-lite-plus.ts             ← Generación híbrida con IA
│
├── data/manu-dev/prompts/
│   └── manu-dev.md                       ← System prompt del agente
│
├── scripts/
│   ├── manu-dev-build.sh                 ← Build + deploy Docker
│   └── manu-dev-cleanup.sh              ← Limpieza de containers
│
└── sites/
    └── {subdomain}/                      ← Archivos de cada sitio generado
        ├── package.json
        ├── next.config.js
        ├── Dockerfile
        └── app/
            ├── globals.css
            ├── layout.jsx
            ├── page.jsx
            ├── social-links.js
            └── [slug]/page.jsx
```

---

## 16. Áreas de Mejora Identificadas (para discutir)

### Calidad de generación
1. **Prompt 3 (páginas internas) es best-effort** — no valida con igual rigor, puede generar código incompleto
2. **Sin preview antes de publicar** — el usuario espera 8+ min y ve el resultado final directo
3. **Imágenes Unsplash hardcodeadas** — se usan en build time y no son editables después sin rebuild
4. **No hay secciones modulares** — si el usuario quiere reorganizar secciones, requiere edición manual

### UX/Performance
5. **Rebuild completo por cada cambio de diseño** — cambiar un color fuerza 8 min de espera
6. **Sin streaming de logs más granular** — el usuario no sabe exactamente qué está pasando durante Opus 4.7
7. **Logo HuggingFace sin timeout explícito** — puede bloquear el flujo indefinidamente

### CMS
8. **Edición con Haiku 4.5** — puede no interpretar bien instrucciones complejas de edición
9. **content_json** — no está claro si el frontend lo usa para edición visual o solo se guarda por referencia
10. **Sin edición visual de secciones** — todas las ediciones son por instrucción en lenguaje natural

### Infraestructura
11. **Builds secuenciales** — un usuario en cola espera a que termine el anterior
12. **In-memory rate limiting** — se resetea al reiniciar el servidor
13. **Reconciliación cada 30s** — si el servidor cae, builds quedan en estado 'building' hasta que suba

---

*Fin del análisis — archivo temporal para planificación de mejoras*
