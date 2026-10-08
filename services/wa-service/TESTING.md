# WA-Service: Testing & Validation Plan

## Fecha de implementación: 2026-01-12

### ✅ CAMBIOS REALIZADOS

#### 1. Security fixes (auth-guard.ts)
```typescript
// ❌ ANTES: undefined === undefined → true (AUTH BYPASS!)
if (req.headers["x-service-secret"] !== process.env.SERVICE_SECRET)

// ✅ DESPUÉS: Valida en arranque y falla rápido
const SERVICE_SECRET = process.env.SERVICE_SECRET;
if (!SERVICE_SECRET || SERVICE_SECRET.trim() === "") {
  throw new Error("FATAL: SERVICE_SECRET environment variable not set or empty");
}
```

#### 2. Environment validation (index.ts)
```typescript
// ✅ NUEVO: Validar en arranque
function validateEnvironment() {
  const required = ["NL360_URL", "WEBHOOK_SECRET"];
  const missing = required.filter(v => !process.env[v] || process.env[v]!.trim() === "");
  if (missing.length > 0) throw new Error(...);
}
validateEnvironment();
```

#### 3. Webhook with retries (index.ts)
```typescript
// ✅ NUEVO: Exponential backoff (1s → 2s → 4s)
for (let attempt = 0; attempt < maxRetries; attempt++) {
  try {
    const response = await fetch(...);
    if (!response.ok) throw new Error(...);
    return; // Success
  } catch (e) {
    const delay = Math.pow(2, attempt) * 1000;
    if (attempt < maxRetries - 1) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}
```

#### 4. Reconnection limits (session-store.ts)
```typescript
// ✅ NUEVO: Max 5 reconexiones con exponential backoff
const MAX_RECONNECT_ATTEMPTS = 5;
const backoff = INITIAL_BACKOFF_MS * Math.pow(1.5, session.reconnectAttempts);

if (session.reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
  setTimeout(() => startSession(userId), backoff);
} else {
  console.error("Max reconnection attempts reached");
  sessions.delete(userId);
}
```

#### 5. Input validation (routes/send.ts)
```typescript
// ✅ NUEVO: Validar JID format + text length
function isValidJID(jid: string): boolean {
  return /^\d+@(s\.whatsapp\.net|g\.us)$/.test(jid);
}

const MAX_TEXT_LENGTH = 1000;
if (text.length > MAX_TEXT_LENGTH) {
  return res.status(400).json({ error: "Message too long..." });
}
```

#### 6. Health endpoint (index.ts)
```typescript
// ✅ NUEVO: GET /health (sin auth)
app.get("/health", (req, res) => {
  const isConfigured = process.env.SERVICE_SECRET && process.env.NL360_URL && process.env.WEBHOOK_SECRET;
  if (!isConfigured) {
    return res.status(503).json({ status: "unhealthy", reason: "Missing env config" });
  }
  res.json({ status: "healthy" });
});
```

#### 7. Documentation (routes/contacts.ts, routes/history.ts)
```typescript
// ✅ NUEVO: Explicit stub documentation with usage instructions
/**
 * 📌 STUB ENDPOINT - NO REAL DATA
 * 
 * To get contacts:
 * 1. Query the `wa_messages` table in MySQL for unique `jid` values
 * ...
 */
```

#### 8. Structured logging (all files)
```typescript
// ✅ NUEVO: Consistent prefix logging
console.log(`[session] ✅ Connected ${userId} as ${displayName}`);
console.log(`[webhook] ✅ ${event} for ${userId} (attempt ${attempt + 1})`);
console.error(`[send] ❌ Error sending message to ${jid}:`);
```

---

## 🧪 TESTING CHECKLIST

### A. Environment Validation
```bash
# Test 1: Missing SERVICE_SECRET should FAIL to start
unset SERVICE_SECRET
npm run dev
# Expected: Error "FATAL: SERVICE_SECRET environment variable not set"

# Test 2: Missing NL360_URL should FAIL to start
export SERVICE_SECRET="test"
unset NL360_URL
npm run dev
# Expected: Error "Missing or empty environment variables: NL360_URL"

# Test 3: All vars set should START successfully
export SERVICE_SECRET="test-secret"
export NL360_URL="http://localhost:3000"
export WEBHOOK_SECRET="webhook-secret"
npm run dev
# Expected: "✅ Environment validation passed" + "🚀 Server running on port 3002"
```

### B. Health Endpoint
```bash
# Test 4: Health check (no auth required)
curl http://localhost:3002/health
# Expected: { "status": "healthy", "timestamp": "...", "port": 3002 }

# Test 5: Health check when unhealthy
# (Manually unset an env var in running container)
curl http://localhost:3002/health
# Expected: { "status": "unhealthy", "reason": "Missing environment configuration" }
```

### C. Auth Guard
```bash
# Test 6: Wrong secret rejected
curl -H "x-service-secret: wrong-secret" \
  -X POST http://localhost:3002/sessions/user1/start
# Expected: 401 { "error": "Unauthorized" }

# Test 7: Correct secret accepted
curl -H "x-service-secret: test-secret" \
  -X POST http://localhost:3002/sessions/user1/start
# Expected: 200 { "ok": true } (or error about Baileys, but auth passed)
```

### D. Message Validation (send.ts)
```bash
# Test 8: Invalid JID format
curl -H "x-service-secret: test-secret" \
  -H "Content-Type: application/json" \
  -X POST http://localhost:3002/sessions/user1/send \
  -d '{"jid": "invalid", "text": "hello"}'
# Expected: 400 { "error": "Invalid JID format. Expected: 5491234567890@s.whatsapp.net..." }

# Test 9: Text too long (>1000 chars)
LONG_TEXT=$(printf 'a%.0s' {1..1001})
curl -H "x-service-secret: test-secret" \
  -H "Content-Type: application/json" \
  -X POST http://localhost:3002/sessions/user1/send \
  -d "{\"jid\": \"5491234567890@s.whatsapp.net\", \"text\": \"$LONG_TEXT\"}"
# Expected: 400 { "error": "Message too long. Maximum 1000 characters." }

# Test 10: Valid format accepted (if session connected)
curl -H "x-service-secret: test-secret" \
  -H "Content-Type: application/json" \
  -X POST http://localhost:3002/sessions/user1/send \
  -d '{"jid": "5491234567890@s.whatsapp.net", "text": "valid message"}'
# Expected: 200 { "ok": true } (if session connected) OR 400 (not connected)
```

### E. Stub Endpoints (contacts, history)
```bash
# Test 11: Contacts returns stub with notice
curl -H "x-service-secret: test-secret" \
  http://localhost:3002/sessions/user1/contacts
# Expected: 200 { "ok": true, "notice": "Use wa_messages table in MySQL...", "status": "..." }

# Test 12: History returns stub with notice
curl -H "x-service-secret: test-secret" \
  http://localhost:3002/sessions/user1/history/5491234567890%40s.whatsapp.net
# Expected: 200 { "ok": true, "notice": "Query wa_messages table...", "jid": "...", "messages": [] }
```

### F. Reconnection Behavior (manual stress test)
```bash
# Test 13: Start a session
curl -H "x-service-secret: test-secret" \
  -X POST http://localhost:3002/sessions/user1/start
# Expected: 200 { "ok": true }

# Check logs for:
# [session] 🔄 Starting session for user1...
# [session] 📱 QR code generated for user1
# etc.

# Simulate disconnection by stopping WiFi or using Baileys event
# Should see logs like:
# [session] ❌ Disconnected user1 (code: 500)
# [session] 🔄 Reconnect attempt 1/5 in 5000ms for user1
# [session] 🔄 Reconnect attempt 2/5 in 7500ms for user1
# ... (exponential backoff: 5s, 7.5s, 11.25s, 16.87s, 25.3s)
# [session] 💀 Max reconnection attempts reached for user1. Manual intervention required.
```

### G. Webhook Retry Behavior
```bash
# Test 14: Start session with unreachable webhook
# Modify NL360_URL to point to non-existent server:
export NL360_URL="http://localhost:9999"

# Trigger an event (receive a message via Baileys)
# Should see logs like:
# [webhook] ⚠️ Attempt 1/3 failed: connect ECONNREFUSED 127.0.0.1:9999. Retrying in 1000ms...
# [webhook] ⚠️ Attempt 2/3 failed: connect ECONNREFUSED 127.0.0.1:9999. Retrying in 2000ms...
# [webhook] ⚠️ Attempt 3/3 failed: connect ECONNREFUSED 127.0.0.1:9999. Giving up.
# [webhook] ❌ Failed to deliver MESSAGE_INBOUND for user1 after 3 attempts
```

---

## 📊 EXPECTED LOGS AFTER FIXES

```
[wa-service] ✅ Environment validation passed
[wa-service] 🚀 Server running on port 3002
[wa-service] 🔗 Webhook endpoint: http://escritorio:3000/api/whatsapp/webhook

[session] 🔄 Starting session for user1...
[session] 📱 QR code generated for user1
[session] ✅ Connected user1 as John (5491234567890)

[webhook] ✅ CONNECTED for user1 (attempt 1)
[webhook] ✅ QR_UPDATE for user1 (attempt 1)

[session] 📨 Inbound message from 5491234567890@s.whatsapp.net for user1
[webhook] ✅ MESSAGE_INBOUND for user1 (attempt 1)

[send] ✅ Message sent to 5491234567890@s.whatsapp.net for user1

[session] 🚪 Logged out user1
```

---

## 🚀 DEPLOYMENT STEPS

### 1. Local testing
```bash
cd /opt/docker-apps/services/wa-service
npm install  # Rebuild if needed
npm run build
npm run start  # or npm run dev
```

### 2. Docker build & test
```bash
cd /opt/docker-apps
docker compose build wa-service
docker compose up wa-service -d
docker logs -f wa-service
```

### 3. Full stack test
```bash
docker compose up --build
# Check that wa-service starts and logs show validation passed

# Test from escritorio container
docker exec escritorio curl -H "x-service-secret: <SECRET>" \
  http://wa-service:3002/health
# Expected: { "status": "healthy", ... }
```

### 4. Smoke tests
```bash
# From your host machine
curl http://localhost:3002/health  # Should fail (no auth)
# OR if port exposed:
curl -H "x-service-secret: $(grep WA_SERVICE_SECRET .env | cut -d= -f2)" \
  http://localhost:3002/health     # Should pass
```

---

## 📝 RISK MITIGATION

### What's still NOT fixed (future work)

| Risk | Mitigation | Timeline |
|------|-------------|----------|
| Sessions lost on restart | Persist state to Redis/MySQL | Q2 2026 |
| Metrics/observability | Add Prometheus metrics | Q2 2026 |
| Rate limiting | Add rate-limit middleware | Q2 2026 |
| Message history caching | Implement Redis cache | Q2 2026 |
| Baileys version fetching | Cache version locally | Q3 2026 |

---

## ✅ VERIFICATION CHECKLIST

- [x] auth-guard.ts validates SERVICE_SECRET in constructor
- [x] index.ts validates all required env vars on startup
- [x] index.ts implements webhook retries with exponential backoff
- [x] index.ts implements GET /health endpoint
- [x] session-store.ts limits reconnections to 5 attempts max
- [x] session-store.ts uses exponential backoff for reconnection
- [x] session-store.ts has detailed logging with prefixes
- [x] routes/send.ts validates JID format
- [x] routes/send.ts limits text to 1000 chars
- [x] routes/contacts.ts documents stub behavior
- [x] routes/history.ts documents stub behavior
- [x] All files have consistent logging format [prefix]

**Status: READY FOR TESTING ✅**
