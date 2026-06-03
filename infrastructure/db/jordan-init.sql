-- Jordan schema — conversation persistence
-- Run against the `jordan` database
-- Safe to re-run (IF NOT EXISTS)

CREATE TABLE IF NOT EXISTS `jordan`.`j_conversations` (
  `id`         INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  `user_id`    INT UNSIGNED     NOT NULL,
  `title`      VARCHAR(255)     NOT NULL DEFAULT 'Nueva conversación',
  `created_at` TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `jordan`.`j_messages` (
  `id`              INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  `conversation_id` INT UNSIGNED     NOT NULL,
  `role`            ENUM('user','assistant') NOT NULL,
  `content`         TEXT             NOT NULL,
  `created_at`      TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_conversation_id` (`conversation_id`),
  FOREIGN KEY (`conversation_id`) REFERENCES `j_conversations`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
