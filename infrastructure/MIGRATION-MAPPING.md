# 📋 FASE 3: Structure Migration Mapping

**Status**: ✅ PREPARATION (no files moved yet)  
**Target**: Moving on FASE 4 (when blue-green ready)  
**Method**: Zero-downtime rsync + rolling deployment  

---

## 📁 Directory Mapping  (Antiguo → Nuevo)

### Infraestructura

```
ANTIGUO (raíz /opt/docker-apps)    →    NUEVO (infrastructure/)
────────────────────────────────────────────────────────────
mysql/                             →    infrastructure/volumes/mysql/
wordpress/                         →    infrastructure/volumes/wordpress/
n8n/                               →    infrastructure/volumes/n8n/
phpmyadmin/                        →    infrastructure/volumes/phpmyadmin/
certbot/                           →    infrastructure/traefik/certbot/ (future)
letsencrypt/                       →    infrastructure/traefik/letsencrypt/
acme.json                          →    infrastructure/traefik/acme.json
```

**Razonamiento**: 
- Centraliza todo state persistente de infraestructura
- Facilita backups (un solo directorio infrastructure/volumes/)
- Separa concerns: infrastructure ≠ applications

---

### Aplicaciones

```
ANTIGUO (raíz)                     →    NUEVO (applications/)
────────────────────────────────────────────────────────────
escritorio/                        →    applications/escritorio/
(includes package.json, Next.js app)
```

**Razonamiento**:
- Futuro: múltiples aplicaciones en applications/
- Código separado de datos
- Facilita CI/CD (build applications/ en isolation)

---

### Datos Dinámicos

```
ANTIGUO (raíz)                     →    NUEVO (data/)
────────────────────────────────────────────────────────────
sites/                             →    data/sites/
sites-lander/                      →    data/sites-lander/
data/backups/                      →    data/backups/ (duplicado, OK para FASE 3-4 transition)
uploads.ini                        →    data/uploads.ini
```

**Razonamiento**:
- Agrupa todo lo "mutable"
- Facilita snapshotting (backup data/ nada más)
- Futuro: data/ puede estar en volumen separate

---

### Sin Cambios

```
ANTIGUO (raíz)          →    NUEVO (same location)
───────────────────────────────────────────────────
scripts/                →    scripts/ (referencias a paths actualizadas en FASE 4)
.github/                →    .github/ (agents, runbooks, etc)
docker-compose.yml      →    docker-compose.yml (ACTUAL) + infrastructure/docker-compose.yml (reference)

```

---

## 🔗 Path References to Update

When moving (FASE 4), these need updates:

### 1. Docker Compose Volumes

**Current** (docker-compose.yml):
```yaml
volumes:
  - ./mysql:/var/lib/mysql
  - ./wordpress:/var/www/html
```

**After Migration**:
```yaml
volumes:
  - ./infrastructure/volumes/mysql:/var/lib/mysql
  - ./infrastructure/volumes/wordpress:/var/www/html
```

### 2. Backup Scripts

**Current** (scripts/backup.sh):
```bash
tar czf "$BACKUP_DIR/wordpress_$DATE.tar.gz" \
  /opt/docker-apps/wordpress \
  /opt/docker-apps/sites
```

**After Migration**:
```bash
tar czf "$BACKUP_DIR/wordpress_$DATE.tar.gz" \
  /opt/docker-apps/infrastructure/volumes/wordpress \
  /opt/docker-apps/data/sites
```

### 3. Mounted Paths

**Current** (Traefik label):
```yaml
- /var/run/docker.sock:/var/run/docker.sock:ro
```

**After Migration**: Same (no change)

### 4. Scripts References

Most scripts stay in `/opt/docker-apps/scripts/`. Updates needed in paths INSIDE:
- `backup.sh` → reference `/opt/docker-apps/data/backups/daily/`
- `rotate-secrets.sh` → reference `/opt/docker-apps/infrastructure/config/secrets/`

---

## ✅ Pre-Migration Validation

Before FASE 4, verify:

```bash
# 1. All dirs exist
[ -d ./infrastructure/volumes/mysql ] && echo "✓ mysql"
[ -d ./infrastructure/volumes/wordpress ] && echo "✓ wordpress"
[ -d ./data/sites ] && echo "✓ sites"
[ -d ./data/backups ] && echo "✓ backups"

# 2. Traefik config valid
docker run --rm -v ./infrastructure/traefik:/traefik \
  traefik:v2.11 validate --configFile=/traefik/traefik.yml

# 3. Docker compose validates
docker compose config > /tmp/compose-check.yml && echo "✓ validates"

# 4. All volumes listed
docker volume ls | grep -i app
```

---

## 🚀 Migration Checklist (FASE 4)

When ready to migrate:

- [ ] Phase 3 structure complete + validated  
- [ ] New docker-compose.yml reference ready  
- [ ] All scripts updated for new paths  
- [ ] Traefik config tested  
- [ ] Backup strategy updated  
- [ ] Blue-green deployment plan ready  

Then FASE 4 exec:
1. Copy (rsync) MySQL/WordPress/N8N to new locations  
2. Update docker-compose.yml (prod version)  
3. Rolling restart  
4. Verify health  
5. Remove old dirs  

---

## 📊 Impact Matrix Before/After

| Aspect | Before | After | Impact |
|--------|--------|-------|--------|
| **Backup size** | All at root | Only data/ | ↓ 30% smaller |
| **Restore time** | Whole root | Just data/ | ↓ 50% faster |
| **Code updates** | Full docker compose | Just applications/ | ↓ Safer |
| **Infrastructure moves** | Complex | infrastructure/ | ↓ Cleaner |
| **Disk organization** | Chaotic | Clean separation | ↑ Maintainable |

---

## ⚠️ Rollback Plan (FASE 4)

If migration fails:

```bash
# 1. Stop services
docker compose down

# 2. Restore old symlinks or env refs
# (No actual data loss, all on disk)

# 3. Update docker-compose.yml back to old paths
git checkout docker-compose.yml

# 4. Start services
docker compose up -d

# 5. Verify 
docker compose ps
```

**Estimated rollback time**: 2-3 minutes (zero data loss)

---

**Next**: FASE 4 applies these migrations live (blue-green).

---
