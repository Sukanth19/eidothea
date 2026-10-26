#!/usr/bin/env bash
# Start the API (port 8000) and the website (port 3000). Ctrl+C stops both.
# First run also installs dependencies and imports the dataset.
set -euo pipefail
cd "$(dirname "$0")"

if [ ! -x api/.venv/bin/python ]; then
  echo ">> creating Python venv"
  if command -v uv >/dev/null; then
    uv venv -q api/.venv && uv pip install -q --python api/.venv/bin/python -r api/requirements.txt
  else
    python3 -m venv api/.venv && api/.venv/bin/pip install -q -r api/requirements.txt
  fi
fi

if [ ! -f data/archive.db ]; then
  echo ">> importing the creepypasta dataset (one time, ~45 MB download)"
  (cd api && .venv/bin/python import_dataset.py)
fi

if [ ! -d web/node_modules ]; then
  echo ">> installing web dependencies"
  (cd web && npm install --no-fund --no-audit)
fi

trap 'kill 0' EXIT
(cd api && .venv/bin/python -m uvicorn app.main:app --reload --port 8000) &
(cd web && NEXT_TELEMETRY_DISABLED=1 npx next dev -p 3000) &
wait
