// Standalone site entry. Vite injects the stylesheet from the CSS import.
import "./styles.css";
import { createVisualizer, autoMount } from "./widget";

// If the page already declares a `[data-ascii-visualizer]` target, honour it;
// otherwise fall back to the #app container from index.html.
const declared = document.querySelectorAll("[data-ascii-visualizer]");
if (declared.length > 0) {
  autoMount();
} else {
  const app = document.getElementById("app");
  if (app) {
    // Image settings come from the engine defaults; only layout is set here.
    createVisualizer(app, {
      controls: true,
      autostart: false,
      maxWidth: "960px",
    });
  }
}
