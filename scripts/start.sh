#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
npm run build
if [[ -x .venv/bin/python ]]; then
  exec .venv/bin/python -m uvicorn backend.app:app --host 127.0.0.1 --port "${PORT:-8000}"
else
  exec python -m uvicorn backend.app:app --host 127.0.0.1 --port "${PORT:-8000}"
fi
