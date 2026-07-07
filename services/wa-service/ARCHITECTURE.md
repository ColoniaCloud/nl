# WA-Service: Arquitectura y Integración

## 📐 Diagrama de componentes

```
┌─────────────────────────────────────────────────────────────┐
│                        TRAEFIK (Proxy)                       │
│                   (api.nl360.site, db.nl360.site, etc)       │
└────────────────────────┬──────────────────────────────────────┘
                         │ (HTTP/HTTPS)
         ┌───────────────┼───────────────┐
         │               │               │
    ┌────▼───┐    ┌──────▼──────┐    ┌──▼────────┐
    │WordPress│    │ phpMyAdmin  │    │ N8N /    │
    │ (WP)    │    │  (DB GUI)   │    │ Code-Srv │
    └────┬────┘    └──────┬──────┘    └──┬───────┘
         │                │               │
         └────────────────┼───────────────┘
                  (internal network)
                          │
         ┌────────────────┼────────────────┐
         │                │                │
    ┌────▼───────┐  ┌─────▼──────┐  ┌────▼──────┐
    │ MySQL      │  │ Escritorio │  │ WA-Service│
    │ Database   │  │ (Next.js)  │  │(Baileys)  │
    └────────────┘  └─────┬──────┘  └────┬──────┘
         │ (table: wa_messages)      │    │
         │                           │    │
         └───────────────┬───────────┘    │
                         │                │
                    ┌────▼────────────────▼────┐
                    │   Internal API calls     │
                    │  (SERVICE_SECRET header) │
                    └─────────────────────────┘
```

## 🔄 Flujos de comunicación

### 1. Flujo: Iniciar sesión WhatsApp

```
Cliente (Frontend)
    │
    ├──> POST /api/whatsapp/start
    │
    └──> Escritorio (Next.js)
         │
         ├──> POST http://wa-service:3002/sessions/userId/start
         │    (Header: x-service-secret)
         │
         └──> WA-Service (Baileys)
              │
              ├──> Genera QR
              ├──> Almacena en auth_states/session_userId/
              │
              └──> Evento: QR_UPDATE
                   │
                   └──> POST http://escritorio:3000/api/whatsapp/webhook
                        (Header: x-webhook-secret)
                        
                        Payload: { userId, event: "QR_UPDATE", data: { qrBase64 } }
```

### 2. Flujo: Recibir mensaje

```
WhatsApp Client
    │
    └──> Baileys (WA-Service)
         │
         ├──> Evento: messages.upsert
         │
         └──> Evento: MESSAGE_INBOUND
              │
              └──> POST http://escritorio:3000/api/whatsapp/webhook
                   (Header: x-webhook-secret)
                   
                   Payload: { 
                     userId, 
                     event: "MESSAGE_INBOUND", 
                     data: { message: {...} } 
                   }
                   
                   ├──> (Retry 1: 1s delay)
                   ├──> (Retry 2: 2s delay)
                   └──> (Retry 3: 4s delay)
                        Si falla: Log error y descarta
```

### 3. Flujo: Enviar mensaje

```
Escritorio (Next.js)
    │
    ├──> POST /api/whatsapp/send (input: jid, text)
    │
    └──> POST http://wa-service:3002/sessions/userId/send
         (Header: x-service-secret)
         
         Validaciones:
         ├──> JID format: \d+@(s\.whatsapp\.net|g\.us)
         ├──> Text length: <= 1000 chars
         └──> Session status: connected
         
         ├──> Baileys: socket.sendMessage(jid, { text })
         │
         └──> Response: { ok: true } / Error
```

## 🏗️ Estructura de datos

### SessionData (en memoria)

```typescript
interface SessionData {
  socket: WASocket;                    // Conexión Baileys activa
  qrBase64: string | null;             // QR para escanear
  status: "qr_pending" | "connected" | "disconnected" | "error";
  phone: string | null;                // Número de WhatsApp (5491234567890)
  displayName: string | null;          // Nombre del usuario
  reconnectAttempts: number;           // Contador para limitar reintentos
}
```

### Persistencia

| Componente | Ubicación | Persistencia | Scope |
|-----------|-----------|--------------|-------|
| Credenciales WA | `auth_states/session_<userId>/` | Volumen Docker | Por usuario |
| Sesión activa | Map en memoria | En memoria | Global |
| Mensajes | MySQL: `wa_messages` | BD | Por usuario |
| Configuración | `.env` | Archivo | Global |

## 🔐 Seguridad

### Autenticación entre servicios

| Servicio A → B | Secret | Ubicación | Validación |
|---|---|---|---|
| Escritorio → WA-Service | `SERVICE_SECRET` | Header `x-service-secret` | En auth-guard.ts (arranque + petición) |
| WA-Service → Escritorio | `WEBHOOK_SECRET` | Header `x-webhook-secret` | En Escritorio (implementar) |

### Validaciones críticas en wa-service

```
┌─ Health ─┐
│ SERVICE_SECRET:     REQUIRED (no vacío)
│ NL360_URL:         REQUIRED (no vacío)
│ WEBHOOK_SECRET:    REQUIRED (no vacío)
└───────────┘

┌─ Send ─┐
│ JID: debe matchear \d+@(s\.whatsapp\.net|g\.us)
│ Text: string no vacío, máx 1000 chars
└────────┘
```

## 📦 Volúmenes

```
wa_auth_states (named volume)
├── session_user1/
│   ├── creds.json          (Credenciales de Baileys encriptadas)
│   ├── pre-keys.json
│   ├── sessions.json
│   ├── app-state-sync-key.json
│   ├── app-state-sync-version.json
│   └── sender-key-map.json
├── session_user2/
│   └── ...
└── session_userN/
    └── ...
```

Este volumen **persiste entre reinicios de contenedor**. Las credenciales no se pierden.

## 🔄 Ciclo de vida de una sesión

```
[1] Inicio                                    [6] Desconexión permanente
      │                                             │
      ├─> POST /sessions/:userId/start             ├─> Logout de usuario
      │                                             ├─> code === DisconnectReason.loggedOut
      ├─> startSession() en session-store          │
      │                                             ├─> NO reintentar
      ├─> createWASocket()                         │
      │                                             └─> sessions.delete(userId)
      │                                                  │
[2] QR pendiente                                        │
      │                                                 │
      ├─> connection.update { qr }                 [6b] Falla permanente (>5 reintentos)
      │                                                  │
      ├─> Enviar QR_UPDATE webhook                  ├─> Registrar: "Manual intervention required"
      │                                             │
      └─> Usuario escanea QR                        └─> sessions.delete(userId)
          │                                              │
[3] Conectado                                          │
      │                                                │
      ├─> connection.update { connection: "open" }  [7] Manual restart
      │                                                 │
      ├─> Enviar CONNECTED webhook                  ├─> POST /sessions/:userId/start
      │                                             │
      ├─> Escuchar mensajes                         └─> Vuelve a [1]
      │
[4] Mensajes entrantes
      │
      ├─> messages.upsert { messages, type }
      │
      ├─> Filtrar: type === "notify" && !msg.key.fromMe
      │
      └─> Enviar MESSAGE_INBOUND webhook
          (con reintentos exponenciales)
          │
[5] Desconexión temporal
      │
      ├─> connection.update { connection: "close" }
      │
      ├─> Si NO es logout:
      │   ├─> Registrar reconexión
      │   ├─> Esperar: 5s, 7.5s, 11.25s, 16.87s, 25.3s
      │   └─> Reintentar: startSession()
      │
      └─> Vuelve a [2] o [6]
```

## 🚀 Optimizaciones futuras

### Phase 2: High Availability
- [ ] Persistir estado de sesión en Redis (para que sobreviva reinicio)
- [ ] Cluster de wa-service (múltiples instancias)
- [ ] Load balancing en Traefik

### Phase 3: Observability
- [ ] Métricas Prometheus (sesiones activas, mensajes enviados/recibidos, latencia webhook)
- [ ] Logging estructurado a ELK stack
- [ ] Tracing distribuido (Jaeger)

### Phase 4: Features
- [ ] Media support (imágenes, archivos)
- [ ] Group chats
- [ ] Contact caching en Redis
- [ ] Message queue (para desacloplar webhook)

---

## 📞 Endpoints activos

```
GET  /health                           (sin auth) - Health check
POST /sessions/:userId/start           - Iniciar sesión
GET  /sessions/:userId/qr              - Obtener QR
GET  /sessions/:userId/status          - Status de sesión
POST /sessions/:userId/send            - Enviar mensaje
GET  /sessions/:userId/contacts        - Stub: contactos (query DB directamente)
GET  /sessions/:userId/history/:jid    - Stub: historial (query DB directamente)
POST /sessions/:userId/logout          - Cerrar sesión
```

## 🔗 Referencias

- Baileys: https://github.com/whiskeysockets/Baileys
- WhatsApp JID format: https://github.com/whiskeysockets/Baileys/wiki/FAQ
- Docker Compose wa-service: `docker-compose.yml` líneas 338-355
- Escritorio webhook handler: `escritorio/app/api/whatsapp/webhook/route.ts`
