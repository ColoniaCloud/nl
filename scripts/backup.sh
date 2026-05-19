#!/bin/bash
###############################################################################
# backup.sh — Daily automated backup (MySQL + critical volumes)
###############################################################################
# Execute: 0 2 * * * /opt/docker-apps/scripts/backup.sh
# Backups: /opt/docker-apps/data/backups/{daily,weekly,monthly}
###############################################################################

set -e

BACKUP_ROOT="/opt/docker-apps/data/backups"
DATE=$(date +%Y%m%d_%H%M%S)
DATE_HUMAN=$(date "+%Y-%m-%d %H:%M:%S")
LOG_FILE="/opt/docker-apps/logs/backup.log"

mkdir -p "$(dirname "$LOG_FILE")"

log() {
  echo "[$DATE_HUMAN] $1" | tee -a "$LOG_FILE"
}

log "========== BACKUP STARTED =========="

# Step 1: MySQL full dump
log "MySQL dump in progress..."
mkdir -p "$BACKUP_ROOT/daily"

docker compose -f /opt/docker-apps/infrastructure/docker-compose.yml exec -T mysql \
  mysqldump -u root -p"${MYSQL_ROOT_PASSWORD}" \
  --all-databases --single-transaction --quick --lock-tables=false \
  > "$BACKUP_ROOT/daily/mysql_$DATE.sql" 2>/dev/null

if [ $? -eq 0 ]; then
  SIZE=$(du -h "$BACKUP_ROOT/daily/mysql_$DATE.sql" | cut -f1)
  log "✅ MySQL dump: $SIZE"
else
  log "❌ MySQL dump failed!"
  exit 1
fi

# Step 2: Critical volumes (tar.gz)
log "Archiving critical volumes..."

tar czf "$BACKUP_ROOT/daily/volumes_$DATE.tar.gz" \
  -C /opt/docker-apps \
  wordpress \
  n8n \
  sites \
  config/secrets/.env.production \
  2>/dev/null || true

SIZE=$(du -h "$BACKUP_ROOT/daily/volumes_$DATE.tar.gz" | cut -f1)
log "✅ Volumes archive: $SIZE"

# Step 3: Cleanup old backups (retention policy)
log "Applying retention policy..."

# Daily: 7 days
find "$BACKUP_ROOT/daily" -name "mysql_*.sql" -mtime +7 -delete
find "$BACKUP_ROOT/daily" -name "volumes_*.tar.gz" -mtime +7 -delete

# Archive to weekly/monthly if first of week/month
DAY_OF_WEEK=$(date +%A)
DAY_OF_MONTH=$(date +%d)

if [ "$DAY_OF_WEEK" = "Monday" ]; then
  cp "$BACKUP_ROOT/daily/mysql_$DATE.sql" "$BACKUP_ROOT/weekly/" 2>/dev/null || true
  cp "$BACKUP_ROOT/daily/volumes_$DATE.tar.gz" "$BACKUP_ROOT/weekly/" 2>/dev/null || true
  log "  Weekly backup archived"
fi

if [ "$DAY_OF_MONTH" = "01" ]; then
  cp "$BACKUP_ROOT/daily/mysql_$DATE.sql" "$BACKUP_ROOT/monthly/" 2>/dev/null || true
  cp "$BACKUP_ROOT/daily/volumes_$DATE.tar.gz" "$BACKUP_ROOT/monthly/" 2>/dev/null || true
  log "  Monthly backup archived"
fi

log "========== BACKUP COMPLETED =========="
log "Location: $BACKUP_ROOT/daily/"
