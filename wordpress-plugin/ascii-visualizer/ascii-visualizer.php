<?php
/**
 * Plugin Name:       ASCII Visualizer
 * Plugin URI:        https://github.com/AngeloSemeraro/ASCII-Visualizer
 * Description:        Real-time webcam → ASCII art filter via the [ascii_visualizer] shortcode. Runs entirely in the visitor's browser; the camera stream never leaves the device.
 * Version:           1.1.0
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

define( 'ASCII_VISUALIZER_VERSION', '1.1.0' );
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
 *   columns    - target column count (default 240)
 *   color      - color | mono | inverted (default mono)
 *   phrase     - sentence to build the image from (empty = use the ramp)
 *   preset     - charset name (ramp fallback): standard | detailed | blocks | minimal | binary
 *   controls   - show the control panel: true | false (default true)
 *   autostart  - start the camera on load: true | false (default false)
 *   background - display background color
 *   foreground - foreground color (mono / inverted modes)
 *   height     - fixed display height (CSS length, e.g. 480px); canvas fits inside
 *   maxwidth   - max widget width (CSS length, e.g. 960px)
 *   ghost      - motion-only filter: true | false
 *   crt        - CRT scanline + vignette filter: true | false
 *   slitscan   - slit-scan time-warp filter: true | false
 *   glitch     - glitch-burst filter: true | false
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
			'ghost'      => 'false',
			'crt'        => 'false',
			'slitscan'   => 'false',
			'glitch'     => 'false',
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

	// Optional string attributes: only emit when provided.
	foreach ( array( 'background', 'foreground', 'height', 'maxwidth' ) as $key ) {
		if ( '' !== $atts[ $key ] ) {
			$data_attrs[ 'data-' . $key ] = $atts[ $key ];
		}
	}

	// Filter toggles: only emit when enabled.
	foreach ( array( 'ghost', 'crt', 'slitscan', 'glitch' ) as $key ) {
		if ( 'true' === strtolower( (string) $atts[ $key ] ) ) {
			$data_attrs[ 'data-' . $key ] = 'true';
		}
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

/**
 * Add the "ASCII Visualizer" builder page under the Settings menu.
 */
function ascii_visualizer_admin_menu() {
	$hook = add_options_page(
		__( 'ASCII Visualizer', 'ascii-visualizer' ),
		__( 'ASCII Visualizer', 'ascii-visualizer' ),
		'manage_options',
		'ascii-visualizer',
		'ascii_visualizer_render_settings_page'
	);

	// Load the widget bundle only on our builder page (for the live preview).
	add_action(
		'admin_print_scripts-' . $hook,
		function () {
			wp_enqueue_script(
				'ascii-visualizer',
				ASCII_VISUALIZER_URL . 'assets/ascii-visualizer.js',
				array(),
				ASCII_VISUALIZER_VERSION,
				true
			);
		}
	);
}
add_action( 'admin_menu', 'ascii_visualizer_admin_menu' );

/**
 * Convenience "Settings" link on the Plugins list row.
 *
 * @param array $links Existing action links.
 * @return array
 */
function ascii_visualizer_action_links( $links ) {
	$url  = admin_url( 'options-general.php?page=ascii-visualizer' );
	$link = '<a href="' . esc_url( $url ) . '">' . esc_html__( 'Shortcode builder', 'ascii-visualizer' ) . '</a>';
	array_unshift( $links, $link );
	return $links;
}
add_filter( 'plugin_action_links_' . plugin_basename( __FILE__ ), 'ascii_visualizer_action_links' );

/**
 * Render the shortcode builder: a form of every option, a live preview, and a
 * ready-to-paste shortcode that updates as you edit. Everything is client-side;
 * nothing is saved server-side.
 */
function ascii_visualizer_render_settings_page() {
	if ( ! current_user_can( 'manage_options' ) ) {
		return;
	}
	echo '<div class="wrap">';
	echo '<h1>' . esc_html__( 'ASCII Visualizer — Shortcode builder', 'ascii-visualizer' ) . '</h1>';
	echo '<p>' . esc_html__( 'Configure the widget below, copy the generated shortcode, and paste it into any page or post. The camera needs an HTTPS page and runs entirely in the visitor\'s browser.', 'ascii-visualizer' ) . '</p>';

	// The markup + client-side generator. NOWDOC keeps JS $ signs literal.
	echo <<<'HTML'
<style>
  .asciiv-builder { display:flex; flex-wrap:wrap; gap:24px; align-items:flex-start; }
  .asciiv-builder .asciiv-form { flex:1 1 320px; max-width:420px; }
  .asciiv-builder .asciiv-side { flex:1 1 420px; min-width:320px; }
  .asciiv-builder label { display:block; margin:10px 0 4px; font-weight:600; }
  .asciiv-builder input[type=text], .asciiv-builder input[type=number], .asciiv-builder select { width:100%; max-width:340px; }
  .asciiv-builder .asciiv-checks { display:flex; flex-wrap:wrap; gap:14px; margin-top:12px; }
  .asciiv-builder .asciiv-checks label { display:flex; align-items:center; gap:6px; font-weight:500; margin:0; }
  .asciiv-out { width:100%; font-family:monospace; font-size:13px; padding:10px; box-sizing:border-box; }
  .asciiv-preview { background:#070a10; border:1px solid #ccd0d4; border-radius:8px; padding:12px; }
</style>
<div class="asciiv-builder">
  <div class="asciiv-form">
    <label for="av-columns">Columns (detail)</label>
    <input type="number" id="av-columns" value="240" min="40" max="400" step="1">

    <label for="av-color">Color mode</label>
    <select id="av-color">
      <option value="mono" selected>mono</option>
      <option value="color">color</option>
      <option value="inverted">inverted</option>
    </select>

    <label for="av-phrase">Phrase (leave blank to use a charset ramp)</label>
    <input type="text" id="av-phrase" value="sono una terapia">

    <label for="av-preset">Charset (ramp fallback)</label>
    <select id="av-preset">
      <option value="binary" selected>binary</option>
      <option value="standard">standard</option>
      <option value="detailed">detailed</option>
      <option value="blocks">blocks</option>
      <option value="minimal">minimal</option>
    </select>

    <label for="av-height">Height (e.g. 480px, 60vh — blank = auto)</label>
    <input type="text" id="av-height" value="" placeholder="auto">

    <label for="av-maxwidth">Max width (e.g. 900px — blank = full)</label>
    <input type="text" id="av-maxwidth" value="" placeholder="full width">

    <label for="av-bg">Background color</label>
    <input type="text" id="av-bg" value="" placeholder="#0b0e14">

    <label for="av-fg">Foreground color (mono / inverted)</label>
    <input type="text" id="av-fg" value="" placeholder="#e6edf3">

    <div class="asciiv-checks">
      <label><input type="checkbox" id="av-controls" checked> Controls</label>
      <label><input type="checkbox" id="av-autostart"> Autostart</label>
      <label><input type="checkbox" id="av-ghost"> Ghost</label>
      <label><input type="checkbox" id="av-crt"> CRT</label>
      <label><input type="checkbox" id="av-slitscan"> Slit-scan</label>
      <label><input type="checkbox" id="av-glitch"> Glitch</label>
    </div>
  </div>

  <div class="asciiv-side">
    <label for="av-shortcode">Shortcode (copy &amp; paste)</label>
    <textarea id="av-shortcode" class="asciiv-out" rows="2" readonly onclick="this.select()"></textarea>
    <p>
      <button type="button" class="button button-primary" id="av-copy">Copy shortcode</button>
      <button type="button" class="button" id="av-refresh">Load / refresh preview</button>
      <span id="av-copied" style="margin-left:8px;color:#1a7f37;display:none;">Copied!</span>
    </p>
    <label>Live preview</label>
    <div class="asciiv-preview" id="av-preview"></div>
    <p class="description">Click <strong>Start</strong> in the preview to grant the camera. Requires an HTTPS admin URL.</p>
  </div>
</div>
<script>
(function () {
  var ids = ['columns','color','phrase','preset','height','maxwidth','bg','fg','controls','autostart','ghost','crt','slitscan','glitch'];
  var el = {};
  ids.forEach(function (k) { el[k] = document.getElementById('av-' + k); });
  var out = document.getElementById('av-shortcode');
  var previewHost = document.getElementById('av-preview');
  var handle = null;

  function read() {
    return {
      columns: parseInt(el.columns.value, 10) || 240,
      color: el.color.value,
      phrase: el.phrase.value,
      preset: el.preset.value,
      height: el.height.value.trim(),
      maxwidth: el.maxwidth.value.trim(),
      bg: el.bg.value.trim(),
      fg: el.fg.value.trim(),
      controls: el.controls.checked,
      autostart: el.autostart.checked,
      ghost: el.ghost.checked,
      crt: el.crt.checked,
      slitscan: el.slitscan.checked,
      glitch: el.glitch.checked
    };
  }

  function shortcode(v) {
    var parts = ['ascii_visualizer'];
    var add = function (k, val) { parts.push(k + '="' + val + '"'); };
    if (v.columns !== 240) add('columns', v.columns);
    if (v.color !== 'mono') add('color', v.color);
    if (v.phrase !== 'sono una terapia') add('phrase', v.phrase);
    if (v.preset !== 'binary') add('preset', v.preset);
    if (!v.controls) add('controls', 'false');
    if (v.autostart) add('autostart', 'true');
    if (v.bg) add('background', v.bg);
    if (v.fg) add('foreground', v.fg);
    if (v.height) add('height', v.height);
    if (v.maxwidth) add('maxwidth', v.maxwidth);
    if (v.ghost) add('ghost', 'true');
    if (v.crt) add('crt', 'true');
    if (v.slitscan) add('slitscan', 'true');
    if (v.glitch) add('glitch', 'true');
    return '[' + parts.join(' ') + ']';
  }

  function options(v) {
    return {
      controls: v.controls,
      autostart: false,
      columns: v.columns,
      colorMode: v.color,
      phrase: v.phrase,
      charset: v.preset,
      height: v.height || undefined,
      maxWidth: v.maxwidth || undefined,
      background: v.bg || undefined,
      foreground: v.fg || undefined,
      ghost: v.ghost,
      crt: v.crt,
      slitScan: v.slitscan,
      glitch: v.glitch
    };
  }

  function updateShortcode() { out.value = shortcode(read()); }

  function refreshPreview() {
    if (!window.AsciiVisualizer) { return; }
    if (window.AsciiVisualizer.injectStyles) { window.AsciiVisualizer.injectStyles(); }
    if (handle && handle.destroy) { handle.destroy(); }
    previewHost.innerHTML = '';
    handle = window.AsciiVisualizer.createVisualizer(previewHost, options(read()));
  }

  ids.forEach(function (k) {
    el[k].addEventListener('input', updateShortcode);
    el[k].addEventListener('change', updateShortcode);
  });
  document.getElementById('av-refresh').addEventListener('click', refreshPreview);
  document.getElementById('av-copy').addEventListener('click', function () {
    out.select();
    var done = function () {
      var c = document.getElementById('av-copied');
      c.style.display = 'inline';
      setTimeout(function () { c.style.display = 'none'; }, 1500);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(out.value).then(done, function () { document.execCommand('copy'); done(); });
    } else { document.execCommand('copy'); done(); }
  });

  updateShortcode();
  refreshPreview();
})();
</script>
HTML;

	echo '</div>';
}
