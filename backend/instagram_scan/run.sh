#!/usr/bin/env bash
# Start the scan service on 127.0.0.1:8010 ONLY.
# This host has a public IP — never bind 0.0.0.0.
set -euo pipefail

cd "$(dirname "$0")"

# Load .env into the environment (uvicorn/app also load it, but export here so
# child processes and quick debugging see the same values).
if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
fi

# Prefer the local venv if present.
if [ -x .venv/bin/uvicorn ]; then
  UVICORN=.venv/bin/uvicorn
else
  UVICORN=uvicorn
fi

exec "$UVICORN" main:app --host 127.0.0.1 --port 8010
