import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from 'vite-plugin-pwa';
import { sitemapPlugin } from "./scripts/generate-sitemap";

// Public (anon) backend config. `.env` is no longer tracked in git, so production
// builds can end up without VITE_SUPABASE_* and crash with "supabaseUrl is required".
// These are publishable values only — never put secrets here.
const PUBLIC_ENV_FALLBACK = {
  VITE_SUPABASE_URL: "https://bzxmejzssxjazswgwqqs.supabase.co",
  VITE_SUPABASE_PROJECT_ID: "bzxmejzssxjazswgwqqs",
  VITE_SUPABASE_PUBLISHABLE_KEY:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ6eG1lanpzc3hqYXpzd2d3cXFzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA3MDI4NjcsImV4cCI6MjA3NjI3ODg2N30.U10RsJRxIm3zPWcJPHpHuKf0X6FGO6P1bj4c21PN42o",
} as const;

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const define = Object.fromEntries(
    Object.entries(PUBLIC_ENV_FALLBACK)
      .filter(([key]) => !env[key])
      .map(([key, value]) => [`import.meta.env.${key}`, JSON.stringify(value)]),
  );

  return {

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
    define,
  };
});

