// Embed entry: a single self-mounting IIFE. The stylesheet is inlined as a
// string (via Vite's `?inline` query) and injected once into <head>, so the
// built file has zero external assets and can be dropped onto any page.

import css from "./styles.css?inline";
import { createVisualizer, autoMount, optionsFromDataset } from "./widget";
import { AsciiVisualizer } from "./AsciiVisualizer";

const STYLE_ID = "asciiv-styles";

function injectStyles(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = css;
  document.head.appendChild(style);
}

function boot(): void {
  injectStyles();
  autoMount();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}

// Expose a small public API on the global for manual/programmatic mounting.
const api = {
  createVisualizer,
  autoMount,
  optionsFromDataset,
  AsciiVisualizer,
  injectStyles,
};

declare global {
  interface Window {
    AsciiVisualizer: typeof api;
  }
}

window.AsciiVisualizer = api;

export default api;
