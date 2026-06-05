<?php
if (!defined('ABSPATH')) exit;

function nl360_register_admin_routes() {
  // Grant entitlement
  register_rest_route('nl360/v1/admin', '/entitlements/grant', [
    'methods' => 'POST',
    'callback' => 'nl360_admin_entitlements_grant',
    'permission_callback' => 'nl360_perm_admin_system',
    'args' => [
      'user_id' => ['required' => true],
      'key' => ['required' => true, 'type' => 'string'],
      'value' => ['required' => true],
      'expires_at' => ['required' => false],
      'source' => ['required' => false, 'type' => 'string'],
    ],
  ]);

  // (Opcional) Set plan role for testing
  register_rest_route('nl360/v1/admin', '/users/(?P<id>\d+)/set-plan', [
    'methods' => 'POST',
    'callback' => 'nl360_admin_set_plan_role',
    'permission_callback' => 'nl360_perm_admin_system',
    'args' => [
      'plan_slug' => ['required' => true, 'type' => 'string'],
    ],
  ]);

  register_rest_route( 'nl360/v1', '/admin/users/create', [
    'methods'             => 'POST',
    'callback'            => 'nl360_admin_create_user',
    'permission_callback' => 'nl360_perm_admin_system',
  ] );
}

function nl360_perm_admin_system() {
  $secret = getenv('NL360_INTERNAL_SECRET');
  if ( $secret ) {
    $provided = $_SERVER['HTTP_X_NL360_INTERNAL'] ?? '';
    if ( $provided && hash_equals( $secret, $provided ) ) {
      return true;
    }
  }
  return is_user_logged_in() && current_user_can('manage_network');
}

function nl360_admin_entitlements_grant(WP_REST_Request $req) {
  global $wpdb;

  $user_id = (int)$req->get_param('user_id');
  if ($user_id <= 0 || !get_user_by('id', $user_id)) {
    return new WP_Error('nl360_validation_error', 'Invalid user_id', ['status' => 422]);
  }

  $key = sanitize_text_field($req->get_param('key'));
  $value = $req->get_param('value');
  $source = $req->get_param('source');
  $source = $source ? sanitize_text_field($source) : 'addon';

  // normalize value to string
  if (is_bool($value)) $value = $value ? 'true' : 'false';
  if (is_numeric($value)) $value = (string)$value;
  if (!is_string($value)) $value = wp_json_encode($value);

  $expires_at = $req->get_param('expires_at');
  $expires_at = $expires_at ? sanitize_text_field($expires_at) : null;

  $table = $wpdb->prefix . 'nl360_entitlements';
  $now = nl360_now_gmt();

  $wpdb->insert($table, [
    'user_id' => $user_id,
    'source' => $source,
    'ent_key' => $key,
    'ent_value' => $value,
    'expires_at' => $expires_at,
    'created_at' => $now,
    'updated_at' => $now,
  ]);

  return [
    'ok' => true,
    'entitlement_id' => (int)$wpdb->insert_id,
  ];
}

function nl360_admin_set_plan_role(WP_REST_Request $req) {
  $user_id = (int)$req['id'];
  $plan = sanitize_text_field($req->get_param('plan_slug'));

  $allowed = ['nl360_free','nl360_basic','nl360_pro','nl360_elite'];
  if (!in_array($plan, $allowed, true)) {
    return new WP_Error('nl360_validation_error', 'Invalid plan_slug', ['status' => 422]);
  }

  $u = get_user_by('id', $user_id);
  if (!$u) return new WP_Error('nl360_not_found', 'User not found', ['status' => 404]);

  // Remove existing nl360_* roles
  foreach ($allowed as $r) {
    if (in_array($r, (array)$u->roles, true)) $u->remove_role($r);
  }

  if ($plan !== 'nl360_free') {
    $u->add_role($plan);
  }

  // Clear pending plan so post-registration payment prompt doesn't reappear
  delete_user_meta($user_id, 'nl360_pending_plan');

  return ['ok' => true, 'user_id' => $user_id, 'plan_slug' => $plan];
}

function nl360_admin_create_user( WP_REST_Request $request ) {
  $username   = sanitize_user( $request->get_param('username') );
  $email      = sanitize_email( $request->get_param('email') );
  $password   = $request->get_param('password');
  $plan_slug  = sanitize_text_field( $request->get_param('plan_slug') );

  $allowed_plans = [
    'nl360_free', 'nl360_basic', 'nl360_pro', 'nl360_elite'
  ];

  if ( empty($username) || empty($email) || empty($password) ) {
    return new WP_Error(
      'missing_fields',
      'username, email y password son requeridos',
      [ 'status' => 400 ]
    );
  }
  if ( ! in_array($plan_slug, $allowed_plans, true) ) {
    $plan_slug = 'nl360_free';
  }

  $user_id = wp_create_user( $username, $password, $email );

  if ( is_wp_error($user_id) ) {
    return new WP_Error(
      'create_failed',
      $user_id->get_error_message(),
      [ 'status' => 409 ]
    );
  }

  // Marcar email como verificado — no requiere verificación manual
  update_user_meta( $user_id, 'nl360_email_verified', true );

  // Asignar rol del plan — misma lógica que set-plan
  $u = new WP_User( $user_id );
  foreach ( $allowed_plans as $r ) {
    $u->remove_role( $r );
  }
  $u->add_role( $plan_slug );

  return rest_ensure_response( [
    'ok'      => true,
    'user_id' => $user_id,
  ] );
}
