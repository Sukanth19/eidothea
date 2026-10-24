#!/usr/bin/env bash
# Install dependencies and build both apps. Runs as the app user (setup.sh and update.sh call it).
set -euo pipefail
cd /opt/eidothea

[ -x api/.venv/bin/python ] || python3 -m venv api/.venv
api/.venv/bin/pip install -q --upgrade pip
api/.venv/bin/pip install -q -r api/requirements.txt

cd web
npm ci --no-fund --no-audit
NEXT_TELEMETRY_DISABLED=1 npm run build
