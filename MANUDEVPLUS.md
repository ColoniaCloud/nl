# AUDITORÍA TÉCNICA: MANU DEV / NUBIA / FORGE
## Inconsistencias y faltas de lógica identificadas
*Fecha: 2026-06-11 — Basado en lectura directa del código*

---

## 1. Los subdominos no son verificados de forma cruzada entre agentes

**Archivos**: `lib/nubia/db-nubia.ts:220-224` · `app/api/manu-dev/chat/route.ts:121-132`

Manu Dev chequea disponibilidad de subdominio solo en `md_projects`. Nubia solo chequea `nb_projects`. Dos usuarios distintos podrían terminar con el mismo subdominio en agentes diferentes (`pizza.nl360.site` en Manu Dev y `pizza.nl360.site` en Nubia). En Docker/Traefik eso genera un conflicto de nombres de contenedor y enrutamiento roto.

---

## 2. Nubia chat no tiene ningún control de billing

**Archivos**: `app/api/nubia/chat/route.ts` · `app/api/nubia/create-store/route.ts` · `app/api/forge/chat/route.ts:51-53`

Forge verifica `checkAgentAccess(user.roles, "forge")` en su endpoint de chat. Nubia no tiene ninguna verificación de plan ni en `/chat` ni en `/create-store`. Un usuario de plan `free` puede usar Nubia directamente y crear tiendas sin restricción, saltando el límite de sitios y el acceso al agente que define `billing-plans.ts`.

---

## 3. El webhook de MercadoPago no verifica el origen del request

**Archivo**: `app/api/nubia/storefront/[subdomain]/payment/webhook/mp/route.ts`

El webhook acepta cualquier POST con `{type:"payment", data:{id:"..."}}`. No verifica el header `x-signature` que MercadoPago envía para autenticar la fuente. La implementación *sí* consulta el pago real en la API de MP (`getMpPaymentInfo`), lo cual mitiga el riesgo de pago inventado, pero permite un ataque de **replay**: alguien puede tomar el `payment_id` de un pago real aprobado (cualquier comercio), enviarlo a este webhook, y si el `external_reference` coincide con una orden real del sistema, esa orden queda marcada como pagada.

El webhook de Coinbase **sí** verifica la firma correctamente (`verifyCoinbaseWebhook`). La asimetría entre ambos es un error de consistencia.

---

## 4. Nubia no descarga el logo localmente (Manu Dev sí lo hace)

**Archivos**: `app/api/manu-dev/chat/route.ts:79-97` · `app/api/nubia/chat/route.ts:150-163`

Manu Dev tiene `downloadLogoLocally()` que descarga el SVG de Recraft y lo guarda en `/public/logos/logo-{id}.svg`, guardando una URL relativa al dominio del frontend. Nubia guarda directamente la URL remota de Recraft (`logoResult.url`). Las URLs de Recraft son temporales/firmadas y pueden expirar. Además, cuando el store de Nubia (en `{subdomain}.nl360.site`) intenta cargar el logo desde `external.api.recraft.ai` (distinto dominio y distinto origen), puede fallar por CORS o por expiración.

---

## 5. El tipo TypeScript de `token_standard` en Forge compile está incorrecto

**Archivo**: `app/api/forge/compile/route.ts:35`

```typescript
token_standard: project.token_standard as "ERC-20" | "ERC-721",
```

El tipo `ForgeReadyData` en `lib/forge/forge-ai.ts:40` define `token_standard` como `"ERC-20" | "ERC-721" | "ERC-1155"`. El cast en compile elimina ERC-1155. En runtime JavaScript el valor "ERC-1155" fluye igual (los casts de TypeScript no existen en runtime), pero el prompt de generación de Solidity en `forge-ai.ts:83` sí instruye cómo generar ERC-1155 correctamente. La inconsistencia está en que el tipo declarado es falso, y si algún código futuro brancha sobre este tipo (por ejemplo con un switch), ERC-1155 nunca matchearía el tipo.

---

## 6. Los colores se guardan dos veces en Manu Dev con lógica solapada

**Archivo**: `app/api/manu-dev/chat/route.ts:775-800`

Cuando Claude emite `next === "colors"` (transición logo → colors): se guardan los colores *propuestos* en `md_design`.

Cuando Claude emite `next === "fonts"` (transición colors → fonts): se guardan los colores *aprobados* en `md_design` con exactamente la misma query `INSERT ... ON DUPLICATE KEY UPDATE`.

El nombre del bloque de código en `next === "fonts"` dice `// colors -> fonts: Save confirmed colors` — es confuso porque parece que habría que guardar las fuentes ahí, pero las fuentes se guardan en `next === "social"`. La primera escritura de colores (en `next === "colors"`) es innecesaria porque siempre es sobreescrita por la segunda.

---

## 7. Si el AI no emite `font_body`, ambas fuentes quedan iguales

**Archivo**: `app/api/manu-dev/chat/route.ts:813, 817`

```typescript
[data.font_heading, data.font_body || data.font_heading, project_id]
```

El sistema prompt instruye a Claude a asignar un par heading+body (ej: "Playfair Display para titulos y Inter para textos"). Pero si por alguna razón Claude solo emite `font_heading`, el fallback asigna la misma fuente al body. Esto resulta en sitios con fuentes display (Playfair Display, Oswald) como fuente de texto corrido — visualmente incorrecto y perjudicial para la legibilidad.

---

## 8. El `step: "subdomain_conflict"` de Nubia no existe en el frontend

**Archivo**: `app/api/nubia/chat/route.ts:92-93` · `app/(app)/services/nubia/page.tsx:53`

Cuando el subdominio está ocupado, el backend devuelve `{ step: "subdomain_conflict" }`. El tipo `Step` del frontend es `"welcome" | "onboarding" | "ready" | "building" | "complete" | "cms"`. El frontend recibe un step desconocido, el estado no se actualiza correctamente, y el usuario queda en un limbo de UI sin saber qué hacer ni poder reintentar.

---

## 9. El handoff Manu Dev → Nubia pone JSON sin límite en una URL

**Archivo**: `app/(app)/services/manu-dev/page.tsx:729-731`

```typescript
params.set("handoff", JSON.stringify(parsed.nubiaHandoff));
router.push(`/services/nubia?${params.toString()}`);
```

El objeto JSON se serializa directamente como parámetro de URL. No hay validación de tamaño. Si `social_links` tiene muchas redes o los valores son largos, la URL puede exceder 2000 caracteres en IE o ~8000 en otros browsers. No hay fallback ni compresión. Si la URL se trunca, Nubia parsea un JSON inválido y cae en el catch silencioso (línea 244-246 en nubia/page.tsx), perdiendo todos los datos del handoff sin notificar al usuario.

---

## 10. Nubia chat es síncrono; dentro del mismo request genera logo (hasta 30s)

**Archivo**: `app/api/nubia/chat/route.ts:149-163`

Cuando se detecta `NUBIA_READY`, la misma request HTTP hace: crear proyecto en DB + generar tagline (Haiku) + generar logo (Recraft, hasta 30s) + actualizar brandbook. Todo en secuencia bloqueante. Si Recraft tarda o falla, no hay feedback al usuario hasta que toda la cadena resuelve o falla. En contraste, Manu Dev hace la generación de logo *después* de enviar la respuesta al stream, con feedback visible al usuario.

---

## 11. Inconsistencia de arquitectura: Forge/Nubia chat son JSON síncrono, Manu Dev usa SSE

**Archivos**: `app/api/manu-dev/chat/route.ts` · `app/api/forge/chat/route.ts:168` · `app/api/nubia/chat/route.ts:177`

Manu Dev usa Server-Sent Events (streaming token a token). Forge y Nubia devuelven `NextResponse.json({})` bloqueante. Para respuestas largas de Claude (config de token compleja, múltiples detalles de tienda), el usuario de Forge/Nubia ve un spinner sin ningún texto hasta que la respuesta completa llega. Esto es consistente entre Forge y Nubia, pero inconsistente con la experiencia de Manu Dev. No es un bug crítico, pero sí una deuda de UX y una incoherencia arquitectónica.

---

## 12. `ensureProjectColumns()` usa una flag de módulo que no es confiable en restart

**Archivo**: `app/api/manu-dev/chat/route.ts:36-53`

```typescript
let columnsEnsured = false;
```

Esta variable vive en el módulo Node.js. Si el proceso Next.js se reinicia (deploy, crash, OOM), la flag se resetea y los `ALTER TABLE` se vuelven a intentar. Están wrapped en try/catch vacío, así que no rompe nada, pero ejecuta hasta 7 ALTER TABLE en cada restart. Una migración de tabla real o un `ensureColumns()` que lea el schema actual sería más limpio.

---

## 13. Nubia chat no guarda el `project_id` en los mensajes hasta que NUBIA_READY

**Archivo**: `app/api/nubia/chat/route.ts:44, 53`

```typescript
await saveChatMessage(userId, "user", message, step || "onboarding", project_id);
// project_id es null durante todo el onboarding
```

Durante todo el flujo conversacional de Nubia (antes de que el usuario confirme con NUBIA_READY), los mensajes se guardan con `project_id = null`. Si el usuario abandona y vuelve después, no hay forma de recuperar el historial de esa conversación con el proyecto creado, porque el linkeo entre historial y proyecto nunca se actualiza (a diferencia de Manu Dev que tiene `UPDATE md_chat_history SET project_id = ?` al crear el proyecto).

---

## 14. Logo en Nubia se genera incondicionalmente al detectar NUBIA_READY

**Archivo**: `app/api/nubia/chat/route.ts:149-163`

El flujo de Nubia pide al usuario que elija si quiere logo o no (similar a Manu Dev), pero el backend **siempre** llama `generateLogo()` cuando llega NUBIA_READY, independientemente de si el usuario lo pidió o eligió "continuar sin logo". Si el usuario explícitamente dijo que no quiere logo, igual se consume créditos de Recraft y se hace una petición de hasta 30s.

---

## RESUMEN PRIORIZADO

| # | Severidad | Descripción corta |
|---|-----------|-------------------|
| 3 | CRÍTICO | Webhook MP sin verificación de origen (replay attack) |
| 2 | ALTO | Nubia sin billing check (acceso gratuito al agente) |
| 1 | ALTO | Subdominos no cruzados entre agentes (conflicto Traefik) |
| 10 | ALTO | Nubia chat síncrono + logo Recraft bloqueante (timeout user) |
| 4 | ALTO | Logo Nubia sin descargar localmente (URL expira / CORS) |
| 14 | MEDIO | Logo generado aunque usuario dijo "sin logo" |
| 9 | MEDIO | Handoff sin límite de tamaño en URL |
| 8 | MEDIO | `subdomain_conflict` step no existe en el frontend |
| 13 | MEDIO | Historial de Nubia no se vincula al proyecto creado |
| 7 | MEDIO | `font_body` fallback a `font_heading` si IA no emite el par |
| 5 | BAJO | Type cast incorrecto ERC-1155 en Forge compile |
| 6 | BAJO | Colores guardados dos veces en Manu Dev (redundante) |
| 11 | BAJO | Inconsistencia SSE vs JSON entre agentes |
| 12 | BAJO | `columnsEnsured` flag no confiable en restart |
