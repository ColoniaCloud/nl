<?php
if (!defined('ABSPATH')) exit;

require_once NL360_CORE_PATH . 'includes/rest/brandbooks.php';
require_once NL360_CORE_PATH . 'includes/rest/conversations.php';
require_once NL360_CORE_PATH . 'includes/rest/messages.php';
require_once NL360_CORE_PATH . 'includes/rest/sites.php';
require_once NL360_CORE_PATH . 'includes/rest/register.php';

function nl360_register_user_routes() {
  nl360_register_brandbook_routes();
  nl360_register_conversation_routes();
  nl360_register_message_routes();
  nl360_register_site_routes();
  nl360_register_registration_routes();
}
