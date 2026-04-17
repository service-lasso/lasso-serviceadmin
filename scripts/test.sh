#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

for path in \
  "$ROOT/service.json" \
  "$ROOT/verify/service-harness.json" \
  "$ROOT/runtime/server.js" \
  "$ROOT/dist/index.html"; do
  if [[ ! -f "$path" ]]; then
    echo "Missing required file: $path" >&2
    exit 1
  fi
done

SERVICE_ID=$(python3 - <<'PY'
import json, pathlib
print(json.loads(pathlib.Path('service.json').read_text())['id'])
PY
)
if [[ "$SERVICE_ID" != "service-admin" ]]; then
  echo "service.json id mismatch" >&2
  exit 1
fi

CONTRACT_ID=$(python3 - <<'PY'
import json, pathlib
print(json.loads(pathlib.Path('verify/service-harness.json').read_text())['serviceId'])
PY
)
if [[ "$CONTRACT_ID" != "service-admin" ]]; then
  echo "service-harness.json serviceId mismatch" >&2
  exit 1
fi

PORT=17711 SERVICE_PORT=17711 SERVICE_HOST=127.0.0.1 node ./runtime/server.js > /tmp/service-admin-test.log 2>&1 &
SERVER_PID=$!
trap 'kill "$SERVER_PID" >/dev/null 2>&1 || true' EXIT

for _ in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1:17711" >/dev/null; then
    echo "Template tests passed ($(uname -s))"
    exit 0
  fi
  sleep 0.5
done

echo "Service Admin runtime health check failed" >&2
exit 1
