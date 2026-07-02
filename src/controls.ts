// Minimal plain-DOM control panel: start/stop, camera selection, and Save PNG.
// All image settings are baked into the engine defaults, so there is nothing
// else to tweak here. Returns a handle so the caller can push status/errors and
// refresh the camera list once permission is granted.

import { AsciiVisualizer } from "./AsciiVisualizer";

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

  const status = el("div", "asciiv-status");
  status.setAttribute("role", "status");

  panel.append(row, status);

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
