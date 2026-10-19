/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** API base. Defaults to "/api" (proxied to the backend in dev). */
  readonly VITE_API_URL?: string
  /** Google OAuth client id for the "Continue with Google" button. */
  readonly VITE_GOOGLE_CLIENT_ID?: string
  /** dev only: "1" serves the API from an in-browser mock (src/dev/mockApi.ts). */
  readonly VITE_MOCK_API?: string
}
interface ImportMeta {
  readonly env: ImportMetaEnv
}
