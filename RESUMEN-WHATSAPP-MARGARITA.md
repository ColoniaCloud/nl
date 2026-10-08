# WhatsApp en el CRM de Margarita — Resumen Ejecutivo

## Qué es

Integración que permite a un usuario del CRM de Margarita vincular su propia cuenta de WhatsApp (escaneando un QR, como WhatsApp Web) para enviar/recibir mensajes desde la plataforma NL360.

## Arquitectura

- **`wa-service`** (`/opt/docker-apps/services/wa-service/`): microservicio Node.js/Express independiente, usa **Baileys** (`@whiskeysockets/baileys`, protocolo WhatsApp Web nativo — sin Chromium/Puppeteer). Corre en el contenedor `wa-service`, puerto 3002 **solo interno** (no expuesto por Traefik, únicamente accesible desde `escritorio` vía la red Docker `app-network`).
- **Proxy Next.js**: `escritorio/app/api/whatsapp/*` (rutas `qr`, `status`, `send`, `contacts`, `history/[jid]`, `logout`, `webhook`). Actúan como intermediarias autenticadas (JWT de usuario) entre el frontend y `wa-service` (`lib/wa-client.ts`, header `x-service-secret`).
- **Persistencia**: MySQL, base `nl360`, tablas `wa_sessions` (estado de vinculación por usuario) y `wa_messages`.
- **Sesión WhatsApp**: credenciales de Baileys por usuario en volumen Docker `wa_auth_states` (`auth_states/session_<userId>/`).
- **Frontend**: `escritorio/components/whatsapp/WaConnectPanel.tsx` y `WaQRCode.tsx`, dentro de `/services/margarita/crm`.

## Flujo de vinculación por QR

1. Usuario abre la pestaña WhatsApp del CRM → `WaQRCode` pide `GET /api/whatsapp/qr`.
2. Esa ruta valida plan/acceso (`lib/wa-access.ts`, requiere `pro|elite|nl_setters|nl_admin`), marca `wa_sessions` en `qr_pending`, y dispara `POST wa-service:3002/sessions/:userId/start`.
3. `wa-service` abre un socket Baileys con `useMultiFileAuthState`. Cuando Baileys emite un QR, se convierte a PNG base64 y se envía por **webhook saliente** a `escritorio:3000/api/whatsapp/webhook`.
4. El webhook guarda el QR en `wa_sessions.qr_code` (con expiración de 60s).
5. El frontend hace polling cada 2s a `GET /api/whatsapp/status` (lee directo de MySQL) hasta recibir el QR y mostrarlo como `<img>`.
6. Al escanear, Baileys emite `connection=open` → webhook `CONNECTED` → `wa_sessions.status=connected` con el teléfono vinculado.

No hay WebSocket/SSE hacia el navegador — todo el estado intermedio pasa por MySQL, alimentado por el webhook saliente de `wa-service`.

## Capacidades actuales y limitaciones conocidas

- Vinculación por QR, envío de mensajes (`/send`), reconexión automática con límite de reintentos (5, backoff exponencial) y reset manual de sesión (`/reset`) para limpiar credenciales inválidas.
- `contacts` y `history` son **stubs parciales** — no devuelven datos reales de WhatsApp, documentado en `services/wa-service/IMPLEMENTATION_PLAN.md` como pendiente ("enriquecer con datos reales desde la DB compartida").
- El servicio **no está versionado en git** (`services/wa-service/` completo fuera de control de versiones) — riesgo de pérdida total del código si se borra el disco sin backup. Recomendado: `git add services/wa-service && git commit` en una sesión dedicada.
- Documentación técnica adicional ya existente dentro del propio servicio: `services/wa-service/ARCHITECTURE.md`, `AUDIT-FIXES.md`, `TESTING.md`.
