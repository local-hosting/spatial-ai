#!/usr/bin/env bash
# Build comms → frames → compose → vocab → local-ai → spatial-ai (GHA / Dockerfile.ghci).
set -euo pipefail

spatial_root="${1:-/src/spatial-ai}"
stack_root="$(cd "${spatial_root}/.." && pwd)"

if [[ -z "${YARN_NPM_AUTH_TOKEN:-}" ]]; then
  echo "build-runtime-stack: set YARN_NPM_AUTH_TOKEN" >&2
  exit 1
fi

for repo in comms frames compose vocab local-ai spatial-ai; do
  if [[ ! -d "${stack_root}/${repo}" ]]; then
    echo "build-runtime-stack: missing ${stack_root}/${repo}" >&2
    exit 1
  fi
done

export YARN_NPM_AUTH_TOKEN
export YARN_ENABLE_HARDENED_MODE=0

pin_portal_dependency() {
  local pkg_json="$1"
  local dep="$2"
  local rel="$3"
  node - "$pkg_json" "$dep" "$rel" <<'NODE'
const fs = require('node:fs');
const [file, dep, rel] = process.argv.slice(2);
const pkg = JSON.parse(fs.readFileSync(file, 'utf8'));
for (const section of ['dependencies', 'devDependencies', 'peerDependencies']) {
  if (pkg[section]?.[dep]) {
    pkg[section][dep] = `portal:${rel}`;
  }
}
fs.writeFileSync(file, JSON.stringify(pkg, null, 2) + '\n');
NODE
}

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

build_frames_from_siblings() {
  local root="$1"
  pin_portal_dependency "${root}/frames/package.json" "@local-hosting/comms" "../comms"
  (
    cd "${root}/frames"
    unset NODE_ENV
    export NODE_ENV=development
    export YARN_ENABLE_SCRIPTS=1
    yarn install
  )
  (
    cd "${root}/comms"
    yarn build
  )
  (
    cd "${root}/frames"
    yarn exec tsc -p tsconfig.build.json
    export NODE_ENV=production
    yarn install
  )
}

install_build_prod "${stack_root}/comms"
build_frames_from_siblings "${stack_root}"

pin_portal_dependency "${stack_root}/compose/package.json" "@local-hosting/comms" "../comms"
pin_portal_dependency "${stack_root}/compose/package.json" "@local-hosting/frames" "../frames"
install_build_prod "${stack_root}/compose"

pin_portal_dependency "${stack_root}/vocab/package.json" "@local-hosting/compose" "../compose"
install_build_prod "${stack_root}/vocab"

pin_portal_dependency "${stack_root}/local-ai/package.json" "@local-hosting/compose" "../compose"
pin_portal_dependency "${stack_root}/local-ai/package.json" "@local-hosting/vocab" "../vocab"
install_build_prod "${stack_root}/local-ai"

pin_portal_dependency "${spatial_root}/package.json" "@local-hosting/compose" "../compose"
pin_portal_dependency "${spatial_root}/package.json" "@local-hosting/vocab" "../vocab"
pin_portal_dependency "${spatial_root}/package.json" "@local-hosting/local-ai" "../local-ai"
install_build_prod "${spatial_root}"

chmod +x "${spatial_root}/runtime/boot.sh" "${spatial_root}/runtime/start-gliner.sh" \
  "${spatial_root}/runtime/wait-gliner.sh"
chmod +x "${stack_root}/local-ai/runtime/boot.sh" "${stack_root}/local-ai/runtime/start-llama.sh" \
  "${stack_root}/local-ai/runtime/wait-llama.sh"

echo "build-runtime-stack OK"