import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      // Registro manual (ver src/main.tsx) -- assim que uma versão nova é
      // detectada, recarrega sozinho em vez de ficar preso na versão
      // antiga até o usuário fechar e reabrir o app/PWA na mão.
      injectRegister: false,
      manifest: {
        name: 'des.tino',
        short_name: 'des.tino',
        description: 'Controle de finanças pessoais',
        lang: 'pt-BR',
        theme_color: '#0D1F1A',
        background_color: '#0D1F1A',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
})
