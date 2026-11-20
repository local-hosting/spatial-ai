#!/usr/bin/env bash
# Build vocab → local-ai → spatial-ai for the runtime OCI image (GHA only).
set -euo pipefail

spatial_root="${1:-/src/spatial-ai}"
if [[ -z "${YARN_NPM_AUTH_TOKEN:-}" ]]; then
  echo "build-runtime-stack: set YARN_NPM_AUTH_TOKEN" >&2
  exit 1
fi

export YARN_NPM_AUTH_TOKEN
export YARN_ENABLE_HARDENED_MODE=0

install_build_prod() {
  local dir="$1"
  (
    cd "${dir}"
    unset NODE_ENV
    export NODE_ENV=development
    export YARN_ENABLE_SCRIPTS=1
    yarn install
    yarn build
    export NODE_ENV=production
    yarn install
  )
}

install_build_prod "${spatial_root}/../vocab"
install_build_prod "${spatial_root}/../local-ai"
install_build_prod "${spatial_root}"

chmod +x "${spatial_root}/runtime/boot.sh" "${spatial_root}/runtime/start-gliner.sh" \
  "${spatial_root}/runtime/wait-gliner.sh"
chmod +x "${spatial_root}/../local-ai/runtime/boot.sh" "${spatial_root}/../local-ai/runtime/start-llama.sh" \
  "${spatial_root}/../local-ai/runtime/wait-llama.sh"

echo "build-runtime-stack OK"