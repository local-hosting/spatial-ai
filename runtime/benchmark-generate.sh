#!/usr/bin/env bash
# Benchmark spatial-ai POST /generate.
set -euo pipefail

base_url="${LOCAL_AI_BENCHMARK_BASE_URL:-${LLM_BASE_URL:-http://127.0.0.1:11434}}"
base_url="${base_url%/}"
model="${LOCAL_AI_BENCHMARK_MODEL:-${LOCAL_AI_MODEL_ALIAS:-${LLM_MODEL:-qwen2.5-7b}}}"
max_tokens="${LOCAL_AI_BENCHMARK_MAX_TOKENS:-32}"
prompt="${LOCAL_AI_BENCHMARK_PROMPT:-Say hi in three words.}"
runs=1
warmup=0
json_out=0
curl_max_time="${LOCAL_AI_BENCHMARK_CURL_MAX_TIME:-900}"

usage() {
  cat <<'EOF'
Usage: benchmark-generate.sh [options]

Options:
  --base-url URL     Server base (default: LOCAL_AI_BENCHMARK_BASE_URL, LLM_BASE_URL, or http://127.0.0.1:11434)
  --model NAME       Model alias (default: LOCAL_AI_MODEL_ALIAS / LLM_MODEL / qwen2.5-7b)
  --max-tokens N     max_tokens per request (default: 32)
  --prompt TEXT      User message (default: short greeting)
  --runs N           Measured runs after warmup (default: 1)
  --warmup N         Warmup requests not recorded (default: 0)
  --json             Print one JSON object per run
  -h, --help         This help

Auth: LOCAL_AI_API_KEY, LLM_API_KEY, or LOCAL_AI_BENCHMARK_API_KEY (Bearer) when required.

Examples:
  benchmark-generate.sh
  LLM_API_KEY=... benchmark-generate.sh --runs 3 --warmup 1
  docker exec <container> /app/ws/spatial-ai/runtime/benchmark-generate.sh
EOF
}

while [ $# -gt 0 ]; do
  case "$1" in
    --base-url)
      base_url="${2%/}"
      shift 2
      ;;
    --model)
      model="$2"
      shift 2
      ;;
    --max-tokens)
      max_tokens="$2"
      shift 2
      ;;
    --prompt)
      prompt="$2"
      shift 2
      ;;
    --runs)
      runs="$2"
      shift 2
      ;;
    --warmup)
      warmup="$2"
      shift 2
      ;;
    --json)
      json_out=1
      shift
      ;;
    -h | --help)
      usage
      exit 0
      ;;
    *)
      echo "benchmark-generate: unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

api_key="${LOCAL_AI_BENCHMARK_API_KEY:-${LOCAL_AI_API_KEY:-${LLM_API_KEY:-}}}"

if ! command -v curl >/dev/null 2>&1; then
  echo "benchmark-generate: curl is required" >&2
  exit 1
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo "benchmark-generate: python3 is required" >&2
  exit 1
fi

health_code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 30 "${base_url}/health" || true)"
if [ "$health_code" != "200" ]; then
  echo "benchmark-generate: health check failed (HTTP ${health_code}) at ${base_url}/health" >&2
  exit 1
fi

request_body="$(python3 - "$model" "$max_tokens" "$prompt" <<'PY'
import json
import sys

model, max_tokens, prompt = sys.argv[1:4]
print(json.dumps({"model": model, "user": prompt, "max_tokens": int(max_tokens)}))
PY
)"

run_once() {
  local label="$1"
  local body_file time_file http_code wall_s
  body_file="$(mktemp)"
  time_file="$(mktemp)"
  trap 'rm -f "$body_file" "$time_file"' RETURN

  if [ -n "$api_key" ]; then
    http_code="$(
      curl -sS --max-time "$curl_max_time" \
        -H "Authorization: Bearer ${api_key}" \
        -H "Content-Type: application/json" \
        -o "$body_file" \
        -w '%{http_code} %{time_total}' \
        -X POST "${base_url}/generate" \
        -d "$request_body" | tee "$time_file" | awk '{print $1}'
    )"
  else
    http_code="$(
      curl -sS --max-time "$curl_max_time" \
        -H "Content-Type: application/json" \
        -o "$body_file" \
        -w '%{http_code} %{time_total}' \
        -X POST "${base_url}/generate" \
        -d "$request_body" | tee "$time_file" | awk '{print $1}'
    )"
  fi

  read -r _ wall_s <"$time_file" || wall_s=""

  if [ "$http_code" != "200" ]; then
    echo "benchmark-generate: ${label} HTTP ${http_code}" >&2
    head -c 500 "$body_file" >&2 || true
    echo >&2
    return 1
  fi

  python3 - "$label" "$wall_s" "$body_file" "$json_out" <<'PY'
import json
import sys

label, wall_s, path, json_out = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
with open(path, encoding="utf-8") as f:
    body = json.load(f)

record = {
    "label": label,
    "model": body.get("model"),
    "provider": body.get("provider"),
    "wall_s": float(wall_s) if wall_s else None,
    "text_preview": (body.get("text") or "")[:160],
}

if json_out == "1":
    print(json.dumps(record))
else:
    wall = record["wall_s"]
    print(f"=== {label} ===")
    print(f"model:    {record['model']}")
    print(f"provider: {record['provider']}")
    print(f"wall:     {wall:.3f}s" if wall is not None else "wall:     —")
    print(f"reply:    {record['text_preview']!r}")
    print()
PY
}

if [ "$json_out" -eq 0 ]; then
  echo "spatial-ai POST /generate"
  echo "  base_url:    ${base_url}"
  echo "  model:       ${model}"
  echo "  max_tokens:  ${max_tokens}"
  echo "  warmup:      ${warmup}"
  echo "  runs:        ${runs}"
  echo
fi

i=0
while [ "$i" -lt "$warmup" ]; do
  run_once "warmup-$((i + 1))" >/dev/null
  i=$((i + 1))
done

i=0
while [ "$i" -lt "$runs" ]; do
  run_once "run-$((i + 1))"
  i=$((i + 1))
done