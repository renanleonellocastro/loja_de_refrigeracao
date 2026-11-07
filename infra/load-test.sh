#!/usr/bin/env bash
# k6 load test of RNF-10 (docs/TESTES.md). Starts the API with a dedicated database loaded with the RNF-10 volume
# (apps/api/scripts/load-stack.ts), waits for it, runs tools/load/main.js and stops the API.
# Needs the PostgreSQL of infra/compose.yaml (pnpm db:up) or LOAD_DATABASE_URL pointing at another one.
# Uses the k6 binary when installed, otherwise the grafana/k6 Docker image.
# Env: LOAD_API_PORT (3001), LOAD_DATABASE_URL, LOAD_DURATION (3m), LOAD_RESULTS (tools/load/results).
set -euo pipefail

PORT="${LOAD_API_PORT:-3001}"
RESULTS="${LOAD_RESULTS:-tools/load/results}"
K6_IMAGE="${K6_IMAGE:-grafana/k6:1.8.0}"
mkdir -p "$RESULTS"

# exec keeps the stack as the background process itself, so the trap stops it (and it stops the API).
(cd apps/api && LOAD_API_PORT="$PORT" exec node --import tsx --conditions=@rc/source scripts/load-stack.ts) \
  > "$RESULTS/api.log" 2>&1 &
STACK=$!
trap 'kill "$STACK" 2>/dev/null || true; wait "$STACK" 2>/dev/null || true' EXIT

for _ in $(seq 1 180); do
  if curl -fsS "http://localhost:$PORT/health" > /dev/null 2>&1; then break; fi
  if ! kill -0 "$STACK" 2> /dev/null; then cat "$RESULTS/api.log"; exit 1; fi
  sleep 1
done

if command -v k6 > /dev/null 2>&1; then
  LOAD_BASE_URL="http://localhost:$PORT" LOAD_SUMMARY="$RESULTS/summary.json" k6 run tools/load/main.js
else
  docker run --rm -i --user "$(id -u):$(id -g)" --add-host=host.docker.internal:host-gateway -v "$PWD:/work" -w /work \
    -e LOAD_BASE_URL="http://host.docker.internal:$PORT" -e LOAD_SUMMARY="$RESULTS/summary.json" \
    -e LOAD_DURATION -e LOAD_PASSWORD "$K6_IMAGE" run tools/load/main.js
fi
