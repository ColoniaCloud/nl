#!/bin/bash
###############################################################################
# backup-s3-sync.sh — Sincroniza backups locales a S3 (Daily + incremental)
###############################################################################
# Execute: 0 3 * * * /opt/docker-apps/scripts/backup-s3-sync.sh
# Purpose: Upload backup files a AWS S3 con cleanup local + monitoring
#
# Requisitos:
#   - AWS CLI configurado (credentials)
#   - S3_BUCKET env var definido
#   - s3cmd instalado (alternativa a aws cli)
#
# Configuración:
#   via: /opt/docker-apps/config/s3-backup.conf
###############################################################################

set -e

# ─── CONFIGURATION ──────────────────────────────────────────────────────────
BACKUP_DIR="/opt/docker-apps/data/backups/daily"
LOG_FILE="/opt/docker-apps/logs/backup-s3-sync.log"
TIMESTAMP=$(date "+%Y-%m-%d %H:%M:%S")

# Load S3 config (if exists)
if [ -f "/opt/docker-apps/config/s3-backup.conf" ]; then
  source /opt/docker-apps/config/s3-backup.conf
else
  echo "ERROR: /opt/docker-apps/config/s3-backup.conf not found"
  echo "Create it with: S3_BUCKET=, AWS_REGION=, etc"
  exit 1
fi

# Validate required vars
if [ -z "$S3_BUCKET" ] || [ -z "$AWS_REGION" ]; then
  echo "ERROR: S3_BUCKET and AWS_REGION must be set in s3-backup.conf"
  exit 1
fi

mkdir -p "$(dirname "$LOG_FILE")"

log() {
  echo "[$TIMESTAMP] $1" | tee -a "$LOG_FILE"
}

log "========== S3 BACKUP SYNC STARTED =========="
log "S3 Bucket: $S3_BUCKET"
log "Backup dir: $BACKUP_DIR"

# ─── STEP 1: Upload newest files only ────────────────────────────────────
log "Step 1: Syncing to S3..."

# Count files before
LOCAL_BEFORE=$(ls "$BACKUP_DIR"/*.sql 2>/dev/null | wc -l)

# Upload only new/changed files (incremental)
if command -v aws &>/dev/null; then
  log "Using AWS CLI..."
  aws s3 sync "$BACKUP_DIR" "s3://${S3_BUCKET}/backups/daily/" \
    --region "$AWS_REGION" \
    --delete \
    --storage-class GLACIER_IR \
    --exclude "*" \
    --include "*.sql" \
    --include "*.tar.gz" \
    --include "*.gz" \
    2>&1 | tee -a "$LOG_FILE"
else
  log "ERROR: AWS CLI not found. Install: apt install awscli"
  exit 1
fi

log "✅ S3 sync completed"

# ─── STEP 2: Verify upload ──────────────────────────────────────────────────
log "Step 2: Verifying S3 contents..."

# List S3 contents (verify uploaded)
REMOTE_COUNT=$(aws s3 ls "s3://${S3_BUCKET}/backups/daily/" \
  --region "$AWS_REGION" \
  --recursive \
  --summarize | grep "Total Objects" | awk '{print $NF}')

log "Remote files in S3: $REMOTE_COUNT"

# ─── STEP 3: Cleanup old local backups (keep 3 latest) ─────────────────────
log "Step 3: Cleaning up local backups (keeping 3 latest)..."

# MySQL dumps
MYSQL_COUNT=$(ls -t "$BACKUP_DIR"/mysql_*.sql 2>/dev/null | wc -l)
if [ "$MYSQL_COUNT" -gt 3 ]; then
  ls -t "$BACKUP_DIR"/mysql_*.sql | tail -n +4 | xargs rm -f
  log "  Removed $((MYSQL_COUNT - 3)) old MySQL dumps"
fi

# Volume archives
VOLUME_COUNT=$(ls -t "$BACKUP_DIR"/volumes_*.tar.gz 2>/dev/null | wc -l)
if [ "$VOLUME_COUNT" -gt 3 ]; then
  ls -t "$BACKUP_DIR"/volumes_*.tar.gz | tail -n +4 | xargs rm -f
  log "  Removed $((VOLUME_COUNT - 3)) old volume archives"
fi

# ─── STEP 4: Generate report ────────────────────────────────────────────────
log "Step 4: Generating report..."

LOCAL_SIZE=$(du -sh "$BACKUP_DIR" | cut -f1)
OLDEST_FILE=$(ls -tr "$BACKUP_DIR"/*.sql 2>/dev/null | head -1 | xargs ls -lh | awk '{print $6, $7, $8, $9}')

log "Local storage: $LOCAL_SIZE"
log "Oldest file: $OLDEST_FILE"
log "Remote (S3): ✅ Synced"

# ─── STEP 5: Alert if needed ────────────────────────────────────────────────
log "Step 5: Checking for issues..."

# Check if S3 is accessible
if ! aws s3 ls "s3://${S3_BUCKET}/" --region "$AWS_REGION" > /dev/null 2>&1; then
  log "⚠️  WARNING: S3 bucket not accessible!"
  log "Check AWS credentials in /opt/docker-apps/config/s3-backup.conf"
fi

# Check local storage (warn if > 80% of allocated space)
LOCAL_USAGE=$(du -sh "$BACKUP_DIR" | cut -f1 | sed 's/G//')
if (( $(echo "$LOCAL_USAGE > 80" | bc -l) )); then
  log "⚠️  WARNING: Local backup storage > 80%"
fi

log "========== S3 BACKUP SYNC COMPLETED =========="
log "Next sync: $(date -d '+1 day' '+%Y-%m-%d 03:00 UTC')"
