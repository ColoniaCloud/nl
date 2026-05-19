# 📘 NL360 — Documentación Técnica & Operacional

**Versión**: 1.0  
**Última actualización**: 2026-04-14  
**Estado**: Post-FASE-1 (Secretos Contenidos)  
**Responsable**: DevOps/SRE Team  

---

## 📑 Tabla de Contenidos

1. [Arquitectura General](#arquitectura-general)
2. [Estructura de Directorios](#estructura-de-directorios)
3. [Servicios & Dependencias](#servicios--dependencias)
4. [Configuración & Secretos](#configuración--secretos)
5. [Backups & Disaster Recovery](#backups--disaster-recovery)
6. [Deployment & Upgrades](#deployment--upgrades)
7. [Troubleshooting](#troubleshooting)
8. [Runbooks Operacionales](#runbooks-operacionales)
9. [Security & Compliance](#security--compliance)
10. [FAQ](#faq)

---

## Arquitectura General

### Stack General

```
┌─────────────────────────────────────────────────────────┐
│                    INTERNET (HTTPS)                      │
└────────────────────┬────────────────────────────────────┘
                     │
         ┌───────────▼────────────┐
         │ Traefik v2.11 (Proxy)  │ ← TLS termination, routing
         │ Port: 80, 443          │
         └───────────┬────────────┘
                     │
  ┌──────────┬───────┼───────┬──────────┐
  │          │       │       │          │
  ▼          ▼       ▼       ▼          ▼
WordPress  N8N    Escritorio phpMyAdmin VSCode
API.nl360  automata nl360.site db.nl360  files.nl360
site       .site              .site      .site

                    │
         ┌──────────▼──────────┐
         │   MySQL 8.0         │ ← 2 schemas:
         │   Port: 3306 (int)  │   - wordpress
         └─────────────────────┘   - manu_dev
```

### Red Interna

- **Network**: `app-network` (bridge driver)
- **DNS**: Docker internal DNS (127.0.0.11:53)
- **Service discovery**: Por nombre (e.g., `mysql:3306`)

### Volúmenes Persistentes

| Volumen | Montado En | Contenido |
|---------|-----------|----------|
| `./mysql/` | `/var/lib/mysql` | Datos MySQL |
| `./wordpress/` | `/var/www/html` | WordPress + plugins |
| `./n8n/` | `/home/node/.n8n` | N8N workflows + DB |
| `./sites/` | `/opt/docker-apps/sites` | Generated Next.js sites (Manu Dev) |
| `./letsencrypt/` | `/letsencrypt/` | ACME certs (auto-renewed) |

---

## Estructura de Directorios

```
/opt/docker-apps/
│
├── 🏗️  INFRAESTRUCTURA
│   ├── docker-compose.yml          ← Stack principal
│   ├── uploads.ini                 ← PHP config (upload limits)
│   └── letsencrypt/
│       └── acme.json               ← Certs (auto-renewed por Traefik)
│
├── 🔐 CONFIGURACIÓN & SECRETOS
│   ├── config/
│   │   ├── .env.example            ← Template (safe para git ✓)
│   │   └── secrets/
│   │       └── .env.production     ← Actual secrets (600, NO git ✗)
│   └── .gitignore                  ← Protege secrets
│
├── 📦 APLICACIONES
│   ├── escritorio/                 ← Next.js principal
│   │   ├── package.json
│   │   ├── Dockerfile
│   │   ├── app/                    ← App Router pages
│   │   ├── components/
│   │   ├── lib/
│   │   └── public/
│   ├── wordpress/                  ← WordPress core + plugins
│   └── nubia-templates/            ← Templates para Manu Dev
│
├── 📊 DATOS GENERADOS
│   ├── sites/                      ← Sitios generados (Manu Dev)
│   │   ├── [project-name]/         ← Cada sitio es container
│   │   │   ├── Dockerfile
│   │   │   ├── package.json
│   │   │   └── ...
│   │   └── ...
│   ├── sites-lander/               ← Variação lander
│   ├── data/
│   │   └── backups/
│   │       ├── daily/              ← 7 días
│   │       ├── weekly/             ← 4 semanas
│   │       └── monthly/            ← 12 meses
│   └── uploads/                    ← User uploaded files
│
├── 🛠️  SCRIPTS & AUTOMATIZACIÓN
│   ├── scripts/
│   │   ├── backup.sh               ← Daily MySQL + volumes
│   │   ├── backup-verify.sh        ← Weekly restore test
│   │   ├── rotate-secrets.sh       ← Monthly secret rotation
│   │   ├── manu-dev-build.sh       ← Build generated sites
│   │   ├── lander-build.sh
│   │   └── ...
│   └── logs/
│       ├── nl360-backup.log        ← Backup execution log
│       ├── nl360-backup-verify.log ← Verify test results
│       └── nl360-secret-rotation.log ← Rotation audit trail
│
├── 📚 DOCUMENTACIÓN
│   ├── .github/
│   │   ├── agents/
│   │   │   └── system-architect.agent.md ← VS Code custom agent
│   │   └── runbooks/
│   │       ├── backup-restore.md        ← Disaster recovery
│   │       ├── incident-response.md     ← TODO
│   │       └── deployment.md            ← TODO
│   ├── docs/
│   │   ├── ARCHITECTURE.md              ← Sistema diagrams
│   │   ├── TROUBLESHOOTING.md
│   │   └── DEPLOYMENT.md
│   ├── RESTRUCTURING-PLAN.md     ← Plan 6 fases
│   ├── FASE-1-COMPLETADO.md      ← Estado actual
│   ├── ACCIONES-INMEDIATAS-FASE1.md
│   ├── MEMORIA-SESION.md
│   ├── INDICE.md
│   └── README.md                 ← ESTE ARCHIVO
│
└── 🗂️  UTILIDADES
    ├── vscode_config/            ← Config de code-server
    ├── phpmyadmin/               ← Admin UI (contenedor)
    └── filebrowser/              ← File browser
```

---

## Servicios & Dependencias

### 1. **Traefik v2.11** (Reverse Proxy/Load Balancer)

**Rol**: TLS termination, routing, service discovery, certificate management

**Puerto expuesto**:
- `:80` → HTTP (redirect to HTTPS)
- `:443` → HTTPS (production)
- `:8080` → Dashboard (insecure, localhost only)

**Configuración**:
```yaml
Entrypoints:
  - web (80) → websecure (443) redirect
Providers:
  - Docker (auto-discover by labels)
ACME:
  - HTTP challenge
  - Auto-renewal (30 days before expiry)
  - Certs stored: /letsencrypt/acme.json
```

**Dominios manejados**:
- `nl360.site` → Escritorio (Next.js)
- `api.nl360.site` → WordPress REST API
- `automata.nl360.site` → N8N
- `db.nl360.site` → phpMyAdmin
- `files.nl360.site` → VSCode Server
- `*.nl360.site` → Generated sites (Manu Dev)

**Routing rules** (por prioridad):
1. Priority 100: Block xmlrpc.php, wp-signup.php, wp-activate.php
2. Priority 90: Rate limit wp-login.php
3. Priority 50: WP-Admin routes
4. Priority 30: Escritorio (Next.js)
5. Priority 20: Other services
6. Priority 10: WordPress catchall

---

### 2. **MySQL 8.0** (Database)

**Rol**: Persistencia de datos (WordPress + Manu Dev)

**Configuración**:
```
Host: mysql (internal DNS)
Port: 3306 (internal only, no expose)
Volume: ./mysql/ → /var/lib/mysql
Env vars: MYSQL_ROOT_PASSWORD, MYSQL_DATABASE, MYSQL_USER, MYSQL_PASSWORD
```

**Esquemas**:
| Schema | Propósito |
|--------|-----------|
| `wordpress` | WordPress core (posts, pages, users, etc.) |
| `manu_dev` | Manu Dev (projects, pages, design) |
| `mysql` (system) | User grants, etc. |

**Queries útiles**:
```sql
-- Ver bases de datos
SHOW DATABASES;

-- Tamaño de cada DB
SELECT table_schema, ROUND(SUM(data_length+index_length)/1024/1024, 2) AS size_mb 
FROM information_schema.tables 
GROUP BY table_schema;

-- Número de posts/páginas
SELECT COUNT(*) FROM wordpress.wp_posts WHERE post_type = 'post';

-- Projects en Manu Dev
SELECT id, subdomain, status FROM manu_dev.md_projects;
```

**Backup/Restore**:
```bash
# Backup completo
mysqldump -u root -p"$MYSQL_ROOT_PASSWORD" --all-databases > backup.sql

# Restore
mysql -u root -p"$MYSQL_ROOT_PASSWORD" < backup.sql

# Solo una DB
mysqldump -u root -p"$MYSQL_ROOT_PASSWORD" wordpress > wordpress.sql
mysql -u root -p"$MYSQL_ROOT_PASSWORD" wordpress < wordpress.sql
```

---

### 3. **WordPress** (CMS + API)

**Rol**: Sistema de autenticación, Manu Pro (wizard 9 pasos)

**Configuración**:
```
Main domain: api.nl360.site
API endpoint: /wp-json
Auth: Application password (JWT via nl360_jwt cookie)
Volume: ./wordpress/ → /var/www/html
```

**Rutas importantes**:
| Ruta | Propósito |
|------|-----------|
| `/wp-json/` | REST API (auth, user info) |
| `/wp-admin/` | Admin panel |
| `/wp-login.php` | Login |
| `/wp-cron.php` | Cron jobs |

**Extensiones críticas**:
- Manu Pro plugin → `/wp-content/plugins/manu-pro/`
- Custom scripts → `/wp-content/mu-plugins/`

---

### 4. **Escritorio (Next.js 16)** (Main App)

**Rol**: UI principal, Manu Dev (chat-builder IA), orchestración Docker

**Configuración**:
```
Main domain: nl360.site
Internal port: 3000
Build context: ./escritorio/
```

**Estructura clave**:
```
app/
├── layout.tsx              ← Root layout
├── page.tsx                ← Home
├── login/
├── dashboard/              ← Manu Pro wizard
└── services/
    └── manu-dev/           ← Chat builder

api/
├── auth/                   ← Login/logout
├── manu-pro/*              ← Wizard API
└── manu-dev/*              ← Chat API
```

**Env vars críticas**:
```
WP_URL=https://api.nl360.site
MYSQL_HOST=mysql_db
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-...
NL360_INTERNAL_SECRET=...
```

**Docker socket**:
- Montado: `/var/run/docker.sock`
- Uso: Build/run containers para Manu Dev generated sites
- ⚠️ Riesgo: Sin RBAC (Fase 5)

---

### 5. **N8N** (Workflow Automation)

**Rol**: Automatización, webhooks, integraciones

**Configuración**:
```
Domain: automata.nl360.site
Internal port: 5678
Database: SQLite (/home/node/.n8n/database.sqlite)
```

**Webhooks**:
- Create site: `/webhook/create-site-trigger`
- Other custom flows

---

### 6. **phpMyAdmin** (Database Admin)

**Rol**: SQL debugging, manual DB admin

**Configuración**:
```
Domain: db.nl360.site
Internal port: 80
Access: Requires auth (nginx basic auth o similar futuro)
```

⚠️ **Security**: Expuesto públicamente sin auth → **Fase 4 priority**

---

### 7. **VSCode Server** (Remote Development)

**Rol**: IDE remoto, edición de código en vivo

**Configuración**:
```
Domain: files.nl360.site
Internal port: 8443
Volumes: 
  - /opt/docker-apps → /config/workspace (toda la app visible)
```

**Env vars**:
```
PASSWORD=<codeserver_password>
SUDO_PASSWORD=<codeserver_sudo_password>
```

---

## Configuración & Secretos

### Gestión de Secretos

**Estructura**:
```
config/
├── .env.example              ← Template (GIT ✓)
└── secrets/
    └── .env.production       ← Actual (GIT ✗, perms 600)
```

**Variables críticas** (en `.env.production`):

| Variable | Ejemplo | Uso | Sensibilidad |
|----------|---------|-----|--------------|
| `MYSQL_ROOT_PASSWORD` | `NLevel@360` | MySQL auth | CRÍTICA |
| `MYSQL_USER` | `nlevel` | MySQL user | Alta |
| `MYSQL_PASSWORD` | `NLevel@360` | MySQL pass | CRÍTICA |
| `GEMINI_API_KEY` | `AIz...` | Google Gemini | CRÍTICA |
| `ANTHROPIC_API_KEY` | `sk-ant...` | Claude API | CRÍTICA |
| `OPENAI_API_KEY` | `sk-proj...` | OpenAI API | CRÍTICA |
| `UNSPLASH_ACCESS_KEY` | `5Pyq...` | Image API | Media |
| `NL360_INTERNAL_SECRET` | `4d9f...` | JWT signing | CRÍTICA |
| `NL360_WEBHOOK_SECRET` | `3934...` | N8N webhook | Alta |
| `CODESERVER_PASSWORD` | `fN7u...` | VSCode auth | Alta |
| `RESEND_API_KEY` | `re_XZ...` | Email service | Media |

**Protección**:
- Archivo `.env.production`: permisos `600` (root only)
- Directorio `config/secrets/`: permisos `700`
- `.gitignore`: bloquea commits de secrets
- Rotación: monthly via `scripts/rotate-secrets.sh`
- Audit: `/var/log/nl360-secret-rotation.log`

### Env Files Hierarchy

Docker-compose y aplicaciones leen envs en este orden (first wins):

1. `.env.production` (actual secrets)
2. `.env.local` (local dev overrides)
3. `escritorio/.env.local` (app-specific)
4. Environment section en docker-compose.yml

---

## Backups & Disaster Recovery

### Backup Strategy

**Frecuencia**:
- **Daily** (02:00 UTC): MySQL dump + volumes tar
- **Weekly** (Monday 03:00 UTC): Verify restore en container test
- **Monthly** (1st Saturday): Archive to long-term storage

**Retención**:
- Daily: 7 días
- Weekly: 4 semanas (1 per week)
- Monthly: 12 meses (1 per month)

**Ubicación**: `/opt/docker-apps/data/backups/`

### Backup Components

```
Cada backup contiene:
├── mysql_YYYYMMDD_HHMMSS.sql       (Database dump ~200-300 MB)
└── volumes_YYYYMMDD_HHMMSS.tar.gz  (WordPress, N8N, sites ~500MB-2GB)
    ├── wordpress/
    ├── n8n/
    ├── sites/
    ├── config/secrets/.env.production
    └── otros
```

### Restore Procedure

**Full restore** (~30 min, zero data loss):

```bash
# 1. Stop services
cd /opt/docker-apps
docker compose down

# 2. Start MySQL
docker compose up -d mysql
sleep 10

# 3. Restore database
docker compose exec mysql mysql -u root -p"$MYSQL_ROOT_PASSWORD" < /path/to/mysql_*.sql

# 4. Restore volumes
tar xzf /path/to/volumes_*.tar.gz -C /opt/docker-apps --preserve-permissions

# 5. Start full stack
docker compose up -d

# 6. Verify
curl -I https://nl360.site
docker compose logs escritorio | grep -i error
```

**Selective restore** (specific database):
```bash
# Solo manu_dev
mysql -u root -p"$MYSQL_ROOT_PASSWORD" manu_dev < <(grep -A 99999 "CREATE DATABASE.*manu_dev" backup.sql)
```

**Verify**: Ver `.github/runbooks/backup-restore.md` para guía completa

---

## Deployment & Upgrades

### Starting/Stopping

```bash
# Start all services
cd /opt/docker-apps
docker compose up -d

# Stop all services
docker compose down

# Restart specific service
docker compose restart escritorio

# Rebuild + restart (after code changes)
docker compose up -d --build escritorio

# View logs
docker compose logs -f escritorio
docker compose logs -f mySQL | tail -50
```

### Updating Applications

#### Escritorio (Next.js)

```bash
# Pull latest code
cd /opt/docker-apps/escritorio
git pull origin main

# Update dependencies
npm install

# Rebuild container
cd /opt/docker-apps
docker compose up -d --build escritorio

# Monitor
docker compose logs -f escritorio
```

#### WordPress

```bash
# SSH inside container
docker compose exec wordpress bash

# Update plugins
wp plugin update --all

# Update core
wp core update
```

#### N8N

```bash
# Update image tag in docker-compose.yml
# image: n8nio/n8n:latest → n8nio/n8n:1.x.x

docker compose up -d --pull always n8n
```

### Blue-Green Deployment (Future)

Para zero-downtime updates (Fase 3):
- Levantar stack nuevo en puerto temp
- Verificar smoke tests
- Swap Traefik labels
- Monitorear errores 30 min
- Rollback si falla

---

## Troubleshooting

### Common Issues

#### 1. Services not starting

```bash
# Check docker daemon
docker ps

# View specific logs
docker compose logs mysql | tail -50
docker compose logs escritorio | tail -50

# Validate config
docker compose config > /tmp/check.yml

# Restart daemon
systemctl restart docker
```

#### 2. Database connection errors

```bash
# Check MySQL is running
docker compose ps | grep mysql

# Test connection
docker compose exec mysql mysql -u root -p"$MYSQL_ROOT_PASSWORD" -e "SELECT 1;"

# Check credentials
grep "MYSQL_" /opt/docker-apps/config/secrets/.env.production

# View MySQL logs
docker compose logs mysql | tail -20
```

#### 3. SSL certificate issues

```bash
# Check cert file exists
ls -la /opt/docker-apps/letsencrypt/acme.json

# Traefik logs
docker compose logs traefik | grep -i "acme\|certificate\|error" | tail -20

# Force renewal (only if critical)
docker compose exec traefik rm /letsencrypt/acme.json
docker compose restart traefik
```

#### 4. Disk full

```bash
# Check space
df -h /opt/docker-apps

# Find large files
du -sh /opt/docker-apps/* | sort -h

# Common culprits:
du -sh /opt/docker-apps/sites/
du -sh /opt/docker-apps/data/backups/

# Clean old backups
rm /opt/docker-apps/data/backups/daily/mysql_*.sql -mtime +7
```

#### 5. Application crashing

```bash
# Check exit code
docker compose ps | grep escritorio
# Status column: Up X minutes or Exited (137) = OOM killed

# View recent logs
docker compose logs --tail=100 escritorio

# Check resources
docker stats

# If OOM: increase memory in docker-compose.yml or OS
```

---

## Runbooks Operacionales

### 🚨 Emergency Procedures

#### Service Down (5 min RTO)

1. **Identify**: `docker compose ps` → qué está abajo
2. **Logs**: `docker compose logs [service]` → error?
3. **Restart**: `docker compose restart [service]`
4. **Monitor**: `docker compose logs -f [service]`
5. **If OOM/disk**: Ver troubleshooting arriba

#### Database Corruption (30 min RTO)

1. **Stop services**: `docker compose down`
2. **Check backup**: `ls /opt/docker-apps/data/backups/daily/mysql_*.sql | head -1`
3. **Restore**: Ver "Restore Procedure" arriba
4. **Verify**: `docker compose exec mysql mysql -u root -p -e "SHOW DATABASES;"`
5. **Start full stack**: `docker compose up -d`

#### Disk Full (Immediate)

1. Cleanup backups: `rm /opt/docker-apps/data/backups/daily/mysql_*.sql -mtime +7`
2. Cleanup sites: `du -sh /opt/docker-apps/sites/* | sort -h` → identify large ones
3. Monitor: `df -h /opt/docker-apps` → verify freed space

### 📈 Scaling / Adding Services

Ver `.github/runbooks/deployment.md` (futuro)

### 🔄 Maintenance Windows

- **Backup**: Daily 02:00 UTC (5 min, no user impact)
- **Verify test**: Monday 03:00 UTC (5 min, no user impact)
- **Secret rotation**: Monthly (manual, no downtime)
- **Major updates**: Schedule 2-week window, announce in advance

---

## Security & Compliance

### Current Status

| Aspecto | Estado | Crítica | Acción |
|--------|--------|---------|--------|
| Secrets centralizados | ✅ | No | Monitored mensual |
| Backups automatizados | ✅ | No | Verify weekly |
| TLS/HTTPS | ✅ | No | Auto-renewal via ACME |
| MySQL password auth | ✅ | Sí | Rotar antes que Fase 2 |
| .env.production permisos | ✅ (600) | Sí | Monitored |
| Docker socket sin RBAC | ❌ | Sí | Fase 5 |
| Traefik --api.insecure | ❌ | Sí | Fase 4 |
| Health checks | ❌ | No | Fase 4 |
| Logs centralizados | ❌ | No | Fase 4 |

### Best Practices

1. **Never commit secrets**:
   ```bash
   # Check before git push
   git diff HEAD | grep -i "password\|secret\|key" && echo "ABORT!" || echo "OK"
   ```

2. **Rotate credentials monthly**:
   ```bash
   /opt/docker-apps/scripts/rotate-secrets.sh
   ```

3. **Backup regularly and test**:
   ```bash
   # Monday 03:00 UTC automatic, or manual:
   /opt/docker-apps/scripts/backup-verify.sh
   ```

4. **Monitor logs**:
   ```bash
   tail -f /var/log/nl360-backup.log
   tail -f /var/log/nl360-secret-rotation.log
   ```

5. **Limit service exposure**:
   - phpMyAdmin: No public auth (Fase 4)
   - VSCode: Password protected ✓
   - WordPress: JWT auth ✓
   - N8N: Webhook secret ✓

---

## FAQ

### P: ¿Cómo agrego un nuevo servicio?

**R**: 
1. Agregar entry en docker-compose.yml
2. Traefik auto-descubre vía labels
3. Test: `docker compose up -d`

### P: ¿Cómo cambio MySQL password?

**R**:
1. Editar `config/secrets/.env.production`
2. Cambiar `MYSQL_ROOT_PASSWORD` y `MYSQL_PASSWORD`
3. `docker compose down`
4. Cambiar password en MySQL:
   ```bash
   docker compose up -d mysql
   docker compose exec mysql mysql -u root -pOLD_PASS -e "ALTER USER 'root'@'localhost' IDENTIFIED BY 'NEW_PASS';"
   docker compose down
   ```
5. `docker compose up -d`

### P: ¿URL para acceder a cada servicio?

**R**:
- Escritorio: https://nl360.site
- WordPress API: https://api.nl360.site
- N8N: https://automata.nl360.site
- phpMyAdmin: https://db.nl360.site
- VSCode: https://files.nl360.site

### P: ¿Dónde están los logs?

**R**:
```bash
# Docker logs
docker compose logs [service]

# System logs
tail -f /var/log/nl360-backup.log
tail -f /var/log/nl360-backup-verify.log
tail -f /var/log/nl360-secret-rotation.log
```

### P: ¿Puedo escalar horizontalmente?

**R**: No (single-server setup). Futuro: Kubernetes o multi-node Docker Swarm (Fase 6 planning).

### P: ¿Qué pasa si pierdo letsencrypt/acme.json?

**R**: Traefik re-solicitará certificados al próximo restart (24-48h delay posible). Backup en `/data/backups/` protege.

### P: ¿Cómo debuggeo queries MySQL?

**R**:
```bash
docker compose exec mysql mysql -u root -p"$MYSQL_ROOT_PASSWORD"
# Inside MySQL CLI:
USE wordpress;
SELECT COUNT(*) FROM wp_posts;
```

---

## Recursos Adicionales

| Tipo | Ubicación | Propósito |
|------|-----------|-----------|
| Plan de reestructuración | `RESTRUCTURING-PLAN.md` | Roadmap 6 fases |
| Runbook backup/restore | `.github/runbooks/backup-restore.md` | Disaster recovery |
| Agent sistema | `.github/agents/system-architect.agent.md` | VS Code helper |
| Acciones inmediatas | `ACCIONES-INMEDIATAS-FASE1.md` | Setup inicial |
| Memoria sesión | `MEMORIA-SESION.md` | Decisiones & progreso |

---

## Contacto & Soporte

- **Arquitecto Sistema**: `@system-architect` en VS Code chat
- **Documentación**: `/opt/docker-apps/` en servidor
- **Logs**: `/var/log/nl360-*.log`
- **Backups**: `/opt/docker-apps/data/backups/`

---

**Última revisión**: 2026-04-14  
**Próxima**: Post-FASE-2 (Backups Remotos)  
**Mantenedor**: DevOps/SRE Team

---
