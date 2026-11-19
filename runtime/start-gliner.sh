#!/bin/sh
set -eu

ROOT="$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"
LOCAL_AI_ROOT="${LOCAL_AI_RUNTIME_ROOT:-$ROOT/../local-ai}"
APP="$LOCAL_AI_ROOT/services/gliner/app.py"
VENV="$LOCAL_AI_ROOT/services/gliner/.venv"

if [ ! -f "$APP" ]; then
  echo "spatial-ai: GLiNER app missing at ${APP} — skip or fix LOCAL_AI_RUNTIME_ROOT" >&2
  exit 1
fi

if [ ! -d "$VENV" ]; then
  echo "spatial-ai: GLiNER venv missing — run local-ai scripts/mac_setup.sh or pi_setup.sh" >&2
  exit 1
fi

# shellcheck disable=SC1091
. "$VENV/bin/activate"
export LOCAL_AI_GLINER_PORT="${LOCAL_AI_GLINER_PORT:-8091}"
echo "spatial-ai: starting GLiNER on :${LOCAL_AI_GLINER_PORT}"
exec python3 "$APP"