#!/bin/bash
set -e

export ALL_IN_ONE=1
export DB_HOST=127.0.0.1
export DB_PORT=3306
export DB_NAME="${DB_NAME:-smsgateway}"
export DB_USER="${DB_USER:-smsuser}"
export DB_PASSWORD="${DB_PASSWORD:-smspassword}"

if [ -n "${TZ}" ]; then
  ln -snf "/usr/share/zoneinfo/${TZ}" /etc/localtime 2>/dev/null || true
  echo "${TZ}" > /etc/timezone 2>/dev/null || true
  echo "date.timezone = ${TZ}" > /usr/local/etc/php/conf.d/timezone.ini
fi

mkdir -p /run/mysqld /var/lib/mysql
chown -R mysql:mysql /run/mysqld /var/lib/mysql 2>/dev/null || true

start_mariadb_tmp() {
  mariadbd --user=mysql --datadir=/var/lib/mysql &
  MPID=$!
  for i in $(seq 1 45); do
    if mariadb-admin ping -uroot --silent 2>/dev/null; then
      return 0
    fi
    sleep 2
  done
  echo "[init] ERRO: MariaDB não arrancou"
  exit 1
}

stop_mariadb_tmp() {
  if [ -n "${MPID:-}" ]; then
    kill "$MPID" 2>/dev/null || true
    wait "$MPID" 2>/dev/null || true
    unset MPID
    sleep 2
  fi
}

init_mysql() {
  if [ -f /var/lib/mysql/ibdata1 ]; then
    echo "[init] MariaDB já inicializado"
    return
  fi

  echo "[init] A inicializar MariaDB (primeira execução)..."
  mariadb-install-db --user=mysql --datadir=/var/lib/mysql >/dev/null
  start_mariadb_tmp

  if [ -f /opt/schema/MySQL_DB.sql ]; then
    echo "[init] A importar schema..."
    mariadb -uroot "${DB_NAME}" < /opt/schema/MySQL_DB.sql 2>/dev/null || {
      mariadb -uroot -e "CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
      mariadb -uroot "${DB_NAME}" < /opt/schema/MySQL_DB.sql
    }
  fi

  stop_mariadb_tmp
  echo "[init] MariaDB pronto"
}

import_schema_if_needed() {
  local cnt
  cnt=$(mariadb -uroot -N -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='${DB_NAME}' AND table_name='users'" 2>/dev/null || echo "0")
  if [ "${cnt}" = "0" ] && [ -f /opt/schema/MySQL_DB.sql ]; then
    echo "[init] A importar schema (base vazia)..."
    mariadb -uroot -e "CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
    mariadb -uroot "${DB_NAME}" < /opt/schema/MySQL_DB.sql
  fi
}

sync_users() {
  start_mariadb_tmp
  import_schema_if_needed
  mariadb -uroot <<-EOSQL
    CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
    CREATE USER IF NOT EXISTS '${DB_USER}'@'127.0.0.1' IDENTIFIED BY '${DB_PASSWORD}';
    CREATE USER IF NOT EXISTS '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASSWORD}';
    ALTER USER '${DB_USER}'@'127.0.0.1' IDENTIFIED BY '${DB_PASSWORD}';
    ALTER USER '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASSWORD}';
    GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO '${DB_USER}'@'127.0.0.1';
    GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO '${DB_USER}'@'localhost';
    FLUSH PRIVILEGES;
EOSQL
  stop_mariadb_tmp
}

init_mysql
sync_users

echo "[entrypoint] SMS Gateway all-in-one — MariaDB + Apache (sem host 'db')"
echo "[entrypoint] DB_HOST=${DB_HOST} DB=${DB_NAME} USER=${DB_USER} ALL_IN_ONE=1"

start_mariadb_tmp
php /var/www/html/cli_wait_db.php

if [ "${MIGRATE_ON_START}" = "true" ] && [ -n "${MIGRATE_KEY}" ]; then
  echo "[entrypoint] A executar migrações..."
  php /var/www/html/cli_migrate.php || echo "[entrypoint] Migração: passos já aplicados (OK)"
fi

stop_mariadb_tmp

echo "[entrypoint] A iniciar supervisord (MariaDB + Apache)..."
exec /usr/bin/supervisord -c /etc/supervisor/conf.d/smsgateway.conf