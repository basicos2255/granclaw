import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * P2.2: Added proxy configuration for API routes
 * P5.2: Config consistency - use VITE_API_BASE_URL
 * This is a backup for when VITE_API_BASE_URL is not set.
 * Production should use VITE_API_BASE_URL directly.
 */
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/runtime': 'http://localhost:3001',
      '/queue': 'http://localhost:3001',
      '/dag': 'http://localhost:3001',
      '/notifications': 'http://localhost:3001',
      '/channels': 'http://localhost:3001',
      '/credentials': 'http://localhost:3001',
      '/approvals': 'http://localhost:3001',
      '/workers': 'http://localhost:3001',
      '/test-mode': 'http://localhost:3001',
      '/metrics': 'http://localhost:3001',
      '/readiness': 'http://localhost:3001',
      '/api': 'http://localhost:3001'
    }
  }
})
