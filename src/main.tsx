import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import './index.css'
import App from './App.tsx'
import AuthProvider from './components/auth/AuthProvider'
import { GC_TIME_MS, STALE_TIME_MS } from './config/cache'
import { theme } from './lib/theme'
import { BASE } from './lib/auth/authConfig'

// Freshness is driven by the le_* staleness poll (lib/useLastEditCheck), not by
// timers: staleTime/gcTime are just the daily backstop for a poll that never
// arrived. gcTime has to be set alongside staleTime — its 5-minute default would
// evict unmounted queries long before staleTime mattered, and every navigation
// between admin pages would refetch. Both come from VITE_STALE_TIME_HOURS.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: STALE_TIME_MS,
      gcTime: GC_TIME_MS,
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter basename={BASE}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <AuthProvider>
            <App />
          </AuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </BrowserRouter>
  </StrictMode>,
)
