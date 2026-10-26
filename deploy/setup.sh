#!/usr/bin/env bash
# One-time setup for a fresh Ubuntu 24.04 server (built for an Azure B1s VM). Run with sudo:
#
#   sudo git clone https://github.com/Sukanth19/eidothea.git /opt/eidothea
#   sudo bash /opt/eidothea/deploy/setup.sh                                  # http on the VM's IP
#   sudo bash /opt/eidothea/deploy/setup.sh eidothea.eastus.cloudapp.azure.com  # https on a domain
#
# Safe to re-run, e.g. to add a domain later.
set -euo pipefail

APP_DIR=/opt/eidothea
APP_USER=eidothea
DOMAIN="${1:-}"

if [ "$(id -u)" -ne 0 ]; then echo "Run as root (or with sudo)." >&2; exit 1; fi
if [ -n "$DOMAIN" ] && ! [[ "$DOMAIN" =~ ^[A-Za-z0-9.-]+$ ]]; then echo "That doesn't look like a domain: $DOMAIN" >&2; exit 1; fi
cd "$APP_DIR"

step() { echo; echo ">> $*"; }

step "System packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -q
apt-get install -y -q sudo ca-certificates curl gnupg git python3 python3-venv sqlite3 caddy ufw

step "Node.js 22 (Next.js needs 20.9+, Ubuntu ships 18)"
if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 22 ]; then
  install -d -m 0755 /etc/apt/keyrings
  curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor --yes -o /etc/apt/keyrings/nodesource.gpg
  echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_22.x nodistro main" > /etc/apt/sources.list.d/nodesource.list
  apt-get update -q
  apt-get install -y -q nodejs
fi
node --version

step "Swap (a B1s VM has 1 GB RAM; building Next.js needs more)"
if ! swapon --show | grep -q . && [ ! -f /swapfile ]; then
  if fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile >/dev/null && swapon /swapfile; then
    echo "/swapfile none swap sw 0 0" >> /etc/fstab
  else
    rm -f /swapfile
    echo "couldn't add swap; continuing (the build may be slow or run out of memory)"
  fi
fi

step "App user"
id "$APP_USER" >/dev/null 2>&1 || useradd --system --home "$APP_DIR" --shell /usr/sbin/nologin "$APP_USER"
chown -R "$APP_USER:$APP_USER" "$APP_DIR"

step "Build"
# NEXT_PUBLIC_* settings are baked into the website when it's built
BUILD_ENV=$(grep -s '^NEXT_PUBLIC_' /etc/eidothea.env || true)
sudo -u "$APP_USER" -H env $BUILD_ENV bash "$APP_DIR/deploy/build.sh"

step "Database (first run downloads and imports ~3,500 stories)"
if [ ! -f "$APP_DIR/data/archive.db" ]; then
  sudo -u "$APP_USER" -H bash -c "cd $APP_DIR/api && .venv/bin/python import_dataset.py"
else
  echo "already there, leaving it alone"
fi

step "Services"
if [ -n "$DOMAIN" ]; then SITE="$DOMAIN"; SECURE=1; else SITE=":80"; SECURE=0; fi
# Keep settings added by hand (email, the Discord webhook, …) when this runs again
KEEP=$(grep -sv -e '^COOKIE_SECURE=' -e '^NEXT_TELEMETRY_DISABLED=' /etc/eidothea.env || true)
if [ -n "$DOMAIN" ]; then KEEP=$(printf '%s\n' "$KEEP" | grep -v '^SITE_URL=' || true); fi
cat > /etc/eidothea.env <<EOF
COOKIE_SECURE=$SECURE
NEXT_TELEMETRY_DISABLED=1
EOF
# Links in emails need the site's address
if [ -n "$DOMAIN" ]; then echo "SITE_URL=https://$DOMAIN" >> /etc/eidothea.env; fi
if [ -n "$KEEP" ]; then printf '%s\n' "$KEEP" >> /etc/eidothea.env; fi
chmod 600 /etc/eidothea.env  # holds the email password and the webhook URL
install -m 0644 "$APP_DIR/deploy/eidothea-api.service" "$APP_DIR/deploy/eidothea-web.service" /etc/systemd/system/
sed "s|{\$SITE}|$SITE|" "$APP_DIR/deploy/Caddyfile" > /etc/caddy/Caddyfile
install -m 0755 "$APP_DIR/deploy/backup.sh" /etc/cron.daily/eidothea-backup

if [ "${EIDOTHEA_NO_SYSTEMD:-0}" = 1 ]; then
  echo "EIDOTHEA_NO_SYSTEMD=1: skipping firewall and service start (testing only)"
else
  step "Firewall: only SSH, HTTP and HTTPS"
  ufw allow OpenSSH >/dev/null
  ufw allow 80/tcp >/dev/null
  ufw allow 443/tcp >/dev/null
  ufw --force enable >/dev/null

  systemctl daemon-reload
  systemctl enable --now eidothea-api eidothea-web
  systemctl restart eidothea-api eidothea-web caddy
fi

# Azure's instance metadata service knows the public IP
IP=$(curl -fsS --max-time 3 -H Metadata:true \
  "http://169.254.169.254/metadata/instance/network/interface/0/ipv4/ipAddress/0/publicIpAddress?api-version=2021-02-01&format=text" \
  2>/dev/null || echo "<your VM's public IP>")
echo
if [ -n "$DOMAIN" ]; then URL="https://$DOMAIN"; else URL="http://$IP"; fi
echo "Done. Eidothea is at: $URL"
echo
echo "Next, create your Overseer account:"
echo "  sudo -u $APP_USER $APP_DIR/api/.venv/bin/python $APP_DIR/api/create_overseer.py <username>"
