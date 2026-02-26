import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  root: "demo",
  base: "/bitbucket-pipelines-viewer-react/",
  build: {
    outDir: "../dist-demo",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, "demo/index.html"),
      },
    },
  },
});
