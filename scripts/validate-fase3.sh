#!/bin/bash
###############################################################################
# validate-fase3.sh — Validate FASE 3 preparation before FASE 4 migration
###############################################################################

set -e

OK="✅"
ERR="❌"
WARN="⚠️"

echo "========== FASE 3 Validation =========="
echo ""

# Check new structure exists
echo "1. Checking new directory structure..."
checks=(
  "infrastructure/volumes/mysql"
  "infrastructure/volumes/wordpress"
  "infrastructure/volumes/n8n"
  "infrastructure/traefik"
  "infrastructure/config"
  "applications/escritorio"
  "data/sites"
  "data/backups/daily"
  "data/backups/weekly"
  "data/backups/monthly"
)

for dir in "${checks[@]}"; do
  if [ -d "$dir" ]; then
    echo "$OK $dir"
  else
    echo "$ERR $dir missing!"
    exit 1
  fi
done

echo ""
echo "2. Checking reference configs..."

# Traefik config exists
if [ -f "infrastructure/traefik/traefik.yml" ]; then
  echo "$OK traefik.yml exists"
else
  echo "$ERR traefik.yml missing!"
  exit 1
fi

# Docker compose reference
if [ -f "infrastructure/DOCKER-COMPOSE-REFACTORED.yml" ]; then
  echo "$OK DOCKER-COMPOSE-REFACTORED.yml exists"
else
  echo "$ERR DOCKER-COMPOSE-REFACTORED.yml missing!"
  exit 1
fi

# Migration mapping
if [ -f "infrastructure/MIGRATION-MAPPING.md" ]; then
  echo "$OK MIGRATION-MAPPING.md exists"
else
  echo "$ERR MIGRATION-MAPPING.md missing!"
  exit 1
fi

echo ""
echo "3. Checking old structure still intact (pre-migration)..."

# Verify original dirs still exist (not migrated yet)
old_checks=(
  "mysql"
  "wordpress"
  "n8n"
  "sites"
)

for dir in "${old_checks[@]}"; do
  if [ -d "$dir" ]; then
    echo "$OK $dir (original, not migrated yet)"
  else
    echo "$WARN $dir missing from root (may already be migrated)"
  fi
done

echo ""
echo "4. Validating docker-compose syntax..."

if docker compose config > /tmp/compose-check.yml 2>/dev/null; then
  echo "$OK docker-compose.yml is valid"
else
  echo "$ERR docker-compose.yml has errors!"
  docker compose config
  exit 1
fi

echo ""
echo "5. Checking .gitignore protection..."

if grep -q "infrastructure/config/secrets" .gitignore; then
  echo "$OK infrastructure/config/secrets protected"
else
  echo "$WARN Adding secrets to .gitignore"
  echo "infrastructure/config/secrets/" >> .gitignore
fi

if grep -q "infrastructure/traefik/acme.json" .gitignore; then
  echo "$OK acme.json protected"
else
  echo "$WARN Adding acme.json to .gitignore"
  echo "infrastructure/traefik/acme.json" >> .gitignore
fi

echo ""
echo "6. Size estimation for migration..."

old_size=$(du -sh mysql wordpress n8n sites 2>/dev/null | awk '{s+=$1} END {print s}' || echo "~10GB")
echo "$WARN Old data size (estimate): $old_size"
echo "   (Use this to estimate downtime during rsync)"

echo ""
echo "========== FASE 3 VALIDATION: PASSED =========="
echo ""
echo "✅ Ready for FASE 4 activation"
echo ""
echo "Next steps:"
echo "  1. Review infrastructure/MIGRATION-MAPPING.md"
echo "  2. Plan FASE 4 migration window"
echo "  3. Run: bash scripts/fase4-migrate.sh (when ready)"
echo ""
