#!/bin/sh
set -eu

ROOT="$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"
LOCAL_AI_ROOT="${LOCAL_AI_RUNTIME_ROOT:-}"
if [ -z "$LOCAL_AI_ROOT" ]; then
  if [ -d "$ROOT/../local-ai/runtime" ]; then
    LOCAL_AI_ROOT="$(CDPATH= cd -- "$ROOT/../local-ai" && pwd)"
  elif [ -d "$ROOT/vendor/local-ai/runtime" ]; then
    LOCAL_AI_ROOT="$ROOT/vendor/local-ai"
  elif [ -d "/app/local-ai/runtime" ]; then
    LOCAL_AI_ROOT="/app/local-ai"
  else
    echo "spatial-ai: set LOCAL_AI_RUNTIME_ROOT to local-ai checkout (needs runtime/start-llama.sh)" >&2
    exit 1
  fi
fi

export LOCAL_AI_RUNTIME_ROOT="$LOCAL_AI_ROOT"

llama_pid=""
gliner_pid=""

cleanup() {
  if [ -n "$llama_pid" ]; then kill "$llama_pid" 2>/dev/null || true; fi
  if [ -n "$gliner_pid" ]; then kill "$gliner_pid" 2>/dev/null || true; fi
}
trap cleanup EXIT INT TERM

START_LLAMA="${LOCAL_AI_START_LLAMA:-1}"
if [ "$START_LLAMA" = "1" ]; then
  /bin/sh "$LOCAL_AI_ROOT/runtime/start-llama.sh" &
  llama_pid=$!
  /bin/sh "$LOCAL_AI_ROOT/runtime/wait-llama.sh"
fi

START_GLINER="${SPATIAL_AI_START_GLINER:-0}"
if [ "$START_GLINER" = "1" ]; then
  if [ -f "$ROOT/runtime/start-gliner.sh" ]; then
    /bin/sh "$ROOT/runtime/start-gliner.sh" &
    gliner_pid=$!
    /bin/sh "$ROOT/runtime/wait-gliner.sh"
  else
    echo "spatial-ai: SPATIAL_AI_START_GLINER=1 but start-gliner.sh missing" >&2
  fi
fi

export LOCAL_AI_BOOT_MODE="${LOCAL_AI_BOOT_MODE:-full}"
export SPATIAL_AI_BOOT_MODE="${SPATIAL_AI_BOOT_MODE:-${LOCAL_AI_BOOT_MODE}}"

if [ -z "${SPATIAL_AI_VERSION:-}" ] && [ -f "$ROOT/package.json" ]; then
  SPATIAL_AI_VERSION="$(node --input-type=module -e "import fs from 'node:fs'; process.stdout.write(JSON.parse(fs.readFileSync('${ROOT}/package.json','utf8')).version)")"
fi
export SPATIAL_AI_VERSION="${SPATIAL_AI_VERSION:-0.0.0}"

if [ -z "${LOCAL_AI_VERSION:-}" ] && [ -f "$LOCAL_AI_ROOT/package.json" ]; then
  LOCAL_AI_VERSION="$(node --input-type=module -e "import fs from 'node:fs'; process.stdout.write(JSON.parse(fs.readFileSync('${LOCAL_AI_ROOT}/package.json','utf8')).version)")"
fi
export LOCAL_AI_VERSION="${LOCAL_AI_VERSION:-0.0.0}"

if [ -f "$ROOT/dist/src/api/start-server.js" ]; then
  exec node "$ROOT/dist/src/api/start-server.js"
fi

exec node --import tsx "$ROOT/src/api/start-server.ts"