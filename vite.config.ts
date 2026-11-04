import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/',
  plugins: [react()],
  build: { chunkSizeWarningLimit: 1500 },
  optimizeDeps: { exclude: ['maplibre-gl'] },
  test: { environment: 'node' },
})
