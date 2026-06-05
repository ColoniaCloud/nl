<?php
/**
 * Plugin Name: NL360 Core
 * Description: Core endpoints and data layer for NL360 (identity, agents, logs).
 * Version: 0.1.0
 * Network: true
 */

if (!defined('ABSPATH')) exit;

define('NL360_CORE_VERSION', '0.1.0');
define('NL360_CORE_PATH', plugin_dir_path(__FILE__));
define('NL360_CORE_URL', plugin_dir_url(__FILE__));

require_once NL360_CORE_PATH . 'includes/migrations.php';
require_once NL360_CORE_PATH . 'includes/helpers.php';
require_once NL360_CORE_PATH . 'includes/rest-me.php';
require_once NL360_CORE_PATH . 'includes/rest/routes.php';
require_once NL360_CORE_PATH . 'includes/rest/admin.php';


register_activation_hook(__FILE__, function () {
  if (is_multisite()) {
    nl360_core_migrate();
  }
});

add_action('rest_api_init', function () {
  nl360_register_me_routes();
  nl360_register_user_routes();
  nl360_register_admin_routes();
});
