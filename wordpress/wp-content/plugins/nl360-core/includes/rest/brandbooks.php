<?php
if (!defined('ABSPATH')) exit;

function nl360_register_brandbook_routes() {
  register_rest_route('nl360/v1', '/brandbooks', [
    [
      'methods' => 'GET',
      'callback' => 'nl360_brandbooks_list',
      'permission_callback' => 'nl360_perm_logged_in',
    ],
    [
      'methods' => 'POST',
      'callback' => 'nl360_brandbooks_create',
      'permission_callback' => 'nl360_perm_logged_in',
      'args' => [
        'name' => ['required' => true, 'type' => 'string'],
        'site_id' => ['required' => false],
        'data' => ['required' => false],
      ],
    ],
  ]);

  register_rest_route('nl360/v1', '/brandbooks/(?P<id>\d+)', [
    [
      'methods' => 'GET',
      'callback' => 'nl360_brandbooks_get',
      'permission_callback' => 'nl360_perm_logged_in',
    ],
    [
      'methods' => 'PATCH',
      'callback' => 'nl360_brandbooks_update',
      'permission_callback' => 'nl360_perm_logged_in',
    ],
  ]);

  register_rest_route('nl360/v1', '/brandbooks/(?P<id>\d+)/set-default', [
    [
      'methods' => 'POST',
      'callback' => 'nl360_brandbooks_set_default',
      'permission_callback' => 'nl360_perm_logged_in',
    ]
  ]);
}

function nl360_perm_logged_in() {
  return is_user_logged_in();
}



function nl360_brandbooks_list(WP_REST_Request $req) {
  global $wpdb;
  $user_id = get_current_user_id();
  $table = $wpdb->prefix . 'nl360_brandbooks';

  $items = $wpdb->get_results($wpdb->prepare(
    "SELECT id,user_id,site_id,name,status,version,is_default,assets_json,data_json,created_at,updated_at
     FROM $table WHERE user_id=%d ORDER BY updated_at DESC",
    $user_id
  ), ARRAY_A);

  foreach ($items as &$it) {
    $it['assets'] = $it['assets_json'] ? json_decode($it['assets_json'], true) : null;
    $it['data'] = $it['data_json'] ? json_decode($it['data_json'], true) : null;
    unset($it['assets_json'], $it['data_json']);
    $it['id'] = (int)$it['id'];
    $it['user_id'] = (int)$it['user_id'];
    $it['site_id'] = $it['site_id'] !== null ? (int)$it['site_id'] : null;
    $it['version'] = (int)$it['version'];
    $it['is_default'] = (bool)$it['is_default'];
  }

  return ['items' => $items];
}

function nl360_brandbooks_create(WP_REST_Request $req) {
  global $wpdb;
  $user_id = get_current_user_id();
  $table = $wpdb->prefix . 'nl360_brandbooks';

  $name = sanitize_text_field($req->get_param('name'));
  $site_id = $req->get_param('site_id');
  $site_id = $site_id === null ? null : (int)$site_id;

  $data = $req->get_param('data');
  $data_json = $data ? wp_json_encode($data) : null;

  $now = nl360_now_gmt();

  $wpdb->insert($table, [
    'user_id' => $user_id,
    'site_id' => $site_id,
    'name' => $name,
    'status' => 'draft',
    'version' => 1,
    'is_default' => 0,
    'assets_json' => null,
    'data_json' => $data_json,
    'created_at' => $now,
    'updated_at' => $now,
  ]);

  $id = (int)$wpdb->insert_id;
  $get_req = new WP_REST_Request('GET', "/nl360/v1/brandbooks/$id");
  $get_req->set_param('id', $id);
  return nl360_brandbooks_get($get_req);
}

function nl360_brandbooks_get(WP_REST_Request $req) {
  global $wpdb;
  $user_id = get_current_user_id();
  $table = $wpdb->prefix . 'nl360_brandbooks';
  $id = (int)$req['id'];

  $row = $wpdb->get_row($wpdb->prepare(
    "SELECT * FROM $table WHERE id=%d AND user_id=%d",
    $id, $user_id
  ), ARRAY_A);

  if (!$row) {
    return new WP_Error('nl360_not_found', 'Brandbook not found', ['status' => 404]);
  }

  $row['assets'] = $row['assets_json'] ? json_decode($row['assets_json'], true) : null;
  $row['data'] = $row['data_json'] ? json_decode($row['data_json'], true) : null;
  unset($row['assets_json'], $row['data_json']);
  $row['id'] = (int)$row['id'];
  $row['user_id'] = (int)$row['user_id'];
  $row['site_id'] = $row['site_id'] !== null ? (int)$row['site_id'] : null;
  $row['version'] = (int)$row['version'];
  $row['is_default'] = (bool)$row['is_default'];

  return $row;
}

function nl360_brandbooks_update(WP_REST_Request $req) {
  global $wpdb;
  $user_id = get_current_user_id();
  $table = $wpdb->prefix . 'nl360_brandbooks';
  $id = (int)$req['id'];

  $existing = $wpdb->get_row($wpdb->prepare(
    "SELECT id FROM $table WHERE id=%d AND user_id=%d",
    $id, $user_id
  ));
  if (!$existing) return new WP_Error('nl360_not_found', 'Brandbook not found', ['status' => 404]);

  $fields = [];
  if ($req->has_param('name')) $fields['name'] = sanitize_text_field($req->get_param('name'));
  if ($req->has_param('status')) $fields['status'] = sanitize_text_field($req->get_param('status'));
  if ($req->has_param('site_id')) $fields['site_id'] = $req->get_param('site_id') === null ? null : (int)$req->get_param('site_id');
  if ($req->has_param('assets')) $fields['assets_json'] = wp_json_encode($req->get_param('assets'));
  if ($req->has_param('data')) $fields['data_json'] = wp_json_encode($req->get_param('data'));

  $fields['updated_at'] = nl360_now_gmt();
  if (isset($fields['data_json'])) $fields['version'] = (int)$wpdb->get_var($wpdb->prepare("SELECT version FROM $table WHERE id=%d", $id)) + 1;

  $wpdb->update($table, $fields, ['id' => $id, 'user_id' => $user_id]);

  return nl360_brandbooks_get(new WP_REST_Request('GET', "/nl360/v1/brandbooks/$id"));
}

function nl360_brandbooks_set_default(WP_REST_Request $req) {
  global $wpdb;
  $user_id = get_current_user_id();
  $table = $wpdb->prefix . 'nl360_brandbooks';
  $id = (int)$req['id'];

  $exists = $wpdb->get_var($wpdb->prepare("SELECT id FROM $table WHERE id=%d AND user_id=%d", $id, $user_id));
  if (!$exists) return new WP_Error('nl360_not_found', 'Brandbook not found', ['status' => 404]);

  $wpdb->update($table, ['is_default' => 0], ['user_id' => $user_id]);
  $wpdb->update($table, ['is_default' => 1, 'updated_at' => nl360_now_gmt()], ['id' => $id, 'user_id' => $user_id]);

  return ['ok' => true];
}
