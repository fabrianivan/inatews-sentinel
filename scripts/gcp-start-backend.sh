#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR/backend"

export SERVER_PORT="${SERVER_PORT:-8080}"
export CORS_ORIGIN="${CORS_ORIGIN:-http://localhost:3000}"
export DEMO_MODE="${DEMO_MODE:-false}"

if [ -f "$ROOT_DIR/.env" ]; then
  set -a
  source "$ROOT_DIR/.env"
  set +a
fi

echo "[GCP] Starting backend with OS environment variables..."
go run cmd/server/main.go
