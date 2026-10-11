import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Proxy API calls to the FastAPI backend during dev
      '/api': {
        target: process.env.VITE_API_BASE_URL?.replace('/api/v1', '') ?? 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
