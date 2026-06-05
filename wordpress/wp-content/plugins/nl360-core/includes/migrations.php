<?php
if (!defined('ABSPATH')) exit;

function nl360_core_migrate() {
  global $wpdb;

  require_once ABSPATH . 'wp-admin/includes/upgrade.php';

  $charset = $wpdb->get_charset_collate();

  $brandbooks = $wpdb->prefix . 'nl360_brandbooks';
  $avatars = $wpdb->prefix . 'nl360_avatars';
  $conversations = $wpdb->prefix . 'nl360_conversations';
  $messages = $wpdb->prefix . 'nl360_messages';
  $entitlements = $wpdb->prefix . 'nl360_entitlements';

  // Brandbooks
  $sql = "CREATE TABLE $brandbooks (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id BIGINT UNSIGNED NOT NULL,
    site_id BIGINT UNSIGNED NULL,
    name VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'draft',
    version INT UNSIGNED NOT NULL DEFAULT 1,
    is_default TINYINT(1) NOT NULL DEFAULT 0,
    assets_json LONGTEXT NULL,
    data_json LONGTEXT NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    PRIMARY KEY (id),
    KEY user_id (user_id),
    KEY site_id (site_id),
    KEY status (status),
    KEY is_default (is_default)
  ) $charset;";
  dbDelta($sql);

  // Avatars
  $sql = "CREATE TABLE $avatars (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id BIGINT UNSIGNED NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'draft',
    provider VARCHAR(50) NULL,
    prompt_json LONGTEXT NULL,
    assets_json LONGTEXT NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    PRIMARY KEY (id),
    KEY user_id (user_id),
    KEY status (status)
  ) $charset;";
  dbDelta($sql);

  // Conversations
  $sql = "CREATE TABLE $conversations (
    id CHAR(36) NOT NULL,
    user_id BIGINT UNSIGNED NOT NULL,
    agent_key VARCHAR(32) NOT NULL,
    subagent_key VARCHAR(64) NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    context_json LONGTEXT NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    PRIMARY KEY (id),
    KEY user_id (user_id),
    KEY agent_key (agent_key),
    KEY status (status)
  ) $charset;";
  dbDelta($sql);

  // Messages
  $sql = "CREATE TABLE $messages (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    conversation_id CHAR(36) NOT NULL,
    role VARCHAR(20) NOT NULL,
    content_json LONGTEXT NULL,
    tokens_in INT UNSIGNED NULL,
    tokens_out INT UNSIGNED NULL,
    created_at DATETIME NOT NULL,
    PRIMARY KEY (id),
    KEY conversation_id (conversation_id),
    KEY role (role),
    KEY created_at (created_at)
  ) $charset;";
  dbDelta($sql);

  // Entitlements (plan/addons/limits)
  $sql = "CREATE TABLE $entitlements (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id BIGINT UNSIGNED NOT NULL,
    source VARCHAR(32) NOT NULL DEFAULT 'addon',
    ent_key VARCHAR(64) NOT NULL,
    ent_value VARCHAR(255) NOT NULL,
    expires_at DATETIME NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    PRIMARY KEY (id),
    KEY user_id (user_id),
    KEY ent_key (ent_key),
    KEY expires_at (expires_at)
  ) $charset;";
  dbDelta($sql);

  // Store schema version
  update_site_option('nl360_core_schema_version', NL360_CORE_VERSION);
}
