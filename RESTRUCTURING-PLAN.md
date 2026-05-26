# 🏗️ Plan de Reestructuración NL360 — Producción Zero-Downtime

**Versión**: 1.0  
**Fecha**: 2026-04-14  
**Estado**: En ejecución  
**Prioridad**: CRÍTICO (Seguridad + Disponibilidad)

---

## 📌 Visión General

Transformar `/opt/docker-apps` de una instalación ad-hoc a una **plataforma operativa profesional** con:
- ✅ Gestión de secretos hermética
- ✅ Backups automáticos verificables
- ✅ Estructura clara infraestructura/apps/datos
- ✅ Health checks y alertas
- ✅ Runbooks operacionales
- ✅ Zero downtime en todos los cambios

**Duración total**: 6-8 semanas  
**Riesgo en prod**: Bajo (~5% si se sigue el plan)  
**Downtime esperado**: 0 minutos (cutover blue-green)

---

## 🎯 Fases Ordenadas por Criticidad

### **FASE 1: Gestión de Secretos (CRÍTICO — Semana 1)**

**Por qué primero**: Credenciales hardcodeadas = riesgo inmediato de breach total.

**Riesgo si no se hace**:
- Credenciales GitHub/Docker vulnerables si repo es clonado
- Compromise instantáneo si VPS es breacheado
- Imposible auditar quién accedió a secretos

**Duración**: 4-6 horas  
**Cambios en prod**: Cero (fase de prep)  
**Rollback**: N/A (no modifica running services)

#### Tareas

1. **Crear estructura de configuración**
   ```bash
   mkdir -p /opt/docker-apps/config/secrets
   mkdir -p /opt/docker-apps/.github/runbooks
   ```

2. **Generar `.env.example` (sin valores)**
   ```bash
   cat > /opt/docker-apps/config/.env.example << 'EOF'
   # --- MySQL Configuration ---
   MYSQL_ROOT_PASSWORD=
   MYSQL_USER=
   MYSQL_PASSWORD=

   # --- IA APIs ---
   GEMINI_API_KEY=
   ANTHROPIC_API_KEY=
   OPENAI_API_KEY=

   # --- Configuration ---
   WP_URL=https://api.nl360.site
   AUTH_COOKIE_NAME=nl360_jwt

   # --- N8N ---
   NL360_WEBHOOK_SECRET=
   N8N_MANU_WEBHOOK=

   # --- Manu Dev ---
   UNSPLASH_ACCESS_KEY=
   MANU_DEV_DB=manu_dev

   # --- Other ---
   NEXT_PUBLIC_VOICE_FALLBACK=1
   HUGGING_FACE_TOKEN=
   CODESERVER_PASSWORD=
   CODESERVER_SUDO_PASSWORD=
   NL360_INTERNAL_SECRET=
   NL360_FRONTEND_URL=https://nl360.site
   RESEND_API_KEY=
   GOOGLE_PLACES_API_KEY=
   FORGE_DEPLOYER_PRIVATE_KEY=
   FORGE_DEPLOYER_ADDRESS=
   ETHERSCAN_API_KEY=
   POLYGONSCAN_API_KEY=
   BASESCAN_API_KEY=
   ARBISCAN_API_KEY=
   EOF
   ```

3. **Backup actual `.env` → protegido**
   ```bash
   cp /opt/docker-apps/.env /opt/docker-apps/config/secrets/.env.production
   chmod 600 /opt/docker-apps/config/secrets/.env.production
   ```

4. **Limpiar secrets de docker-compose.yml**
   - Remover values inline de OPENAI_API_KEY, etc.
   - Usar `${VARIABLE}` en su lugar

5. **Crear script de rotación de secretos**
   ```bash
   cat > /opt/docker-apps/scripts/rotate-secrets.sh << 'EOF'
   #!/bin/bash
   # Ejecuta mensualmente para rotar credenciales
   # - Genera nuevas API keys donde sea posible
   # - Backup antiguas
   # - Notifica cambios
   EOF
   chmod +x /opt/docker-apps/scripts/rotate-secrets.sh
   ```

6. **Documentar en `.gitignore`**
   ```bash
   echo "config/secrets/.env.production" >> /opt/docker-apps/.gitignore
   echo "config/.env*" >> /opt/docker-apps/.gitignore
   ```

---

### **FASE 2: Backups Remotos (CRÍTICO — Semana 2) ✅ COMPLETADA**

**Por qué segundo**: Disk-only backups son vulnerables a hardware failure. S3 = offsite safety.

**Riesgo si no se hace**:
- Disk failure → backups + data perdidos
- Ransomware → todo cifrado, backups no sirven
- VPS deleted → disaster

**Duración**: 8 horas prep + 30 min setup manual  
**Cambios en prod**: Cero (automatización optional)  
**Rollback**: Remover S3 sync cron, s3-backup.conf

#### ✅ Tareas Completadas

1. **Scripts S3 creados**
   ```bash
   ✅ scripts/backup-s3-sync.sh          (daily upload a S3)
   ✅ scripts/backup-s3-restore.sh       (emergency download)
   ✅ scripts/backup-alert.sh            (check+alert si falla)
   ```

2. **Configuración template**
   ```bash
   ✅ config/s3-backup.conf.example      (copy to .conf, populate manually)
   ```

3. **Disaster recovery runbooks**
   ```bash
   ✅ .github/runbooks/backup-s3-restore.md (step-by-step restore)
   ```

4. **Documentación**
   ```bash
   ✅ README.md (S3 backup section)
   ✅ FASE-2-COMPLETADO.md (status report)
   ```

#### 📋 Setup Manual Requerido (POST Fase 2)

1. **AWS Account**: Create S3 bucket + IAM user
   ```bash
   aws s3 mb s3://nl360-backups-prod --region us-east-1
   ```

2. **Credentials**: Poblar `config/s3-backup.conf` (no en git)
   ```bash
   cp config/s3-backup.conf.example config/s3-backup.conf
   nano config/s3-backup.conf  # AWS keys + bucket name
   chmod 600 config/s3-backup.conf
   ```

3. **Install AWS CLI**: En servidor
   ```bash
   apt install awscli
   ```

4. **Test manual**: Verify S3 connectivity
   ```bash
   /opt/docker-apps/scripts/backup-s3-sync.sh
   # Should see: ✅ S3 sync completed
   ```

5. **Activate cron** (optional, after testing)
   ```bash
   # Add to crontab (03:00 UTC daily)
   0 3 * * * /opt/docker-apps/scripts/backup-s3-sync.sh >> /var/log/nl360-backup-s3.log 2>&1
   
   # Add alert check (06:00 UTC daily)
   0 6 * * * /opt/docker-apps/scripts/backup-alert.sh >> /var/log/nl360-backup-alert.log 2>&1
   ```

---

### **FASE 3: Separación Lógica — Infraestructura/Apps/Datos (IMPORTANTE — Semana 2-3) ✅ COMPLETADA**

**Estado**: Completada (preparación) — 2026-04-15  
**Decisión arquitectural**: Migración de datos **NO ejecutada** (ver justificación abajo).

#### ✅ Tareas Completadas

1. **Estructura de referencia creada**
   ```
   infrastructure/
   ├── DOCKER-COMPOSE-REFACTORED.yml   # Compose referencia para migración futura
   ├── MIGRATION-MAPPING.md            # Mapping antiguo → nuevo paths
   ├── README.md                       # Documentación de la estructura
   └── traefik/
       └── traefik.yml                 # Config estática Traefik hardened
   ```

2. **Health checks agregados al compose de producción** (2026-04-15)
   - MySQL: `mysqladmin ping` (30s interval, 5 retries, 30s start_period)
   - WordPress: `curl http://localhost/` (30s interval, 3 retries, 40s start_period)
   - Escritorio: `wget --spider http://localhost:3000/` (30s interval, 3 retries, 20s start_period)
   - N8N: `wget --spider http://localhost:5678/healthz` (30s interval, 3 retries, 30s start_period)
   - WordPress ahora depende de MySQL con `condition: service_healthy`

3. **Directorios vacíos eliminados** — solo documentación referencial permanece en `infrastructure/`

4. **Script de validación**: `scripts/validate-fase3.sh`

5. **Backups**: `data/backups/` con estructura `daily/`, `weekly/`, `monthly/`

#### 🏗️ Decisión Arquitectural: No Migrar Datos

**Justificación (2026-04-15)**:

La reorganización de directorios (`mysql/` → `infrastructure/volumes/mysql/`, etc.) fue evaluada y **descartada** por las siguientes razones:

1. **Riesgo/beneficio negativo**: Mover 1.8GB MySQL + 677MB WordPress en producción requiere downtime o rsync complejo. El beneficio es solo cosmético (nombres de carpetas).
2. **Stack de 1 operador**: La complejidad adicional no tiene retorno sin equipo que la aproveche.
3. **Config madura en compose actual**: Rate-limiting, xmlrpc blocking, priority routing — todo probado y funcionando. El compose refactorizado era una versión simplificada que no capturaba toda esta complejidad.
4. **Migración a nuevo VPS**: Si se necesita migrar, el `MIGRATION-MAPPING.md` documenta la estructura ideal para aplicar en el destino limpio.

**Lo que SÍ se implementó** (valor real):
- Health checks en producción → Docker detecta y reinicia servicios caídos automáticamente
- `depends_on: condition: service_healthy` → WordPress no arranca sin MySQL sano
- Documentación de mapping → referencia para migración futura a nuevo VPS

---

### **FASE 4: Monitoring & Alerting (IMPORTANTE — Semana 3-4)**

**Por qué cuarto**: Health checks ya implementados en FASE 3. Falta observabilidad centralizada.

**Riesgo si no se hace**:
- Fallos silenciosos (downtime descubierto por usuarios)
- Debug lento (no hay logs centralizados)
- Recuperación reactiva en lugar de proactiva

**Nota**: Health checks con auto-restart ya activos desde FASE 3 (2026-04-15).

**Duración**: 6-8 horas  
**Cambios en prod**: Sí, pero no disruptivos (logs + alertas, sin reinicio)

#### Tareas

1. ~~**Agregar health checks a docker-compose.yml**~~ ✅ Completado en FASE 3

2. **Setup centralización de logs (opcional pero recomendado)**
   - Loki + Promtail o ELK stack lite
   - Alternativa simple: rsyslog + logrotate

3. **Crear alertas básicas**
   - Disk full warning (80%)
   - Service down alert
   - MySQL connection drops

4. **Documentar en `.github/runbooks/monitoring.md`**

---

### **FASE 5: Docker Security & RBAC (IMPORTANTE — Semana 4)**

**Por qué quinto**: Menos urgente que secretos/backups, pero crítico.

**Riesgo si no se hace**:
- Contenedor comprometido = acceso total al host
- Sin limpieza de privilegios

**Duración**: 4-6 horas  
**Cambios en prod**: Sí, requiere restart limitado

#### Tareas

1. **RBAC para docker socket**
   - Usar docker-socket-proxy en lugar de montar socket directo
   - Limitar permisos: solo containers, images

2. **Remover privilegios no necesarios**
   - `privileged: false` en docker-compose
   - Drop capabilities innecesarias

3. **Hardening Traefik**
   - Proteger dashboard con auth básico
   - Remover `--api.insecure=true`

4. **Network policies**
   - Limitar comunicación entre servicios
   - Solo lo estrictamente necesario

---

### **FASE 6: Runbooks & Documentación Operacional (DESEABLE — Semana 5-6)**

**Por qué último**: Documentación es necesaria pero no urgente si Fases 1-5 están ok.

**Riesgo si no se hace**:
- Tribal knowledge (solo operador sabe cosas)
- Incident response lento
- Escalación manual de todo

**Duración**: 8-10 horas  
**Cambios en prod**: Cero

#### Tareas

1. **Crear `.github/runbooks/` con procedures**
   - `incident-response.md`
   - `scale-new-service.md`
   - `migration-vps.md`
   - `disaster-recovery.md`

2. **Crear `docs/ARCHITECTURE.md`**
   - Diagrama de servicios
   - Matriz de dependencias
   - Puertos expuestos
   - Networking

3. **Crear `docs/TROUBLESHOOTING.md`**
   - Problemas comunes + soluciones

4. **Crear `docs/DEPLOYMENT.md`**
   - Cómo deployar cambios
   - Rollback procedures

---

## 🗒️ Deuda Técnica Documentada

Artefactos huérfanos o inconsistencias detectadas durante refactors, pendientes de resolución.

- [ ] Investigar y eliminar (o conectar) `escritorio/data/conversations.json` — archivo huérfano de 3 bytes (`{}`) sin referencias en el código. Probablemente artefacto de un prototipo anterior.
- [ ] Pendiente: test runtime de Neville Sin Filtros (Disruptivo-2) tras recargar saldo de Venice. Validar que el tono directo/sin disclaimers se preservó después del refactor de Fase 3.
- [ ] Resolver loop de Neville Sin Filtros (Disruptivo-2): el modelo `venice-uncensored-1-2` sigue el `sourceContext` de la Lección 1 ("La Verdad Incómoda: Tú Eres la Causa") de forma demasiado mecánica — repite el template de la lección en lugar de mantener la voz de Neville Goddard. Pendiente: testear con Venice recargado, y si persiste, ajustar el balance entre identity prompt y sourceContext en `buildSystemPrompt`, o suavizar el sourceContext de esa lección. Branch sugerida: `fix/neville-disruptivo-loop`.
- [ ] Resolver dead data: `persona.voice` y `persona.style` en los JSONs de agentes ya no son leídos por `buildSystemPrompt` (su contenido se extrajo a `data/mentoria/prompts/*.md` en el refactor de Fase 3). Decidir si se eliminan de los JSONs y de la interface `Curriculum`, o si se conservan para uso futuro (UI, exports, etc.). Verificar antes de eliminar que ningún componente de UI los consume.
- [ ] **nvidia.ts retenido intencionalmente**: El provider NVIDIA NIM (`escritorio/lib/providers/nvidia.ts`) se mantiene en el código aunque ningún agente activo lo usa (Tony migró a Anthropic/Venice en `feat/tony-premium-models`). Está disponible para futuros agentes que requieran modelos de NVIDIA NIM. No eliminar sin verificar primero que sigue sin usos activos.

---

## 📐 Convenciones de Arquitectura

### Archivos de identidad en `data/mentoria/prompts/`

Los archivos `.md` en este directorio contienen **únicamente** identidad del agente y reglas de conducta. **No deben contener** metadata de UI como `subtitle`, `title`, `icon`, ni nombres de variantes/planes. La UI ya conoce esos datos desde el JSON; el modelo solo necesita saber quién es y cómo hablar.

---

## 🚀 Inicio de FASE 1: Gestión de Secretos

Ejecutaré ahora la FASE 1 completa (sin modificar servicios en prod).

### Estructura a crear:
```
/opt/docker-apps/
├── config/
│   ├── .env.example           # Template sin secretos
│   └── secrets/
│       └── .env.production    # Backup de actual (protegido)
├── .github/runbooks/
│   └── (future runbooks)
└── scripts/
    ├── rotate-secrets.sh      # Nuevo
    └── (existentes)
```

### Cambios en archivos existentes:
- `docker-compose.yml`: Cambiar hardcoded OpenAI key → `${OPENAI_API_KEY}`
- `.gitignore`: Agregar config secretos

---
