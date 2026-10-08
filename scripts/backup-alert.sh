#!/bin/bash
###############################################################################
# backup-alert.sh — Alert if backup failed or issues detected
###############################################################################
# Execute: 0 6 * * * /opt/docker-apps/scripts/backup-alert.sh
# Purpose: Check daily que backup succeeded, send alert si hay problemas
###############################################################################

LOG_DIR="/opt/docker-apps/logs"
BACKUP_DIR="/opt/docker-apps/data/backups/daily"
ALERT_EMAIL="${ALERT_EMAIL:-comunicacion@colonia.cloud}"
TIMESTAMP=$(date "+%Y-%m-%d %H:%M:%S")

# Load RESEND_API_KEY (used instead of `mail`, which isn't installed on this host)
if [ -f /opt/docker-apps/.env ]; then
  RESEND_API_KEY=$(grep -m1 "^RESEND_API_KEY=" /opt/docker-apps/.env | cut -d= -f2-)
fi

send_alert() {
  local subject="$1"
  local body="$2"
  if [ -z "$RESEND_API_KEY" ]; then
    echo "⚠️  RESEND_API_KEY not found — cannot send email alert"
    return 1
  fi
  curl -s -o /dev/null -w "%{http_code}" -X POST "https://api.resend.com/emails" \
    -H "Authorization: Bearer $RESEND_API_KEY" \
    -H "Content-Type: application/json" \
    -d "$(printf '{"from":"NL360 <no-responder@nl360.site>","to":["%s"],"subject":"%s","html":"%s"}' \
      "$ALERT_EMAIL" "$subject" "${body//$'\n'/<br>}")" | grep -q "^2" || {
    echo "⚠️  Resend API call failed"
    return 1
  }
}

check_backup() {
  # Verify tar backup from today exists
  local today=$(date +%Y%m%d)
  local mysql_file=$(ls -t "$BACKUP_DIR"/mysql_${today}_*.sql 2>/dev/null | head -1)
  local volume_file=$(ls -t "$BACKUP_DIR"/volumes_${today}_*.tar.gz 2>/dev/null | head -1)
  
  local issues=""
  
  # Check MySQL backup
  if [ -z "$mysql_file" ]; then
    issues+="❌ MySQL backup MISSING for today\n"
  else
    local size=$(du -h "$mysql_file" | cut -f1)
    echo "✅ MySQL backup exists: $size"
  fi
  
  # Check volumes backup
  if [ -z "$volume_file" ]; then
    issues+="❌ Volumes backup MISSING for today\n"
  else
    local size=$(du -h "$volume_file" | cut -f1)
    echo "✅ Volumes backup exists: $size"
  fi
  
  # Check backup.log for errors
  if [ -f "$LOG_DIR/backup.log" ] && grep -q "ERROR\|FAILED" "$LOG_DIR/backup.log"; then
    issues+="⚠️  Errors found in backup.log\n"
  fi

  # If issues, send alert
  if [ -n "$issues" ]; then
    send_alert "🚨 NL360 Backup ALERT" "ALERT: Backup issues detected\n\n$issues"
    return 1
  fi
  
  return 0
}

check_s3_sync() {
  if [ ! -f "/opt/docker-apps/config/s3-backup.conf" ]; then
    return 0  # S3 not configured
  fi
  
  source /opt/docker-apps/config/s3-backup.conf
  
  if [ -f "$LOG_DIR/backup-s3-sync.log" ]; then
    if tail -20 "$LOG_DIR/backup-s3-sync.log" | grep -q "ERROR"; then
      echo "❌ S3 sync failed"
      return 1
    else
      echo "✅ S3 sync OK"
    fi
  fi
  return 0
}

check_disk_space() {
  # Check if backup dir is > 80% full
  local usage=$(df /opt/docker-apps | awk 'NR==2 {print $5}' | sed 's/%//')
  
  if [ "$usage" -gt 80 ]; then
    echo "⚠️  Disk usage: ${usage}% (FULL!)"
    return 1
  else
    echo "✅ Disk usage: ${usage}%"
    return 0
  fi
}

echo "=== BACKUP HEALTH CHECK ==="
echo ""

check_backup; backup_ok=$?
check_s3_sync; s3_ok=$?
check_disk_space; disk_ok=$?

echo ""
if [ "$backup_ok" -eq 0 ] && [ "$s3_ok" -eq 0 ] && [ "$disk_ok" -eq 0 ]; then
  echo "✅ ALL CHECKS PASSED"
  exit 0
else
  echo "❌ SOME CHECKS FAILED - sent alert to $ALERT_EMAIL"
  exit 1
fi
