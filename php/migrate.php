<?php
/**
 * migrate.php — Executa migração v3 (multi-tenant)
 * GET /migrate.php?key=setup2026
 */
require_once 'config.php';

$key = $_GET['key'] ?? '';
if ($key === '' || $key !== MIGRATE_KEY) {
    http_response_code(403);
    die('Forbidden');
}

$con = db_connect();
$log = [];

function run_sql(mysqli $con, string $sql, array &$log): void {
    try {
        if ($con->query($sql)) {
            $log[] = 'OK: ' . substr($sql, 0, 80);
        } else {
            $log[] = 'SKIP/ERR: ' . $con->error . ' — ' . substr($sql, 0, 60);
        }
    } catch (mysqli_sql_exception $e) {
        $log[] = 'SKIP: ' . $e->getMessage();
    }
}

run_sql($con, "ALTER TABLE users ADD COLUMN api_key varchar(64) DEFAULT NULL", $log);
run_sql($con, "ALTER TABLE users ADD UNIQUE INDEX idx_api_key (api_key)", $log);
run_sql($con, "ALTER TABLE users ADD COLUMN webhook_enabled tinyint(1) NOT NULL DEFAULT 0", $log);
run_sql($con, "ALTER TABLE users ADD COLUMN webhook_url varchar(500) DEFAULT NULL", $log);
run_sql($con, "ALTER TABLE users ADD COLUMN webhook_api_key varchar(128) DEFAULT NULL", $log);
run_sql($con, "ALTER TABLE users ADD COLUMN webhook_auto tinyint(1) NOT NULL DEFAULT 0", $log);
run_sql($con, "ALTER TABLE sms_received ADD COLUMN webhook_last_sent timestamp NULL DEFAULT NULL", $log);
run_sql($con, "ALTER TABLE sms_received ADD COLUMN webhook_last_status enum('sent','failed') DEFAULT NULL", $log);
run_sql($con, "ALTER TABLE sms_received ADD COLUMN webhook_last_error varchar(500) DEFAULT NULL", $log);

$hash = '$2y$10$OjvLtcJynhhkz7XZNj3vRuNjDst6V645HgOw2G4VNzhX2QhfcuNfu';
$con->query("UPDATE users SET password = '$hash' WHERE email = 'admin@smsgateway.local' AND password = 'admin123'");
$con->query("UPDATE users SET api_key = LOWER(REPLACE(UUID(), '-', '')) WHERE api_key IS NULL OR api_key = ''");

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

run_sql($con, "ALTER TABLE sms_received ADD COLUMN user_id int DEFAULT NULL", $log);
run_sql($con, "ALTER TABLE sms_received ADD COLUMN device_id int UNSIGNED DEFAULT NULL", $log);
run_sql($con, "ALTER TABLE sms_queue ADD COLUMN user_id int DEFAULT NULL", $log);
run_sql($con, "ALTER TABLE sms_queue ADD COLUMN device_id int UNSIGNED DEFAULT NULL", $log);

$con->query('UPDATE sms_received SET user_id = 1 WHERE user_id IS NULL');
$con->query('UPDATE sms_queue SET user_id = 1 WHERE user_id IS NULL');

run_sql($con, "ALTER TABLE users ADD COLUMN role enum('admin','user') NOT NULL DEFAULT 'user'", $log);
$con->query("UPDATE users SET role = 'admin' WHERE email = 'admin@smsgateway.local'");
$con->query("UPDATE users SET role = 'user' WHERE role IS NULL OR role = ''");

run_sql($con, "ALTER TABLE users ADD COLUMN is_active tinyint(1) NOT NULL DEFAULT 0", $log);
$con->query("UPDATE users SET is_active = 1 WHERE email = 'admin@smsgateway.local' OR role = 'admin'");
$con->query("UPDATE users SET is_active = 1 WHERE is_active = 0 AND created_at < NOW() - INTERVAL 1 MINUTE");

$con->close();

header('Content-Type: text/plain; charset=utf-8');
echo "Migração v3 concluída\n\n" . implode("\n", $log);