import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles/app.css'

async function boot() {
  // dev only: `VITE_MOCK_API=1 npm run dev` serves the API from the browser. Stripped from production builds.
  if (import.meta.env.DEV && import.meta.env.VITE_MOCK_API) {
    const { installMockApi } = await import('./dev/mockApi')
    installMockApi()
  }
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}
void boot()
