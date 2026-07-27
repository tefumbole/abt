#!/usr/bin/env bash
# Deploy Alpha Bridge to alpha-bridge.net — port 3003 (Beyond Enterprise uses 3004)
# Usage: bash tools/deploy-alphabridge-vps.sh
set -euo pipefail

ROOT="${1:-/var/www/alphabridge}"
cd "$ROOT"

echo "==> 1. Ensure nginx owns port 80"
if systemctl is-active --quiet apache2 2>/dev/null; then
  systemctl stop apache2
  systemctl disable apache2
fi
systemctl start nginx || systemctl restart nginx

echo "==> 2. Pull latest code"
git pull || { echo "git pull failed — fix conflicts first"; exit 1; }

echo "==> 3. API env (alpha-bridge database)"
if [[ ! -f apps/api/.env ]]; then
  cp apps/api/.env.hostinger.example apps/api/.env
  echo "    Created apps/api/.env — EDIT DB_PASSWORD and JWT_SECRET, then re-run"
  exit 1
fi
grep -q '^PORT=' apps/api/.env && sed -i 's/^PORT=.*/PORT=3003/' apps/api/.env || echo 'PORT=3003' >> apps/api/.env
grep -q '^COMPANY_NAME=' apps/api/.env && sed -i 's/^COMPANY_NAME=.*/COMPANY_NAME=Alpha Bridge Technologies Ltd/' apps/api/.env || echo 'COMPANY_NAME=Alpha Bridge Technologies Ltd' >> apps/api/.env
grep -q '^CORS_ORIGIN=' apps/api/.env && sed -i 's|^CORS_ORIGIN=.*|CORS_ORIGIN=https://alpha-bridge.net|' apps/api/.env
grep -q '^APP_URL=' apps/api/.env && sed -i 's|^APP_URL=.*|APP_URL=https://alpha-bridge.net|' apps/api/.env
# Keep Alpha Bridge MySQL DB name isolated from Beyondtechworld
grep -q '^DB_NAME=' apps/api/.env && sed -i 's/^DB_NAME=.*/DB_NAME=u152889834_alphabridge/' apps/api/.env
grep -q '^SEED_ADMIN_EMAIL=' apps/api/.env && sed -i 's/^SEED_ADMIN_EMAIL=.*/SEED_ADMIN_EMAIL=admin@alpha-bridge.net/' apps/api/.env || echo 'SEED_ADMIN_EMAIL=admin@alpha-bridge.net' >> apps/api/.env
grep -q '^SEED_ADMIN_USERNAME=' apps/api/.env && sed -i 's/^SEED_ADMIN_USERNAME=.*/SEED_ADMIN_USERNAME=admin/' apps/api/.env || echo 'SEED_ADMIN_USERNAME=admin' >> apps/api/.env
grep -q '^SEED_ADMIN_PASSWORD=' apps/api/.env && sed -i 's/^SEED_ADMIN_PASSWORD=.*/SEED_ADMIN_PASSWORD=system/' apps/api/.env || echo 'SEED_ADMIN_PASSWORD=system' >> apps/api/.env
grep -q '^SEED_ADMIN_PHONE=' apps/api/.env && sed -i 's|^SEED_ADMIN_PHONE=.*|SEED_ADMIN_PHONE=+237675321739|' apps/api/.env || echo 'SEED_ADMIN_PHONE=+237675321739' >> apps/api/.env

echo "==> 4. Install & migrate"
cd apps/api && npm install && cd ../..
npm run db:migrate
echo "==> 4b. Seed Alpha Bridge admin (admin / system) — alphabridge DB only"
(cd apps/api && npm run db:seed-admin)

echo "==> 5. Frontend env + build (Alpha Bridge branding)"
cp tools/env/alphabridge.production.env .env
npm install
npm run build

echo "==> 6. Start API on port 3003 (PM2) — does NOT stop beyondtechworld-api"
npm install -g pm2 2>/dev/null || true
pm2 delete alphabridge-api 2>/dev/null || true
PORT=3003 pm2 start src/main.js --name alphabridge-api --cwd "$ROOT/apps/api"
pm2 save

sleep 2
curl -sf http://127.0.0.1:3003/health || { echo "API health check failed on :3003"; exit 1; }
echo "    Alpha Bridge API OK on :3003"

echo "==> 7. Nginx — apply all VPS vhost configs"
bash "$ROOT/tools/vps-apply-nginx.sh" "$ROOT"

echo ""
echo "Alpha Bridge deploy complete."
echo "  https://alpha-bridge.net"
echo "  API: http://127.0.0.1:3003/health"
