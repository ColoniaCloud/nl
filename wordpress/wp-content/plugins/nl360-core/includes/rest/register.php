<?php
if (!defined('ABSPATH')) exit;

function nl360_register_registration_routes() {
  register_rest_route('nl360/v1', '/register', [
    'methods'             => 'POST',
    'callback'            => 'nl360_rest_register',
    'permission_callback' => '__return_true',
  ]);

  register_rest_route('nl360/v1', '/verify-email', [
    'methods'             => 'POST',
    'callback'            => 'nl360_rest_verify_email',
    'permission_callback' => '__return_true',
  ]);

  register_rest_route('nl360/v1', '/resend-verification', [
    'methods'             => 'POST',
    'callback'            => 'nl360_rest_resend_verification',
    'permission_callback' => '__return_true',
  ]);
}

// ---------------------------------------------------------------------------
// POST /nl360/v1/register
// ---------------------------------------------------------------------------
function nl360_rest_register(WP_REST_Request $request) {
  // Verificar header de seguridad interna
  $internal_secret = getenv('NL360_INTERNAL_SECRET');
  if ($internal_secret) {
    $provided = $request->get_header('X-NL360-Internal');
    if (!$provided || !hash_equals($internal_secret, $provided)) {
      return new WP_Error('nl360_forbidden', 'Forbidden', ['status' => 403]);
    }
  }

  // Rate limiting por IP
  $ip_key   = 'nl360_reg_' . md5($_SERVER['REMOTE_ADDR'] ?? 'unknown');
  $attempts = (int) get_transient($ip_key);
  if ($attempts >= 5) {
    return new WP_Error('nl360_rate_limit', 'Demasiados intentos. Espera 15 minutos.', ['status' => 429]);
  }
  set_transient($ip_key, $attempts + 1, 15 * MINUTE_IN_SECONDS);

  // Leer parámetros
  $username = sanitize_user($request->get_param('username') ?? '', true);
  $email    = sanitize_email($request->get_param('email') ?? '');
  $password = $request->get_param('password') ?? '';   // NO sanitize — WP hashea con bcrypt
  $plan     = sanitize_text_field($request->get_param('plan') ?? 'free');

  $valid_plans = ['free', 'basic', 'pro', 'elite'];
  if (!in_array($plan, $valid_plans, true)) {
    $plan = 'free';
  }

  // Validaciones
  if (empty($username)) {
    return new WP_Error('nl360_validation', 'El nombre de usuario es requerido.', ['status' => 422]);
  }
  if (!validate_username($username)) {
    return new WP_Error('nl360_validation', 'El nombre de usuario contiene caracteres no permitidos.', ['status' => 422]);
  }
  if (strlen($username) < 3 || strlen($username) > 60) {
    return new WP_Error('nl360_validation', 'El nombre de usuario debe tener entre 3 y 60 caracteres.', ['status' => 422]);
  }
  if (!is_email($email)) {
    return new WP_Error('nl360_validation', 'El email no es valido.', ['status' => 422]);
  }
  if (strlen($password) < 8) {
    return new WP_Error('nl360_validation', 'La contrasena debe tener al menos 8 caracteres.', ['status' => 422]);
  }
  if (username_exists($username)) {
    return new WP_Error('nl360_conflict', 'El nombre de usuario ya esta en uso.', ['status' => 409]);
  }
  if (email_exists($email)) {
    return new WP_Error('nl360_conflict', 'Ya existe una cuenta con ese email.', ['status' => 409]);
  }

  // Crear usuario
  $user_id = wp_create_user($username, $password, $email);
  if (is_wp_error($user_id)) {
    return new WP_Error('nl360_create_error', $user_id->get_error_message(), ['status' => 500]);
  }

  // Asignar rol base
  $user = new WP_User($user_id);
  $user->set_role('nl360_free');

  // Metadata de verificación y plan pendiente
  update_user_meta($user_id, 'nl360_email_verified', 0);
  update_user_meta($user_id, 'nl360_pending_plan', $plan);

  // Generar token de verificación
  $token = bin2hex(random_bytes(32));
  update_user_meta($user_id, 'nl360_verify_token', $token);

  // Enviar email de verificación via Resend
  $frontend_url = getenv('NL360_FRONTEND_URL') ?: 'https://nl360.site';
  $verify_link  = $frontend_url . '/verificar-email?token=' . rawurlencode($token) . '&uid=' . $user_id;

  nl360_send_verification_email($email, $username, $verify_link);

  return rest_ensure_response([
    'ok'      => true,
    'user_id' => $user_id,
  ]);
}

// ---------------------------------------------------------------------------
// Helper: enviar email de verificación via Resend API
// ---------------------------------------------------------------------------
function nl360_send_verification_email(string $to, string $username, string $verify_link): void {
  $api_key = getenv('RESEND_API_KEY');
  if (!$api_key) return; // Silently skip if not configured

  $html = '<!DOCTYPE html><html><body style="font-family:sans-serif;background:#09090b;color:#e4e4e7;padding:32px;">
<div style="max-width:520px;margin:0 auto;background:#18181b;border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:32px;">
  <img src="https://api.nl360.site/wp-content/uploads/2026/01/Isologotipo-NL360-Black.png"
       alt="NL360" style="height:32px;filter:invert(1);margin-bottom:24px;" />
  <h1 style="font-size:20px;font-weight:700;color:#fff;margin:0 0 8px;">Confirma tu cuenta</h1>
  <p style="color:#a1a1aa;font-size:14px;margin:0 0 24px;">Hola <strong style="color:#e4e4e7;">' . esc_html($username) . '</strong>, gracias por registrarte en NL360.</p>
  <a href="' . esc_url($verify_link) . '"
     style="display:inline-block;background:#7c3aed;color:#fff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 24px;border-radius:10px;">
    Verificar mi email
  </a>
  <p style="color:#52525b;font-size:12px;margin:24px 0 0;">Este enlace es valido por 48 horas. Si no creaste esta cuenta, ignora este mensaje.</p>
</div></body></html>';

  wp_remote_post('https://api.resend.com/emails', [
    'timeout' => 10,
    'headers' => [
      'Authorization' => 'Bearer ' . $api_key,
      'Content-Type'  => 'application/json',
    ],
    'body' => wp_json_encode([
      'from'    => 'NL360 <no-responder@nl360.site>',
      'to'      => [$to],
      'subject' => 'Confirma tu cuenta en NL360',
      'html'    => $html,
    ]),
  ]);
}

// ---------------------------------------------------------------------------
// POST /nl360/v1/resend-verification
// ---------------------------------------------------------------------------
function nl360_rest_resend_verification(WP_REST_Request $request) {
  // Verificar header de seguridad interna
  $internal_secret = getenv('NL360_INTERNAL_SECRET');
  if ($internal_secret) {
    $provided = $request->get_header('X-NL360-Internal');
    if (!$provided || !hash_equals($internal_secret, $provided)) {
      return new WP_Error('nl360_forbidden', 'Forbidden', ['status' => 403]);
    }
  }

  $email = sanitize_email($request->get_param('email') ?? '');
  if (!is_email($email)) {
    return new WP_Error('nl360_validation', 'El email no es valido.', ['status' => 422]);
  }

  $user = get_user_by('email', $email);
  if (!$user) {
    return new WP_Error('nl360_not_found', 'No existe una cuenta con ese email.', ['status' => 404]);
  }

  $verified = (int) get_user_meta($user->ID, 'nl360_email_verified', true);
  if ($verified === 1) {
    return new WP_Error('nl360_already_verified', 'Este email ya ha sido verificado.', ['status' => 400]);
  }

  // Generar nuevo token y persistirlo
  $token = bin2hex(random_bytes(32));
  update_user_meta($user->ID, 'nl360_verify_token', $token);

  $frontend_url = getenv('NL360_FRONTEND_URL') ?: 'https://nl360.site';
  $verify_link  = $frontend_url . '/verificar-email?token=' . rawurlencode($token) . '&uid=' . $user->ID;

  nl360_send_verification_email($email, $user->user_login, $verify_link);

  return rest_ensure_response(['success' => true]);
}

// ---------------------------------------------------------------------------
// POST /nl360/v1/verify-email
// ---------------------------------------------------------------------------
function nl360_rest_verify_email(WP_REST_Request $request) {
  $token  = sanitize_text_field($request->get_param('token') ?? '');
  $uid    = (int) ($request->get_param('uid') ?? 0);

  if (!$token || !$uid) {
    return new WP_Error('nl360_validation', 'Token o uid faltante.', ['status' => 422]);
  }

  $user = get_user_by('id', $uid);
  if (!$user) {
    return new WP_Error('nl360_not_found', 'Usuario no encontrado.', ['status' => 404]);
  }

  $stored_token = get_user_meta($uid, 'nl360_verify_token', true);

  if (!$stored_token || !hash_equals((string) $stored_token, $token)) {
    return new WP_Error('nl360_invalid_token', 'Token invalido o expirado.', ['status' => 400]);
  }

  // Verificar email
  update_user_meta($uid, 'nl360_email_verified', 1);
  delete_user_meta($uid, 'nl360_verify_token');

  $pending_plan = get_user_meta($uid, 'nl360_pending_plan', true) ?: 'free';

  return rest_ensure_response([
    'ok'           => true,
    'username'     => $user->user_login,
    'pending_plan' => $pending_plan,
  ]);
}
