#!/usr/bin/env bash
# Apply ONLY the alpha-bridge.net vhost — run ON the VPS from /var/www/alphabridge
# Usage: bash tools/vps-apply-nginx-alphabridge.sh
#
# Deliberately scoped to one site. Other domains on this box (beyondtechworld,
# manukeza, newvision, okusoma) are never read, written, enabled or disabled here,
# so an Alpha Bridge deploy cannot change or remove another site's config.
# To reapply every vhost at once, run tools/vps-apply-nginx.sh by hand.
set -euo pipefail

ROOT="${1:-/var/www/alphabridge}"
SRC="$ROOT/tools/nginx/alphabridge.conf"
AVAILABLE="/etc/nginx/sites-available"
ENABLED="/etc/nginx/sites-enabled"

[[ -f "$SRC" ]] || { echo "Missing $SRC — git pull alphabridge first"; exit 1; }

echo "==> Install alpha-bridge.net vhost"
install -m 644 "$SRC" "$AVAILABLE/alphabridge"
ln -sf "$AVAILABLE/alphabridge" "$ENABLED/alphabridge"

echo "==> Test nginx config"
# A syntax error anywhere on the box fails this; bail out before reloading.
nginx -t

echo "==> Reload nginx (graceful — other sites keep serving their current config)"
systemctl reload nginx

echo "==> Verify alpha-bridge.net"
ok=1
for flag in "-4" "-6"; do
  title=$(curl -sk $flag --resolve "alpha-bridge.net:443:127.0.0.1" "https://alpha-bridge.net/" \
    | grep -o '<title>[^<]*</title>' | head -1 || true)
  if [[ "$title" == *"Alpha Bridge"* ]]; then
    echo "OK   alpha-bridge.net $flag → $title"
  else
    echo "FAIL alpha-bridge.net $flag title=$title (expected *Alpha Bridge*)"
    ok=0
  fi
done

[[ "$ok" == 1 ]] || { echo "alpha-bridge.net did not serve the expected page"; exit 1; }
echo "Alpha Bridge vhost applied. No other site was touched."
