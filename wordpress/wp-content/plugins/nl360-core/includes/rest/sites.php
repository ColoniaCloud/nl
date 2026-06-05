<?php
if (!defined('ABSPATH')) exit;

function nl360_register_site_routes() {
  register_rest_route('nl360/v1', '/sites/check', [
    'methods'             => 'GET',
    'callback'            => 'nl360_sites_check',
    'permission_callback' => 'nl360_perm_logged_in',
  ]);

  register_rest_route('nl360/v1', '/sites', [
    'methods'             => 'POST',
    'callback'            => 'nl360_sites_create',
    'permission_callback' => 'nl360_perm_logged_in',
    'args' => [
      'subdomain'    => ['required' => true,  'type' => 'string'],
      'title'        => ['required' => true,  'type' => 'string'],
      'tagline'      => ['required' => false, 'type' => 'string'],
      'brandbook_id' => ['required' => false],
      'logo_data'          => ['required' => false, 'type' => ['string', 'null']],
      'favicon_data'       => ['required' => false, 'type' => ['string', 'null']],
      'colors'             => ['required' => false, 'type' => 'array'],
      'pages'              => ['required' => false, 'type' => 'array'],
      'needs_woocommerce'  => ['required' => false, 'type' => 'boolean'],
    ],
  ]);
}

/* ─────────────────────────────────────────────
   GET /nl360/v1/sites/check?subdomain=X
───────────────────────────────────────────── */
function nl360_sites_check(WP_REST_Request $req) {
  $subdomain = strtolower(trim($req->get_param('subdomain') ?? ''));

  $reserved = ['www','mail','ftp','admin','api','static','cdn','blog','app','dev','test','staging','smtp','imap','pop','ns1','ns2','vpn','ssh','git','docs','support','help','status','login','panel','cpanel','webmail'];

  if (in_array($subdomain, $reserved, true)) {
    return ['available' => false, 'reason' => 'reserved'];
  }

  if (!preg_match('/^[a-z0-9][a-z0-9\-]*[a-z0-9]$/', $subdomain) || strlen($subdomain) < 3 || strlen($subdomain) > 63) {
    return ['available' => false, 'reason' => 'invalid_format'];
  }

  $existing = get_id_from_blogname($subdomain);
  if ($existing) {
    return ['available' => false, 'reason' => 'taken'];
  }

  return ['available' => true];
}

/* ─────────────────────────────────────────────
   POST /nl360/v1/sites
───────────────────────────────────────────── */
function nl360_sites_create(WP_REST_Request $req) {
  $user_id      = get_current_user_id();
  $subdomain    = strtolower(trim($req->get_param('subdomain') ?? ''));
  $title        = sanitize_text_field($req->get_param('title') ?? '');
  $tagline      = sanitize_text_field($req->get_param('tagline') ?? '');
  $brandbook_id = $req->get_param('brandbook_id');
  $brandbook_id = $brandbook_id !== null ? (int)$brandbook_id : null;
  $logo_data         = $req->get_param('logo_data');
  $favicon_data      = $req->get_param('favicon_data');
  $colors            = $req->get_param('colors') ?? [];
  $pages             = $req->get_param('pages') ?? [];
  $needs_woocommerce = (bool)($req->get_param('needs_woocommerce') ?? false);

  // Fetch brandbook data before switch_to_blog (uses base_prefix, always main site)
  $brandbook_data = nl360_fetch_brandbook_data($brandbook_id, $user_id);

  // Inline validation
  $reserved = ['www','mail','ftp','admin','api','static','cdn','blog','app','dev','test','staging','smtp','imap','pop','ns1','ns2','vpn','ssh','git','docs','support','help','status','login','panel','cpanel','webmail'];
  if (in_array($subdomain, $reserved, true)) {
    return new WP_Error('nl360_subdomain_reserved', 'Subdomain is reserved', ['status' => 422]);
  }
  if (!preg_match('/^[a-z0-9][a-z0-9\-]*[a-z0-9]$/', $subdomain) || strlen($subdomain) < 3 || strlen($subdomain) > 63) {
    return new WP_Error('nl360_subdomain_invalid', 'Invalid subdomain format', ['status' => 422]);
  }
  if (get_id_from_blogname($subdomain)) {
    return new WP_Error('nl360_subdomain_taken', 'Subdomain already taken', ['status' => 409]);
  }

  // Create the subsite
  $domain = $subdomain . '.' . (defined('NL360_SUBSITES_DOMAIN') ? NL360_SUBSITES_DOMAIN : 'nl360.site');
  $blog_id = wpmu_create_blog($domain, '/', $title, $user_id);

  if (is_wp_error($blog_id)) {
    return $blog_id;
  }

  try {
    switch_to_blog($blog_id);

    // Activate Blocksy if allowed
    $allowed_themes = get_site_option('allowedthemes', []);
    if (!isset($allowed_themes['blocksy'])) {
      $allowed_themes['blocksy'] = true;
      update_site_option('allowedthemes', $allowed_themes);
    }
    switch_theme('blocksy');

    // Basic site options
    update_option('blogname', $title);
    update_option('blogdescription', $tagline);
    update_option('permalink_structure', '/%postname%/');
    flush_rewrite_rules(true);

    // Upload logo
    $logo_id = null;
    if ($logo_data) {
      $ext = nl360_mime_to_ext($logo_data);
      $logo_id = nl360_upload_base64_to_media($logo_data, "logo.$ext");
      if ($logo_id && !is_wp_error($logo_id)) {
        set_theme_mod('custom_logo', $logo_id);
      }
    }

    // Upload favicon — fallback al logo si no se provee uno específico
    if ($favicon_data) {
      $ext = nl360_mime_to_ext($favicon_data);
      $favicon_id = nl360_upload_base64_to_media($favicon_data, "favicon.$ext");
      if ($favicon_id && !is_wp_error($favicon_id)) {
        update_option('site_icon', $favicon_id);
      }
    } elseif ($logo_id && !is_wp_error($logo_id)) {
      update_option('site_icon', $logo_id);
    }

    // Color palette (Blocksy format)
    if (!empty($colors)) {
      $palette = [];
      $color_keys = ['color1','color2','color3','color4','color5','color6','color7'];
      foreach ($color_keys as $i => $key) {
        if (isset($colors[$i])) {
          $palette[$key] = ['color' => $colors[$i]];
        }
      }
      if (!empty($palette)) {
        set_theme_mod('colorPalette', $palette);
      }
    }

    // Blocksy extended customization from brandbook
    $tone   = strtolower($brandbook_data['tone'] ?? '');
    $radius = nl360_tone_to_radius($tone);

    set_theme_mod('buttonsBorderRadius', [
      'desktop' => [
        'top_left'     => $radius,
        'top_right'    => $radius,
        'bottom_right' => $radius,
        'bottom_left'  => $radius,
      ],
    ]);

    // Map palette color 1 as the global accent/link color
    if (!empty($colors[0])) {
      set_theme_mod('linkColor', [
        'default' => ['color' => $colors[0]],
      ]);
    }

    // Create pages
    $first_page_id = null;
    $nav_page_ids  = [];

    if (empty($pages)) {
      $pages = [
        ['title' => 'Inicio', 'slug' => 'inicio'],
        ['title' => 'Nosotros', 'slug' => 'nosotros'],
        ['title' => 'Servicios', 'slug' => 'servicios'],
        ['title' => 'Contacto', 'slug' => 'contacto'],
      ];
    }

    foreach ($pages as $idx => $page_def) {
      if (is_string($page_def)) {
        $page_title = sanitize_text_field($page_def) ?: "Página " . ($idx + 1);
        $page_slug  = sanitize_title($page_title);
      } else {
        $page_title = sanitize_text_field($page_def['title'] ?? "Página " . ($idx + 1));
        $page_slug  = sanitize_title($page_def['slug'] ?? $page_title);
      }

      // First page gets a full home content based on the brandbook
      $page_content = ($idx === 0) ? nl360_build_home_content($brandbook_data, $title) : '';

      $page_id = wp_insert_post([
        'post_title'   => $page_title,
        'post_name'    => $page_slug,
        'post_status'  => 'publish',
        'post_type'    => 'page',
        'post_author'  => $user_id,
        'post_content' => $page_content,
      ]);

      if ($page_id && !is_wp_error($page_id)) {
        $nav_page_ids[] = $page_id;
        if ($first_page_id === null) {
          $first_page_id = $page_id;
        }
      }
    }

    // Set home page
    if ($first_page_id) {
      update_option('show_on_front', 'page');
      update_option('page_on_front', $first_page_id);
    }

    // Create navigation menu
    $menu_name = 'Menu Principal';
    $menu_id   = wp_create_nav_menu($menu_name);

    if ($menu_id && !is_wp_error($menu_id)) {
      foreach ($nav_page_ids as $pid) {
        wp_update_nav_menu_item($menu_id, 0, [
          'menu-item-object-id' => $pid,
          'menu-item-object'    => 'page',
          'menu-item-type'      => 'post_type',
          'menu-item-status'    => 'publish',
        ]);
      }

      $locations = get_theme_mod('nav_menu_locations', []);
      $locations['primary'] = $menu_id;
      set_theme_mod('nav_menu_locations', $locations);
    }

    // WooCommerce setup
    if ($needs_woocommerce) {
      nl360_setup_woocommerce($user_id);
    }

    // Link brandbook to this site
    if ($brandbook_id !== null) {
      global $wpdb;
      $main_prefix = $wpdb->base_prefix;
      $wpdb->update(
        $main_prefix . 'nl360_brandbooks',
        ['site_id' => $blog_id, 'status' => 'active'],
        ['id' => $brandbook_id, 'user_id' => $user_id]
      );
    }

  } finally {
    restore_current_blog();
  }

  $site_url  = get_blog_option($blog_id, 'siteurl');
  $admin_url = $site_url . '/wp-admin/';

  return [
    'ok'        => true,
    'blog_id'   => $blog_id,
    'site_url'  => $site_url,
    'admin_url' => $admin_url,
    'subdomain' => $subdomain,
  ];
}

/* ─────────────────────────────────────────────
   Helper: upload base64/data-URL to media library
───────────────────────────────────────────── */
function nl360_upload_base64_to_media(string $data_url, string $filename): int|WP_Error {
  require_once ABSPATH . 'wp-admin/includes/file.php';
  require_once ABSPATH . 'wp-admin/includes/media.php';
  require_once ABSPATH . 'wp-admin/includes/image.php';

  $is_svg = str_starts_with($data_url, 'data:image/svg');

  if ($is_svg) {
    // SVG may be data:image/svg+xml;utf8, or base64
    if (str_contains($data_url, ';base64,')) {
      $raw = base64_decode(explode(',', $data_url, 2)[1] ?? '');
    } else {
      $raw = rawurldecode(explode(',', $data_url, 2)[1] ?? '');
    }
  } else {
    $raw = base64_decode(explode(',', $data_url, 2)[1] ?? '');
  }

  if (!$raw) {
    return new WP_Error('nl360_upload_empty', 'Empty image data');
  }

  $tmp = wp_tempnam($filename);
  file_put_contents($tmp, $raw);

  // Allow SVG upload temporarily
  $allow_svg = function($mimes) {
    $mimes['svg'] = 'image/svg+xml';
    return $mimes;
  };
  add_filter('upload_mimes', $allow_svg);

  $file_array = ['name' => $filename, 'tmp_name' => $tmp];
  $attach_id  = media_handle_sideload($file_array, 0);

  remove_filter('upload_mimes', $allow_svg);
  @unlink($tmp);

  return $attach_id;
}

/* ─────────────────────────────────────────────
   Helper: detect extension from data URL
───────────────────────────────────────────── */
function nl360_mime_to_ext(string $data_url): string {
  if (str_contains($data_url, 'image/svg'))  return 'svg';
  if (str_contains($data_url, 'image/png'))  return 'png';
  if (str_contains($data_url, 'image/webp')) return 'webp';
  if (str_contains($data_url, 'image/jpeg')) return 'jpg';
  return 'png';
}

/* ─────────────────────────────────────────────
   Helper: fetch brandbook data_json from main site DB
───────────────────────────────────────────── */
function nl360_fetch_brandbook_data(?int $brandbook_id, int $user_id): array {
  if (!$brandbook_id) return [];
  global $wpdb;
  $row = $wpdb->get_row($wpdb->prepare(
    "SELECT data_json FROM {$wpdb->base_prefix}nl360_brandbooks WHERE id = %d AND user_id = %d",
    $brandbook_id, $user_id
  ));
  if (!$row || !$row->data_json) return [];
  return json_decode($row->data_json, true) ?: [];
}

/* ─────────────────────────────────────────────
   Helper: map brandbook tone to button border-radius
───────────────────────────────────────────── */
function nl360_tone_to_radius(string $tone): int {
  $rounded = ['amigable','casual','divertido','juvenil','creativo','fresco','playful','fun','friendly'];
  $sharp   = ['moderno','minimalista','tech','digital','minimal','modern','innovador','clean'];
  foreach ($rounded as $kw) { if (str_contains($tone, $kw)) return 8; }
  foreach ($sharp   as $kw) { if (str_contains($tone, $kw)) return 0; }
  return 4;
}

/* ─────────────────────────────────────────────
   Helper: build home page Gutenberg block content
───────────────────────────────────────────── */
function nl360_build_home_content(array $bb, string $brand_name): string {
  $tagline   = esc_html($bb['tagline'] ?? '');
  $copy      = $bb['sample_copy'] ?? [];
  $intro     = esc_html($copy[0] ?? '');
  $about     = esc_html($copy[1] ?? '');
  $brand_esc = esc_html($brand_name);

  $blocks = '';

  // Hero section
  if ($tagline) {
    $blocks .= '<!-- wp:group {"style":{"spacing":{"padding":{"top":"5rem","bottom":"5rem"}}},"layout":{"type":"constrained"}} -->' . "\n";
    $blocks .= '<div class="wp-block-group" style="padding-top:5rem;padding-bottom:5rem">' . "\n";
    $blocks .= '<!-- wp:heading {"textAlign":"center","level":1} -->' . "\n";
    $blocks .= '<h1 class="wp-block-heading has-text-align-center">' . $tagline . '</h1>' . "\n";
    $blocks .= '<!-- /wp:heading -->' . "\n";
    if ($intro) {
      $blocks .= '<!-- wp:paragraph {"align":"center"} -->' . "\n";
      $blocks .= '<p class="has-text-align-center">' . $intro . '</p>' . "\n";
      $blocks .= '<!-- /wp:paragraph -->' . "\n";
    }
    $blocks .= '<!-- wp:buttons {"layout":{"type":"flex","justifyContent":"center"}} -->' . "\n";
    $blocks .= '<div class="wp-block-buttons"><!-- wp:button -->' . "\n";
    $blocks .= '<div class="wp-block-button"><a class="wp-block-button__link wp-element-button">Conocer más</a></div>' . "\n";
    $blocks .= '<!-- /wp:button --></div>' . "\n";
    $blocks .= '<!-- /wp:buttons -->' . "\n";
    $blocks .= '</div>' . "\n";
    $blocks .= '<!-- /wp:group -->' . "\n";
  }

  // About section
  $about_text = $about ?: 'Bienvenido a ' . $brand_esc . '.';
  $blocks .= '<!-- wp:group {"style":{"spacing":{"padding":{"top":"4rem","bottom":"4rem"}}},"layout":{"type":"constrained"}} -->' . "\n";
  $blocks .= '<div class="wp-block-group" style="padding-top:4rem;padding-bottom:4rem">' . "\n";
  $blocks .= '<!-- wp:heading {"textAlign":"center","level":2} -->' . "\n";
  $blocks .= '<h2 class="wp-block-heading has-text-align-center">Quiénes somos</h2>' . "\n";
  $blocks .= '<!-- /wp:heading -->' . "\n";
  $blocks .= '<!-- wp:paragraph {"align":"center"} -->' . "\n";
  $blocks .= '<p class="has-text-align-center">' . $about_text . '</p>' . "\n";
  $blocks .= '<!-- /wp:paragraph -->' . "\n";
  $blocks .= '</div>' . "\n";
  $blocks .= '<!-- /wp:group -->' . "\n";

  return $blocks;
}

/* ─────────────────────────────────────────────
   Helper: activate WooCommerce and create its pages
───────────────────────────────────────────── */
function nl360_setup_woocommerce(int $user_id): void {
  include_once ABSPATH . 'wp-admin/includes/plugin.php';

  $wc_plugin = 'woocommerce/woocommerce.php';
  if (function_exists('is_plugin_active') && !is_plugin_active($wc_plugin)) {
    activate_plugin($wc_plugin);
  }

  $wc_pages = [
    'shop'      => ['title' => 'Tienda',            'content' => '',                                'option' => 'woocommerce_shop_page_id'],
    'cart'      => ['title' => 'Carrito',            'content' => '<!-- wp:woocommerce/cart /-->',   'option' => 'woocommerce_cart_page_id'],
    'checkout'  => ['title' => 'Finalizar compra',   'content' => '<!-- wp:woocommerce/checkout /-->','option' => 'woocommerce_checkout_page_id'],
    'myaccount' => ['title' => 'Mi cuenta',          'content' => '[woocommerce_my_account]',        'option' => 'woocommerce_myaccount_page_id'],
  ];

  foreach ($wc_pages as $slug => $data) {
    if (get_option($data['option'])) continue;
    $page_id = wp_insert_post([
      'post_title'   => $data['title'],
      'post_name'    => $slug,
      'post_status'  => 'publish',
      'post_type'    => 'page',
      'post_author'  => $user_id,
      'post_content' => $data['content'],
    ]);
    if ($page_id && !is_wp_error($page_id)) {
      update_option($data['option'], $page_id);
    }
  }

  update_option('woocommerce_currency', 'USD');
  update_option('woocommerce_calc_taxes', 'no');
  update_option('woocommerce_enable_signup_and_login_from_checkout', 'yes');
}
