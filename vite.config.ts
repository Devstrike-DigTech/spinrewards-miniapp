import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    // Allow any host in dev — covers ngrok tunnels, custom domains, LAN testing
    allowedHosts: 'all',
  },
  build: {
    target: 'es2020',
    sourcemap: true,
  },
})
