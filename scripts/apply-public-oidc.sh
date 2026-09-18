#!/usr/bin/env bash
# Run only on the Mac hosting the Colima GrideX staging stack.
# The Keycloak password is read from the terminal and never stored or printed.
set -euo pipefail

repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
backup_dir="${HOME}/GrideX-runtime/private-backups"
timestamp="$(date +%Y%m%d%H%M%S)"

if [[ ! -t 0 ]]; then
  echo "Run this command from an interactive terminal." >&2
  exit 2
fi

read -r -s -p "Keycloak master-admin password: " GRIDEX_KEYCLOAK_ADMIN_PASSWORD
echo
trap 'unset GRIDEX_KEYCLOAK_ADMIN_PASSWORD payload' EXIT

payload="$({
  export GRIDEX_KEYCLOAK_ADMIN_PASSWORD
  node -e 'process.stdout.write(JSON.stringify({adminPassword: process.env.GRIDEX_KEYCLOAK_ADMIN_PASSWORD, authBaseUrl: "https://auth.gridex.tech/auth", portalOrigin: "https://gridex.tech", apply: true}))'
})"
mkdir -p "$backup_dir"
umask 077

printf '%s' "$payload" | docker --context colima-gridex run --rm -i \
  --network gridex-mac_backend \
  --mount "type=bind,src=${repo_dir}/scripts/configure-public-realm.mjs,dst=/opt/gridex/configure-public-realm.mjs,readonly" \
  node:22-alpine@sha256:c610fcdfb1d5b4740dd70c284ed3cb16bb857e0f7166196e36a5501df7a3aa32 \
  node /opt/gridex/configure-public-realm.mjs \
  > "${backup_dir}/keycloak-public-oidc-${timestamp}.json"

echo "Public OIDC callback configuration applied. Private rollback snapshot: ${backup_dir}/keycloak-public-oidc-${timestamp}.json"
