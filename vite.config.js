import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.js'],
    exclude: ['e2e/**', 'node_modules/**'],
  },
  plugins: [
    react(),
    tailwindcss(),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react':  ['react', 'react-dom', 'react-router-dom'],
          'vendor-map':    ['leaflet', 'react-leaflet'],
          'vendor-charts': ['recharts'],
          'vendor-auth':   ['aws-amplify'],
        },
      },
    },
  },
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
