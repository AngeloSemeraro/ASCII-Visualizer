=== ASCII Visualizer ===
Contributors: angelosemeraro
Tags: webcam, ascii, art, camera, filter, canvas
Requires at least: 5.8
Tested up to: 6.7
Requires PHP: 7.2
Stable tag: 1.1.0
License: MIT
License URI: https://opensource.org/licenses/MIT

Real-time webcam to ASCII art filter via a shortcode. Runs entirely in the visitor's browser; the camera stream never leaves the device.

== Description ==

ASCII Visualizer turns a live webcam feed into ASCII art, in real time, directly
in the browser. There is no server component and nothing is uploaded — the
camera stream is sampled and rendered locally on the visitor's device.

Add it anywhere with the shortcode:

`[ascii_visualizer]`

= Shortcode attributes =

* `columns` — target column count (default `120`)
* `color` — `color`, `mono`, or `inverted` (default `color`)
* `preset` — charset: `standard`, `detailed`, `blocks`, `minimal`, `binary`
* `controls` — show the control panel: `true` / `false` (default `true`)
* `autostart` — start the camera on load: `true` / `false` (default `false`)
* `background` — display background color
* `foreground` — foreground color (mono / inverted modes)
* `height` — minimum stage height (CSS length, e.g. `360px`)
* `maxwidth` — maximum widget width (CSS length, e.g. `960px`)

Example:

`[ascii_visualizer columns="140" color="mono" preset="detailed" autostart="false"]`

== Privacy ==

The webcam feed is processed entirely in the visitor's browser using the
standard getUserMedia API. No frames, snapshots, or ASCII output are transmitted
to any server.

== Installation ==

1. Upload the `ascii-visualizer` folder to `/wp-content/plugins/`.
2. Activate the plugin through the "Plugins" menu in WordPress.
3. Add the `[ascii_visualizer]` shortcode to any post or page.

== Frequently Asked Questions ==

= Does this send my camera anywhere? =

No. All processing happens client-side; the stream never leaves the browser.

= Why does the camera not start automatically? =

Browsers require a user gesture and explicit permission for camera access. Click
"Start" to grant it. You can set `autostart="true"`, but the browser will still
prompt for permission.

== Changelog ==

= 1.1.0 =
* Add a "Shortcode builder" settings page (Settings → ASCII Visualizer) with a
  live preview that generates a ready-to-paste shortcode.
* Fix the `height` attribute: the widget now fits the canvas to a fixed height
  (letterboxed) instead of only setting a minimum.
* Add filter attributes: `ghost`, `crt`, `slitscan`, `glitch`.

= 1.0.0 =
* Initial release: `[ascii_visualizer]` shortcode with the prebuilt embed bundle.
