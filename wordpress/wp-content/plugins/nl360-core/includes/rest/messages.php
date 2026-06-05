<?php
if (!defined('ABSPATH')) exit;

function nl360_register_message_routes() {
  register_rest_route('nl360/v1', '/conversations/(?P<id>[a-zA-Z0-9\-_]{8,64})/messages', [
    [
      'methods' => 'GET',
      'callback' => 'nl360_messages_list',
      'permission_callback' => 'nl360_perm_logged_in',
    ],
    [
      'methods' => 'POST',
      'callback' => 'nl360_messages_create',
      'permission_callback' => 'nl360_perm_logged_in',
      'args' => [
        'role' => ['required' => true, 'type' => 'string'],
        'content' => ['required' => true],
        'tokens_in' => ['required' => false],
        'tokens_out' => ['required' => false],
      ],
    ],
  ]);
}

function nl360_messages_list(WP_REST_Request $req) {
  global $wpdb;
  $user_id = get_current_user_id();
  $conv_id = sanitize_text_field($req['id']);

  // ownership check
  $conv_table = $wpdb->prefix . 'nl360_conversations';
  $exists = $wpdb->get_var($wpdb->prepare("SELECT id FROM $conv_table WHERE id=%s AND user_id=%d", $conv_id, $user_id));
  if (!$exists) return new WP_Error('nl360_not_found', 'Conversation not found', ['status' => 404]);

  $table = $wpdb->prefix . 'nl360_messages';
  $items = $wpdb->get_results($wpdb->prepare(
    "SELECT id,conversation_id,role,content_json,tokens_in,tokens_out,created_at
     FROM $table WHERE conversation_id=%s ORDER BY id ASC",
    $conv_id
  ), ARRAY_A);

  foreach ($items as &$it) {
    $it['id'] = (int)$it['id'];
    $it['tokens_in'] = $it['tokens_in'] !== null ? (int)$it['tokens_in'] : null;
    $it['tokens_out'] = $it['tokens_out'] !== null ? (int)$it['tokens_out'] : null;
    $it['content'] = $it['content_json'] ? json_decode($it['content_json'], true) : null;
    unset($it['content_json']);
  }

  return ['items' => $items];
}

function nl360_messages_create(WP_REST_Request $req) {
  global $wpdb;
  $user_id = get_current_user_id();
  $conv_id = sanitize_text_field($req['id']);

  // ownership check
  $conv_table = $wpdb->prefix . 'nl360_conversations';
  $exists = $wpdb->get_var($wpdb->prepare("SELECT id FROM $conv_table WHERE id=%s AND user_id=%d", $conv_id, $user_id));
  if (!$exists) return new WP_Error('nl360_not_found', 'Conversation not found', ['status' => 404]);

  $role = sanitize_text_field($req->get_param('role'));
  $allowed_roles = ['user','assistant','tool','system'];
  if (!in_array($role, $allowed_roles, true)) {
    return new WP_Error('nl360_validation_error', 'Invalid role', ['status' => 422]);
  }

  $content = $req->get_param('content');
  if (!$content || !is_array($content)) {
    return new WP_Error('nl360_validation_error', 'content must be an object', ['status' => 422]);
  }

  $tokens_in = $req->get_param('tokens_in');
  $tokens_out = $req->get_param('tokens_out');
  $tokens_in = $tokens_in === null ? null : (int)$tokens_in;
  $tokens_out = $tokens_out === null ? null : (int)$tokens_out;

  $table = $wpdb->prefix . 'nl360_messages';
  $now = nl360_now_gmt();

  $wpdb->insert($table, [
    'conversation_id' => $conv_id,
    'role' => $role,
    'content_json' => wp_json_encode($content),
    'tokens_in' => $tokens_in,
    'tokens_out' => $tokens_out,
    'created_at' => $now,
  ]);

  // bump conversation updated_at
  $wpdb->update($conv_table, ['updated_at' => $now], ['id' => $conv_id, 'user_id' => $user_id]);

  return [
    'ok' => true,
    'message_id' => (int)$wpdb->insert_id
  ];
}
