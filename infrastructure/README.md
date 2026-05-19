# Infrastructure Directory — FASE 3 Setup

**Location**: `/opt/docker-apps/infrastructure/`  
**Purpose**: Centralized infrastructure configuration & persistent data  
**Status**: ✅ Ready for FASE 4 activation  

---

## 📁 Directory Structure

```
infrastructure/
├── volumes/                    # Persistent storage for all services
│   ├── mysql/                 # MySQL data files
│   ├── wordpress/             # WordPress installation
│   ├── n8n/                   # N8N workflows & data
│   └── phpmyadmin/            # phpMyAdmin config
│
├── traefik/                   # Reverse proxy & TLS
│   ├── traefik.yml           # Static config (FASE 3 reference)
│   ├── acme.json             # Let's Encrypt certificates
│   └── dynamic/              # Future: dynamic routing rules
│
├── config/                    # Infrastructure configuration
│   └── secrets/              # Credentials (never git)
│       └── .env.production   # Runtime environment
│
├── DOCKER-COMPOSE-REFACTORED.yml    # Reference for FASE 4
└── MIGRATION-MAPPING.md             # Path references -> paths after migration
```

---

## 🔄 Current Status (FASE 3)

### ✅ Completed

- [x] Directory structure created  
- [x] Reference docker-compose.yml (DOCKER-COMPOSE-REFACTORED.yml)  
- [x] Traefik config draft (traefik.yml)  
- [x] Migration mapping documented  
- [x] Zero-downtime plan prepared  

### ⏳ Pending (FASE 4)

- [ ] Copy current volumes to new locations (rsync)  
- [ ] Update active docker-compose.yml  
- [ ] Rolling deployment  
- [ ] Remove old directories  
- [ ] Update backup scripts  

---

## 📖 Files Reference

| File | Purpose | Usage |
|------|---------|-------|
| `DOCKER-COMPOSE-REFACTORED.yml` | New compose template | Reference for FASE 4 migration |
| `MIGRATION-MAPPING.md` | Path mapping guide | Understanding old → new paths |
| `traefik.yml` | Traefik static config | Blueprint for Traefik refactor |

---

## 🚀 FASE 4 Activation

When ready to apply changes:

```bash
# 1. Validate structure
bash /opt/docker-apps/scripts/validate-fase3.sh

# 2. Copy volumes (no downtime)
rsync -av ./mysql ./infrastructure/volumes/
rsync -av ./wordpress ./infrastructure/volumes/
rsync -av ./n8n ./infrastructure/volumes/

# 3. Update docker-compose references
# (from ./mysql → ./infrastructure/volumes/mysql/, etc)

# 4. Deploy with zero downtime
docker compose down
docker compose up -d

# 5. Verify all healthy
docker compose ps
```

---

## ⚠️ Important Notes

**Current state**: All files still at `/opt/docker-apps` root  
**No migration yet**: This directory is prepared structure only  
**Activation**: Will happen during FASE 4 (blue-green deployment)  
**Downtime**: Zero (rsync + rolling restart)  

---

**Next Phase**: [FASE 4: Health Checks & Monitoring](../FASE-4-HEALTH-CHECKS.md)

---
