import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// 1. Agregamos la importación del plugin de la PWA
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    // 2. Agregamos la configuración de la PWA dentro de la lista de plugins
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
      workbox: {
        // Inyecta los manejadores de Web Push en el service worker generado.
        // Sin esto no hay forma de recibir avisos con la app cerrada o en
        // segundo plano.
        importScripts: ['push-sw.js'],
        // El portal público y la API nunca deben resolverse con el shell de la
        // aplicación desde la caché.
        navigateFallbackDenylist: [/^\/api\//],
      },
      manifest: {
        name: 'BeautyControl Pro',
        short_name: 'BeautyControl',
        description: 'Gestión profesional de citas de belleza',
        theme_color: '#ffffff',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ],
  // 3. Mantenemos intacta tu configuración original del servidor y proxy
  server: {
    port: 5174,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});