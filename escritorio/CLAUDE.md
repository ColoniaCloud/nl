# NL360 Escritorio — Contexto para Claude Code

## ⚠️ Reglas absolutas (leer antes de cualquier acción)

- **NUNCA** ejecutar `docker compose build`, `docker compose up`, `docker compose restart`, ni `npm run build` sin confirmación explícita del usuario
- **Leer cada archivo completo** antes de modificarlo — nunca editar a ciegas
- **Reportar número de líneas exactas** antes y después de cualquier cambio
- **Conventional Commits estricto**: `feat(scope)`, `fix(scope)`, `refactor(scope)`, `chore(scope)`, `docs(scope)`
- **Commits atómicos**: un commit por cambio lógico, no commits de múltiples features mezcladas
- **STOP obligatorio** en cada checkpoint indicado — no avanzar al siguiente paso sin confirmación
- Ante cualquier hallazgo inesperado (archivo con estructura diferente a lo esperado, import roto, lógica no documentada): **STOP y reportar** antes de improvisar

---

## Stack

- **Runtime**: Node.js 20 Alpine, TypeScript 5
- **App**: Next.js 16.1.3 App Router, React 19.2.3, Tailwind CSS 4
- **DB**: MySQL 8.0, queries raw con `mysql2`, sin ORM
  - Un pool por archivo `lib/db-*.ts` (el nombre del archivo NO siempre coincide con el schema)
  - Pools / schemas reales:
    - `lib/db-manu.ts` → `manu_dev`
    - `lib/db-billing.ts` → `nl360_billing`
    - `lib/db-jordan.ts` → `jordan`
    - `lib/db-mentoria.ts` → `mentoria`
    - `lib/db-referrals.ts` → schema `nl360`
    - `lib/db-whatsapp.ts`
  - Nombres de DB configurables vía env (`MANU_DEV_DB`, `BILLING_DB`, etc.) con fallback hardcoded
- **Auth**: Cookie HTTP-only `nl360_jwt` — validada en `middleware.ts`
  - Roles: `nl_setters`, `elite`, `pro`, `basic`, `free`, `administrator` (→ `nl_admin`)
  - Control de acceso centralizado en `lib/billing-access.ts`
- **Icons**: Lucide React (verificar que el icono exista antes de importarlo); también FontAwesome disponible
- **UI / Design system**: shadcn/ui + Radix UI primitives + `class-variance-authority` + `tailwind-merge`
  - Animaciones: `framer-motion` / `motion`, `gsap`
  - Config shadcn en `components.json`
  - ⚠️ Existen tokens legacy `--rac-*` en `app/globals.css` (restos de react-aria), pero react-aria-components NO es dependencia activa
- **Toasts**: sonner
- **Forms**: react-hook-form + zod

---

## Estructura clave

```
/opt/docker-apps/
├── escritorio/              # App Next.js — editar aquí
│   ├── app/
│   │   ├── (app)/          # Rutas protegidas JWT (admin, cuenta, services, suscripcion, workspace)
│   │   │   └── services/   # forge, grant, manu-dev, margarita, mentoria, nubia
│   │   ├── (public)/       # Landing, precio, agentes, registro, pago, legales
│   │   └── api/            # Todos los endpoints
│   ├── components/         # Sidebar.tsx (~628l), ui/, chat/
│   ├── lib/                # billing-access.ts, agents.ts, logger.ts, providers/, db-*.ts
│   └── data/mentoria/      # Prompts .md y curriculum JSON — NO gitignore
├── config/secrets/.env.production  # Permisos 600 — NUNCA leer ni loguear
└── docker-compose.yml
```

---

## Convenciones de API routes

```ts
export const runtime = "nodejs";   // siempre nodejs, nunca edge
export const maxDuration = 60;

export async function POST(req: Request) {
  // 1. Auth JWT (cookie nl360_jwt)
  // 2. Validar body
  // 3. Query MySQL pool
  // 4. LLM si aplica
  // 5. Response.json() o stream SSE
}
```

---

## LLM Providers

- Abstracción en `lib/providers/` — interfaz `Provider { streamChat(): AsyncIterable<StreamEvent> }`
  - Implementaciones: `anthropic.ts`, `nvidia.ts`, `venice.ts` (+ `types.ts`, `index.ts`)
- Anthropic Claude (`@anthropic-ai/sdk`) → generación de sitios, MentorIA
- Google Gemini (`@google/genai`) → usado directamente en `app/api/fallback-site/` (no vía providers/)
- NVIDIA NIM → Tony
- Venice (Aion 2.0, Dolphin Mistral) → provider alternativo
- OpenAI SDK (`openai`) también presente como dependencia

---

## Producción activa — puntos de atención

- **0 sitios generados activos** — limpieza completa el 2026-06-18 (38 contenedores + 43 dirs + 29 imágenes + tablas `md_*` vacías + 38 GB build cache). Único `site-*` vivo: `site-mentoria` (protegido, ajeno a Manu Dev)
- **`app/api/manu-dev/create-site/route.ts` tiene ~1580 líneas** — God Object, tocar con mucho cuidado
- **`components/Sidebar.tsx` tiene ~628 líneas** — mezcla nav, estado, permisos, UI
- Los sitios usan Docker socket montado en `escritorio` — riesgo root-equivalent reconocido
- Traefik rutea dinámicamente cada sitio como `{slug}.nl360.site`
- `acme.json` (604 KB) — si se corrompe, caen todos los TLS

---

## Rama activa

```
refactor/agents-hierarchy   ← rama de trabajo actual
feat/tony-premium-models    ← rama intacta, NO modificar
```

**NO hacer merge a `main` sin revisión explícita del usuario.**

---

## Plan activo: Refactor Manu Dev

| Fase | Descripción | Estado |
|------|-------------|--------|
| **0** | Home selector de 4 motores | ✅ Completa (commit bc07325) |
| **B1** | Fix connection error + backoff + banner degraded | ✅ Completa (commit e311069) |
| **D** | Logging limpio — máx ~11 líneas por build | ✅ Completa (commit 3d2a9c4) |
| **B2** | Prompt estético: constraints duros + tokens CSS + 11 rubros | ✅ Completa (commits f43366b + 989809f) |
| **fix** | cast ease literal AudienceSection (preexistente) | ✅ Completa (commit 989809f) |
| **G1** | Fix técnico lite-plus: streaming con idle timeout (30s/chunk), tokens 12000, extractor HTML robusto, validateHtml permisiva (sin `</html>`, umbral 1000) | ✅ Completa (commits 662ef95 + 83acfce + 3cda424 + 78cf512) |
| **A0** | Fix bug hub: started=true + guard messages.length===0 | ✅ Completa (commit b9d9063) |
| **A1** | Skip pick_type desde /pro + fix selector modo | ✅ Completa (commits 87d41a7 + 83acfce) |
| **fix** | False-positive Nubia redirect en fallback pick_type | ✅ Completa (commit c528c51) |
| **fix** | Fixes UI + Logo + Unsplash | ✅ Completa |
| **CF** | Refactor flujo chat: paso `content` nuevo (`site_type → content → building`), paletas por rubro en paso `logo`, saludo personalizado con `displayUser` en `welcome`, botón reintentar en `pro/page.tsx` | ✅ Completa (commit 8d8adef) |
| **CF2** | Simplificar flujo a 9 pasos: eliminar `pick_type` (entra directo a `welcome`), fusionar `identity` en `subdomain` (industry inline, audience descartado), eliminar `site_type` (hardcode `informational`), `social_links` persiste en transición a `content`, baja de handler muerto `redirect_nubia` + `.bak` | ✅ Completa (commit e6af3e6) |
| **CF3** | Reordenar pasos a `logo → fonts → colors → social → address → content` | ⏳ Pendiente (sesión dedicada) |
| **C** | Logo asíncrono post-build, fix bug URL Recraft | ⏳ Pendiente |

### Motores definidos (Fase 0)

| Motor | Path | Descripción |
|-------|------|-------------|
| Sitio Web PRO | `/services/manu-dev/pro` | Next.js multi-página, el actual "Dev" |
| Landing Page | `/services/manu-dev/landing` | HTML+CSS una página, sin Docker build |
| Nubia | `/services/nubia` | Tienda online + MercadoPago |
| Forge | `/services/forge` | Tokenización blockchain |

### Bugs conocidos que NO tocar en Fase 0
- Logo genera pero muestra URL rota → se resuelve en Fase C
- Modo "next" falla con connection error y cae silencioso a `lite_plus` → se resuelve en Fase B1
- Terminal muestra 148+ líneas repetidas de "Generando estilos y layout" → se resuelve en Fase D

---

## Agentes del sistema

| Agente | Ruta UI | Descripción |
|--------|---------|-------------|
| Manu Dev | `/services/manu-dev` | Generador de sitios (orquesta a Dev, Nubia, Forge) |
| Margarita | `/services/margarita` | CRM + estrategia de contenido |
| Jordan | `/services/grant` | Agente de grants |
| MentorIA | `/services/mentoria` | Suite coaching (Neville, Napoleon, Tony) |
| Nubia | `/services/nubia` | Generador tiendas |
| Forge | `/services/forge` | Contratos Solidity + deploy |

---

## Logger

Formato estándar: `[NL360 · ServiceName]`
Archivo: `lib/logger.ts`

---

## Payments

- Stripe: webhook en `/api/billing/webhooks/stripe`
- Coinbase: webhook en `/api/billing/webhooks/coinbase`
- WordPress/WooCommerce: fuente de verdad para roles y planes

---

## Variables de entorno

Los valores reales están en `config/secrets/.env.production` (permisos 600, gitignored).
El template está en `config/.env.example` (y `escritorio/.env.example`).
**NUNCA leer, loguear ni imprimir valores de `.env.production`.**

---

## Próxima sesión

Refactor flujo del chat — 9 pasos nuevos, tocar `chat/route.ts` + `manu-dev.md` + `pro/page.tsx`

---

## Estado final de sesión

Sesión completada. Estado actual del proyecto:

- **Motor generador**: `lite_plus` con streaming, funcionando
- **Logo**: fix aplicado, se sirve correctamente
- **UI**: mode picker eliminado, font grid clickeable, welcome message
- **Unsplash**: 14 mappings por rubro
- **VPS**: swap 2GB agregado

### Refactor flujo chat — ✅ Completado (commits 8d8adef + e6af3e6, rama refactor/agents-hierarchy)

Parte 1 (commit 8d8adef):
- **Saludo personalizado** en `welcome` usando `displayUser` (nombre del usuario logueado) + subdominio auto-sugerido en el mensaje
- **Paletas por rubro** en el paso `logo`: guía de psicología del color con 8 rubros + default
- **Paso `content` nuevo** con 3 preguntas de negocio; respuestas guardadas en `extra_content` (reemplazo, con encabezado de las 3 preguntas, `step='content'`)
- **Botón "Reintentar generacion"** en `pro/page.tsx`, visible solo en `buildStatus === "error"`, llama `startBuild(projectId, "lite_plus")`

Parte 2 — simplificación a 9 pasos (commit e6af3e6):
- **`pick_type` eliminado** — el flujo entra directo a `welcome` (default de `getCurrentStep`); modo `lite_plus` preservado vía frontend
- **`identity` fusionado en `subdomain`** — `industry` se captura inline (turno 2) y se persiste antes de `logo`; `audience` descartado (columna queda con fallback en create-site)
- **`site_type` eliminado** — se hardcodea `informational` en la transición a `content` (sigue alimentando prompt + páginas por defecto + Unsplash en create-site); `social_links` se guarda en esa misma transición
- Baja de handler muerto `redirect_nubia`, `redirect_nubia` fuera de `VALID_STEPS`, y `chat/route.ts.bak` borrado

**Flujo actual (9 pasos):** `welcome → subdomain → address → logo → colors → fonts → social → content → building`

### Pendiente después

- **Reorden de pasos** a `logo → fonts → colors → social → address → content` (Fase CF3 — sesión dedicada; requiere ajustar prompts internos + handlers de guardado, no solo marcadores)
- Limpieza menor: handler frontend muerto `if (parsed.step === "redirect_nubia")` en `pro/page.tsx`
- Shared layout header/footer
- Logo asíncrono post-build (Fase C — fix bug URL Recraft)
