# Runtime (mesh)

**spatial-ai** boots loopback **llama** via **`local-ai`** shell scripts, optionally **GLiNER**, then the **superset** HTTP gateway (`POST /generate`, `/compose`, `/spatial`, …).

## Layout (Docker / Railway)

```text
/app/local-ai/runtime/start-llama.sh   ← weights + llama-server
/app/spatial-ai/runtime/boot.sh        ← orchestrates → node gateway
```

Set **`LOCAL_AI_RUNTIME_ROOT`** when local-ai is not at `../local-ai` or `/app/local-ai`.

## Commands

| Entry | Purpose |
|-------|---------|
| `runtime/boot.sh` | Production (llama → gateway) |
| `yarn start` | Dev gateway only (llama already up) |
| `yarn start:boot` | Same as `runtime/boot.sh` |

## Env (runtime)

| Variable | Default | Purpose |
|----------|---------|---------|
| `LOCAL_AI_START_LLAMA` | `1` | Skip sidecar start when `0` |
| `LOCAL_AI_RUNTIME_ROOT` | auto | Path to **local-ai** checkout |
| `SPATIAL_AI_START_GLINER` | `0` | `1` runs `services/gliner/app.py` from local-ai (needs Python venv) |
| `PORT` | `8092` / mesh `11434` | spatial-ai listen port |
| `SPATIAL_AI_BIND_HOST` | `127.0.0.1` | Use `0.0.0.0` on Railway |
| `LOCAL_AI_*` | see local-ai | llama weights, upstream URLs |

Mesh images use **`SPATIAL_AI_BIND_HOST=0.0.0.0`** and **`PORT=11434`** so tenants keep **`POST /generate`** while **`POST /chat`** is available on the same host.

## Reference image

Build from this package root when siblings exist, or use `runtime/Dockerfile` (clones both repos):

```bash
docker build -f runtime/Dockerfile \
  --build-arg NODE_AUTH_TOKEN="$GITHUB_TOKEN" \
  -t spatial-ai .
```