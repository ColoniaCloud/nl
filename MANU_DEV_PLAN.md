# Manu Dev — Pre-Informe de Mejoras
> Fecha: 2026-06-08 | Estado: PENDIENTE DE APROBACIÓN | No tocar hasta aprobación

---

## Resumen ejecutivo

De las 5 peticiones, **4 son completamente viables**, **1 requiere ajuste de expectativas** (SVG icons). El trabajo es quirúrgico: los cambios son aislados y reversibles sin tocar la infraestructura Docker ni el sistema de build script. Orden de implementación recomendado al final.

---

## Petición 1 — Eliminar modo `lite`, mantener solo `next` y `lite+`

### Qué dice el código hoy

```
billing-plans.ts:
  nl360_free:    ["lite"]               ← usuario free solo puede lite
  nl360_basic:   ["lite", "lite_plus"]  ← sin acceso a next
  nl360_pro:     ["lite", "lite_plus", "next"]
  nl360_elite:   ["lite", "lite_plus", "next"]

create-site/route.ts:
  if (generationMode === "lite")   → generateLiteAndDeploy()   ← genera HTML estático
  if (generationMode === "lite_plus") → generateLitePlusAndDeploy()
                                          └─ si falla → generateLiteAndDeploy() [fallback]
  else (next) → Opus 4.7 → 3 llamadas → buildAndDeploy("next")
                  └─ si falla → generateLitePlusAndDeploy() [fallback]
                                   └─ si falla → generateLiteAndDeploy() [fallback doble]
```

### Lo que SE PUEDE hacer ✅

**A) Eliminar `lite` de los planes (cambio en billing-plans.ts)**
- Cambiar `nl360_free` de `["lite"]` a `["lite_plus"]`
- Cambiar `nl360_basic` de `["lite", "lite_plus"]` a `["lite_plus", "next"]`
- Cambiar `nl360_pro` a `["lite_plus", "next"]`
- Eliminar el tipo `"lite"` de `SiteGenerationMode` o marcarlo como interno

**B) Romper la cadena de fallback a lite (cambio en create-site/route.ts)**
- En `generateLitePlusAndDeploy`: eliminar el segundo fallback a `generateLiteAndDeploy`, reemplazar con mensaje de error claro.
- En `buildAndDeploy`: el fallback de next sigue cayendo a lite+, no a lite puro.

**C) Mantener el código de `manu-dev-lite-site.ts` y `manu-dev-lite-templates.ts` como código muerto temporalmente**
- No se elimina de entrada por seguridad. Se puede purgar en una segunda fase.
- No afecta funcionalidad ni ocupa memoria en runtime.

### Lo que NO conviene hacer ⚠️

- **Eliminar `manu-dev-lite-site.ts` en esta iteración**: el código tiene ~525 líneas con varios helpers que se usan en `create-site/route.ts` (`normalizeGenerationMode`, `resolveEffectiveMode`, `validateLiteFallbackScope`). Eliminar el archivo ahora requeriría refactorizar esas funciones a otro lugar. Mejor hacerlo en fase 2 una vez que el sistema esté estabilizado.

### Archivos afectados
- `escritorio/lib/billing-plans.ts`
- `escritorio/app/api/manu-dev/create-site/route.ts` (funciones de fallback)

---

## Petición 2 — Logos con Recraft (SVG vector, sin fondo, persistencia)

### Qué dice el código hoy

**Situación actual — BUENAS NOTICIAS:**
```
lib/logo-generator.ts (ya implementado con Recraft):
  - Modelo: recraftv4_vector
  - Style: "vector_illustration"
  - response_format: "url"
  - Timeout: 30 segundos (AbortSignal.timeout(30_000)) ← correcto
  - Colores: sí, pasa primary/secondary/accent como RGB
  - Prompt: genera con texto del negocio integrado al ícono
  
chat/route.ts:
  - Línea 11: import { generateLogo } from "@/lib/logo-generator"  ← ✅ ya usa Recraft
  - Línea 706: const logoResult = await generateLogo({...})         ← ✅ ya usa Recraft
  - Líneas 79-107: función generateLogoWithHF() ← 💀 DEAD CODE, nunca se llama
```

**Problema 1 — Dead code de HuggingFace:**
La función `generateLogoWithHF` en `chat/route.ts` (líneas 79-107) existe pero no se llama desde ningún lugar. Es código legacy que hay que limpiar. La variable `HUGGING_FACE_TOKEN` también puede eliminarse si no se usa en otro lado.

**Problema 2 — El logo NO se incluye en el sitio generado:**
El logo generado por Recraft retorna una URL externa (`https://...recraft.ai/...`). Esta URL se guarda en `md_projects.logo_url` y en `md_brandbook`. Sin embargo, al revisar `buildBusinessBlock` y los prompts de generación (`buildStructurePrompt`, `buildPagePrompt`), **el logo_url nunca se pasa como contexto al modelo**. Resultado: el sitio generado no tiene el logo del negocio.

**Problema 3 — URL externa efímera:**
Las URLs de Recraft tienen TTL limitado (el servicio no garantiza permanencia). El logo debería descargarse y servirse localmente.

### Lo que SE PUEDE hacer ✅

**A) Eliminar dead code de HuggingFace**
- Borrar `generateLogoWithHF` de `chat/route.ts` (líneas 79-107)
- Verificar que `HUGGING_FACE_TOKEN` no se use en ningún otro archivo de manu-dev

**B) Descargar y persistir el logo localmente**
- Cuando Recraft retorna la URL, descargar el SVG/PNG y guardarlo en:
  - `public/logos/logo-{projectId}.svg` (en el servidor Next.js de escritorio, para mostrarlo en el chat)
  - Cuando se genera el sitio: copiar también a `/opt/docker-apps/sites/{subdomain}/public/logo.svg`
- El logo_url guardado en DB debería ser la ruta local (`/logos/logo-{projectId}.svg`)

**C) Incluir logo en los prompts de generación**
- En `buildBusinessBlock`, agregar: si existe `logo_url`, pasarlo al modelo como contexto
- En el prompt del layout: indicar que el logo debe estar en el `<nav>` como `<img src="{logo_url}" alt="{nombre} logo">`
- El model ya sabe que debe usar `<img>` y no `<Image>` (está en el system prompt)

**D) Mejorar el prompt de generación de logos**
- El prompt actual incluye texto del negocio integrado al ícono
- El usuario pide logos "coherentes para uso en websites, sin fondo y en vectores SVG"
- Recraft ya retorna SVG con fondo transparente con `vector_illustration` + `recraftv4_vector`
- Ajuste menor: clarificar el prompt para que sea más logomark/logotipo y no solo ícono

### Lo que NO conviene hacer ⚠️

- **Generar el logo directamente como SVG inline en el HTML**: Recraft retorna una URL, no el SVG raw. Descargar + inline es posible pero agrega complejidad. Mejor servirlo como archivo externo.
- **Cambiar el modelo de Recraft**: `recraftv4_vector` es el más adecuado para logos vectoriales. No cambiar.

### Archivos afectados
- `escritorio/app/api/manu-dev/chat/route.ts` (eliminar dead code, mejorar descarga)
- `escritorio/app/api/manu-dev/create-site/route.ts` (incluir logo en buildBusinessBlock, copiar al site)
- `lib/logo-generator.ts` (ajuste de prompt si se desea)

---

## Petición 3 — Resolución de modo por rol (nuevo esquema)

### Qué dice el código hoy vs. lo que se pide

| Rol | Actual | Pedido |
|-----|--------|--------|
| `free` | Solo `lite` | Solo `lite_plus` + mensaje informativo |
| `basic` | `lite`, `lite_plus` (sin next) | `lite_plus` + `next` |
| `pro` | `lite`, `lite_plus`, `next` | `lite_plus`, `next` (igual, solo quitar lite) |
| `elite` | igual que pro | igual que pro |
| `nl_setters` | igual que elite | igual que elite |

### Lo que SE PUEDE hacer ✅

**A) Actualizar `billing-plans.ts`**
```typescript
// Antes:
nl360_free:    ["lite"]
nl360_basic:   ["lite", "lite_plus"]
nl360_pro:     ["lite", "lite_plus", "next"]

// Después:
nl360_free:    ["lite_plus"]
nl360_basic:   ["lite_plus", "next"]
nl360_pro:     ["lite_plus", "next"]
```

**B) Mensaje al usuario free**
El mensaje ya existe parcialmente: cuando hay downgrade, `create-site/route.ts` emite:
```json
{ "status": "mode", "downgraded": true, "message": "Modo ajustado: next → lite_plus (limite de plan)" }
```

Lo que hay que agregar: un mensaje específico más descriptivo para free cuando intenta `next`:
```
"La capa gratuita de NL360 solo permite generar sitios con tecnología Lite+. Para Next.js y diseño avanzado, mejorá tu membresía a Basic o Pro."
```

El frontend ya recibe el campo `downgraded: true` del SSE — solo hay que actualizar el mensaje que se muestra. **No requiere cambios en el frontend**, solo en el mensaje que envía el backend.

### Lo que NO conviene hacer ⚠️

- **Bloquear la generación completamente para free**: El usuario free debería poder generar un sitio lite+, solo informarle la limitación. Si se bloquea totalmente, no hay conversión posible.
- **Mostrar el mensaje en el chat conversacional** (antes del create-site): el chat no sabe el modo de generación en ese momento. El mensaje llega cuando se inicia la generación, que es el momento correcto.

### Archivos afectados
- `escritorio/lib/billing-plans.ts`
- `escritorio/app/api/manu-dev/create-site/route.ts` (texto del mensaje)

---

## Petición 4 — Manejo de errores: fallback a `lite+` + email de reporte

### Qué dice el código hoy

```
Flujo actual de fallbacks en create-site/route.ts:

MODO NEXT:
  next falla en IA  → generateLitePlusAndDeploy({ fallback: true })
                          └─ lite+ falla → generateLiteAndDeploy({ fallback: true }) ← ELIMINAR
  
  next build falla  → generateLitePlusAndDeploy({ fallback: true })
                          └─ lite+ falla → generateLiteAndDeploy()                  ← ELIMINAR

MODO LITE+:
  lite+ falla → generateLiteAndDeploy({ fallback: true })  ← ELIMINAR
```

**Sistema de email ya existe:**
```typescript
// lib/email.ts — usa Resend API
sendEmail(to, subject, html)  // función privada
sendPasswordResetEmail()
sendWelcomeEmail()
// NO existe sendBuildErrorReport()  ← hay que agregar
```

### Lo que SE PUEDE hacer ✅

**A) Cortar la cadena de fallback en lite+**
Cuando `generateLitePlusAndDeploy` falla (result.success = false), en lugar de caer a lite puro:
```typescript
// Antes:
return generateLiteAndDeploy({ fallback: true, reason: result.error })

// Después:
send(controller, {
  status: "error",
  message: `No se pudo generar el sitio. ${result.error || "Error en la generación"}. Intenta de nuevo en unos minutos.`,
})
return false;
```

**B) Agregar `sendBuildErrorReport` en `lib/email.ts`**
```typescript
export async function sendBuildErrorReport(details: {
  subdomain: string;
  projectId: number;
  userId: number;
  errorStage: string;
  errorMessage: string;
  fallbackActivated: boolean;
}): Promise<void>
```
- Destinatario: `manuel@wpuruguay.com`
- Diseño: tabla con datos del proyecto, etapa donde falló, tail del error
- Se llama de forma fire-and-forget (no bloquea el flujo del usuario)
- Condición: solo en errores donde se activa el fallback a lite+ (no en errores de IA que se reintentan)

**C) Dónde llamar el email**
En `create-site/route.ts`, al activar el fallback de next→lite+:
```typescript
// Fire-and-forget, no await
sendBuildErrorReport({ subdomain, projectId, userId: user.id, ... }).catch(() => {})
```

### Lo que NO conviene hacer ⚠️

- **Enviar email en cada intento fallido (retry)**: Solo en el fallback definitivo, no en cada intento.
- **Enviar email cuando lite+ falla también**: Si lite+ falla es diferente — puede ser un error de IA temporal. Solo reportar cuando es un fallo de build de Next.js (más grave e informativo).
- **Await el email**: El usuario no debe esperar a que el email se envíe.

### Archivos afectados
- `escritorio/lib/email.ts` (agregar `sendBuildErrorReport`)
- `escritorio/app/api/manu-dev/create-site/route.ts` (llamar email, cortar fallback)

---

## Petición 5 — Mejorar el build del modo `next`

Esta petición tiene **dos sub-temas** que requiero separar:

### 5A — Cambiar modelo: Opus 4.7 → Sonnet 4.6

**Estado actual:**
```typescript
// lib/agents.ts, línea 32-33:
models: {
  "create-site": "claude-opus-4-7",  ← cambiar a "claude-sonnet-4-6"
}
```

**Análisis:**
- El cambio es una línea en `agents.ts`
- Sonnet 4.6 es significativamente más rápido y menos costoso que Opus 4.7
- La diferencia de calidad para generación de código JSX/CSS es mínima en la práctica — el system prompt y los prompts de usuario son el factor determinante, no el modelo
- El usuario menciona "Max Effort" que probablemente refiere a `extended_thinking` (budget_tokens) para mejorar razonamiento

**Sobre extended thinking con Sonnet 4.6:**
- Es posible activarlo con `thinking: { type: "enabled", budget_tokens: 10000 }`
- Para generación de código, extended thinking ayuda a planificar la estructura antes de escribir
- **Pero**: la respuesta del modelo en thinking mode no puede hacer streaming de la misma forma — el stream de texto solo aparece después del bloque thinking
- El código actual hace streaming en tiempo real con `charCount % 500` para mostrar progreso
- Con extended thinking, el usuario vería "silencio" durante el thinking y luego todo el código de golpe
- **Recomendación**: activar extended thinking con `budget_tokens: 8000` y ajustar el SSE para informar que está "pensando la estructura..." durante ese período

**Viabilidad:** ✅ SE PUEDE hacer. El cambio de modelo es trivial. El extended thinking requiere un ajuste en el streaming SSE.

### 5B — SVG icons en lugar de lucide-react

**Lo que implica el cambio:**
El sistema actual usa lucide-react para todos los iconos en el sitio generado. El user pide pasar a SVG inline para evitar los errores de import.

**Análisis honesto:**

| Aspecto | lucide-react (actual) | SVG inline (propuesto) |
|---------|----------------------|------------------------|
| Errores de import | Frecuentes, requieren preflight | Ninguno |
| Tokens por archivo | Bajo (solo el nombre del icono) | Alto (el SVG completo) |
| Riesgo de truncamiento | Bajo | **Mayor** (archivos más largos) |
| Consistencia visual | Alta (librería curada) | Depende del modelo |
| Mantenimiento | Simple | Complejo |
| Conocimiento del modelo | Excelente (lucide es muy conocido) | Variable (SVG paths varían) |

**Problema real con los SVGs inline:**
Un icono de lucide-react en el JSX ocupa ~1 token: `<Phone />`. El mismo ícono en SVG inline ocupa ~50-100 tokens. En una página con 20 iconos, eso son 1000-2000 tokens adicionales por archivo. Con 3 llamadas (layout + home + internas), podrían sumar 3000-6000 tokens extra, acercándose al límite de 32768 tokens y **aumentando** el riesgo de truncamiento.

**Lo que NO conviene hacer:**
- Eliminar lucide-react completamente y reemplazar por SVG inline: aumenta el riesgo de truncamiento sin garantizar mejor calidad visual.

**Lo que SÍ conviene hacer (alternativa viable):**
- **Mantener lucide-react** pero mejorar el sistema de preflight con una lista expandida de iconos comunes pre-importados en el boilerplate.
- **O**: crear un archivo `app/icons.jsx` como parte del boilerplate que exporte los iconos más usados como wrappers SVG. El modelo importa de `./icons` y el modelo no necesita saber el SVG path exacto. Esto elimina el problema de imports sin agregar tokens.

### 5C — Optimización del tiempo de build Docker

**Estado actual del Dockerfile (en boilerplate):**
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package.json .
RUN npm install          ← instala ~200 paquetes cada build (lento)
COPY . .
RUN npm run build        ← Next.js build
EXPOSE 3000
CMD ["npm","start"]
```

**Opciones ordenadas por impacto vs riesgo:**

| Opción | Reducción tiempo | Riesgo | Complejidad |
|--------|-----------------|--------|-------------|
| `output: 'standalone'` en next.config.js | 20-30% menos tamaño imagen | Bajo | Mínima |
| `npm ci` en lugar de `npm install` | 10-15% más rápido | Bajo | Mínima |
| Imagen base pre-construida con node_modules | 60-70% menos tiempo | Medio | Media |
| Turbopack (`next build --turbo`) | 30-50% más rápido | **Alto** (experimental) | Baja |
| Multi-stage build | Imagen 50% más pequeña | Bajo | Media |

**Recomendación viable para esta fase:**
1. Agregar `output: 'standalone'` al `next.config.js` del boilerplate
2. Cambiar `npm install` por `npm ci` en el Dockerfile
3. Multi-stage build (separar builder de runtime)

Estas 3 mejoras juntas pueden reducir el tiempo de build en 25-40% y el tamaño de la imagen en ~50%, sin riesgo de romper nada.

**La imagen base pre-construida** es el mayor ahorro pero requiere:
- Crear y mantener una imagen Docker base (`manu-dev-base:latest`) con node_modules instalados
- Actualizar `manu-dev-build.sh` para que use esa imagen como base
- Tener un proceso para regenerar la base cuando cambia `package.json`
- Esto está fuera del scope de la presente iteración pero es viable a futuro.

---

## Resumen de Viabilidad

| # | Petición | Viabilidad | Riesgo | Esfuerzo estimado |
|---|----------|-----------|--------|------------------|
| 1 | Eliminar modo lite de planes | ✅ Completamente viable | Bajo | 2-3 archivos, 1-2 horas |
| 2 | Logos Recraft + persistencia + incluir en sitio | ✅ Completamente viable | Bajo | 3-4 archivos, 2-3 horas |
| 3 | Nuevo esquema de roles + mensaje free | ✅ Completamente viable | Bajo | 1-2 archivos, 30 min |
| 4 | Fallback lite+ + email de reporte | ✅ Completamente viable | Bajo | 2 archivos, 1-2 horas |
| 5A | Modelo Sonnet 4.6 (+ extended thinking) | ✅ Completamente viable | Bajo | 1-2 archivos, 30 min |
| 5B | SVG icons en lugar de lucide-react | ⚠️ NO recomendado (ver alternativa) | Alto | N/A |
| 5C | Optimización Dockerfile (standalone + ci + multistage) | ✅ Viable | Bajo | 1 archivo, 1 hora |

---

## Plan de Implementación (si se aprueba)

**Orden recomendado** (cada paso es independiente y deployable):

### Fase 1 — Cambios de configuración (sin riesgos, rápido)
1. `billing-plans.ts`: nuevo esquema de roles/modos
2. `agents.ts`: cambiar modelo `create-site` a `claude-sonnet-4-6`
3. `create-site/route.ts`: actualizar mensaje de downgrade para free

### Fase 2 — Logos y persistencia
4. `chat/route.ts`: eliminar `generateLogoWithHF` (dead code)
5. `chat/route.ts`: descargar logo de Recraft URL → guardar localmente como SVG
6. `create-site/route.ts`: incluir `logo_url` en `buildBusinessBlock` + copiar logo al sitio
7. `logo-generator.ts`: ajuste de prompt si se desea (opcional)

### Fase 3 — Manejo de errores
8. `email.ts`: agregar `sendBuildErrorReport`
9. `create-site/route.ts`: cortar fallback lite+ → lite, agregar llamada al email

### Fase 4 — Build optimization
10. Boilerplate Dockerfile: standalone + npm ci + multi-stage
11. `create-site/route.ts`: actualizar boilerplate en el código
12. (Opcional) Extended thinking para Sonnet 4.6 + ajuste SSE

### Fase 5 — Limpieza (futura, no urgente)
13. Eliminar `manu-dev-lite-site.ts`, `manu-dev-lite-templates.ts` (cuando se confirme que no hay regresiones)
14. Eliminar `HUGGING_FACE_TOKEN` de `.env`

---

## Preguntas pendientes antes de implementar

1. **Petición 5B — Iconos**: ¿Querés explorar la alternativa del archivo `app/icons.jsx` con SVG curados en el boilerplate? Eliminaría los errores de import sin el riesgo de truncamiento.

2. **Extended thinking**: ¿Querés activar extended thinking en Sonnet 4.6 para la generación? Significa que el usuario verá "pensando..." durante ~15-20 segundos antes de que aparezcan los archivos.

3. **Logo en el sitio**: Cuando el logo existe, ¿debería reemplazar el texto del nombre en el nav, o aparecer junto con el texto? (nav con logo + nombre, o solo logo)

4. **Fallback lite+ completo**: Si lite+ también falla (error de IA, no solo de build), ¿mostramos error al usuario o intentamos de nuevo automáticamente?

---

*Pre-informe — no implementar hasta aprobación explícita*

---

## ✅ Implementación completada — 2026-06-08

Todas las mejoras aprobadas fueron implementadas. Resumen de cambios por archivo:

### `lib/agents.ts`
- Modelo `create-site` cambiado: `claude-opus-4-7` → `claude-sonnet-4-6`

### `lib/billing-plans.ts`
- `nl360_free`: `["lite"]` → `["lite_plus"]`
- `nl360_basic`: `["lite", "lite_plus"]` → `["lite_plus", "next"]`
- `nl360_pro/elite/nl_setters/administrator`: eliminado `"lite"` de todos
- Fallback de `getAllowedModes` cambiado de `"lite"` a `"lite_plus"`
- `getDefaultMode`: eliminado `"lite"` de la prioridad

### `lib/email.ts`
- Agregada función `sendBuildErrorReport(errorMessage, projectId?)` — envía email fire-and-forget a `manuel@wpuruguay.com` con reporte HTML cuando lite+ falla dos veces

### `app/api/manu-dev/chat/route.ts`
- Eliminada función muerta `generateLogoWithHF` (HuggingFace, nunca se llamaba)
- Agregada `downloadLogoLocally()`: descarga el SVG de Recraft y lo guarda en `public/logos/logo-{id}.svg`
- Logo guardado en DB como ruta local (`/logos/logo-{id}.svg`) en lugar de URL externa

### `app/api/manu-dev/create-site/route.ts`
- **Icons boilerplate**: `app/icons.jsx` agregado al BOILERPLATE con ~45 iconos curados re-exportados de `lucide-react`
- **SITE_SYSTEM_PROMPT**: instrucción de iconos actualizada — modelo importa de `./icons` o `../icons` (no desde `lucide-react` directo); lista de iconos disponibles incluida en el prompt
- **parseImportedLucideIcons**: regex ampliado para reconocer `from './icons'` y `from '../icons'` como imports válidos (no los marca como faltantes en preflight)
- **buildStructurePrompt**: si el proyecto tiene `logo_url`, instruye al modelo a usar `<img src={logo_url}>` en el nav con link a home, en lugar del nombre como texto
- **streamGenerate**: modo `next` activa `thinking: { type: "adaptive" }` + `output_config: { effort: "high" }`; modo `lite_plus` sin thinking
- **generateLitePlusAndDeploy**: reescrita con loop de 2 intentos; si ambos fallan → HTML de error al usuario + `sendBuildErrorReport()` fire-and-forget. Se eliminó el fallback lite+ → lite.
- **AI error handler** (next→lite+): simplificado — ya no valida `liteFallbackScope` para el fallback, siempre cae a `generateLitePlusAndDeploy`
- **Docker build failure**: también simplificado — siempre cae a `generateLitePlusAndDeploy` sin validación de scope
- **Import**: agregado `import { sendBuildErrorReport } from "@/lib/email"`

### `app/(app)/services/manu-dev/page.tsx`
- `BuildTerminal`: última línea de log renderizada con `dangerouslySetInnerHTML` cuando `status === "error"` y el mensaje empieza con `<` — permite mostrar el HTML formateado del error de doble fallo

### `package.json` / `node_modules`
- SDK `@anthropic-ai/sdk` actualizado `0.39.0` → `0.102.0` (necesario para el tipo `ThinkingConfigAdaptive` y `OutputConfig.effort`)
