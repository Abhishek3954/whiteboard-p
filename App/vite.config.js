import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    watch: {
      usePolling: true,
    },
    proxy: {
      '/api1': {
        target: 'http://api-node:8080',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api1/, '')
      },
      '/api2': {
        target: 'http://api-node:8080',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api2/, '')
      },
    },
    host: true,
    allowedHosts: 'aflame-myth-squiggle.ngrok-free.dev'
  }
})
