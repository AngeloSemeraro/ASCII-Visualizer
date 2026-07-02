// The render engine: owns the camera stream, the offscreen sampling canvas and
// the visible display canvas, and drives a requestAnimationFrame loop that turns
// live video frames into ASCII art. It is deliberately framework-free and does
// not touch any DOM outside the container it is given.
//
// Privacy note: the MediaStream is attached to a local <video> element and
// sampled entirely in-page. Nothing is ever uploaded — the pixels never leave
// the browser.

import {
  resolveCharset,
  luma,
  adjust,
  charForLuma,
  rowsForColumns,
  imageDataToText,
  DEFAULT_CHARSET,
  type CharsetName,
} from "./ascii";

export type ColorMode = "color" | "mono" | "inverted";

export interface AsciiVisualizerOptions {
  /** Target number of character columns. Rows are derived from aspect ratio. */
  columns?: number;
  /** Character ramp to use. */
  charset?: CharsetName | string;
  /** How glyphs are colored: per-pixel color, single foreground, or inverted. */
  colorMode?: ColorMode;
  /** Contrast multiplier around mid-gray. 1 = unchanged. */
  contrast?: number;
  /** Brightness offset in luminance units. 0 = unchanged. */
  brightness?: number;
  /** Invert luminance (light <-> dark). */
  invert?: boolean;
  /** Mirror the image horizontally (selfie view). */
  mirror?: boolean;
  /** Background color of the display canvas. */
  background?: string;
  /** Foreground color used in mono / inverted modes. */
  foreground?: string;
  /** Start the camera automatically on mount. */
  autostart?: boolean;
  /** Preferred camera deviceId. */
  deviceId?: string;
  /** Called with a human-readable message when something goes wrong. */
  onError?: (message: string) => void;
  /** Called when the stream starts / stops. */
  onStateChange?: (running: boolean) => void;
}

const DEFAULTS: Required<
  Omit<AsciiVisualizerOptions, "deviceId" | "onError" | "onStateChange">
> = {
  columns: 120,
  charset: DEFAULT_CHARSET,
  colorMode: "color",
  contrast: 1,
  brightness: 0,
  invert: false,
  mirror: true,
  background: "#0b0e14",
  foreground: "#e6edf3",
  autostart: false,
};

// Monospace glyphs are ~twice as tall as they are wide.
const GLYPH_ASPECT = 0.5;

export class AsciiVisualizer {
  private container: HTMLElement;
  private opts: Required<
    Omit<AsciiVisualizerOptions, "deviceId" | "onError" | "onStateChange">
  > & {
    deviceId?: string;
    onError?: (message: string) => void;
    onStateChange?: (running: boolean) => void;
  };

  private video: HTMLVideoElement;
  private sampler: HTMLCanvasElement;
  private samplerCtx: CanvasRenderingContext2D;
  private display: HTMLCanvasElement;
  private displayCtx: CanvasRenderingContext2D;

  private stream: MediaStream | null = null;
  private rafId = 0;
  private running = false;
  private mounted = false;
  private resizeObserver: ResizeObserver | null = null;
  private lastText = "";

  constructor(container: HTMLElement, options: AsciiVisualizerOptions = {}) {
    this.container = container;
    this.opts = { ...DEFAULTS, ...options };

    this.video = document.createElement("video");
    this.video.setAttribute("playsinline", "");
    this.video.muted = true;
    this.video.autoplay = true;
    // Keep the raw feed out of view — we only display the ASCII rendering.
    this.video.style.display = "none";

    this.sampler = document.createElement("canvas");
    const sctx = this.sampler.getContext("2d", { willReadFrequently: true });
    if (!sctx) throw new Error("2D canvas context unavailable");
    this.samplerCtx = sctx;

    this.display = document.createElement("canvas");
    this.display.className = "asciiv-canvas";
    const dctx = this.display.getContext("2d");
    if (!dctx) throw new Error("2D canvas context unavailable");
    this.displayCtx = dctx;
  }

  /** Attach the display canvas + hidden video to the container. */
  mount(): void {
    if (this.mounted) return;
    this.container.appendChild(this.video);
    this.container.appendChild(this.display);
    this.mounted = true;

    this.resizeObserver = new ResizeObserver(() => this.renderOnce());
    this.resizeObserver.observe(this.container);

    if (this.opts.autostart) {
      void this.start();
    } else {
      this.renderPlaceholder();
    }
  }

  /** Request the camera and begin the render loop. */
  async start(): Promise<void> {
    if (this.running) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      this.emitError("Camera access (getUserMedia) is not supported in this browser.");
      return;
    }

    const constraints: MediaStreamConstraints = {
      audio: false,
      video: this.opts.deviceId
        ? { deviceId: { exact: this.opts.deviceId } }
        : { facingMode: "user" },
    };

    try {
      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch (err) {
      this.emitError(this.describeGetUserMediaError(err));
      return;
    }

    this.video.srcObject = this.stream;
    try {
      await this.video.play();
    } catch {
      // Some browsers reject play() until a user gesture; the loop still works
      // once frames arrive, so this is non-fatal.
    }

    this.running = true;
    this.opts.onStateChange?.(true);
    this.loop();
  }

  /** Stop the camera and the render loop, releasing all tracks. */
  stop(): void {
    if (!this.running && !this.stream) return;
    this.running = false;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = 0;
    }
    if (this.stream) {
      for (const track of this.stream.getTracks()) track.stop();
      this.stream = null;
    }
    this.video.srcObject = null;
    this.opts.onStateChange?.(false);
    this.renderPlaceholder();
  }

  /** Fully tear down: stop the stream, detach observers, remove elements. */
  destroy(): void {
    this.stop();
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    if (this.mounted) {
      this.video.remove();
      this.display.remove();
      this.mounted = false;
    }
  }

  /** Enumerate available video input devices. Requires prior permission for labels. */
  async listCameras(): Promise<MediaDeviceInfo[]> {
    if (!navigator.mediaDevices?.enumerateDevices) return [];
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices.filter((d) => d.kind === "videoinput");
    } catch {
      return [];
    }
  }

  /** Switch to a specific camera by deviceId, restarting the stream if live. */
  async setCamera(deviceId: string): Promise<void> {
    this.opts.deviceId = deviceId;
    if (this.running) {
      this.stop();
      await this.start();
    }
  }

  /** Update options at runtime (merged over current). */
  setOptions(partial: Partial<AsciiVisualizerOptions>): void {
    this.opts = { ...this.opts, ...partial };
    if (!this.running) this.renderOnce();
  }

  getOptions(): Readonly<typeof this.opts> {
    return this.opts;
  }

  isRunning(): boolean {
    return this.running;
  }

  /** The most recently rendered frame as an ASCII string. */
  getText(): string {
    return this.lastText;
  }

  /** A PNG data URL of the current display canvas. */
  snapshot(): string {
    return this.display.toDataURL("image/png");
  }

  // --- internals -----------------------------------------------------------

  private loop = (): void => {
    if (!this.running) return;
    this.renderOnce();
    this.rafId = requestAnimationFrame(this.loop);
  };

  private renderOnce(): void {
    const vw = this.video.videoWidth;
    const vh = this.video.videoHeight;
    if (!this.running || vw === 0 || vh === 0) return;

    const columns = Math.max(8, Math.round(this.opts.columns));
    const rows = rowsForColumns(columns, vw, vh, GLYPH_ASPECT);
    if (rows <= 0) return;

    // 1) Downsample the video into a tiny columns x rows buffer.
    if (this.sampler.width !== columns) this.sampler.width = columns;
    if (this.sampler.height !== rows) this.sampler.height = rows;

    this.samplerCtx.save();
    if (this.opts.mirror) {
      this.samplerCtx.translate(columns, 0);
      this.samplerCtx.scale(-1, 1);
    }
    this.samplerCtx.drawImage(this.video, 0, 0, columns, rows);
    this.samplerCtx.restore();

    const image = this.samplerCtx.getImageData(0, 0, columns, rows);
    const charset = resolveCharset(this.opts.charset);

    // 2) Cache the plain-text representation for getText()/copy.
    this.lastText = imageDataToText(image, {
      charset,
      brightness: this.opts.brightness,
      contrast: this.opts.contrast,
      invert: this.opts.invert,
    });

    // 3) Paint the ASCII onto the display canvas.
    this.paint(image, columns, rows, charset);
  }

  private paint(image: ImageData, columns: number, rows: number, charset: string): void {
    const dpr = window.devicePixelRatio || 1;
    const cssWidth = this.container.clientWidth || 640;
    const cellW = cssWidth / columns;
    const cellH = cellW / GLYPH_ASPECT;
    const cssHeight = cellH * rows;

    const pxWidth = Math.max(1, Math.round(cssWidth * dpr));
    const pxHeight = Math.max(1, Math.round(cssHeight * dpr));
    if (this.display.width !== pxWidth) this.display.width = pxWidth;
    if (this.display.height !== pxHeight) this.display.height = pxHeight;
    this.display.style.width = `${cssWidth}px`;
    this.display.style.height = `${cssHeight}px`;

    const ctx = this.displayCtx;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const inverted = this.opts.colorMode === "inverted";
    const bg = inverted ? this.opts.foreground : this.opts.background;
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, cssWidth, cssHeight);

    ctx.textBaseline = "top";
    ctx.textAlign = "left";
    ctx.font = `${cellH}px "SFMono-Regular", "Menlo", "Consolas", "Liberation Mono", monospace`;

    const { width, height, data } = image;
    for (let y = 0; y < height && y < rows; y++) {
      for (let x = 0; x < width && x < columns; x++) {
        const i = (y * width + x) * 4;
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const l = luma(r, g, b);
        const v = adjust(l, this.opts.brightness, this.opts.contrast, this.opts.invert);
        const ch = charForLuma(v, charset);
        if (ch === " ") continue;

        if (this.opts.colorMode === "color") {
          ctx.fillStyle = `rgb(${r},${g},${b})`;
        } else if (inverted) {
          ctx.fillStyle = this.opts.background;
        } else {
          ctx.fillStyle = this.opts.foreground;
        }
        ctx.fillText(ch, x * cellW, y * cellH);
      }
    }
  }

  private renderPlaceholder(): void {
    const dpr = window.devicePixelRatio || 1;
    const cssWidth = this.container.clientWidth || 640;
    const cssHeight = Math.round(cssWidth * 0.5) || 320;

    const pxWidth = Math.max(1, Math.round(cssWidth * dpr));
    const pxHeight = Math.max(1, Math.round(cssHeight * dpr));
    this.display.width = pxWidth;
    this.display.height = pxHeight;
    this.display.style.width = `${cssWidth}px`;
    this.display.style.height = `${cssHeight}px`;

    const ctx = this.displayCtx;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = this.opts.background;
    ctx.fillRect(0, 0, cssWidth, cssHeight);
    ctx.fillStyle = this.opts.foreground;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = '16px "SFMono-Regular", "Menlo", "Consolas", monospace';
    ctx.globalAlpha = 0.6;
    ctx.fillText("Camera stopped — press Start", cssWidth / 2, cssHeight / 2);
    ctx.globalAlpha = 1;
  }

  private emitError(message: string): void {
    if (this.opts.onError) this.opts.onError(message);
    else console.error("[AsciiVisualizer]", message);
  }

  private describeGetUserMediaError(err: unknown): string {
    const name = err instanceof DOMException ? err.name : "";
    switch (name) {
      case "NotAllowedError":
      case "SecurityError":
        return "Camera permission was denied. Allow camera access and try again.";
      case "NotFoundError":
      case "OverconstrainedError":
        return "No camera matching the request was found.";
      case "NotReadableError":
        return "The camera is already in use by another application.";
      case "AbortError":
        return "Camera start was aborted. Please try again.";
      default:
        return "Could not access the camera. Check your browser permissions and that a camera is connected.";
    }
  }
}
