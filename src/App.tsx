import type { ReactNode } from "react";
import { Alert, Box, Button, Typography } from "@mui/material";
import { ErrorBoundary } from "react-error-boundary";
import type { FallbackProps } from "react-error-boundary";
import { Navigate, Route, Routes } from "react-router-dom";
import AuthGateway from "./components/auth/AuthGateway";
import Layout from "./components/Layout";
import StalenessMonitor from "./components/StalenessMonitor";
import { routeLeaves } from "./config/menu";
import { useAuth } from "./components/auth/authContext";
import { hasRole } from "./lib/roles";
import { GlobalsProvider } from "./lib/GlobalsContext";
import type { Role } from "./types";

function ErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
  return (
    <Box sx={{ p: 4, maxWidth: 640, mx: "auto" }}>
      <Alert severity="error" sx={{ mb: 2 }}>
        <Typography sx={{ fontWeight: 600 }}>Something went wrong</Typography>
        <Typography variant="body2">{(error as Error)?.message}</Typography>
      </Alert>
      <Button variant="contained" onClick={resetErrorBoundary}>
        Try again
      </Button>
    </Box>
  );
}

/** Client-side role guard (defence in depth — the API also enforces roles on
 *  every request). Redirects users without an allowed role back to the
 *  overview. */
function RequireRole({ roles, children }: { roles?: readonly Role[]; children: ReactNode }) {
  const { user } = useAuth();
  if (!hasRole(user?.role, roles)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <AuthGateway>
        <GlobalsProvider>
          <StalenessMonitor />
          <Layout>
            <Routes>
              {routeLeaves().map((r) => (
                <Route
                  key={r.path}
                  path={r.path}
                  element={r.roles ? <RequireRole roles={r.roles}>{r.element}</RequireRole> : r.element}
                />
              ))}
              <Route path="/" element={<Navigate to="/progress/schedule" replace />} />
              <Route path="*" element={<Navigate to="/progress/schedule" replace />} />
            </Routes>
          </Layout>
        </GlobalsProvider>
      </AuthGateway>
    </ErrorBoundary>
  );
}
