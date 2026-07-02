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

export interface ImageToTextOptions {
  charset?: string;
  brightness?: number;
  contrast?: number;
  invert?: boolean;
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

  const { width, height, data } = image;
  const lines: string[] = [];

  for (let y = 0; y < height; y++) {
    let line = "";
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const l = luma(data[i], data[i + 1], data[i + 2]);
      const v = adjust(l, brightness, contrast, invert);
      line += charForLuma(v, charset);
    }
    lines.push(line);
  }

  return lines.join("\n");
}
