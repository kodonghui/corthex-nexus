#!/bin/sh
# Runs on the origin through sudo. Development only; no production option.
set -eu
umask 077
archive=${1:?archive required}
revision=${2:?full Git revision required}
[ "$(id -u)" = 0 ] || { echo 'root required' >&2; exit 1; }
case "$revision" in *[!0-9a-f]*|'') exit 1;; esac
[ "${#revision}" -eq 40 ] || exit 1
base=/opt/nexus/dev
state=/var/lib/nexus-dev
release=$base/releases/$revision
[ -f /etc/nexus/dev.env ] || { echo 'create the private origin environment file first' >&2; exit 1; }
[ ! -e "$release" ] || { echo 'release already exists' >&2; exit 1; }
# The uploader sends a Git archive of reviewed public runtime files only.
tar -tf "$archive" | awk '/(^\/|(^|\/)\.\.(\/|$))/ {bad=1} END {exit bad}'
getent passwd nexus-dev >/dev/null || useradd --system --home-dir "$state" --shell /usr/sbin/nologin nexus-dev
install -d -m 0755 /opt/nexus "$base" "$base/releases" "$release"
install -d -m 0700 -o nexus-dev -g nexus-dev "$state" "$state/backups"
tar -xf "$archive" -C "$release" --no-same-owner
chmod -R a+rX "$release"
previous=
if [ -L "$base/current" ]; then
  previous=$(readlink -f "$base/current" 2>/dev/null || true)
  [ -d "$previous" ] || previous=
fi
if [ -f "$state/nexus.sqlite" ]; then
  runuser -u nexus-dev -- /usr/bin/node "$release/nexus/tools/database.js" backup --database "$state/nexus.sqlite" --directory "$state/backups" --reason predeploy
fi
install -m 0644 "$release/nexus/ops/nexus@.service" /etc/systemd/system/nexus@.service
install -m 0644 "$release/nexus/ops/nexus-backup@.service" /etc/systemd/system/nexus-backup@.service
install -m 0644 "$release/nexus/ops/nexus-backup@.timer" /etc/systemd/system/nexus-backup@.timer
ln -s "$release" "$base/current.next"
mv -Tf "$base/current.next" "$base/current"
systemctl daemon-reload
systemctl restart nexus@dev.service
attempt=0
while [ "$attempt" -lt 20 ]; do
  # Direct unauthenticated refusal proves HTTP is ready, without a bypass.
  code=$(curl -s --max-time 2 -o /dev/null -w '%{http_code}' http://127.0.0.1:8787/api/snapshots || true)
  if [ "$code" = 403 ] && systemctl is-active --quiet nexus@dev.service; then break; fi
  attempt=$((attempt+1))
  sleep 1
done
if [ "$code" != 403 ] || ! systemctl is-active --quiet nexus@dev.service; then
  if [ -n "$previous" ]; then
    ln -s "$previous" "$base/rollback.next"
    mv -Tf "$base/rollback.next" "$base/current"
    systemctl restart nexus@dev.service
  else systemctl stop nexus@dev.service
  fi
  echo 'development deployment failed; previous runtime selected' >&2
  exit 1
fi
systemctl enable nexus@dev.service nexus-backup@dev.timer >/dev/null
systemctl start nexus-backup@dev.timer
printf 'development deployment ready: %s\n' "$revision"
