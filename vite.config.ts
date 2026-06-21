import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // expõe em 0.0.0.0 — acessível por outros dispositivos na rede local
  },
  optimizeDeps: {
    // wa-sqlite uses WASM and ESM features incompatible with Vite's pre-bundler
    exclude: ['wa-sqlite'],
  },
})
