import { defineConfig } from "vite";

// Two build targets:
//   default  -> dist/               (standalone site, entry index.html)
//   --mode embed -> dist-embed/     (single self-mounting IIFE with CSS inlined)
export default defineConfig(({ mode }) => {
  if (mode === "embed") {
    return {
      define: {
        "process.env.NODE_ENV": JSON.stringify("production"),
      },
      build: {
        outDir: "dist-embed",
        emptyOutDir: true,
        lib: {
          entry: "src/embed.ts",
          name: "AsciiVisualizer",
          formats: ["iife"],
          fileName: () => "ascii-visualizer.js",
        },
        rollupOptions: {
          output: {
            // Keep everything (including inlined CSS) in the single JS file.
            inlineDynamicImports: true,
          },
        },
      },
    };
  }

  return {
    build: {
      outDir: "dist",
      emptyOutDir: true,
    },
  };
});
