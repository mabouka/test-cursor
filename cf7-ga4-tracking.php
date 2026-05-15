<?php
/**
 * Plugin Name: CF7 GA4 Server-Side Tracking
 * Description: Envoie un événement GA4 via Measurement Protocol lors de l'envoi d'un formulaire Contact Form 7.
 * Version: 1.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

// ─── Vérification des prérequis ───────────────────────────────────────────────

function cf7_ga4_is_configured() {
    return defined( 'GA4_MEASUREMENT_ID' )
        && defined( 'GA4_API_SECRET' )
        && GA4_MEASUREMENT_ID !== 'G-XXXXXXXXXX'
        && GA4_API_SECRET     !== '';
}

// Bloque l'activation si les constantes sont absentes.
register_activation_hook( __FILE__, function () {
    if ( ! cf7_ga4_is_configured() ) {
        deactivate_plugins( plugin_basename( __FILE__ ) );
        wp_die(
            '<strong>CF7 GA4 Tracking</strong> : veuillez d\'abord ajouter dans <code>wp-config.php</code> :<br><br>'
            . '<code>define( \'GA4_MEASUREMENT_ID\', \'G-XXXXXXXXXX\' );</code><br>'
            . '<code>define( \'GA4_API_SECRET\',     \'votre_secret\' );</code>',
            'Activation impossible',
            [ 'back_link' => true ]
        );
    }
} );

// Affiche une notice admin si les constantes sont supprimées après activation.
add_action( 'admin_notices', function () {
    if ( ! cf7_ga4_is_configured() ) {
        echo '<div class="notice notice-error"><p>'
            . '<strong>CF7 GA4 Tracking</strong> : les constantes <code>GA4_MEASUREMENT_ID</code> et <code>GA4_API_SECRET</code> sont manquantes dans <code>wp-config.php</code>. Le tracking est désactivé.'
            . '</p></div>';
    }
} );

// N'enregistre le hook CF7 que si la configuration est valide.
if ( ! cf7_ga4_is_configured() ) {
    return;
}

// ─── Configuration ────────────────────────────────────────────────────────────

define( 'CF7_GA4_MEASUREMENT_ID', GA4_MEASUREMENT_ID );
define( 'CF7_GA4_API_SECRET',     GA4_API_SECRET );

// Nom du champ radio dans CF7 (attribut "name" de la balise [radio ...]).
define( 'CF7_GA4_RADIO_FIELD', 'enquiry-type' );

// Correspondance valeur soumise → [ event_name, label lisible pour GA4 ].
// La valeur soumise est la partie APRÈS le pipe "|" dans le shortcode CF7 :
//   "Collaboration on a project|lead_website@mojo-v2.ddev.site"  → lead_website@...
//   "An application for a job or an internship|jobs@mojo-v2.ddev.site" → jobs@...
$cf7_ga4_radio_event_map = [
    'lead_website@mojo-v2.ddev.site' => [
        'event' => 'contact_us_form_submit',
        'label' => 'Collaboration on a project',
    ],
    'jobs@mojo-v2.ddev.site' => [
        'event' => 'job_application_submit',
        'label' => 'An application for a job or an internship',
    ],
];

// ─── Hook CF7 ─────────────────────────────────────────────────────────────────

add_action( 'wpcf7_mail_sent', 'cf7_ga4_send_event' );

function cf7_ga4_send_event( $contact_form ) {
    global $cf7_ga4_radio_event_map;

    $form_id    = (int) $contact_form->id();
    $submission = WPCF7_Submission::get_instance();

    // Lit la valeur soumise par le radio button.
    $radio_value = '';
    if ( $submission ) {
        $raw = $submission->get_posted_data( CF7_GA4_RADIO_FIELD );
        // CF7 retourne parfois un tableau même pour les radios.
        $radio_value = is_array( $raw ) ? sanitize_text_field( $raw[0] ?? '' )
                                        : sanitize_text_field( (string) $raw );
    }

    // Détermine le nom d'événement et le label lisible selon la valeur du radio.
    $mapping    = $cf7_ga4_radio_event_map[ $radio_value ] ?? null;
    $event_name = $mapping['event'] ?? 'cf7_form_submit';
    $label      = $mapping['label'] ?? $radio_value;

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
                    'form_id'      => $form_id,
                    'form_title'   => $contact_form->title(),
                    'enquiry_type' => $label,
                ],
            ],
        ],
    ];

    $response = wp_remote_post( $endpoint, [
        'headers'     => [ 'Content-Type' => 'application/json' ],
        'body'        => wp_json_encode( $payload ),
        'timeout'     => 5,
        'blocking'    => false,
        'data_format' => 'body',
    ] );

    if ( defined( 'WP_DEBUG' ) && WP_DEBUG && is_wp_error( $response ) ) {
        error_log( '[CF7 GA4] Erreur Measurement Protocol : ' . $response->get_error_message() );
    }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function cf7_ga4_get_client_id() {
    if ( ! empty( $_COOKIE['_ga'] ) ) {
        $parts = explode( '.', sanitize_text_field( wp_unslash( $_COOKIE['_ga'] ) ) );
        if ( count( $parts ) >= 4 ) {
            return $parts[2] . '.' . $parts[3];
        }
    }

    return sprintf(
        '%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
        mt_rand( 0, 0xffff ), mt_rand( 0, 0xffff ),
        mt_rand( 0, 0xffff ),
        mt_rand( 0, 0x0fff ) | 0x4000,
        mt_rand( 0, 0x3fff ) | 0x8000,
        mt_rand( 0, 0xffff ), mt_rand( 0, 0xffff ), mt_rand( 0, 0xffff )
    );
}
