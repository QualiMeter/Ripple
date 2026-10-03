import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss()],
  define: mode === 'test'
    ? { 'import.meta.env.VITE_API_MODE': JSON.stringify('mock') }
    : undefined,
  server: {
    host: '127.0.0.1',
    port: 4173,
  },
}))
