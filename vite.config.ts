import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from 'vite-plugin-pwa';
import { sitemapPlugin } from "./scripts/generate-sitemap";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    allowedHosts: [
      'nonoperating-innocuously-magaly.ngrok-free.dev',
      'loyalty-spark.lovable.app',
      'bzxmejzssxjazswgwqqs.supabase.co',
      'loyalspark.online'
    ],
  },
  publicDir: 'public',
  build: {
    rollupOptions: {
      onwarn(warning, warn) {
        // Suppress /*#__PURE__*/ warnings from dependencies
        if (warning.code === 'INVALID_ANNOTATION' && warning.message.includes('/*#__PURE__*/')) {
          return;
        }
        warn(warning);
      },
      output: {
        assetFileNames: (assetInfo) => {
          // Preserve .well-known directory structure
          if (assetInfo.name?.includes('.well-known')) {
            return assetInfo.name;
          }
          return 'assets/[name]-[hash][extname]';
        }
      }
    }
  },
  plugins: [
    react(),
    sitemapPlugin(),
    mode === "development" && componentTagger(),
    // PWA plugin temporarily disabled to ensure successful builds in the current environment.
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
