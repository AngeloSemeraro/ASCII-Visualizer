// Plain-DOM control panel: start/stop, camera selection, Save PNG, and a row of
// togglable filter chips (palette cycler, ghost/motion, CRT, rainbow). Returns a
// handle so the caller can push status/errors and refresh the camera list.

import { AsciiVisualizer } from "./AsciiVisualizer";

// Duotone palettes cycled by the Palette chip (background + mono foreground).
const PALETTES = [
  { name: "Midnight", background: "#0b0e14", foreground: "#e6edf3" },
  { name: "Matrix", background: "#000700", foreground: "#39ff14" },
  { name: "Amber", background: "#160d00", foreground: "#ffb000" },
  { name: "Cyber", background: "#0a0014", foreground: "#ff3bd4" },
  { name: "Sepia", background: "#1a120b", foreground: "#e8c9a0" },
  { name: "Ice", background: "#02121a", foreground: "#8fe0ff" },
];

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

export function createControls(engine: AsciiVisualizer): ControlsHandle {
  const panel = el("div", "asciiv-controls");
  const row = el("div", "asciiv-row");

  const startBtn = el("button", "asciiv-btn asciiv-btn-primary", "Start");
  startBtn.type = "button";
  startBtn.addEventListener("click", () => {
    if (engine.isRunning()) {
      engine.stop();
    } else {
      showStatus("Requesting camera…");
      void engine.start();
    }
  });

  const cameraSelect = el("select", "asciiv-select");
  cameraSelect.disabled = true;
  cameraSelect.setAttribute("aria-label", "Camera");
  cameraSelect.addEventListener("change", () => {
    void engine.setCamera(cameraSelect.value);
  });

  const saveBtn = el("button", "asciiv-btn", "Save PNG");
  saveBtn.type = "button";
  saveBtn.addEventListener("click", () => {
    const url = engine.snapshot();
    const a = el("a");
    a.href = url;
    a.download = `ascii-${Date.now()}.png`;
    a.click();
  });

  row.append(startBtn, cameraSelect, saveBtn);

  // --- Filter chips -----------------------------------------------------
  const filters = el("div", "asciiv-row asciiv-filters");

  let paletteIndex = 0;
  const paletteBtn = el("button", "asciiv-btn asciiv-chip", `🎨 ${PALETTES[0].name}`);
  paletteBtn.type = "button";
  paletteBtn.addEventListener("click", () => {
    paletteIndex = (paletteIndex + 1) % PALETTES.length;
    const p = PALETTES[paletteIndex];
    paletteBtn.textContent = `🎨 ${p.name}`;
    engine.setOptions({ background: p.background, foreground: p.foreground });
  });

  const toggleChip = (label: string, apply: (on: boolean) => void): HTMLButtonElement => {
    const chip = el("button", "asciiv-btn asciiv-chip", label);
    chip.type = "button";
    let on = false;
    chip.addEventListener("click", () => {
      on = !on;
      chip.classList.toggle("asciiv-btn-active", on);
      apply(on);
    });
    return chip;
  };

  const ghostChip = toggleChip("Ghost", (on) => engine.setOptions({ ghost: on }));
  const crtChip = toggleChip("CRT", (on) => engine.setOptions({ crt: on }));
  const rainbowChip = toggleChip("Rainbow", (on) => engine.setOptions({ rainbow: on }));

  filters.append(paletteBtn, ghostChip, crtChip, rainbowChip);

  const status = el("div", "asciiv-status");
  status.setAttribute("role", "status");

  panel.append(row, filters, status);

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
