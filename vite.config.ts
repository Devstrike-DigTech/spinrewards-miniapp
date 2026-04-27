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
    allowedHosts: ['localhost', '127.0.0.1', '.local', 'fatigued-nonleprous-hue.ngrok-free.dev', 'plastery-unhampered-erline.ngrok-free.dev'],
  },
  build: {
    target: 'es2020',
    sourcemap: true,
  },
})
