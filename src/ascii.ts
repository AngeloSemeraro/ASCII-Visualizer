// Pure, side-effect-free helpers for turning pixel data into ASCII art.
// Everything here is deterministic and framework-free so it can be unit-reasoned
// about in isolation from the DOM/engine code.

export type CharsetName = "standard" | "detailed" | "blocks" | "minimal" | "binary";

// Character ramps ordered from darkest -> lightest.
// (A leading space represents "black".)
export const CHARSETS: Record<CharsetName, string> = {
  standard: " .:-=+*#%@",
  detailed: " .'`^\",:;Il!i><~+_-?][}{1)(|\\/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$",
  blocks: " ░▒▓█",
  minimal: " .oO@",
  binary: " 01",
};

export const DEFAULT_CHARSET: CharsetName = "standard";

/**
 * The list of available charset names, handy for populating a <select>.
 */
export function charsetNames(): CharsetName[] {
  return Object.keys(CHARSETS) as CharsetName[];
}

/**
 * Resolve a charset by name, falling back to the standard ramp for unknown
 * values (so bad `data-*` attributes never throw).
 */
export function resolveCharset(name: string | null | undefined): string {
  if (name && name in CHARSETS) {
    return CHARSETS[name as CharsetName];
  }
  return CHARSETS[DEFAULT_CHARSET];
}

/**
 * Rec.601 luminance for an 8-bit RGB triple. Returns 0..255.
 */
export function luma(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/**
 * Apply brightness/contrast/invert to a 0..255 luminance value and return a
 * clamped 0..255 result.
 *
 * @param value      raw luminance, 0..255
 * @param brightness additive offset in luminance units, roughly -255..255
 * @param contrast   multiplier around mid-gray (128); 1 = unchanged
 * @param invert     flip the value (light <-> dark)
 */
export function adjust(
  value: number,
  brightness: number,
  contrast: number,
  invert: boolean
): number {
  // Contrast pivots around mid-gray, then brightness shifts.
  let v = (value - 128) * contrast + 128 + brightness;
  if (invert) v = 255 - v;
  if (v < 0) v = 0;
  else if (v > 255) v = 255;
  return v;
}

/**
 * Map a 0..255 luminance value onto a character ramp (darkest char first).
 */
export function charForLuma(value: number, charset: string): string {
  const len = charset.length;
  if (len === 0) return " ";
  let idx = Math.floor((value / 255) * len);
  if (idx < 0) idx = 0;
  else if (idx >= len) idx = len - 1;
  return charset.charAt(idx);
}

/**
 * Derive the number of character rows for a given column count so the result
 * keeps the source aspect ratio, correcting for the fact that monospace glyphs
 * are roughly twice as tall as they are wide (~0.5 ratio).
 */
export function rowsForColumns(
  columns: number,
  srcWidth: number,
  srcHeight: number,
  glyphAspect = 0.5
): number {
  if (columns <= 0 || srcWidth <= 0 || srcHeight <= 0) return 0;
  const rows = Math.round((columns * (srcHeight / srcWidth)) * glyphAspect);
  return Math.max(1, rows);
}

/**
 * Build the repeating unit for phrase mode: the trimmed phrase plus a single
 * trailing space so consecutive repetitions stay separated. Returns "" when
 * there is no phrase (callers then fall back to the character ramp).
 */
export function phraseUnit(phrase: string | null | undefined): string {
  if (!phrase) return "";
  const trimmed = phrase.trim();
  return trimmed ? trimmed + " " : "";
}

/**
 * Phrase-mode cell character. The sentence is tiled continuously across the
 * raster (indexed by `cellIndex`); a cell lights up with its tiled letter only
 * when the adjusted luminance clears `threshold`, otherwise it stays blank.
 */
export function phraseCharForLuma(
  value: number,
  unit: string,
  cellIndex: number,
  threshold = 1 / 3
): string {
  if (unit.length === 0) return " ";
  if (value / 255 < threshold) return " ";
  const ch = unit.charAt(cellIndex % unit.length);
  return ch === " " ? " " : ch;
}

/**
 * The full per-pixel transform used everywhere (display, text, exposure stats)
 * so they never drift apart: apply exposure gain to the raw luminance, clamp,
 * then apply brightness/contrast/invert. Returns 0..255.
 */
export function pixelValue(
  r: number,
  g: number,
  b: number,
  exposure: number,
  brightness: number,
  contrast: number,
  invert: boolean
): number {
  let l = luma(r, g, b) * exposure;
  if (l > 255) l = 255;
  return adjust(l, brightness, contrast, invert);
}

/**
 * Mean of the fully-adjusted luminance across the image. Used by the
 * auto-exposure loop to steer the gain toward a target on-screen brightness.
 */
export function meanAdjustedLuma(
  image: ImageData,
  exposure: number,
  brightness: number,
  contrast: number,
  invert: boolean
): number {
  const { data } = image;
  let sum = 0;
  let n = 0;
  for (let i = 0; i < data.length; i += 4) {
    sum += pixelValue(data[i], data[i + 1], data[i + 2], exposure, brightness, contrast, invert);
    n++;
  }
  return n ? sum / n : 0;
}

export interface ImageToTextOptions {
  charset?: string;
  brightness?: number;
  contrast?: number;
  invert?: boolean;
  /** Exposure gain multiplier applied to luminance before brightness/contrast. */
  exposure?: number;
  /** When set, render the image out of this repeating sentence instead of the ramp. */
  phrase?: string;
  /** Brightness threshold (0..1) a cell must clear to show a phrase letter. */
  phraseThreshold?: number;
}

/**
 * Convert already-sampled ImageData (typically a small offscreen canvas whose
 * dimensions are the target column/row counts) into an ASCII string with
 * newline-separated rows.
 */
export function imageDataToText(image: ImageData, opts: ImageToTextOptions = {}): string {
  const charset = opts.charset ?? CHARSETS[DEFAULT_CHARSET];
  const brightness = opts.brightness ?? 0;
  const contrast = opts.contrast ?? 1;
  const invert = opts.invert ?? false;
  const exposure = opts.exposure ?? 1;
  const unit = phraseUnit(opts.phrase);
  const threshold = opts.phraseThreshold ?? 1 / 3;

  const { width, height, data } = image;
  const lines: string[] = [];

  for (let y = 0; y < height; y++) {
    let line = "";
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const i = idx * 4;
      const v = pixelValue(data[i], data[i + 1], data[i + 2], exposure, brightness, contrast, invert);
      line += unit
        ? phraseCharForLuma(v, unit, idx, threshold)
        : charForLuma(v, charset);
    }
    lines.push(line);
  }

  return lines.join("\n");
}
