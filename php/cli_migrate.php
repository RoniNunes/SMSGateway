<?php
/**
 * cli_migrate.php — Migração via CLI (entrypoint Docker)
 */
require_once __DIR__ . '/config.php';

$key = getenv('MIGRATE_KEY') ?: '';
if ($key === '') {
    fwrite(STDERR, "MIGRATE_KEY não definida — migração ignorada\n");
    exit(0);
}

$con = db_connect();
$log = [];

function run_sql(mysqli $con, string $sql, array &$log): void {
    try {
        if ($con->query($sql)) {
            $log[] = 'OK: ' . substr($sql, 0, 70);
        } else {
            $log[] = 'SKIP: ' . $con->error;
        }
    } catch (mysqli_sql_exception $e) {
        $log[] = 'SKIP: ' . $e->getMessage();
    }
}

run_sql($con, "ALTER TABLE users ADD COLUMN api_key varchar(64) DEFAULT NULL", $log);
run_sql($con, "ALTER TABLE users ADD UNIQUE INDEX idx_api_key (api_key)", $log);
run_sql($con, "ALTER TABLE users ADD COLUMN role enum('admin','user') NOT NULL DEFAULT 'user'", $log);
run_sql($con, "ALTER TABLE users ADD COLUMN is_active tinyint(1) NOT NULL DEFAULT 0", $log);
run_sql($con, "ALTER TABLE users ADD COLUMN webhook_enabled tinyint(1) NOT NULL DEFAULT 0", $log);
run_sql($con, "ALTER TABLE users ADD COLUMN webhook_url varchar(500) DEFAULT NULL", $log);
run_sql($con, "ALTER TABLE users ADD COLUMN webhook_api_key varchar(128) DEFAULT NULL", $log);
run_sql($con, "ALTER TABLE users ADD COLUMN webhook_auto tinyint(1) NOT NULL DEFAULT 0", $log);

$hash = '$2y$10$OjvLtcJynhhkz7XZNj3vRuNjDst6V645HgOw2G4VNzhX2QhfcuNfu';
$con->query("UPDATE users SET password = '$hash' WHERE email = 'admin@smsgateway.local' AND password = 'admin123'");
$con->query("UPDATE users SET api_key = LOWER(REPLACE(UUID(), '-', '')) WHERE api_key IS NULL OR api_key = ''");
$con->query("UPDATE users SET role = 'admin' WHERE email = 'admin@smsgateway.local'");
$con->query("UPDATE users SET is_active = 1 WHERE email = 'admin@smsgateway.local'");

run_sql($con, "CREATE TABLE IF NOT EXISTS user_devices (
  id int UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id int NOT NULL,
  device_token varchar(64) DEFAULT NULL,
  pairing_code varchar(8) DEFAULT NULL,
  pairing_expires timestamp NULL DEFAULT NULL,
  device_name varchar(100) NOT NULL DEFAULT 'Android',
  phone_number varchar(20) NOT NULL DEFAULT '',
  last_seen timestamp NULL DEFAULT NULL,
  is_active tinyint(1) NOT NULL DEFAULT 1,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_device_token (device_token),
  UNIQUE KEY uk_pairing_code (pairing_code),
  KEY idx_user_devices_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4", $log);

run_sql($con, "CREATE TABLE IF NOT EXISTS sms_queue (
  id int UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id int DEFAULT NULL,
  device_id int UNSIGNED DEFAULT NULL,
  phone varchar(50) NOT NULL,
  message text NOT NULL,
  status enum('pending','sent','failed') NOT NULL DEFAULT 'pending',
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  sent_at timestamp NULL DEFAULT NULL,
  error_msg varchar(500) DEFAULT NULL,
  PRIMARY KEY (id),
  KEY idx_sms_queue_user (user_id),
  KEY idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4", $log);

run_sql($con, "ALTER TABLE sms_received ADD COLUMN user_id int DEFAULT NULL", $log);
run_sql($con, "ALTER TABLE sms_received ADD COLUMN device_id int UNSIGNED DEFAULT NULL", $log);
run_sql($con, "ALTER TABLE sms_queue ADD COLUMN user_id int DEFAULT NULL", $log);
run_sql($con, "ALTER TABLE sms_queue ADD COLUMN device_id int UNSIGNED DEFAULT NULL", $log);
run_sql($con, "ALTER TABLE sms_received ADD COLUMN webhook_last_sent timestamp NULL DEFAULT NULL", $log);
run_sql($con, "ALTER TABLE sms_received ADD COLUMN webhook_last_status enum('sent','failed') DEFAULT NULL", $log);
run_sql($con, "ALTER TABLE sms_received ADD COLUMN webhook_last_error varchar(500) DEFAULT NULL", $log);

$con->query('UPDATE sms_received SET user_id = 1 WHERE user_id IS NULL');
$con->query('UPDATE sms_queue SET user_id = 1 WHERE user_id IS NULL');

$con->close();

foreach ($log as $line) {
    fwrite(STDOUT, "[migrate] $line\n");
}
exit(0);