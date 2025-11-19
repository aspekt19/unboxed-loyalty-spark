import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from 'vite-plugin-pwa';

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
    mode === "development" && componentTagger(),
    mode === "production" && VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['new-favicon.png', 'media-kit/*.png'],
      manifest: {
        name: 'Loyal Spark - Decentralized Loyalty Rewards',
        short_name: 'Loyal Spark',
        description: 'Create, manage & trade loyalty tokens on-chain. Zero middlemen. Total transparency.',
        theme_color: '#0EA5E9',
        background_color: '#0F172A',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: '/new-favicon.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: '/new-favicon.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      }
    })
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
