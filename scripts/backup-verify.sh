#!/bin/bash
###############################################################################
# backup-verify.sh — Verify last backup is restorable (WEEKLY)
###############################################################################
# Execute: 0 3 * * 1 /opt/docker-apps/scripts/backup-verify.sh
# Purpose: Restore latest MySQL dump in a test container, verify integrity
###############################################################################

set -e

BACKUP_DIR="/opt/docker-apps/data/backups"
LOG_FILE="/opt/docker-apps/logs/backup-verify.log"
DATE_HUMAN=$(date "+%Y-%m-%d %H:%M:%S")

mkdir -p "$(dirname "$LOG_FILE")"

log() {
  echo "[$DATE_HUMAN] $1" | tee -a "$LOG_FILE"
}

log "========== BACKUP VERIFICATION STARTED =========="

# Get latest MySQL dump
LATEST_SQL=$(ls -t "$BACKUP_DIR"/daily/mysql_*.sql 2>/dev/null | head -1)

if [ -z "$LATEST_SQL" ]; then
  log "❌ No MySQL backup found!"
  exit 1
fi

log "Testing restore of: $(basename "$LATEST_SQL")"
SIZE=$(du -h "$LATEST_SQL" | cut -f1)
log "Dump size: $SIZE"

# Create temporary test container
TEST_CONTAINER="mysql-verify-$$"
log "Creating test container: $TEST_CONTAINER"

docker run -d \
  --name "$TEST_CONTAINER" \
  -e MYSQL_ROOT_PASSWORD=test_verify \
  mysql:8.0 \
  > /dev/null

# Wait for MySQL to be ready
sleep 10

log "Restoring from dump..."
if docker exec "$TEST_CONTAINER" mysql -u root -ptest_verify < "$LATEST_SQL" > /dev/null 2>&1; then
  log "✅ Restore successful"
  
  # Verify: check database count
  DB_COUNT=$(docker exec "$TEST_CONTAINER" mysql -u root -ptest_verify -e "SHOW DATABASES;" 2>/dev/null | wc -l)
  log "✅ Databases restored: $((DB_COUNT - 4))"  # Exclude system DBs
  
  log "✅ BACKUP VERIFICATION PASSED"
else
  log "❌ Restore failed!"
  docker rm -f "$TEST_CONTAINER" 2>/dev/null || true
  exit 1
fi

# Cleanup
docker rm -f "$TEST_CONTAINER" 2>/dev/null || true

log "========== BACKUP VERIFICATION COMPLETED =========="
