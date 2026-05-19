#!/bin/sh
set -e

SUBDOMAIN="${1}"
MODE="${2:-next}"

if [ "${MODE}" != "next" ] && [ "${MODE}" != "lite" ]; then
  MODE="next"
fi

if [ -z "$SUBDOMAIN" ]; then
  echo "ERROR: subdomain requerido" >&2
  exit 1
fi

# Sanitize: solo a-z0-9-
if ! echo "$SUBDOMAIN" | grep -qE '^[a-z0-9-]{3,63}$'; then
  echo "ERROR: subdominio inválido" >&2
  exit 1
fi

SITE_DIR="/opt/docker-apps/sites/${SUBDOMAIN}"
IMAGE_NAME="site-${SUBDOMAIN}"
CONTAINER_NAME="site-${SUBDOMAIN}"
LOG_FILE="${SITE_DIR}/build.log"

mkdir -p "${SITE_DIR}"

log() {
  TS="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  echo "[${TS}] [manu-dev] $1" | tee -a "${LOG_FILE}"
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
    echo "[manu-dev] Last 80 log lines from ${LOG_FILE}:" >&2
    tail -n 80 "${LOG_FILE}" >&2 || true
    exit ${STATUS}
  fi
}

log "Building ${SUBDOMAIN}..."

if [ "${MODE}" = "next" ]; then
  run_logged "docker build image ${IMAGE_NAME}" docker build -t "${IMAGE_NAME}" "${SITE_DIR}"
else
  if [ ! -f "${SITE_DIR}/index.html" ]; then
    log "ERROR: Lite requiere ${SITE_DIR}/index.html"
    exit 1
  fi
  if [ ! -f "${SITE_DIR}/nginx.conf" ]; then
    log "ERROR: Lite requiere ${SITE_DIR}/nginx.conf"
    exit 1
  fi
fi

log "Stopping old container (if any)..."
docker stop "${CONTAINER_NAME}" >>"${LOG_FILE}" 2>&1 || true
docker rm "${CONTAINER_NAME}" >>"${LOG_FILE}" 2>&1 || true

if [ "${MODE}" = "next" ]; then
  run_logged "docker run container ${CONTAINER_NAME}" docker run -d \
    --name "${CONTAINER_NAME}" \
    --restart unless-stopped \
    --network docker-apps_app-network \
    --label "traefik.enable=true" \
    --label "traefik.http.routers.${SUBDOMAIN}.rule=Host(\`${SUBDOMAIN}.nl360.site\`)" \
    --label "traefik.http.routers.${SUBDOMAIN}.entrypoints=websecure" \
    --label "traefik.http.routers.${SUBDOMAIN}.tls.certresolver=myresolver" \
    --label "traefik.http.services.${SUBDOMAIN}.loadbalancer.server.port=3000" \
    --label "traefik.http.routers.${SUBDOMAIN}.priority=20" \
    "${IMAGE_NAME}"
else
  run_logged "docker run lite container ${CONTAINER_NAME}" docker run -d \
    --name "${CONTAINER_NAME}" \
    --restart unless-stopped \
    --network docker-apps_app-network \
    --label "traefik.enable=true" \
    --label "traefik.http.routers.${SUBDOMAIN}.rule=Host(\`${SUBDOMAIN}.nl360.site\`)" \
    --label "traefik.http.routers.${SUBDOMAIN}.entrypoints=websecure" \
    --label "traefik.http.routers.${SUBDOMAIN}.tls.certresolver=myresolver" \
    --label "traefik.http.services.${SUBDOMAIN}.loadbalancer.server.port=3000" \
    --label "traefik.http.routers.${SUBDOMAIN}.priority=20" \
    -v "${SITE_DIR}:/usr/share/nginx/html:ro" \
    -v "${SITE_DIR}/nginx.conf:/etc/nginx/conf.d/default.conf:ro" \
    nginx:1.27-alpine
fi

log "Done (${MODE}). Site running at https://${SUBDOMAIN}.nl360.site"
docker ps --filter "name=${CONTAINER_NAME}" --format "{{.ID}}" | tee -a "${LOG_FILE}"
