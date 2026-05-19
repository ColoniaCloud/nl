#!/bin/sh
SUBDOMAIN="${1}"
if [ -z "$SUBDOMAIN" ]; then exit 1; fi

CONTAINER_NAME="lp-site-${SUBDOMAIN}"
IMAGE_NAME="lp-site-${SUBDOMAIN}"
SITE_DIR="/opt/docker-apps/sites-lander/${SUBDOMAIN}"

docker rm -f "${CONTAINER_NAME}" 2>/dev/null || true
docker rmi "${IMAGE_NAME}" 2>/dev/null || true
rm -rf "${SITE_DIR}" 2>/dev/null || true
echo "Cleaned up lander site ${SUBDOMAIN}"
