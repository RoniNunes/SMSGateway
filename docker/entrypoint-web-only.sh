#!/bin/bash
set -e

if [ -n "${TZ}" ]; then
  echo "[entrypoint] Timezone: ${TZ}"
  ln -snf "/usr/share/zoneinfo/${TZ}" /etc/localtime 2>/dev/null || true
  echo "${TZ}" > /etc/timezone 2>/dev/null || true
  echo "date.timezone = ${TZ}" > /usr/local/etc/php/conf.d/timezone.ini
fi

export DB_HOST="${DB_HOST:-db}"
echo "[entrypoint] SMS Gateway web-only — a aguardar MySQL (${DB_HOST}:3306)..."

php /var/www/html/cli_wait_db.php

if [ "${MIGRATE_ON_START}" = "true" ] && [ -n "${MIGRATE_KEY}" ]; then
  echo "[entrypoint] A executar migrações..."
  php /var/www/html/cli_migrate.php || echo "[entrypoint] Migração: alguns passos já aplicados (OK)"
fi

echo "[entrypoint] Apache a iniciar..."
exec apache2-foreground