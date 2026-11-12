import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// Aplikace běží pod https://<uživatel>.github.io/kostra-3d/
// Jiné umístění: BASE_PATH=/jiny-nazev/ npm run build
const base = process.env.BASE_PATH || '/kostra-3d/';

export default defineConfig({
  base,
  build: { target: 'es2020', chunkSizeWarningLimit: 900 },
  plugins: [
    VitePWA({
      injectRegister: false,
      registerType: 'autoUpdate',          // nová verze se načte sama při dalším spuštění
      includeAssets: ['icons/apple-touch-icon.png', 'icons/icon.svg'],
      manifest: {
        name: 'Kostra 3D – učení kostí',
        short_name: 'Kostra 3D',
        description: 'Interaktivní 3D model lidské kostry s českými názvy kostí, kartičkami a testy.',
        lang: 'cs',
        start_url: base,
        scope: base,
        display: 'standalone',
        orientation: 'any',
        background_color: '#12161c',
        theme_color: '#12161c',
        categories: ['education'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // model kostry (8 MB) se uloží do cache, aby aplikace běžela i bez internetu
        globPatterns: ['**/*.{js,css,html,glb,png,svg,webmanifest}'],
        maximumFileSizeToCacheInBytes: 12 * 1024 * 1024,
        navigateFallback: `${base}index.html`,
        cleanupOutdatedCaches: true,
      },
    }),
  ],
});
