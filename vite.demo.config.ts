import { defineConfig, Plugin } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

const cloudflareAnalyticsPlugin = (): Plugin => ({
  name: "cloudflare-analytics",
  transformIndexHtml(html) {
    if (process.env.NODE_ENV === "production") {
      return html.replace(
        "</body>",
        `  <!-- Cloudflare Web Analytics --><script defer src='https://static.cloudflareinsights.com/beacon.min.js' data-cf-beacon='{"token": "7e2479cb4fb5482599d88ce842209429"}'></script><!-- End Cloudflare Web Analytics -->\n  </body>`,
      );
    }
    return html;
  },
});

export default defineConfig({
  plugins: [react(), cloudflareAnalyticsPlugin()],
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
