#!/usr/bin/env bash
# Build comms → … → spatial-ai using workspace tooling (mirrors spatial-ai ci / build-image workflow).
# Optional local/dev helper — not used inside Dockerfile.ghci.
set -euo pipefail

ws_root="${1:-}"
if [[ -z "${ws_root}" ]]; then
  script_dir="$(CDPATH= cd -- "$(dirname "$0")" && pwd)"
  ws_root="$(CDPATH= cd -- "${script_dir}/../.." && pwd)"
fi

for dir in comms frames compose vocab local-ai spatial-ai; do
  if [[ ! -d "${ws_root}/${dir}" ]]; then
    echo "build-stack: missing ${ws_root}/${dir} (use workspace root with sibling clones)" >&2
    exit 1
  fi
done

if [[ -z "${YARN_NPM_AUTH_TOKEN:-}" ]]; then
  echo "build-stack: set YARN_NPM_AUTH_TOKEN for @local-hosting/* on GitHub Packages" >&2
  exit 1
fi

export YARN_NPM_AUTH_TOKEN

(
  cd "${ws_root}"
  corepack enable 2>/dev/null || true
  corepack prepare yarn@4.18.1 --activate 2>/dev/null || true
  yarn install --immutable
  yarn bootstrap:stack
  yarn workspace @local-hosting/local-ai build
  yarn workspace @local-hosting/spatial-ai build
)

chmod +x "${ws_root}/spatial-ai/runtime/boot.sh" \
  "${ws_root}/spatial-ai/runtime/start-gliner.sh" \
  "${ws_root}/spatial-ai/runtime/wait-gliner.sh"
chmod +x "${ws_root}/local-ai/runtime/boot.sh" \
  "${ws_root}/local-ai/runtime/start-llama.sh" \
  "${ws_root}/local-ai/runtime/wait-llama.sh"

echo "build-stack OK (ws=${ws_root})"