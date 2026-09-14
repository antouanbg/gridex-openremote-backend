#!/usr/bin/env bash
# Automatic staging bootstrap; no devices. / Автоматична staging подготовка; без устройства.
set -Eeuo pipefail
umask 077
mkdir -p /var/lib/gridex-bootstrap /opt/gridex/.local-staging
status=/var/lib/gridex-bootstrap/status
trap 'printf "FAILED at line %s; inspect journalctl -u gridex-bootstrap\n" "$LINENO" > "$status"' ERR
echo INSTALLING_DOCKER > "$status"
export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y --no-install-recommends ca-certificates curl gnupg
install -m 0755 -d /etc/apt/keyrings
curl --fail --location --retry 3 https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
gpg --batch --show-keys --with-colons /etc/apt/keyrings/docker.asc | grep -q '9DC858229FC7DD38854AE2D88D81803C0EBFCD88'
chmod 0644 /etc/apt/keyrings/docker.asc
echo 'deb [arch=amd64 signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu noble stable' > /etc/apt/sources.list.d/docker.list
apt-get update
apt-get install -y --no-install-recommends \
 'docker-ce=5:29.8.0-1~ubuntu.24.04~noble' \
 'docker-ce-cli=5:29.8.0-1~ubuntu.24.04~noble' \
 'containerd.io=2.3.5-1~ubuntu.24.04~noble' \
 'docker-buildx-plugin=0.37.1-1~ubuntu.24.04~noble' \
 'docker-compose-plugin=5.5.1-1~ubuntu.24.04~noble'
systemctl enable --now docker
dpkg-query -W docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin > /var/lib/gridex-bootstrap/docker-versions.txt
echo PULLING_ORIGINAL_IMAGES > "$status"
while read -r image; do docker pull --platform linux/amd64 "$image"; done < /opt/gridex/images.txt
echo TESTING_ORIGINAL_IMAGES > "$status"
if bash /opt/gridex/scripts/staging/probe-original-images.sh; then
 echo 'BINARY_PROBES_PASS; full six-service startup NOT_RUN; OIDC/migrations pending' > "$status"
else
 echo 'BINARY_PROBE_FAILED; original images retained; inspect local probe logs; full service startup NOT_RUN' > "$status"
fi
