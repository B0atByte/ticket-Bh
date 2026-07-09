#!/usr/bin/env bash
# Backup the xBloom database + uploaded files into ./backups/.
# Usage (from repo root, stack running):  bash scripts/backup.sh
set -euo pipefail
cd "$(dirname "$0")/.."

# Load MYSQL_* from .env
set -a; [ -f .env ] && . ./.env; set +a

TS="$(date +%Y%m%d-%H%M%S)"
mkdir -p backups

echo "→ dumping database '${MYSQL_DATABASE}' ..."
docker compose exec -T mysql mysqldump -u root -p"${MYSQL_ROOT_PASSWORD}" \
  --single-transaction --routines "${MYSQL_DATABASE}" > "backups/db-${TS}.sql"

echo "→ archiving uploaded files ..."
docker compose exec -T api tar -czf - -C /app/backend uploads > "backups/uploads-${TS}.tar.gz" 2>/dev/null || \
  echo "  (no uploads volume yet — skipped)"

echo "✓ backup complete:"
echo "  backups/db-${TS}.sql"
echo "  backups/uploads-${TS}.tar.gz"
echo
echo "Restore DB:   docker compose exec -T mysql mysql -uroot -p\$MYSQL_ROOT_PASSWORD \$MYSQL_DATABASE < backups/db-${TS}.sql"
echo "Restore files: docker compose exec -T api tar -xzf - -C /app/backend < backups/uploads-${TS}.tar.gz"
