# ManuDev — Resumen de correcciones (2026-06-10/11)

---

## Resumen técnico

### C1 — `ensureProjectColumns`: detección real de columnas faltantes
**Archivo:** `escritorio/app/api/manu-dev/chat/route.ts`
- Antes: usaba un flag de módulo (`let columnsEnsured = false`) que se reseteaba en cada cold start de Next.js, causando ALTER TABLE repetidos.
- Ahora: consulta `information_schema.COLUMNS` en cada arranque, construye un `Set` con columnas existentes y solo ejecuta el ALTER si la columna realmente falta.

### C2 — `font_body` nunca se guardaba correctamente
**Archivo:** `escritorio/app/api/manu-dev/chat/route.ts`
- Antes: `font_body` fallback era `data.font_body || data.font_heading`, lo que hacía imposible distinguir "no especificado" de "igual al heading".
- Ahora: mapa `FONT_BODY_DEFAULTS` + función `resolveBodyFont(heading, body?)` que asigna pares tipográficos coherentes (ej. Playfair Display → Lato).

### C3 — Colores se guardaban dos veces por conversación
**Archivo:** `escritorio/app/api/manu-dev/chat/route.ts`
- Antes: había dos bloques de guardado de colores: uno en `next === "colors"` y otro en `next === "fonts"`. El primero era redundante y podía sobreescribir datos con valores parciales.
- Ahora: eliminado el bloque `else if (next === "colors")`. Los colores solo se persisten en el paso `fonts` cuando ambos datos están completos.

### C4 — Conflicto de subdominios entre Manu Dev y Nubia
**Archivos:** `escritorio/app/api/manu-dev/chat/route.ts`, `escritorio/lib/nubia/db-nubia.ts`
- Antes: `generateSubdomainOptions` solo consultaba `md_projects`; `subdomainAvailable` solo consultaba `nb_projects`. Un subdominio creado por un agente era invisible al otro.
- Ahora: ambas funciones consultan `md_projects` AND `nb_projects` antes de aprobar un subdominio.

### C5 — `downloadLogoLocally` duplicada entre agentes
**Archivos:** `escritorio/lib/logo-generator.ts`, `escritorio/app/api/manu-dev/chat/route.ts`
- Antes: la función existía solo como closure privado dentro del route de Manu Dev; Nubia no podía usarla.
- Ahora: movida a `lib/logo-generator.ts` como export nombrado. Manu Dev y Nubia importan desde el mismo lugar.

### C6 — Logo bloqueaba la respuesta principal
**Archivo:** `escritorio/app/api/nubia/chat/route.ts`
- Antes: la generación del logo era `await` dentro del handler SSE de Nubia, causando hasta 10s de bloqueo antes de que el usuario recibiera respuesta.
- Ahora: fire-and-forget con `.then().catch()`. La respuesta al usuario se envía inmediatamente; el logo se actualiza en DB en background.

### C7 — Billing no estaba implementado en Nubia ni en create-store
**Archivos:** `escritorio/app/api/nubia/chat/route.ts`, `escritorio/app/api/nubia/create-store/route.ts`
- Antes: ambos endpoints no verificaban plan ni contaban sitios existentes.
- Ahora: ambos llaman `checkAgentAccess(user.roles, "nubia")` y `checkMaxSites(userId, user.roles)` al inicio.

### C8 — `chat_history` no vinculaba `project_id`
**Archivo:** `escritorio/app/api/nubia/chat/route.ts`
- Antes: los mensajes de conversación previos a la creación del proyecto quedaban huérfanos (`project_id = NULL`).
- Ahora: tras crear el proyecto se ejecuta `UPDATE nb_chat_history SET project_id = ? WHERE user_id = ? AND project_id IS NULL`.

### C9 — Webhook MercadoPago sin verificación de firma
**Archivos:** `escritorio/app/api/nubia/storefront/[subdomain]/payment/webhook/mp/route.ts`, `escritorio/lib/nubia/nubia-payments.ts`
- Antes: cualquier POST al webhook era procesado sin validación de origen.
- Ahora: función `verifyMpWebhook()` con HMAC-SHA256 sobre el manifest `id:{dataId};request-id:{requestId};ts:{ts}`. Retorna 401 si la firma es inválida. El cuerpo se lee con `req.text()` + `JSON.parse` para preservar el raw body.

### C10 — `mercadopago_webhook_secret` faltaba en DB y API
**Archivos:** `escritorio/lib/nubia/db-nubia.ts`, `escritorio/app/api/nubia/payment-config/route.ts`
- Antes: el campo no existía en el tipo `NbPaymentConfig` ni en los queries INSERT/SELECT.
- Ahora: campo añadido al tipo, al INSERT, al SELECT, y enmascarado en el GET de la API (`"***"` si está configurado). Migración ejecutada en DB.

### M1 — Handoff Manu Dev → Nubia pasaba payload enorme por URL
**Archivos:** `escritorio/app/(app)/services/manu-dev/page.tsx`, `escritorio/app/(app)/services/nubia/page.tsx`, `escritorio/app/api/nubia/handoff/route.ts`, `escritorio/lib/shared-project.ts`
- Antes: el contexto completo de handoff se serializaba como JSON y se pasaba como query param `?handoff=...`, lo cual podía exceder el límite de URL y exponía datos en el historial del browser.
- Ahora: `recordHandoff()` retorna el `insertId` de la fila en `shared_handoffs`. Manu Dev pasa `?handoff_id=<número>`. Nubia hace `GET /api/nubia/handoff?id=<número>` para recuperar el contexto, con validación de `user_id`.

### M2 — Estado `subdomain_conflict` no manejado en UI de Nubia
**Archivo:** `escritorio/app/(app)/services/nubia/page.tsx`
- Antes: si el subdominio elegido ya estaba tomado al crear el sitio, la UI se bloqueaba silenciosamente.
- Ahora: step `"subdomain_conflict"` con banner ámbar explicativo y botón "Reintentar" que retoma la conversación.

### B1 — `ERC-1155` no incluido en el type cast de Forge compile
**Archivo:** `escritorio/app/api/forge/compile/route.ts`
- Antes: `token_standard as "ERC-20" | "ERC-721"` causaría error de TypeScript si llegaba un token ERC-1155.
- Ahora: `token_standard as "ERC-20" | "ERC-721" | "ERC-1155"`.

### B2 — Prompt de Nubia no describía opciones de logo
**Archivo:** `escritorio/data/nubia/prompts/nubia.md`
- Antes: el paso de logo no indicaba las tres opciones disponibles (subir, generar con IA, omitir).
- Ahora: descripción explícita de las tres opciones y campo `"logo_requested"` documentado en el bloque NUBIA_READY.

---

## Resumen en lenguaje natural

### ¿Qué se rompía antes y qué funciona ahora?

**Tipografía en Manu Dev**
Antes, si un usuario no especificaba fuente de cuerpo, el sitio generado usaba la fuente de título en todos lados (ej. Playfair Display para párrafos). Ahora el sistema elige automáticamente un par tipográfico coherente según la fuente de título elegida.

**Colores guardados dos veces**
El sistema guardaba los colores en dos momentos distintos de la conversación. Eso podía pisar datos correctos con valores incompletos. Ahora solo se guardan una vez, cuando la información está completa.

**Subdominios sin conflicto entre agentes**
Si alguien ya tenía el dominio `mitienda.nl360.site` creado con Nubia, Manu Dev igualmente te lo podía sugerir (y viceversa). Ahora ambos agentes consultan la misma lista antes de sugerir opciones.

**Logo generado sin bloquear la conversación**
En Nubia, generar un logo con IA demoraba hasta 10 segundos antes de que apareciera cualquier respuesta. Ahora la respuesta llega de inmediato y el logo se actualiza en segundo plano.

**Planes y límites de sitios en Nubia**
Nubia no revisaba si el usuario tenía plan activo ni cuántos sitios ya tenía creados. Cualquier usuario podía crear sitios ilimitados. Ahora aplican las mismas reglas de billing que en Manu Dev.

**Historial de chat vinculado al proyecto**
Los mensajes de la conversación previa a crear el sitio en Nubia quedaban "sueltos" en la base de datos sin referencia al proyecto. Ahora se vinculan automáticamente al proyecto recién creado.

**Seguridad en pagos**
El webhook de MercadoPago no verificaba si la notificación venía realmente de MercadoPago. Ahora verifica una firma criptográfica (HMAC-SHA256) y rechaza cualquier llamada no firmada correctamente.

**Campo de secreto webhook en configuración de pagos**
No había forma de configurar el secreto del webhook de MercadoPago desde la interfaz. Ahora existe el campo, se guarda encriptado y se muestra enmascarado en el panel de configuración.

**Handoff entre Manu Dev y Nubia**
Cuando Manu Dev detectaba que el usuario necesitaba una tienda, enviaba todo el contexto del proyecto como un bloque de texto enorme en la URL del browser. Eso podía romperse en browsers estrictos y exponía información sensible. Ahora se guarda en base de datos y se pasa solo un número ID.

**Pantalla de conflicto de subdominio**
Si al crear un sitio en Nubia el subdominio elegido ya estaba ocupado, la interfaz se trababa sin explicación. Ahora muestra un aviso claro con un botón para reintentar.

**Compatibilidad con tokens ERC-1155 en Forge**
Forge soporta tokens ERC-1155 pero el código tenía un type cast que no los incluía, lo que generaría un error en TypeScript al compilar. Corregido.

**Instrucciones de logo para la IA de Nubia**
El prompt del agente Nubia no describía las tres opciones de logo disponibles (subir, generar, omitir), así que el agente no siempre las ofrecía correctamente al usuario. Ahora el prompt las describe explícitamente.
