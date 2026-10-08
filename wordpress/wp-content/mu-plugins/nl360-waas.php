<?php
/**
 * Plugin Name: NL360 WaaS Core
 * Description: API para crear sitios, subir logos y configurar Blocksy automáticamente.
 * Version: 2.1
 * Author: NL360
 */

if ( ! defined( 'ABSPATH' ) ) { exit; }


add_action( 'rest_api_init', function () {
    register_rest_route( 'nl360/v1', '/chat-history', array(
        'methods' => 'GET',
        'callback' => 'nl360_get_chat_history',
        'permission_callback' => 'is_user_logged_in',
    ) );

    register_rest_route( 'nl360/v1', '/chat-history', array(
        'methods' => 'POST',
        'callback' => 'nl360_upsert_chat_history',
        'permission_callback' => 'is_user_logged_in',
    ) );
} );

function nl360_get_chat_history( WP_REST_Request $request ) {
    $user_id = get_current_user_id();
    if ( ! $user_id ) {
        return new WP_Error( 'nl360_unauthorized', 'Unauthorized', array( 'status' => 401 ) );
    }

    $items = get_user_meta( $user_id, 'nl360_chat_history', true );
    if ( ! is_array( $items ) ) {
        $items = array();
    }

    return array(
        'ok' => true,
        'items' => array_values( $items ),
    );
}

function nl360_sanitize_messages( $messages ) {
    if ( ! is_array( $messages ) ) {
        return array();
    }

    $clean = array();
    foreach ( $messages as $msg ) {
        if ( ! is_array( $msg ) ) {
            continue;
        }
        $role = isset( $msg['role'] ) ? sanitize_text_field( $msg['role'] ) : '';
        if ( $role !== 'assistant' && $role !== 'user' ) {
            continue;
        }
        $clean[] = array(
            'role' => $role,
            'text' => isset( $msg['text'] ) ? sanitize_textarea_field( $msg['text'] ) : '',
            'time' => isset( $msg['time'] ) ? sanitize_text_field( $msg['time'] ) : '',
        );
    }

    return array_slice( $clean, -200 );
}

function nl360_upsert_chat_history( WP_REST_Request $request ) {
    $user_id = get_current_user_id();
    if ( ! $user_id ) {
        return new WP_Error( 'nl360_unauthorized', 'Unauthorized', array( 'status' => 401 ) );
    }

    $params = $request->get_json_params();
    if ( ! is_array( $params ) ) {
        return new WP_Error( 'invalid_json', 'JSON inválido o ausente', array( 'status' => 400 ) );
    }

    $items = get_user_meta( $user_id, 'nl360_chat_history', true );
    if ( ! is_array( $items ) ) {
        $items = array();
    }

    $id = isset( $params['id'] ) ? sanitize_text_field( $params['id'] ) : '';
    if ( empty( $id ) ) {
        $id = wp_generate_uuid4();
    }

    $item = array(
        'id' => $id,
        'title' => isset( $params['title'] ) ? sanitize_text_field( $params['title'] ) : 'Chat',
        'last_message' => isset( $params['last_message'] ) ? sanitize_textarea_field( $params['last_message'] ) : '',
        'last_message_at' => isset( $params['last_message_at'] ) ? sanitize_text_field( $params['last_message_at'] ) : current_time( 'mysql' ),
        'site_built' => isset( $params['site_built'] ) ? (bool) $params['site_built'] : false,
        'site_url' => isset( $params['site_url'] ) ? esc_url_raw( $params['site_url'] ) : '',
        'messages' => nl360_sanitize_messages( isset( $params['messages'] ) ? $params['messages'] : array() ),
    );

    $found = false;
    foreach ( $items as $index => $existing ) {
        if ( isset( $existing['id'] ) && $existing['id'] === $id ) {
            $items[ $index ] = $item;
            $found = true;
            break;
        }
    }

    if ( ! $found ) {
        array_unshift( $items, $item );
    }

    $items = array_slice( $items, 0, 20 );
    update_user_meta( $user_id, 'nl360_chat_history', $items );

    return array(
        'ok' => true,
        'item' => $item,
    );
}

