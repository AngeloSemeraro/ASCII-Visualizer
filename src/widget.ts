// Public widget API. `createVisualizer` builds the full UI (root + stage +
// optional controls) inside a container; `autoMount` scans the document for
// `[data-ascii-visualizer]` elements and configures each from its data-* attrs.

import { AsciiVisualizer, type AsciiVisualizerOptions, type ColorMode } from "./AsciiVisualizer";
import { createControls, type ControlsHandle } from "./controls";
import { type CharsetName } from "./ascii";

export interface WidgetOptions extends AsciiVisualizerOptions {
  /** Render the control panel. Defaults to true. */
  controls?: boolean;
  /** Max CSS width of the widget root, e.g. "960px" or "100%". */
  maxWidth?: string;
  /** Min CSS height of the display stage, e.g. "360px". */
  height?: string;
}

export interface VisualizerHandle {
  engine: AsciiVisualizer;
  controls: ControlsHandle | null;
  root: HTMLElement;
  destroy(): void;
}

export function createVisualizer(
  container: HTMLElement,
  options: WidgetOptions = {}
): VisualizerHandle {
  const showControls = options.controls !== false;

  const root = document.createElement("div");
  root.className = "asciiv-root";
  if (options.maxWidth) root.style.maxWidth = options.maxWidth;

  const stage = document.createElement("div");
  stage.className = "asciiv-stage";
  if (options.height) stage.style.minHeight = options.height;
  root.appendChild(stage);

  let controls: ControlsHandle | null = null;

  const engine = new AsciiVisualizer(stage, {
    ...options,
    onError: (message) => {
      controls?.showError(message);
      options.onError?.(message);
    },
    onStateChange: (running) => {
      controls?.setRunning(running);
      if (running) void controls?.refreshCameras();
      options.onStateChange?.(running);
    },
  });

  if (showControls) {
    controls = createControls(engine);
    root.appendChild(controls.element);
  }

  container.appendChild(root);
  engine.mount();
  void controls?.refreshCameras();

  return {
    engine,
    controls,
    root,
    destroy() {
      engine.destroy();
      root.remove();
    },
  };
}

const BOOL_TRUE = new Set(["", "true", "1", "yes", "on"]);

function parseBool(value: string | undefined, fallback: boolean): boolean {
  if (value == null) return fallback;
  return BOOL_TRUE.has(value.trim().toLowerCase());
}

function parseNumber(value: string | undefined, fallback: number): number {
  if (value == null) return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Build widget options from a `[data-ascii-visualizer]` element's dataset.
 * Recognised attributes: data-columns, data-color, data-preset, data-controls,
 * data-autostart, data-background, data-foreground, data-height, data-maxwidth,
 * data-contrast, data-brightness, data-invert, data-mirror.
 */
export function optionsFromDataset(dataset: DOMStringMap): WidgetOptions {
  const opts: WidgetOptions = {};

  if (dataset.columns != null) opts.columns = parseNumber(dataset.columns, 120);
  if (dataset.color != null) opts.colorMode = dataset.color as ColorMode;
  if (dataset.preset != null) opts.charset = dataset.preset as CharsetName;
  if (dataset.phrase != null) opts.phrase = dataset.phrase;
  if (dataset.phrasethreshold != null) {
    opts.phraseThreshold = parseNumber(dataset.phrasethreshold, 1 / 3);
  }
  opts.controls = parseBool(dataset.controls, true);
  opts.autostart = parseBool(dataset.autostart, false);
  if (dataset.background != null) opts.background = dataset.background;
  if (dataset.foreground != null) opts.foreground = dataset.foreground;
  if (dataset.height != null) opts.height = dataset.height;
  if (dataset.maxwidth != null) opts.maxWidth = dataset.maxwidth;
  if (dataset.contrast != null) opts.contrast = parseNumber(dataset.contrast, 1);
  if (dataset.brightness != null) opts.brightness = parseNumber(dataset.brightness, 0);
  if (dataset.invert != null) opts.invert = parseBool(dataset.invert, false);
  if (dataset.mirror != null) opts.mirror = parseBool(dataset.mirror, true);
  if (dataset.autoexposure != null) opts.autoExposure = parseBool(dataset.autoexposure, true);
  if (dataset.exposuretarget != null) opts.exposureTarget = parseNumber(dataset.exposuretarget, 120);
  if (dataset.rainbow != null) opts.rainbow = parseBool(dataset.rainbow, false);
  if (dataset.ghost != null) opts.ghost = parseBool(dataset.ghost, false);
  if (dataset.crt != null) opts.crt = parseBool(dataset.crt, false);
  if (dataset.trail != null) opts.trail = parseNumber(dataset.trail, 0.94);
  if (dataset.trailblur != null) opts.trailBlur = parseNumber(dataset.trailblur, 2.5);
  if (dataset.trailsharp != null) opts.trailSharp = parseNumber(dataset.trailsharp, 0.35);

  return opts;
}

/**
 * Find every element with a `data-ascii-visualizer` attribute and mount a
 * visualizer inside it (once). Returns the created handles.
 */
export function autoMount(scope: ParentNode = document): VisualizerHandle[] {
  const nodes = scope.querySelectorAll<HTMLElement>("[data-ascii-visualizer]");
  const handles: VisualizerHandle[] = [];
  nodes.forEach((node) => {
    if (node.dataset.asciivMounted === "true") return;
    node.dataset.asciivMounted = "true";
    handles.push(createVisualizer(node, optionsFromDataset(node.dataset)));
  });
  return handles;
}
