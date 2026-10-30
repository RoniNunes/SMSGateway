-- Migração v3: multi-tenant, dispositivos por utilizador, API keys
SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET time_zone = "+00:00";

-- Users: API key + password hash
ALTER TABLE `users`
  ADD COLUMN IF NOT EXISTS `api_key` varchar(64) DEFAULT NULL AFTER `password`,
  ADD UNIQUE INDEX IF NOT EXISTS `idx_api_key` (`api_key`);

UPDATE `users` SET `password` = '$2y$10$OjvLtcJynhhkz7XZNj3vRuNjDst6V645HgOw2G4VNzhX2QhfcuNfu'
WHERE `email` = 'admin@smsgateway.local' AND `password` = 'admin123';

UPDATE `users` SET `api_key` = LOWER(REPLACE(UUID(), '-', ''))
WHERE `api_key` IS NULL OR `api_key` = '';

-- Dispositivos por utilizador
CREATE TABLE IF NOT EXISTS `user_devices` (
  `id`            int(11) UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id`       int(11) NOT NULL,
  `device_token`  varchar(64)  DEFAULT NULL,
  `pairing_code`  varchar(8)   DEFAULT NULL,
  `pairing_expires` timestamp NULL DEFAULT NULL,
  `device_name`   varchar(100) NOT NULL DEFAULT 'Android',
  `phone_number`  varchar(20)  NOT NULL DEFAULT '',
  `last_seen`     timestamp NULL DEFAULT NULL,
  `is_active`     tinyint(1)   NOT NULL DEFAULT 1,
  `created_at`    timestamp    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_device_token` (`device_token`),
  UNIQUE KEY `uk_pairing_code` (`pairing_code`),
  KEY `idx_user_devices_user` (`user_id`),
  CONSTRAINT `fk_user_devices_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Colunas multi-tenant
ALTER TABLE `sms_received`
  ADD COLUMN IF NOT EXISTS `user_id` int(11) DEFAULT NULL AFTER `id`,
  ADD COLUMN IF NOT EXISTS `device_id` int(11) UNSIGNED DEFAULT NULL AFTER `user_id`,
  ADD INDEX IF NOT EXISTS `idx_sms_received_user` (`user_id`);

ALTER TABLE `sms_queue`
  ADD COLUMN IF NOT EXISTS `user_id` int(11) DEFAULT NULL AFTER `id`,
  ADD COLUMN IF NOT EXISTS `device_id` int(11) UNSIGNED DEFAULT NULL AFTER `user_id`,
  ADD INDEX IF NOT EXISTS `idx_sms_queue_user` (`user_id`);

UPDATE `sms_received` SET `user_id` = 1 WHERE `user_id` IS NULL;
UPDATE `sms_queue`      SET `user_id` = 1 WHERE `user_id` IS NULL;