#!/usr/bin/env bash
# Smoke POST /chat (pack_mode daily; rules-only path when llama/GLiNER are down).
set -euo pipefail

base_url="${SPATIAL_AI_BENCHMARK_BASE_URL:-${LLM_BASE_URL:-http://127.0.0.1:11434}}"
base_url="${base_url%/}"
text="${SPATIAL_AI_BENCHMARK_TEXT:-where can I go that is safe?}"
lang="${SPATIAL_AI_BENCHMARK_LANG:-en}"
api_key="${SPATIAL_AI_BENCHMARK_API_KEY:-${LOCAL_AI_API_KEY:-${LLM_API_KEY:-}}}"

payload="$(python3 - "$text" "$lang" <<'PY'
import json
import sys

text, lang = sys.argv[1:3]
print(
    json.dumps(
        {
            "text": text,
            "lang": lang,
            "pack_mode": "daily",
            "compose": {"rules_only": True},
        }
    )
)
PY
)"

if [ -n "$api_key" ]; then
  curl -fsS -H "Authorization: Bearer ${api_key}" \
    -H 'Content-Type: application/json' \
    -d "$payload" \
    "${base_url}/chat"
else
  curl -fsS -H 'Content-Type: application/json' \
    -d "$payload" \
    "${base_url}/chat"
fi
echo