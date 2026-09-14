#!/usr/bin/env bash
# Offline binary probes, NOT service acceptance. / Offline binary тестове, НЕ приемане на услуги.
set -euo pipefail
umask 077
cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.."
command -v docker >/dev/null
command -v timeout >/dev/null
[[ $(uname -m) == x86_64 ]] || { echo 'Requires x86_64 / Изисква x86_64'; exit 1; }
[[ $(docker info --format '{{.OSType}}') == linux ]] || exit 1
mkdir -p .local-staging
output=$(mktemp -d .local-staging/probes-XXXXXXXX)
active_container=''
cleanup() {
  if [[ -n "$active_container" ]]; then docker rm -f "$active_container" >/dev/null 2>&1 || true; fi
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
{
  uname -m
  systemd-detect-virt || true
  grep -m1 '^flags' /proc/cpuinfo || true
  docker version --format '{{.Server.Version}}'
} > "$output/guest.txt"
printf 'component\tprobe_exit_code\tservice_startup\n' > "$output/results.tsv"
failed=0
probe() {
  local component=$1 image=$2 binary=$3
  shift 3
  # Never pull or connect to a network here. / Без pull или мрежов достъп тук.
  if ! docker image inspect "$image" >/dev/null 2>&1; then
    printf '%s\tMISSING_IMAGE\tNOT_RUN\n' "$component" >> "$output/results.tsv"
    failed=1
    return
  fi
  [[ $(docker image inspect --format '{{.Os}}/{{.Architecture}}' "$image") == linux/amd64 ]] || exit 1
  active_container="gridex-probe-${component}-$$"
  local code=0
  timeout --signal=TERM --kill-after=10s 60s docker run --rm --pull never \
    --name "$active_container" --network none --no-healthcheck --read-only --cap-drop ALL \
    --security-opt no-new-privileges --pids-limit 128 --memory 512m --cpus 1 \
    --tmpfs /tmp:rw,nosuid,nodev,size=64m --entrypoint "$binary" "$image" "$@" \
    > "$output/$component.txt" 2>&1 || code=$?
  cleanup
  active_container=''
  printf '%s\t%s\tNOT_RUN\n' "$component" "$code" >> "$output/results.tsv"
  if [[ $code != 0 ]]; then failed=1; fi
}
probe manager openremote/manager@sha256:a23e9070f999349b76c4a744e4591a79265d74779ed76394b059720b3c57d386 java -version
probe keycloak openremote/keycloak@sha256:9e00390b412e875d78ee9145f5a0d53076936efcdbda131b0d33d3d89c40e2f0 java -version
probe openremote-db openremote/postgresql@sha256:37ecc2164eba78e89da8deea9cc700dec8e19bc71c9be84cb3131b4900e8e281 postgres --version
probe proxy openremote/proxy@sha256:e8f783346526be6448ffca01922b4b522998ee5c3330715e76f56b574d97ca3c haproxy -vv
probe gridex-db postgres@sha256:e19c5d72436d4d2f54d00c789775095d02a5dfb1c0f7ea5a243230b1bb46c2bb postgres --version
probe api-base node@sha256:76789712cd1ae89a1225eac9077010d68987a423588042dac30446f502f1858c node --version
cat "$output/results.tsv"
printf 'Local evidence / Локални резултати: %s\n' "$output"
exit "$failed"
