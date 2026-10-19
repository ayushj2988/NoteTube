import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '')
  return {
    plugins: [react()],
    server: {
      // the backend defaults to http://localhost:8787; override with VITE_API_PROXY
      proxy: { '/api': { target: env.VITE_API_PROXY || 'http://localhost:8787', changeOrigin: false } },
    },
    build: {
      chunkSizeWarningLimit: 900,
      rollupOptions: {
        output: {
          manualChunks(id: string) {
            if (id.includes('node_modules/three/')) return 'three'
            if (id.includes('@react-three')) return 'r3f'
          },
        },
      },
    },
  }
})
