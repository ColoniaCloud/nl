#!/bin/sh
# Limpia contenedor e imagen de un sitio fallido

SUBDOMAIN="${1}"

if [ -z "$SUBDOMAIN" ]; then
  echo "ERROR: subdomain requerido" >&2
  exit 1
fi

CONTAINER_NAME="site-${SUBDOMAIN}"
IMAGE_NAME="site-${SUBDOMAIN}"
SITE_DIR="/opt/docker-apps/sites/${SUBDOMAIN}"

echo "[manu-dev-cleanup] Cleaning ${SUBDOMAIN}..."

docker stop "${CONTAINER_NAME}" 2>/dev/null || true
docker rm "${CONTAINER_NAME}" 2>/dev/null || true
docker rmi "${IMAGE_NAME}" 2>/dev/null || true

echo "[manu-dev-cleanup] Done."
