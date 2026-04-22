<?php
/**
 * Plugin Name: CF7 GA4 Server-Side Tracking
 * Description: Envoie un événement GA4 via Measurement Protocol lors de l'envoi d'un formulaire Contact Form 7.
 * Version: 1.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

// ─── Configuration ────────────────────────────────────────────────────────────
// Remplacez ces valeurs ou définissez-les dans wp-config.php :
//   define( 'GA4_MEASUREMENT_ID', 'G-XXXXXXXXXX' );
//   define( 'GA4_API_SECRET',     'xxxxxxxxxxxxxxxxxxxx' );
//
// L'API Secret se crée dans GA4 :
//   Admin → Flux de données → (votre flux) → Measurement Protocol API secrets

define( 'CF7_GA4_MEASUREMENT_ID', defined( 'GA4_MEASUREMENT_ID' ) ? GA4_MEASUREMENT_ID : 'G-XXXXXXXXXX' );
define( 'CF7_GA4_API_SECRET',     defined( 'GA4_API_SECRET' )     ? GA4_API_SECRET     : 'VOTRE_API_SECRET' );

// IDs de formulaires CF7 et nom d'événement associé.
// Clé = ID du formulaire CF7 (visible dans WP Admin → Contact → Formulaires).
// Valeur = nom de l'événement GA4 (snake_case, max 40 caractères).
$cf7_ga4_form_map = [
    1 => 'contact_us_form_submit',   // formulaire "Nous contacter"
    2 => 'job_application_submit',   // formulaire "Candidature"
];

// ─── Hook CF7 ─────────────────────────────────────────────────────────────────

add_action( 'wpcf7_mail_sent', 'cf7_ga4_send_event' );

function cf7_ga4_send_event( $contact_form ) {
    global $cf7_ga4_form_map;

    $form_id    = (int) $contact_form->id();
    $event_name = $cf7_ga4_form_map[ $form_id ] ?? 'cf7_form_submit';

    // Récupère le client_id depuis le cookie GA4 (_ga), sinon génère un ID aléatoire.
    $client_id = cf7_ga4_get_client_id();

    $endpoint = sprintf(
        'https://www.google-analytics.com/mp/collect?measurement_id=%s&api_secret=%s',
        rawurlencode( CF7_GA4_MEASUREMENT_ID ),
        rawurlencode( CF7_GA4_API_SECRET )
    );

    $payload = [
        'client_id' => $client_id,
        'events'    => [
            [
                'name'   => $event_name,
                'params' => [
                    'form_id'    => $form_id,
                    'form_title' => $contact_form->title(),
                    // Ajoute d'autres paramètres ici si nécessaire.
                ],
            ],
        ],
    ];

    $response = wp_remote_post( $endpoint, [
        'headers'     => [ 'Content-Type' => 'application/json' ],
        'body'        => wp_json_encode( $payload ),
        'timeout'     => 5,
        'blocking'    => false, // non-bloquant : n'impacte pas la vitesse du site
        'data_format' => 'body',
    ] );

    // En mode debug : loguer les erreurs dans le log WordPress.
    if ( defined( 'WP_DEBUG' ) && WP_DEBUG && is_wp_error( $response ) ) {
        error_log( '[CF7 GA4] Erreur Measurement Protocol : ' . $response->get_error_message() );
    }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Extrait le client_id GA4 depuis le cookie _ga (format GA1.X.XXXXXXXXXX.XXXXXXXXXX).
 * Retourne un UUID v4 aléatoire si le cookie est absent.
 */
function cf7_ga4_get_client_id() {
    if ( ! empty( $_COOKIE['_ga'] ) ) {
        $parts = explode( '.', sanitize_text_field( wp_unslash( $_COOKIE['_ga'] ) ) );
        if ( count( $parts ) >= 4 ) {
            return $parts[2] . '.' . $parts[3];
        }
    }

    // Fallback : identifiant aléatoire (pas rattaché à une session navigateur).
    return sprintf(
        '%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
        mt_rand( 0, 0xffff ), mt_rand( 0, 0xffff ),
        mt_rand( 0, 0xffff ),
        mt_rand( 0, 0x0fff ) | 0x4000,
        mt_rand( 0, 0x3fff ) | 0x8000,
        mt_rand( 0, 0xffff ), mt_rand( 0, 0xffff ), mt_rand( 0, 0xffff )
    );
}
