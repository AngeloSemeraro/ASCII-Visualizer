<?php
/**
 * Plugin Name:       ASCII Visualizer
 * Plugin URI:        https://github.com/AngeloSemeraro/ASCII-Visualizer
 * Description:        Real-time webcam → ASCII art filter via the [ascii_visualizer] shortcode. Runs entirely in the visitor's browser; the camera stream never leaves the device.
 * Version:           1.0.0
 * Requires at least: 5.8
 * Requires PHP:      7.2
 * Author:            Angelo Semeraro
 * License:           MIT
 * License URI:       https://opensource.org/licenses/MIT
 * Text Domain:       ascii-visualizer
 *
 * @package AsciiVisualizer
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit; // No direct access.
}

define( 'ASCII_VISUALIZER_VERSION', '1.0.0' );
define( 'ASCII_VISUALIZER_URL', plugin_dir_url( __FILE__ ) );

/**
 * Register (but do not enqueue) the prebuilt embed bundle. The self-mounting
 * IIFE injects its own scoped CSS, so no separate stylesheet is required.
 */
function ascii_visualizer_register_assets() {
	wp_register_script(
		'ascii-visualizer',
		ASCII_VISUALIZER_URL . 'assets/ascii-visualizer.js',
		array(),
		ASCII_VISUALIZER_VERSION,
		true
	);
}
add_action( 'wp_enqueue_scripts', 'ascii_visualizer_register_assets' );

/**
 * Render the [ascii_visualizer] shortcode.
 *
 * Supported attributes:
 *   columns    - target column count (default 120)
 *   color      - color | mono | inverted (default color)
 *   preset     - charset name (ramp fallback): standard | detailed | blocks | minimal | binary
 *   phrase     - sentence to build the image from (empty = use the ramp)
 *   controls   - show the control panel: true | false (default true)
 *   autostart  - start the camera on load: true | false (default false)
 *   background - display background color
 *   foreground - foreground color (mono / inverted modes)
 *   height     - min stage height (CSS length, e.g. 360px)
 *   maxwidth   - max widget width (CSS length, e.g. 960px)
 *
 * @param array $atts Shortcode attributes.
 * @return string HTML markup.
 */
function ascii_visualizer_shortcode( $atts ) {
	$atts = shortcode_atts(
		array(
			'columns'    => '240',
			'color'      => 'mono',
			'preset'     => 'binary',
			'phrase'     => 'sono una terapia',
			'controls'   => 'true',
			'autostart'  => 'false',
			'background' => '',
			'foreground' => '',
			'height'     => '',
			'maxwidth'   => '',
		),
		$atts,
		'ascii_visualizer'
	);

	// Ensure the embed script loads on pages that actually use the shortcode.
	wp_enqueue_script( 'ascii-visualizer' );

	$data_attrs = array(
		'data-ascii-visualizer' => '',
		'data-columns'          => $atts['columns'],
		'data-color'            => $atts['color'],
		'data-preset'           => $atts['preset'],
		'data-phrase'           => $atts['phrase'],
		'data-controls'         => $atts['controls'],
		'data-autostart'        => $atts['autostart'],
	);

	if ( '' !== $atts['background'] ) {
		$data_attrs['data-background'] = $atts['background'];
	}
	if ( '' !== $atts['foreground'] ) {
		$data_attrs['data-foreground'] = $atts['foreground'];
	}
	if ( '' !== $atts['height'] ) {
		$data_attrs['data-height'] = $atts['height'];
	}
	if ( '' !== $atts['maxwidth'] ) {
		$data_attrs['data-maxwidth'] = $atts['maxwidth'];
	}

	$attr_html = '';
	foreach ( $data_attrs as $name => $value ) {
		if ( '' === $value ) {
			$attr_html .= ' ' . esc_attr( $name );
		} else {
			$attr_html .= ' ' . esc_attr( $name ) . '="' . esc_attr( $value ) . '"';
		}
	}

	return '<div class="ascii-visualizer-shortcode"' . $attr_html . '></div>';
}
add_shortcode( 'ascii_visualizer', 'ascii_visualizer_shortcode' );
