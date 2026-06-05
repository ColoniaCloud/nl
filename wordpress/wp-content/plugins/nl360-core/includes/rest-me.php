<?php
if (!defined('ABSPATH')) exit;

function nl360_register_me_routes() {
  register_rest_route('nl360/v1', '/me', [
    'methods'  => 'GET',
    'callback' => 'nl360_rest_me',
    'permission_callback' => function () {
      return is_user_logged_in();
    },
  ]);
}


function nl360_rest_me(WP_REST_Request $request) {
  global $wpdb;

  $user = wp_get_current_user();
  $user_id = (int) $user->ID;

  // 1) Detectar plan por rol (PMPro puede mapear niveles a roles)
  $roles = array_values((array) $user->roles);

  $plan_slug = 'nl360_free';
  $plan_status = 'active';

  // prioridad por "mejor plan"
  $priority = [
    'nl360_free' => 0,
    'nl360_basic' => 1,
    'nl360_pro' => 2,
    'nl360_elite' => 3,
  ];

  foreach ($roles as $r) {
    if (isset($priority[$r]) && $priority[$r] > $priority[$plan_slug]) {
      $plan_slug = $r;
    }
  }

  // 2) Defaults por plan
  $caps = [
    'use_manu' => false,
    'use_vilma' => false,
    'use_jordan' => false,
    'use_mentoria' => false,
  ];

  $limits = [
    'sites_limit' => 0,              // int o 'unlimited'
    'mentor_courses_limit' => 0,     // int o 'unlimited'
    'tokens_monthly_limit' => 0,     // int
  ];

  switch ($plan_slug) {
    case 'nl360_basic':
      $caps['use_manu'] = true;
      $caps['use_mentoria'] = true;
      $limits['sites_limit'] = 1;
      $limits['mentor_courses_limit'] = 1;
      $limits['tokens_monthly_limit'] = 100000;
      break;

    case 'nl360_pro':
      $caps['use_manu'] = true;
      $caps['use_vilma'] = true;
      $caps['use_mentoria'] = true;
      $limits['sites_limit'] = 2;
      $limits['mentor_courses_limit'] = 2;
      $limits['tokens_monthly_limit'] = 250000;
      break;

    case 'nl360_elite':
      $caps['use_manu'] = true;
      $caps['use_vilma'] = true;
      $caps['use_jordan'] = true;
      $caps['use_mentoria'] = true;
      $limits['sites_limit'] = 'unlimited';
      $limits['mentor_courses_limit'] = 'unlimited';
      $limits['tokens_monthly_limit'] = 1000000;
      break;

    case 'nl360_free':
    default:
      $plan_slug = 'nl360_free';
      $limits['tokens_monthly_limit'] = 25000;
      break;
  }

  // 3) Aplicar entitlements (addons / overrides)
  $ent_table = $wpdb->prefix . 'nl360_entitlements';
  $ents = $wpdb->get_results($wpdb->prepare(
    "SELECT ent_key, ent_value, expires_at
     FROM $ent_table
     WHERE user_id=%d
       AND (expires_at IS NULL OR expires_at > UTC_TIMESTAMP())",
    $user_id
  ), ARRAY_A);

  foreach ($ents as $e) {
    $key = $e['ent_key'];
    $val = $e['ent_value'];

    // capabilities: use_*
    if (strpos($key, 'use_') === 0) {
      $caps[$key] = ($val === 'true' || $val === '1' || $val === 'yes');
      continue;
    }

    // limits
    if (in_array($key, ['sites_limit','mentor_courses_limit','tokens_monthly_limit'], true)) {
      if ($val === 'unlimited') {
        $limits[$key] = 'unlimited';
      } else {
        $limits[$key] = (int)$val;
      }
    }
  }

  // 4) Usage tokens del mes: suma tokens_in + tokens_out del mes actual (UTC)
  // Nota: para performance, luego podemos cachear o agregar tabla de agregados mensual.
  $msg_table = $wpdb->prefix . 'nl360_messages';
  $conv_table = $wpdb->prefix . 'nl360_conversations';

  $tokens_monthly_used = (int) $wpdb->get_var($wpdb->prepare(
    "SELECT COALESCE(SUM(COALESCE(m.tokens_in,0) + COALESCE(m.tokens_out,0)),0)
     FROM $msg_table m
     JOIN $conv_table c ON c.id = m.conversation_id
     WHERE c.user_id = %d
       AND m.created_at >= DATE_FORMAT(UTC_TIMESTAMP(), '%%Y-%%m-01 00:00:00')",
    $user_id
  ));

  // 5) Sites del usuario (multisite)
  $sites = [];
  if (is_multisite()) {
    $user_blogs = get_blogs_of_user($user_id);
    foreach ($user_blogs as $blog) {
      $sites[] = [
        'blog_id' => (int) $blog->userblog_id,
        'domain' => $blog->domain,
        'path' => $blog->path,
        'role' => 'member', // si luego necesitás role exacto por sitio, lo afinamos
      ];
    }
  }

  // Admins always verified. Pre-existing users (meta never set = '') also verified.
  // Only block when meta is explicitly '0' (registered after verification system, not yet confirmed).
  $email_verified_meta = get_user_meta($user_id, 'nl360_email_verified', true);
  $is_admin = in_array('administrator', $roles, true);
  $email_verified = $is_admin || ($email_verified_meta !== '0' && $email_verified_meta !== 0);
  $pending_plan   = get_user_meta($user_id, 'nl360_pending_plan', true) ?: null;

  return [
    'user' => [
      'id' => $user_id,
      'username' => $user->user_login,
      'email' => $user->user_email,
      'displayName' => $user->display_name,
      'roles' => $roles,
      'capabilities' => $caps,
      'emailVerified' => $email_verified,
    ],
    'limits' => $limits,
    'usage' => [
      'tokens_monthly_used' => $tokens_monthly_used,
    ],
    'sites' => $sites,
    'plan' => [
      'slug' => $plan_slug,
      'status' => $plan_status,
    ],
    'pendingPlan' => $pending_plan,
  ];
}
