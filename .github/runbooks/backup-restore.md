# 📋 Backup & Restore Procedure

**Version**: 1.0  
**Date**: 2026-04-14  
**Status**: In Effect  
**Criticality**: CRITICAL

---

## 🎯 Overview

Automated daily backups of:
- **MySQL**: Full database dumps (all schemas)
- **Critical volumes**: WordPress, N8N, sites, secrets
- **Retention**: 7 days daily, 4 weeks (1 per week), 12 months monthly
- **Verification**: Weekly restore test in isolated container

---

## 📅 Backup Schedule

| Task | Frequency | Time | Location |
|------|-----------|------|----------|
| **backup.sh** | Daily | 02:00 UTC | `/opt/docker-apps/data/backups/daily/` |
| **backup-verify.sh** | Weekly (Monday) | 03:00 UTC | Runs restore test |
| **Archive cleanup** | Monthly | 04:00 UTC | Move old backups to `/monthly/` |

---

## 🔧 Manual Backup (Emergency)

```bash
# SSH into server
ssh root@vps

# Execute backup immediately
/opt/docker-apps/scripts/backup.sh

# Output
# [2026-04-14 14:30:22] ========== BACKUP STARTED ==========
# [2026-04-14 14:30:30] MySQL dump: 245M
# [2026-04-14 14:30:45] Volumes archive: 512M
# [2026-04-14 14:30:46] ========== BACKUP COMPLETED ==========
```

---

## 🔄 Full Restore Procedure

### Before Starting

- [ ] Have latest MySQL backup file (`mysql_YYYYMMDD_HHMMSS.sql`)
- [ ] Have latest volumes archive (`volumes_YYYYMMDD_HHMMSS.tar.gz`)
- [ ] Ensure 2GB free disk space for restore
- [ ] Schedule maintenance window (services will be down ~30 min)

### Step 1: Stop Services

```bash
cd /opt/docker-apps
docker compose down

# Verify all containers stopped
docker ps -a | grep -E "traefik|mysql_db|wordpress|escritorio" | wc -l
# Should show 0
```

### Step 2: Restore MySQL

#### Option A: Full restore from backup

```bash
# Start MySQL only
docker compose up -d mysql

# Wait for MySQL to be ready
sleep 10

# Import backup
BACKUP_FILE="/opt/docker-apps/data/backups/daily/mysql_20260414_020000.sql"

docker compose exec mysql mysql -u root -p"${MYSQL_ROOT_PASSWORD}" < "$BACKUP_FILE"

# Verify
docker compose exec mysql mysql -u root -p"${MYSQL_ROOT_PASSWORD}" -e "SHOW DATABASES;"
```

#### Option B: Selective restore (specific database)

```bash
# Extract MySQL dump to file
BACKUP_FILE="/opt/docker-apps/data/backups/daily/mysql_20260414_020000.sql"

# Restore only 'manu_dev' database
docker compose exec mysql mysql -u root -p"${MYSQL_ROOT_PASSWORD}" manu_dev < <(grep -A 99999 "CREATE DATABASE \`manu_dev\`" "$BACKUP_FILE")

# Verify restore
docker compose exec mysql mysql -u root -p"${MYSQL_ROOT_PASSWORD}" -e "USE manu_dev; SELECT COUNT(*) FROM md_projects;"
```

### Step 3: Restore Volumes

```bash
# Extract archive (preserves file permissions)
ARCHIVE_FILE="/opt/docker-apps/data/backups/daily/volumes_20260414_020000.tar.gz"

cd /opt/docker-apps
tar xzf "$ARCHIVE_FILE" --preserve-permissions

# Verify key files restored
ls -la /opt/docker-apps/wordpress/index.php
ls -la /opt/docker-apps/config/secrets/.env.production
```

### Step 4: Start Services

```bash
# Update .env from restored backup
cp /opt/docker-apps/config/secrets/.env.production /opt/docker-apps/.env

# Bring up full stack
docker compose up -d

# Wait for services to stabilize
sleep 30

# Monitor logs
docker compose logs -f

# Ctrl+C after 5 min if no errors
```

### Step 5: Verify Restoration

```bash
# Test application endpoints
curl -I https://nl360.site
curl -I https://api.nl360.site/wp-json
curl -I https://automata.nl360.site/

# Check database integrity
docker compose exec mysql mysql -u root -p"${MYSQL_ROOT_PASSWORD}" \
  -e "SELECT 'manu_dev', COUNT(*) FROM manu_dev.md_projects UNION ALL SELECT 'wordpress', COUNT(*) FROM wordpress.wp_posts;"

# Monitor application logs
docker compose logs escritorio | grep -i "error\|warning" | head -10
```

### Step 6: Notification

- [ ] Notify users that services are restored
- [ ] Test core user workflows (login, chat, project creation)
- [ ] Document restore time and any issues encountered

---

## ⚠️ Troubleshooting

### Backup fails: "No MySQL backup found"

```bash
# Check backup directory
ls -la /opt/docker-apps/data/backups/daily/

# Check MySQL is running
docker compose ps | grep mysql

# Check logs
docker compose logs mysql | tail -20

# Manual fix
/opt/docker-apps/scripts/backup.sh
```

### Restore verification fails: "Cannot restore, password incorrect"

```bash
# Verify env var is set
echo $MYSQL_ROOT_PASSWORD

# If empty, source from secrets
source /opt/docker-apps/config/secrets/.env.production
echo $MYSQL_ROOT_PASSWORD

# Retry restore
docker compose exec mysql mysql -u root -p"${MYSQL_ROOT_PASSWORD}" < "$BACKUP_FILE"
```

### Disk full during backup

```bash
# Check disk space
df -h /opt/docker-apps

# Clean old backups manually (keep 3 most recent)
cd /opt/docker-apps/data/backups/daily
ls -t mysql_*.sql | tail -n +4 | xargs rm -f

# Retry backup
/opt/docker-apps/scripts/backup.sh
```

---

## 🧪 Test Restore Procedure (Monthly)

Run this **every first Monday of the month** to ensure backups are actually restorable:

```bash
#!/bin/bash
# test-restore-monthly.sh

BACKUP_DIR="/opt/docker-apps/data/backups"
LATEST_SQL=$(ls -t "$BACKUP_DIR"/daily/mysql_*.sql | head -1)

echo "Testing restore of: $(basename "$LATEST_SQL")"

# Create temp test container
docker run -d \
  --name mysql-test-restore \
  -e MYSQL_ROOT_PASSWORD=test_password \
  mysql:8.0

sleep 10

# Attempt restore
if docker exec mysql-test-restore mysql -u root -ptest_password < "$LATEST_SQL" > /dev/null 2>&1; then
  echo "✅ RESTORE TEST PASSED"
  docker rm -f mysql-test-restore
  exit 0
else
  echo "❌ RESTORE TEST FAILED"
  docker rm -f mysql-test-restore
  exit 1
fi
```

---

## 📊 Backup Compression Stats

Expected backup sizes (for planning):

| Component | Size |
|-----------|------|
| MySQL dump (WordPress + manu_dev) | 200-300 MB |
| WordPress files | 100-200 MB |
| N8N workflows | 50-100 MB |
| Generated sites (Manu Dev) | 500MB - 5GB (growth over time) |
| **Total (compressed)** | ~500MB - 2GB per backup |

**Storage cost estimate**:
- Daily: 7 × 500MB = 3.5 GB
- Weekly: 4 × 600MB = 2.4 GB  
- Monthly: 12 × 700MB = 8.4 GB
- **Total**: ~14 GB for 12-month retention

---

## 🔑 Credentials for Restore

Stored in: `/opt/docker-apps/config/secrets/.env.production`

Permissions: `600` (read-only by root)

**Required for restore**:
```bash
MYSQL_ROOT_PASSWORD=<your-password>
MYSQL_USER=<your-user>
MYSQL_PASSWORD=<your-password>
```

---

## ✅ Disaster Recovery Checklist

- [ ] Latest backup exists: `ls /opt/docker-apps/data/backups/daily/ | wc -l` > 0
- [ ] Backup verification runs weekly: `docker compose logs backup-verify | grep PASSED`
- [ ] Disk space adequate: `df -h /opt/docker-apps | awk '{print $5}'` < 80%
- [ ] MySQL connectivity: `docker compose exec mysql mysql -u root -p -e "SELECT 1;"`
- [ ] Restore procedure tested monthly: `test-restore-monthly.sh`

---
