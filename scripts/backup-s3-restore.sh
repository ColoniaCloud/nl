#!/bin/bash
###############################################################################
# backup-s3-restore.sh — Restore backup from S3 (Emergency recovery)
###############################################################################
# Usage: bash /opt/docker-apps/scripts/backup-s3-restore.sh [date|latest]
# Example: bash /opt/docker-apps/scripts/backup-s3-restore.sh latest
#          bash /opt/docker-apps/scripts/backup-s3-restore.sh 20260414
#
# Purpose: Download backup de S3 local disk para restaurar
###############################################################################

set -e

# Load S3 config
if [ -f "/opt/docker-apps/config/s3-backup.conf" ]; then
  source /opt/docker-apps/config/s3-backup.conf
else
  echo "ERROR: /opt/docker-apps/config/s3-backup.conf not found"
  exit 1
fi

# Parameters
BACKUP_DATE="${1:-latest}"
BACKUP_DIR="/opt/docker-apps/data/backups/daily"
RESTORE_DIR="/tmp/s3-restore-$$"
LOG_FILE="/opt/docker-apps/logs/backup-s3-restore.log"
TIMESTAMP=$(date "+%Y-%m-%d %H:%M:%S")

log() {
  echo "[$TIMESTAMP] $1" | tee -a "$LOG_FILE"
}

log "========== S3 RESTORE STARTED =========="
log "Restore date: $BACKUP_DATE"
log "S3 bucket: $S3_BUCKET"

# ─── STEP 1: List available backups ──────────────────────────────────────
log "Step 1: Available backups on S3..."

aws s3 ls "s3://${S3_BUCKET}/backups/daily/" \
  --region "$AWS_REGION" \
  --recursive \
  | tail -5

# ─── STEP 2: Determine target backup ─────────────────────────────────────
if [ "$BACKUP_DATE" = "latest" ]; then
  log "Step 2: Finding latest backup..."
  LATEST_SQL=$(aws s3 ls "s3://${S3_BUCKET}/backups/daily/" \
    --region "$AWS_REGION" \
    --recursive \
    | grep "\.sql$" \
    | sort \
    | tail -1 \
    | awk '{print $NF}')
  
  if [ -z "$LATEST_SQL" ]; then
    log "ERROR: No backups found on S3"
    exit 1
  fi
  log "Latest backup: $LATEST_SQL"
else
  LATEST_SQL="backups/daily/mysql_${BACKUP_DATE}_*.sql"
fi

# ─── STEP 3: Download from S3 ───────────────────────────────────────────
log "Step 3: Downloading from S3..."

mkdir -p "$RESTORE_DIR"

wget_or_aws() {
  if command -v aws &>/dev/null; then
    aws s3 cp "s3://${S3_BUCKET}/${LATEST_SQL}" "$RESTORE_DIR/" \
      --region "$AWS_REGION"
  else
    echo "ERROR: AWS CLI required"
    exit 1
  fi
}

wget_or_aws

DOWNLOADED_FILE="$RESTORE_DIR/$(basename "$LATEST_SQL")"

if [ ! -f "$DOWNLOADED_FILE" ]; then
  log "ERROR: Download failed"
  rm -rf "$RESTORE_DIR"
  exit 1
fi

SIZE=$(du -h "$DOWNLOADED_FILE" | cut -f1)
log "✅ Downloaded: $SIZE"

# ─── STEP 4: Restore procedure ──────────────────────────────────────────
log "Step 4: RESTORE PROCEDURE"
log "To restore this backup:"
log ""
log "  1. Stop services:"
log "     cd /opt/docker-apps && docker compose down"
log ""
log "  2. Start MySQL:"
log "     docker compose up -d mysql && sleep 10"
log ""
log "  3. Restore database:"
log "     docker compose exec mysql mysql -u root -p'\$MYSQL_ROOT_PASSWORD' < $DOWNLOADED_FILE"
log ""
log "  4. Start full stack:"
log "     docker compose up -d"
log ""
log "File is ready at: $DOWNLOADED_FILE"
log "Expires in 24 hours"

# ─── STEP 5: Automatic cleanup timer ────────────────────────────────────
log "Step 5: Scheduling cleanup..."

# Delete after 24h (cleanup temp files)
at now + 24 hours <<< "rm -rf $RESTORE_DIR" 2>/dev/null || \
  log "WARNING: atd not available, manual cleanup in 24h needed"

log "========== S3 RESTORE DOWNLOADED =========="
log "Restore file: $DOWNLOADED_FILE"
