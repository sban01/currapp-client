import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Prod build is served under base path '/currapp' (see servercfg/00-currapp.conf).
// Dev serves at root instead, since the MSAL app registration's dev redirect URI
// is http://localhost:3000/auth, outside any '/currapp' prefix. import.meta.env.BASE_URL
// carries whichever base is active into the app — see src/lib/auth/authConfig.ts's
// BASE export, used for the router basename and post-login/logout landing paths.
// The dev proxy below still proxies '/currapp-api' regardless of base.
export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === 'build' ? '/app' : '/',
  build: {
    outDir: 'build',
  },
  server: {
    port: 3000,
    proxy: {
      '/currapp-api': { target: 'http://localhost:8000' },
    },
  },
}))
