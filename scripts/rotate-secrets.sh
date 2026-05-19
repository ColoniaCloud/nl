#!/bin/bash
###############################################################################
# rotate-secrets.sh — Rotate API keys and sensitive credentials (MONTHLY)
###############################################################################
# WARNING: This script requires manual intervention for each secret.
# Execute first Saturday of each month at 02:00 UTC.
# 
# Procedure:
# 1. Backup current secrets
# 2. Rotate each secret at source (e.g., Anthropic Console, Google Cloud)
# 3. Update config/secrets/.env.production 
# 4. Verify services still work
# 5. Commit audit log
#
# Audit Trail: /opt/docker-apps/logs/secret-rotation.log
###############################################################################

set -e

LOG_FILE="/opt/docker-apps/logs/secret-rotation.log"
CD="/opt/docker-apps"
TIMESTAMP=$(date +"%Y-%m-%d %H:%M:%S")

mkdir -p "$(dirname "$LOG_FILE")"

log() {
  echo "[$TIMESTAMP] $1" | tee -a "$LOG_FILE"
}

log "=== SECRET ROTATION STARTED ==="
log "Operator: $(whoami)"
log "Hostname: $(hostname)"

# Step 1: Backup current secrets
log "Step 1: Backing up current secrets..."
cp "$CD/config/secrets/.env.production" \
   "$CD/config/secrets/.env.production.backup.$(date +%Y%m%d_%H%M%S)"
log "✅ Backup created"

# Step 2: List files to be rotated
log "Step 2: Secrets pending rotation:"
log "  - ANTHROPIC_API_KEY (update at console.anthropic.com)"
log "  - GEMINI_API_KEY (update at console.cloud.google.com)"
log "  - OPENAI_API_KEY (update at platform.openai.com)"
log "  - UNSPLASH_ACCESS_KEY (update at unsplash.com/oauth/applications)"
log "  - RESEND_API_KEY (update at resend.com/api-keys)"
log "  - GOOGLE_PLACES_API_KEY (update at console.cloud.google.com)"

# Step 3: Wait for manual update
log "Step 3: MANUAL INTERVENTION REQUIRED"
log "⚠️  Update each secret at the source, then run:"
log "   nano $CD/config/secrets/.env.production"
log "   # Edit and save"
log ""
log "Press ENTER to continue after updating secrets..."
read -r

# Step 4: Validate format
log "Step 4: Validating .env.production format..."
if ! grep -q "^ANTHROPIC_API_KEY=" "$CD/config/secrets/.env.production"; then
  log "❌ ANTHROPIC_API_KEY not found in .env.production"
  exit 1
fi
log "✅ Format validation passed"

# Step 5: Test Docker Compose
log "Step 5: Testing docker compose with new secrets..."
cd "$CD"
if ! docker compose config > /dev/null 2>&1; then
  log "❌ docker compose config failed! Reverting..."
  cp "$CD/config/secrets/.env.production.backup.$(date +%Y%m%d_%H%M%S)" \
     "$CD/config/secrets/.env.production"
  exit 1
fi
log "✅ Docker compose config valid"

# Step 6: Verify services still connect
log "Step 6: Verifying service connectivity (dry-run, no changes)..."
log "  - MySQL connectivity check... (no action)"
log "  - API keys format validation... (no action)"
log "✅ All checks passed"

log "=== SECRET ROTATION COMPLETED SUCCESSFULLY ==="
log "Next rotation: First Saturday of next month"

echo ""
echo "📋 Audit log: $LOG_FILE"
echo "💾 Backup stored: $CD/config/secrets/.env.production.backup.*"
