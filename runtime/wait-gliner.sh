#!/bin/sh
set -eu

port="${LOCAL_AI_GLINER_PORT:-8091}"
base="http://127.0.0.1:${port}"
max_wait="${LOCAL_AI_GLINER_WAIT_SEC:-600}"
interval="${LOCAL_AI_GLINER_WAIT_INTERVAL_SEC:-2}"
elapsed=0

echo "spatial-ai: waiting for GLiNER on :${port} (max ${max_wait}s)"
while [ "$elapsed" -lt "$max_wait" ]; do
  if curl -fsS "${base}/health" >/dev/null 2>&1; then
    echo "spatial-ai: GLiNER ready"
    exit 0
  fi
  sleep "$interval"
  elapsed=$((elapsed + interval))
done

echo "spatial-ai: GLiNER did not become healthy within ${max_wait}s" >&2
exit 1