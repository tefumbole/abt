#!/usr/bin/env bash
# Apply all VPS nginx vhosts from repo — run ON the VPS from /var/www/alphabridge
# Usage: bash tools/vps-apply-nginx.sh
set -euo pipefail

ROOT="${1:-/var/www/alphabridge}"
NGINX_SRC="$ROOT/tools/nginx"
AVAILABLE="/etc/nginx/sites-available"
ENABLED="/etc/nginx/sites-enabled"

if [[ ! -d "$NGINX_SRC" ]]; then
  echo "Missing $NGINX_SRC — git pull alphabridge first"
  exit 1
fi

echo "==> Install nginx site configs"
install -m 644 "$NGINX_SRC/000-default-reject.conf" "$AVAILABLE/000-default-reject"
install -m 644 "$NGINX_SRC/alphabridge.conf" "$AVAILABLE/alphabridge"
install -m 644 "$NGINX_SRC/manukeza.conf" "$AVAILABLE/manukeza"
install -m 644 "$NGINX_SRC/newvision.conf" "$AVAILABLE/newvision"
if [[ -f "$NGINX_SRC/beyondtechworld.conf" ]] && [[ -f /etc/letsencrypt/live/beyondtechworld.com/fullchain.pem ]]; then
  install -m 644 "$NGINX_SRC/beyondtechworld.conf" "$AVAILABLE/beyondtechworld"
elif [[ -f "$NGINX_SRC/beyondtechworld-http.conf" ]]; then
  echo "    beyondtechworld SSL cert or conf missing — using HTTP-only config if present"
  install -m 644 "$NGINX_SRC/beyondtechworld-http.conf" "$AVAILABLE/beyondtechworld"
else
  echo "    WARN: no beyondtechworld nginx conf in repo — leaving existing site untouched"
fi
if [[ -f "$NGINX_SRC/okusoma.conf" ]]; then
  install -m 644 "$NGINX_SRC/okusoma.conf" "$AVAILABLE/okusoma.com"
fi

echo "==> Enable sites (symlinks)"
ln -sf "$AVAILABLE/000-default-reject" "$ENABLED/000-default-reject"
ln -sf "$AVAILABLE/alphabridge" "$ENABLED/alphabridge"
[[ -f "$AVAILABLE/beyondtechworld" ]] && ln -sf "$AVAILABLE/beyondtechworld" "$ENABLED/beyondtechworld"
ln -sf "$AVAILABLE/manukeza" "$ENABLED/manukeza"
ln -sf "$AVAILABLE/newvision" "$ENABLED/newvision"
[[ -f "$AVAILABLE/okusoma.com" ]] && ln -sf "$AVAILABLE/okusoma.com" "$ENABLED/okusoma.com"

echo "==> Remove stray backups from sites-enabled"
find "$ENABLED" -maxdepth 1 -type f -delete 2>/dev/null || true

echo "==> Test nginx config"
nginx -t

echo "==> Reload nginx"
systemctl reload nginx

echo "==> Verify each domain (IPv4 + IPv6 localhost)"
check_site() {
  local host="$1"
  local expect="$2"
  for flag in "-4" "-6"; do
    title=$(curl -sk $flag --resolve "${host}:443:127.0.0.1" "https://${host}/" | grep -o '<title>[^<]*</title>' | head -1 || true)
    cert=$(echo | openssl s_client -connect 127.0.0.1:443 -servername "$host" 2>/dev/null | openssl x509 -noout -subject 2>/dev/null | sed 's/subject=CN = /CN=/' || true)
    if [[ "$title" != *"$expect"* ]]; then
      echo "FAIL $host $flag title=$title (expected *$expect*) cert=$cert"
      return 1
    fi
    echo "OK   $host $flag → $title"
  done
}

check_site alpha-bridge.net "Alpha Bridge" || echo "WARN alpha-bridge.net title check failed"
check_site beyondtechworld.com "Beyond Enterprise" || echo "WARN beyondtechworld.com check skipped (DNS/SSL may be pending)"
check_site manukeza.com "Manukeza"
check_site newvisiontraveltours.com "New Vision"
check_site okusoma.com "School Management"

echo ""
echo "All nginx sites applied. If public IPv4 still times out, check Hostinger hPanel firewall for port 443."
