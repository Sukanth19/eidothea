#!/usr/bin/env bash
# Pull the latest code from GitHub, rebuild and restart. Run on the server:
#   sudo bash /opt/eidothea/deploy/update.sh
set -euo pipefail
cd /opt/eidothea

sudo -u eidothea git pull --ff-only
sudo -u eidothea -H bash deploy/build.sh
# Pick up any changes to the service files
install -m 0644 deploy/eidothea-api.service deploy/eidothea-web.service /etc/systemd/system/
systemctl daemon-reload
systemctl restart eidothea-api eidothea-web
echo "Updated to $(sudo -u eidothea git log -1 --format='%h %s')"
