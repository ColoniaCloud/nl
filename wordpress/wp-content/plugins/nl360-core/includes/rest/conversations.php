<?php
if (!defined('ABSPATH')) exit;

function nl360_register_conversation_routes() {
  register_rest_route('nl360/v1', '/conversations', [
    [
      'methods' => 'GET',
      'callback' => 'nl360_conversations_list',
      'permission_callback' => 'nl360_perm_logged_in',
    ],
    [
      'methods' => 'POST',
      'callback' => 'nl360_conversations_create',
      'permission_callback' => 'nl360_perm_logged_in',
      'args' => [
        'agent_key' => ['required' => true, 'type' => 'string'],
        'subagent_key' => ['required' => false, 'type' => 'string'],
        'context' => ['required' => false],
      ],
    ],
  ]);

  register_rest_route('nl360/v1', '/conversations/(?P<id>[a-zA-Z0-9\-_]{8,64})', [
    [
      'methods' => 'GET',
      'callback' => 'nl360_conversations_get',
      'permission_callback' => 'nl360_perm_logged_in',
    ],
  ]);
}

function nl360_uuid_v4() {
  // WordPress has wp_generate_uuid4()
  return function_exists('wp_generate_uuid4') ? wp_generate_uuid4() : uniqid('c_', true);
}

function nl360_conversations_list(WP_REST_Request $req) {
  global $wpdb;
  $user_id = get_current_user_id();
  $table = $wpdb->prefix . 'nl360_conversations';

  $agent_key = $req->get_param('agent_key');
  $sql = "SELECT id,user_id,agent_key,subagent_key,status,context_json,created_at,updated_at
          FROM $table WHERE user_id=%d";
  $params = [$user_id];

  if ($agent_key) {
    $sql .= " AND agent_key=%s";
    $params[] = sanitize_text_field($agent_key);
  }
  $sql .= " ORDER BY updated_at DESC";

  // phpcs:ignore WordPress.DB.PreparedSQLPlaceholders
  $items = $wpdb->get_results($wpdb->prepare($sql, ...$params), ARRAY_A);

  foreach ($items as &$it) {
    $it['context'] = $it['context_json'] ? json_decode($it['context_json'], true) : null;
    unset($it['context_json']);
    $it['user_id'] = (int)$it['user_id'];
  }

  return ['items' => $items];
}

function nl360_conversations_create(WP_REST_Request $req) {
  global $wpdb;
  $user_id = get_current_user_id();
  $table = $wpdb->prefix . 'nl360_conversations';

  $agent_key = sanitize_text_field($req->get_param('agent_key'));
  $allowed = ['manu', 'vilma', 'jordan', 'mentoria'];
  if (!in_array($agent_key, $allowed, true)) {
    return new WP_Error('nl360_validation_error', 'Invalid agent_key', ['status' => 422]);
  }

  $subagent_key = $req->get_param('subagent_key');
  $subagent_key = $subagent_key ? sanitize_text_field($subagent_key) : null;

  $context = $req->get_param('context');
  $context_json = $context ? wp_json_encode($context) : null;

  $id = nl360_uuid_v4();
  $now = nl360_now_gmt();

  $wpdb->insert($table, [
    'id' => $id,
    'user_id' => $user_id,
    'agent_key' => $agent_key,
    'subagent_key' => $subagent_key,
    'status' => 'active',
    'context_json' => $context_json,
    'created_at' => $now,
    'updated_at' => $now,
  ]);

  // devolver el objeto creado directamente (evita 404 por request sin param id)
  return [
    'id' => $id,
    'user_id' => (int)$user_id,
    'agent_key' => $agent_key,
    'subagent_key' => $subagent_key,
    'status' => 'active',
    'context' => $context ? $context : null,
    'created_at' => $now,
    'updated_at' => $now,
  ];
}

function nl360_conversations_get(WP_REST_Request $req) {
  global $wpdb;
  $user_id = get_current_user_id();
  $table = $wpdb->prefix . 'nl360_conversations';
  $id = sanitize_text_field($req['id']);

  $row = $wpdb->get_row($wpdb->prepare(
    "SELECT id,user_id,agent_key,subagent_key,status,context_json,created_at,updated_at
     FROM $table WHERE id=%s AND user_id=%d",
    $id, $user_id
  ), ARRAY_A);

  if (!$row) return new WP_Error('nl360_not_found', 'Conversation not found', ['status' => 404]);

  $row['user_id'] = (int)$row['user_id'];
  $row['context'] = $row['context_json'] ? json_decode($row['context_json'], true) : null;
  unset($row['context_json']);

  return $row;
}
