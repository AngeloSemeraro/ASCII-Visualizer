# ASCII Visualizer

A real-time **webcam → ASCII art** filter that runs entirely in the browser.
No server, no uploads, no runtime dependencies — the camera stream is sampled
and rendered locally and **never leaves your device**.

Built with **Vite + TypeScript**, framework-free (no React).

![standalone](https://img.shields.io/badge/build-vite%20%2B%20typescript-blue)

## How it works

1. `getUserMedia` provides a `MediaStream` attached to a hidden `<video>`.
2. Each animation frame the video is drawn into a tiny offscreen canvas sized to
   the target **column count** (rows are derived from the video aspect ratio,
   corrected by the ~0.5 monospace glyph ratio).
3. For every cell we compute Rec.601 **luminance**, apply brightness / contrast /
   invert, then map it onto a **character ramp**.
4. The characters are painted onto a display canvas — optionally **tinted** with
   the source pixel color.

Everything is deterministic and lives in small, testable modules.

## Getting started

```bash
npm install
npm run dev        # start the dev server
```

Then open the printed URL and click **Start** to grant camera access.

### Scripts

| Script              | Description                                        |
| ------------------- | -------------------------------------------------- |
| `npm run dev`       | Vite dev server                                    |
| `npm run typecheck` | `tsc --noEmit`                                      |
| `npm run build`     | Typecheck + standalone build → `dist/`             |
| `npm run build:embed` | Single self-mounting IIFE → `dist-embed/`        |
| `npm run build:all` | Both builds                                        |
| `npm run preview`   | Preview the standalone build                       |

## Controls

The core UI is minimal — **Start / Stop**, a **camera selector**, and
**Save PNG** — plus a row of togglable **filter chips** (see [Filters](#filters)).
Everything else (resolution, charset, color mode, contrast, brightness, mirror,
auto-exposure, and the motion trail) is baked into a tuned default look and can
still be overridden programmatically or via `data-*` attributes.

## Filters

Togglable, stackable effect chips:

- **🎨 Palette** — cycles duotone themes: Midnight, Matrix, Amber, Cyber, Sepia, Ice.
- **Ghost** — motion-only rendering via frame-differencing; still areas vanish and
  only movement lights up (mesmerising with the trail). Tune with `ghostThreshold`.
- **CRT** — scanlines + vignette for a retro-monitor look.
- **Slit-scan** — samples each row from a different moment in time (a ring of
  recent frames), smearing motion into a time-warped portrait.
- **Glitch** — sporadic datamosh bursts: horizontal band tears + a color-split
  ghost for a few frames, then it subsides. Trigger one on demand with
  `engine.pulseGlitch()`.

### Default look

| Setting     | Default   |
| ----------- | --------- |
| Columns     | `240`     |
| Text        | `sono una terapia` |
| Color mode  | `mono`    |
| Contrast    | `1.35`    |
| Brightness  | `-46`     |
| Auto-exposure | on (`target 120`) |
| Mirror      | on        |
| Trail       | `0.94`    |
| Trail blur  | `2.5px`   |
| Trail sharp | `0.35`    |

## Effects

### Dreamy long-exposure trail

A slow-shutter / light-painting effect. Frames accumulate on an offscreen
buffer that decays only slightly each frame and blends new frames in `lighten`
mode, so the brightest value at each pixel wins. Bright moving glyphs keep
re-lighting new positions while their old positions fade slowly — leaving soft,
glowing streaks that smear behind motion. The buffer is shown blurred as the
main image, with a faint crisp layer over it so the current pose still reads.

Tune it with:

- `trail` (0..1) — persistence. Higher = light lingers far longer (default `0.94`).
- `trailBlur` (CSS px) — softness of the glow (default `2.5`).
- `trailSharp` (0..1) — opacity of the crisp current-frame overlay (default `0.35`; `0` = full dream).

Set `trail: 0` to disable the effect and clear each frame.

### Auto-exposure

The render adapts to your lighting automatically. Each frame it measures the
mean on-screen brightness and eases an exposure gain toward whatever lands it
on a target, so the ASCII (and the phrase density) stays balanced whether the
room is dim or bright. The easing keeps it smooth and flicker-free.

- `autoExposure` (boolean) — enable/disable (default `true`).
- `exposureTarget` (0..255) — target mean brightness (default `120`; higher = denser/brighter).

### Phrase mode

By default the image isn't built from a brightness ramp at all — it's built
from a repeating **sentence**. The phrase (`sono una terapia`) is tiled
continuously across the frame and a cell lights up with its tiled letter only
where the image is bright enough (above `phraseThreshold`), so you literally
read the sentence flowing through the lit shape. Set `phrase` to any string, or
`phrase: ""` to fall back to a character ramp.

- `phrase` — the sentence to render with (default `"sono una terapia"`).
- `phraseThreshold` (0..1) — how bright a cell must be to show a letter (default `0.33`).

### Charsets (ramp fallback)

When `phrase` is empty, luminance maps onto a character ramp instead:
`standard`, `detailed`, `blocks`, `minimal`, `binary` — each ordered from
darkest to lightest.

## Embedding

Build the embed bundle and drop the single file onto any page:

```bash
npm run build:embed
```

```html
<div
  data-ascii-visualizer
  data-columns="240"
  data-color="mono"
  data-preset="binary"
  data-controls="true"
  data-autostart="false"
></div>
<script src="ascii-visualizer.js"></script>
```

The script injects its own scoped CSS and auto-mounts every
`[data-ascii-visualizer]` element. You can also mount programmatically:

```js
window.AsciiVisualizer.createVisualizer(document.getElementById("host"), {
  columns: 140,
  colorMode: "mono",
});
```

### Supported `data-*` attributes

| Attribute         | Meaning                                       |
| ----------------- | --------------------------------------------- |
| `data-columns`    | Target column count                           |
| `data-color`      | `color` \| `mono` \| `inverted`               |
| `data-preset`     | Charset name (ramp fallback)                  |
| `data-phrase`     | Sentence to render the image with             |
| `data-phrasethreshold` | Brightness threshold for a letter (0..1) |
| `data-controls`   | Show the control panel (`true`/`false`)       |
| `data-autostart`  | Start the camera on load                      |
| `data-background` | Display background color                       |
| `data-foreground` | Foreground color (mono / inverted)            |
| `data-height`     | Min stage height (CSS)                         |
| `data-maxwidth`   | Max widget width (CSS)                         |
| `data-contrast`   | Contrast multiplier                           |
| `data-brightness` | Brightness offset                             |
| `data-invert`     | Invert luminance                              |
| `data-mirror`     | Mirror horizontally                           |
| `data-autoexposure` | Adapt exposure to lighting (`true`/`false`) |
| `data-exposuretarget` | Target mean brightness (0..255)           |
| `data-ghost`      | Motion-only ghost filter (`true`/`false`)     |
| `data-crt`        | CRT scanline + vignette filter (`true`/`false`) |
| `data-slitscan`   | Slit-scan time-warp filter (`true`/`false`)   |
| `data-glitch`     | Glitch-burst filter (`true`/`false`)          |
| `data-trail`      | Long-exposure persistence (0..1, 0 = off)     |
| `data-trailblur`  | Trail blur radius (CSS px)                     |
| `data-trailsharp` | Crisp overlay opacity (0..1)                  |

## WordPress plugin

A ready-to-use plugin lives in [`wordpress-plugin/ascii-visualizer`](wordpress-plugin/ascii-visualizer).
It registers an `[ascii_visualizer]` shortcode that emits a
`data-ascii-visualizer` element and enqueues the prebuilt embed bundle:

```
[ascii_visualizer columns="240" color="mono" preset="binary" controls="true"]
```

Rebuild its bundled asset after changing the source:

```bash
npm run build:embed
cp dist-embed/ascii-visualizer.js wordpress-plugin/ascii-visualizer/assets/ascii-visualizer.js
```

## Privacy

The camera feed is processed **entirely in your browser**. No frames, no
snapshots, and no ASCII output are ever sent anywhere.

## License

MIT © Angelo Semeraro
