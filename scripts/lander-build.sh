#!/bin/sh
set -e

SUBDOMAIN="${1}"

if [ -z "$SUBDOMAIN" ]; then
  echo "ERROR: subdomain requerido" >&2
  exit 1
fi

if ! echo "$SUBDOMAIN" | grep -qE '^[a-z0-9-]{3,63}$'; then
  echo "ERROR: subdominio invalido" >&2
  exit 1
fi

SITE_DIR="/opt/docker-apps/sites-lander/${SUBDOMAIN}"
IMAGE_NAME="lp-site-${SUBDOMAIN}"
CONTAINER_NAME="lp-site-${SUBDOMAIN}"
LOG_FILE="${SITE_DIR}/build.log"

mkdir -p "${SITE_DIR}"

log() {
  TS="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  echo "[${TS}] [lander] $1" | tee -a "${LOG_FILE}"
}

run_logged() {
  STEP="$1"
  shift
  log "${STEP}"
  if "$@" >>"${LOG_FILE}" 2>&1; then
    log "OK: ${STEP}"
  else
    STATUS=$?
    log "ERROR (${STATUS}): ${STEP}"
    echo "[lander] Last 80 log lines from ${LOG_FILE}:" >&2
    tail -n 80 "${LOG_FILE}" >&2 || true
    exit ${STATUS}
  fi
}

log "Building lander site ${SUBDOMAIN}..."

if [ ! -f "${SITE_DIR}/index.html" ]; then
  log "ERROR: Requiere ${SITE_DIR}/index.html"
  exit 1
fi

if [ ! -f "${SITE_DIR}/nginx.conf" ]; then
  log "ERROR: Requiere ${SITE_DIR}/nginx.conf"
  exit 1
fi

# Stop and remove any existing container
if docker ps -a --filter "name=${CONTAINER_NAME}" --format "{{.Names}}" | grep -q "^${CONTAINER_NAME}$"; then
  log "Removing existing container ${CONTAINER_NAME}"
  docker rm -f "${CONTAINER_NAME}" >>"${LOG_FILE}" 2>&1 || true
fi

run_logged "docker run lite container ${CONTAINER_NAME}" docker run -d \
  --name "${CONTAINER_NAME}" \
  --restart unless-stopped \
  --network docker-apps_app-network \
  --label "traefik.enable=true" \
  --label "traefik.http.routers.${CONTAINER_NAME}.rule=Host(\`${SUBDOMAIN}.nl360.site\`)" \
  --label "traefik.http.routers.${CONTAINER_NAME}.entrypoints=websecure" \
  --label "traefik.http.routers.${CONTAINER_NAME}.tls.certresolver=myresolver" \
  --label "traefik.http.services.${CONTAINER_NAME}.loadbalancer.server.port=80" \
  --label "traefik.http.routers.${CONTAINER_NAME}.priority=20" \
  -v "${SITE_DIR}:/usr/share/nginx/html:ro" \
  -v "${SITE_DIR}/nginx.conf:/etc/nginx/conf.d/default.conf:ro" \
  nginx:1.27-alpine

log "Done. Site running at https://${SUBDOMAIN}.nl360.site"
docker ps --filter "name=${CONTAINER_NAME}" --format "{{.ID}}" | tee -a "${LOG_FILE}"
