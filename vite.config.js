import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vitest/config'

// GitHub Pages serves under /<repo>/, Vercel and the Capacitor WebView serve from root.
const base = process.env.GITHUB_PAGES ? '/University-Field-Survey---PWA/' : '/'

// Local demo only: forward /api to scripts/dev-api.mjs (`npm run dev:api`). Vercel serves /api in production.
const apiProxy = { '/api': 'http://localhost:3001' }

export default defineConfig({
  base,
  server: { proxy: apiProxy },
  preview: { proxy: apiProxy },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      registerType: 'autoUpdate',
      scope: base,
      injectManifest: { globPatterns: ['**/*.{html,js,css,woff2,png,svg}'] },
      devOptions: { enabled: true, type: 'module' },
      manifest: {
        name: 'VKU Field Survey',
        short_name: 'VKU Survey',
        start_url: base,
        scope: base,
        display: 'standalone',
        theme_color: '#f2f3f1',
        background_color: '#f2f3f1',
        // Relative paths so the icons resolve under any `base`.
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.test.js', 'api/**/*.test.js'],
  },
})
