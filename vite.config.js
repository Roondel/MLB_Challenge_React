import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    host: '127.0.0.1',
    proxy: {
      '/mlb-api': {
        target: 'https://statsapi.mlb.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/mlb-api/, '/api/v1'),
      }
    }
  }
})
