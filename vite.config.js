import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],

  server: {
    port: 5173,
  },

  build: {
    sourcemap: false,
    assetsDir: "crm-assets",

    rollupOptions: {
      output: {
        // Keep the React runtime and the eagerly-used icon set in their own
        // shared vendor chunks, and let Rollup split everything else
        // automatically.
        //
        // Why not `manualChunks: { charts: ["recharts"] }` (the previous setup):
        // forcing recharts into a named chunk made Rollup fold react-dom (a
        // shared dependency) INTO that chunk, so the entry — which needs
        // react-dom — treated the whole ~556KB "charts" chunk as a STATIC
        // dependency and Vite emitted an eager <link modulepreload> for it. That
        // silently pulled all of recharts onto the first authenticated paint,
        // defeating the React.lazy chart splitting. Pinning react-dom here keeps
        // it out of the chart chunks, so recharts stays a purely on-demand
        // dependency (loaded only when a chart mounts) and never preloaded.
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (
            /[\\/]node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/.test(
              id
            )
          ) {
            return "react-vendor";
          }
          if (/[\\/]node_modules[\\/]lucide-react[\\/]/.test(id)) {
            return "icons";
          }
        },
      },
    },
  },
});