import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import pkg from './package.json'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(pkg.version),
  },
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:4001',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://localhost:4001',
        changeOrigin: true,
      },
    },
  },
})
