-- SMSGateway Database Schema v3 — Multi-tenant
SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET AUTOCOMMIT = 0;
START TRANSACTION;
SET time_zone = "+00:00";

CREATE TABLE IF NOT EXISTS `users` (
  `id`         int(11) NOT NULL AUTO_INCREMENT,
  `name`       varchar(49)  NOT NULL,
  `email`      varchar(99)  NOT NULL,
  `password`   varchar(255) NOT NULL,
  `api_key`    varchar(64)  DEFAULT NULL,
  `role`       enum('admin','user') NOT NULL DEFAULT 'user',
  `is_active`        tinyint(1) NOT NULL DEFAULT 0,
  `webhook_enabled`  tinyint(1) NOT NULL DEFAULT 0,
  `webhook_url`      varchar(500) DEFAULT NULL,
  `webhook_api_key`  varchar(128) DEFAULT NULL,
  `webhook_auto`     tinyint(1) NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`),
  UNIQUE KEY `idx_api_key` (`api_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `users` (`name`, `email`, `password`, `api_key`, `role`, `is_active`) VALUES
('Admin', 'admin@smsgateway.local', '$2y$10$OjvLtcJynhhkz7XZNj3vRuNjDst6V645HgOw2G4VNzhX2QhfcuNfu', LOWER(REPLACE(UUID(), '-', '')), 'admin', 1);

CREATE TABLE IF NOT EXISTS `user_devices` (
  `id`              int(11) UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id`         int(11) NOT NULL,
  `device_token`    varchar(64)  DEFAULT NULL,
  `pairing_code`    varchar(8)   DEFAULT NULL,
  `pairing_expires` timestamp NULL DEFAULT NULL,
  `device_name`     varchar(100) NOT NULL DEFAULT 'Android',
  `phone_number`    varchar(20)  NOT NULL DEFAULT '',
  `last_seen`       timestamp NULL DEFAULT NULL,
  `is_active`       tinyint(1)   NOT NULL DEFAULT 1,
  `created_at`      timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_device_token` (`device_token`),
  UNIQUE KEY `uk_pairing_code` (`pairing_code`),
  KEY `idx_user_devices_user` (`user_id`),
  CONSTRAINT `fk_user_devices_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `sms_received` (
  `id`           int(11) UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id`      int(11) DEFAULT NULL,
  `device_id`    int(11) UNSIGNED DEFAULT NULL,
  `user`         varchar(99)  NOT NULL DEFAULT '',
  `phone_num`    varchar(19)  NOT NULL,
  `message`      text         NOT NULL,
  `datestamp`    datetime     NOT NULL DEFAULT '2000-01-01 00:00:00',
  `date_sent`    datetime     NOT NULL DEFAULT '2000-01-01 00:00:00',
  `record_stamp`       timestamp    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `webhook_last_sent`  timestamp    NULL DEFAULT NULL,
  `webhook_last_status` enum('sent','failed') DEFAULT NULL,
  `webhook_last_error` varchar(500) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_sms_received_user` (`user_id`),
  KEY `idx_phone` (`phone_num`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `sms_queue` (
  `id`         int(11) UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id`    int(11) DEFAULT NULL,
  `device_id`  int(11) UNSIGNED DEFAULT NULL,
  `phone`      varchar(50)  NOT NULL,
  `message`    text         NOT NULL,
  `status`     enum('pending','sent','failed') NOT NULL DEFAULT 'pending',
  `created_at` timestamp    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `sent_at`    timestamp    NULL DEFAULT NULL,
  `error_msg`  varchar(500) NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_sms_queue_user` (`user_id`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

COMMIT;