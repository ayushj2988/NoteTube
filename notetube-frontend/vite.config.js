// import { defineConfig, loadEnv } from 'vite'
// import react from '@vitejs/plugin-react'

// // In development the browser talks to Vite, and Vite forwards /api to the NoteTube server.
// // Settings come from the single .env file one folder up (next to web/ and server/).
// // Only GOOGLE_CLIENT_ID is passed on to the browser, because it is public. Your API keys never reach the browser.
// export default defineConfig(({ mode }) => {
//   const env = loadEnv(mode, '..', '')
//   return {
//     plugins: [react()],
//     define: { 'import.meta.env.VITE_GOOGLE_CLIENT_ID': JSON.stringify(env.GOOGLE_CLIENT_ID || '') },
//     server: { port: 5173, proxy: { '/api': `http://localhost:${env.PORT || 8787}` } },
//   }
// })




import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react()],
    define: {
      'import.meta.env.VITE_GOOGLE_CLIENT_ID': JSON.stringify(
        env.VITE_GOOGLE_CLIENT_ID || ''
      ),
    },
    server: {
      port: 5173,
      proxy: {
        '/api': `http://localhost:${env.PORT || 8787}`,
      },
    },
  }
})
