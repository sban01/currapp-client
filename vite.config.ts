import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Prod build is served under base path '/app/' (trailing slash required so BASE_URL + 'file' works).
// Dev serves at root instead, since the MSAL app registration's dev redirect URI
// is http://localhost:3000/auth, outside any '/app' prefix. import.meta.env.BASE_URL
// carries whichever base is active into the app — see src/lib/auth/authConfig.ts's
// BASE export, used for the router basename and post-login/logout landing paths.
// The dev proxy below still proxies '/currapp-api' regardless of base.
export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === 'build' ? '/app/' : '/',
  build: {
    outDir: 'build',
    rolldownOptions: {
      output: {
        // Split the always-needed vendor libraries out of the entry chunk so they
        // cache independently of app code. Page code and xlsx are split by the
        // lazy imports in src/config/menu.tsx and src/lib/xlsxExport.ts.
        codeSplitting: {
          groups: [
            { name: 'vendor-react', test: /node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/, priority: 30 },
            { name: 'vendor-msal', test: /node_modules[\\/]@azure[\\/]/, priority: 20 },
            { name: 'vendor-mui', test: /node_modules[\\/](@mui|@emotion)[\\/]/, priority: 10 },
          ],
        },
      },
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/currapp-api': { target: 'http://localhost:8000' },
    },
  },
}))
