// Plain-DOM control panel. No framework: every widget is a real element wired
// straight to the engine. Returns a handle so the caller can push status/errors
// and refresh the camera list once permission is granted.

import { AsciiVisualizer, type ColorMode } from "./AsciiVisualizer";
import { charsetNames, type CharsetName } from "./ascii";

export interface ControlsHandle {
  element: HTMLElement;
  showError(message: string): void;
  showStatus(message: string): void;
  setRunning(running: boolean): void;
  refreshCameras(): Promise<void>;
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function labeled(labelText: string, control: HTMLElement): HTMLElement {
  const wrap = el("label", "asciiv-field");
  wrap.appendChild(el("span", "asciiv-field-label", labelText));
  wrap.appendChild(control);
  return wrap;
}

export function createControls(engine: AsciiVisualizer): ControlsHandle {
  const opts = engine.getOptions();
  const panel = el("div", "asciiv-controls");

  // --- Row 1: start/stop + camera select --------------------------------
  const row1 = el("div", "asciiv-row");

  const startBtn = el("button", "asciiv-btn asciiv-btn-primary", "Start");
  startBtn.type = "button";

  const cameraSelect = el("select", "asciiv-select");
  cameraSelect.disabled = true;

  startBtn.addEventListener("click", () => {
    if (engine.isRunning()) {
      engine.stop();
    } else {
      showStatus("Requesting camera…");
      void engine.start();
    }
  });

  cameraSelect.addEventListener("change", () => {
    void engine.setCamera(cameraSelect.value);
  });

  row1.append(startBtn, labeled("Camera", cameraSelect));

  // --- Row 2: resolution + charset + color mode -------------------------
  const row2 = el("div", "asciiv-row");

  const resolution = el("input", "asciiv-range");
  resolution.type = "range";
  resolution.min = "40";
  resolution.max = "240";
  resolution.step = "1";
  resolution.value = String(opts.columns);
  const resValue = el("span", "asciiv-value", String(opts.columns));
  resolution.addEventListener("input", () => {
    const columns = Number(resolution.value);
    resValue.textContent = String(columns);
    engine.setOptions({ columns });
  });
  const resField = labeled("Resolution", resolution);
  resField.appendChild(resValue);

  const charsetSelect = el("select", "asciiv-select");
  for (const name of charsetNames()) {
    const o = el("option", undefined, name);
    o.value = name;
    if (name === opts.charset) o.selected = true;
    charsetSelect.appendChild(o);
  }
  charsetSelect.addEventListener("change", () => {
    engine.setOptions({ charset: charsetSelect.value as CharsetName });
  });

  const colorSelect = el("select", "asciiv-select");
  for (const mode of ["color", "mono", "inverted"] as ColorMode[]) {
    const o = el("option", undefined, mode);
    o.value = mode;
    if (mode === opts.colorMode) o.selected = true;
    colorSelect.appendChild(o);
  }
  colorSelect.addEventListener("change", () => {
    engine.setOptions({ colorMode: colorSelect.value as ColorMode });
  });

  row2.append(resField, labeled("Charset", charsetSelect), labeled("Color", colorSelect));

  // --- Row 3: contrast + brightness -------------------------------------
  const row3 = el("div", "asciiv-row");

  const contrast = el("input", "asciiv-range");
  contrast.type = "range";
  contrast.min = "0.2";
  contrast.max = "3";
  contrast.step = "0.05";
  contrast.value = String(opts.contrast);
  const contrastValue = el("span", "asciiv-value", opts.contrast.toFixed(2));
  contrast.addEventListener("input", () => {
    const value = Number(contrast.value);
    contrastValue.textContent = value.toFixed(2);
    engine.setOptions({ contrast: value });
  });
  const contrastField = labeled("Contrast", contrast);
  contrastField.appendChild(contrastValue);

  const brightness = el("input", "asciiv-range");
  brightness.type = "range";
  brightness.min = "-128";
  brightness.max = "128";
  brightness.step = "1";
  brightness.value = String(opts.brightness);
  const brightnessValue = el("span", "asciiv-value", String(opts.brightness));
  brightness.addEventListener("input", () => {
    const value = Number(brightness.value);
    brightnessValue.textContent = String(value);
    engine.setOptions({ brightness: value });
  });
  const brightnessField = labeled("Brightness", brightness);
  brightnessField.appendChild(brightnessValue);

  row3.append(contrastField, brightnessField);

  // --- Row 4: toggles + actions -----------------------------------------
  const row4 = el("div", "asciiv-row");

  const invertToggle = el("input");
  invertToggle.type = "checkbox";
  invertToggle.checked = opts.invert;
  invertToggle.addEventListener("change", () => {
    engine.setOptions({ invert: invertToggle.checked });
  });
  const invertField = labeled("Invert", invertToggle);
  invertField.classList.add("asciiv-check");

  const mirrorToggle = el("input");
  mirrorToggle.type = "checkbox";
  mirrorToggle.checked = opts.mirror;
  mirrorToggle.addEventListener("change", () => {
    engine.setOptions({ mirror: mirrorToggle.checked });
  });
  const mirrorField = labeled("Mirror", mirrorToggle);
  mirrorField.classList.add("asciiv-check");

  const saveBtn = el("button", "asciiv-btn", "Save PNG");
  saveBtn.type = "button";
  saveBtn.addEventListener("click", () => {
    const url = engine.snapshot();
    const a = el("a");
    a.href = url;
    a.download = `ascii-${Date.now()}.png`;
    a.click();
  });

  const copyBtn = el("button", "asciiv-btn", "Copy text");
  copyBtn.type = "button";
  copyBtn.addEventListener("click", () => {
    const text = engine.getText();
    void copyText(text).then(
      () => showStatus("Copied ASCII to clipboard."),
      () => showError("Clipboard copy failed.")
    );
  });

  row4.append(invertField, mirrorField, saveBtn, copyBtn);

  // --- Status line ------------------------------------------------------
  const status = el("div", "asciiv-status");
  status.setAttribute("role", "status");

  panel.append(row1, row2, row3, row4, status);

  // --- handle -----------------------------------------------------------
  function showError(message: string): void {
    status.textContent = message;
    status.classList.add("asciiv-status-error");
  }
  function showStatus(message: string): void {
    status.textContent = message;
    status.classList.remove("asciiv-status-error");
  }
  function setRunning(running: boolean): void {
    startBtn.textContent = running ? "Stop" : "Start";
    startBtn.classList.toggle("asciiv-btn-active", running);
    if (running) showStatus("Live — the camera stream stays in your browser.");
  }
  async function refreshCameras(): Promise<void> {
    const cameras = await engine.listCameras();
    cameraSelect.innerHTML = "";
    if (cameras.length === 0) {
      const o = el("option", undefined, "Default camera");
      o.value = "";
      cameraSelect.appendChild(o);
      cameraSelect.disabled = true;
      return;
    }
    cameras.forEach((cam, idx) => {
      const o = el("option", undefined, cam.label || `Camera ${idx + 1}`);
      o.value = cam.deviceId;
      cameraSelect.appendChild(o);
    });
    cameraSelect.disabled = false;
  }

  return { element: panel, showError, showStatus, setRunning, refreshCameras };
}

async function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text);
  }
  // Fallback for insecure contexts / older browsers.
  return new Promise((resolve, reject) => {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try {
      const ok = document.execCommand("copy");
      ok ? resolve() : reject(new Error("execCommand failed"));
    } catch (e) {
      reject(e);
    } finally {
      ta.remove();
    }
  });
}
