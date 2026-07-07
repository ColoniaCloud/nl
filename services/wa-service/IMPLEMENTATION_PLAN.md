# WA Service Implementation Plan

## Objetivo
Mejorar la seguridad, resiliencia y observabilidad del servicio `wa-service` sin cambiar su arquitectura básica.

## Cambios aplicados

### 1. Validación de entorno
- Se añadió la validación de `SERVICE_SECRET`, `NL360_URL` y `WEBHOOK_SECRET` en `src/index.ts`.
- El servicio falla al iniciar si faltan variables críticas.
- Esto elimina la posibilidad de que `authGuard` permita acceso cuando `SERVICE_SECRET` no está configurado.

### 2. Refuerzo del middleware de autenticación
- En `src/auth-guard.ts` se valida que `SERVICE_SECRET` exista y no esté vacío.
- Si falta, el servicio lanza un error fatal en arranque.
- Además, el header `x-service-secret` se compara de forma estricta.

### 3. Health check en Docker Compose
- En `docker-compose.yml` se añadió un `healthcheck` para `wa-service`.
- El endpoint `/health` en `src/index.ts` responde con `status: healthy`.
- Esto permite a Docker detectar si el servicio está listo.

### 4. Mejora de la entrega de webhooks
- En `src/index.ts`, la entrega de eventos usa reintentos exponenciales (3 intentos).
- Si el webhook falla, se registran advertencias y errores claros.

### 5. Validación y límites de mensajes
- En `src/routes/send.ts` se valida el formato del `jid`.
- Se impone un límite de 1000 caracteres en el campo `text`.
- Se registran envíos exitosos y errores de envío.

### 6. Rutas stub documentadas
- `src/routes/contacts.ts` y `src/routes/history.ts` ahora documentan claramente que no devuelven datos reales.
- Se incluye un mensaje de guía para usar la base de datos `wa_messages`.

### 7. Robustez de reconexión de sesiones
- `src/session-store.ts` ahora limpia sockets antiguos antes de iniciar una sesión nueva.
- Se mantiene un contador de reintentos y un backoff exponencial.
- Los eventos `onEvent` están envueltos en `try/catch` para evitar que una falla rompa el socket.

## Resultado esperado
- `wa-service` arranca solo con configuración completa.
- El servicio expone `/health` para monitoreo.
- El envío de mensajes es más seguro y tolerante a errores.
- La reconexión de sesiones está limitada y no puede entrar en bucle infinito.

## Próximos pasos recomendados
1. Añadir métricas de latencia y errores a `wa-service`.
2. Implementar persistencia de estado de sesión en Redis/MySQL para reinicios.
3. Enriquecer `contacts` y `history` con datos reales desde la DB compartida.
4. Añadir tests de integración para `/health`, `/sessions/:userId/send` y gestión de reconexiones.
