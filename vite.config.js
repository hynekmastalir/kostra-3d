import { defineConfig } from 'vite';

// Aplikace běží pod https://<uživatel>.github.io/kostra-3d/
// Jiné umístění: BASE_PATH=/jiny-nazev/ npm run build
export default defineConfig({
  base: process.env.BASE_PATH || '/kostra-3d/',
  build: { target: 'es2020', chunkSizeWarningLimit: 900 },
});
