#!/usr/bin/env bash
# Daily database backup (installed to /etc/cron.daily). Keeps the last 7.
set -euo pipefail
DB=/opt/eidothea/data/archive.db
DIR=/opt/eidothea/data/backups
[ -f "$DB" ] || exit 0
mkdir -p "$DIR"
sqlite3 "$DB" ".backup '$DIR/archive-$(date +%F).db'"
ls -1t "$DIR"/archive-*.db | tail -n +8 | xargs -r rm --
chown -R eidothea:eidothea "$DIR"
