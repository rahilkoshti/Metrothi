import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // favicon.svg + icons.svg aren't matched by the JS/CSS/HTML globs, so
      // list them explicitly to precache them for the offline shell.
      includeAssets: ['favicon.svg', 'favicon.ico', 'icons.svg', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'Metrothi — Ahmedabad Metro',
        short_name: 'Metrothi',
        description:
          'Offline-capable journey planner for the Ahmedabad–Gandhinagar metro.',
        // Must match the pre-paint background in index.html (light default) so
        // the standalone splash screen doesn't flash a different colour.
        theme_color: '#f4f4f5',
        background_color: '#f4f4f5',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Precache the built shell — the transit engines are bundled in the JS,
        // so this alone makes airplane-mode journey planning work.
        globPatterns: ['**/*.{js,css,html,svg,ico,woff2}'],
        // The app is a client-routed SPA; vercel.json rewrites are server-side
        // and do nothing offline. Serve index.html for any uncached navigation
        // so deep links like /go and /map survive a hard reload while offline.
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            // CARTO basemap tiles — viewed areas become available offline.
            urlPattern: /^https:\/\/[a-d]\.basemaps\.cartocdn\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'carto-tiles',
              expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 30 },
              // Cross-origin CDN responses are opaque (status 0).
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Google Fonts stylesheet.
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'google-fonts-stylesheet',
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Google Fonts webfont files.
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Photon place search — let previously-run queries resolve offline
            // instead of throwing. NetworkFirst keeps online results fresh.
            urlPattern: /^https:\/\/photon\.komoot\.io\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'photon-geocoding',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 7 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
})
