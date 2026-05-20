// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
// @cloudflare/vite-plugin builds from this — wrangler.jsonc main alone is insufficient.
export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  // Extra Vite overrides — merged on top of the helper's base config.
  vite: {
    build: {
      // Default is 500 kB; raise slightly so the (now smaller) main chunk doesn't trip the warning
      // while three/recharts/motion sit in their own dedicated chunks.
      chunkSizeWarningLimit: 700,
      rollupOptions: {
        output: {
          // Split heavy vendor libs into dedicated chunks so the route entry stays small
          // and these caches can be reused independently across deploys.
          manualChunks(id) {
            if (id.includes("node_modules")) {
              if (id.includes("three") || id.includes("@react-three")) return "three";
              if (id.includes("recharts") || id.includes("d3-")) return "recharts";
              if (id.includes("framer-motion")) return "motion";
            }
          },
        },
      },
    },
  },
});
