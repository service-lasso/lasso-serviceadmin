#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export SERVICE_HOST="${SERVICE_HOST:-127.0.0.1}"
export SERVICE_PORT="${SERVICE_PORT:-17700}"
export SERVICE_DIST_DIR="${SERVICE_DIST_DIR:-dist}"

cd "$ROOT"
node ./runtime/server.js
