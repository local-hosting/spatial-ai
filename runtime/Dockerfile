# Reference image: llama-server + spatial-ai (local-ai superset gateway).
# Build context: spatial-ai repo root with local-ai sibling at ../local-ai
# or vendor copy. Requires YARN_NPM_AUTH_TOKEN for @local-hosting/*.

FROM node:22-bookworm-slim AS build
WORKDIR /build
ARG LOCAL_AI_GIT_REF=main
ARG LOCAL_AI_GIT_URL=https://github.com/local-hosting/local-ai.git
ARG SPATIAL_AI_GIT_REF=main
ARG SPATIAL_AI_GIT_URL=https://github.com/local-hosting/spatial-ai.git
ARG NODE_AUTH_TOKEN
ENV YARN_NPM_AUTH_TOKEN=${NODE_AUTH_TOKEN}
RUN apt-get update \
  && apt-get install -y --no-install-recommends git ca-certificates \
  && rm -rf /var/lib/apt/lists/*
RUN git clone --depth 1 --branch "${LOCAL_AI_GIT_REF}" "${LOCAL_AI_GIT_URL}" local-ai \
  && git clone --depth 1 --branch "${SPATIAL_AI_GIT_REF}" "${SPATIAL_AI_GIT_URL}" spatial-ai
WORKDIR /build/spatial-ai
RUN corepack enable && corepack prepare yarn@4.18.1 --activate \
  && yarn install \
  && yarn build \
  && chmod +x runtime/boot.sh runtime/start-gliner.sh runtime/wait-gliner.sh
RUN chmod +x /build/local-ai/runtime/boot.sh /build/local-ai/runtime/start-llama.sh \
  /build/local-ai/runtime/wait-llama.sh

FROM ghcr.io/ggml-org/llama.cpp:server

RUN apt-get update \
  && apt-get install -y --no-install-recommends curl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY --from=node:22-bookworm-slim /usr/local/bin/node /usr/local/bin/node
COPY --from=build /build/local-ai /app/local-ai
COPY --from=build /build/spatial-ai /app/spatial-ai

ENV LOCAL_AI_RUNTIME_ROOT=/app/local-ai
ENV LOCAL_AI_BIND_HOST=0.0.0.0
ENV SPATIAL_AI_BIND_HOST=0.0.0.0
ENV LOCAL_AI_LLAMA_PORT=11435
ENV LOCAL_AI_BOOT_MODE=full
ENV PORT=11434
ENV LOCAL_AI_GGUF_PATH=/models/model.gguf
ENV LOCAL_AI_MODEL_ALIAS=qwen2.5-7b
ENV LOCAL_AI_CTX_SIZE=8192
ENV LOCAL_AI_N_PARALLEL=1
ENV LOCAL_AI_WEIGHTS_MODE=mmap
ENV SPATIAL_AI_START_GLINER=0

WORKDIR /app/spatial-ai
EXPOSE 11434

HEALTHCHECK --interval=30s --timeout=10s --start-period=1200s --retries=5 \
  CMD curl -fsS "http://127.0.0.1:${PORT}/health" >/dev/null || exit 1

CMD ["/bin/sh", "/app/spatial-ai/runtime/boot.sh"]