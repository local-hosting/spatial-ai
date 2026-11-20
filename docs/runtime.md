# Runtime (mesh)

**spatial-ai** boots loopback **llama** via **`local-ai`** shell scripts, optionally **GLiNER**, then the **superset** HTTP gateway (`POST /generate`, `/compose`, `/spatial`, …).

## Layout (container)

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
| `SPATIAL_AI_BIND_HOST` | `127.0.0.1` | Use `0.0.0.0` when listening on all interfaces |
| `LOCAL_AI_*` | see local-ai | llama weights, upstream URLs |

Published runtime images use **`SPATIAL_AI_BIND_HOST=0.0.0.0`** and **`PORT=11434`** so **`POST /generate`** and **`POST /chat`** share one listener.

## Images

| Artifact | Registry |
|----------|----------|
| CI runtime | `ghcr.io/local-hosting/spatial-ai:<git-sha>` and `:main` (workflow **Build spatial-ai runtime image**; clones comms → frames → compose → vocab → local-ai, then `runtime/build-stack.sh`) |

Local build from this package root when siblings exist, or use `runtime/Dockerfile` (clones both repos):

```bash
docker build -f runtime/Dockerfile \
  --build-arg NODE_AUTH_TOKEN="$GITHUB_TOKEN" \
  -t spatial-ai .
```