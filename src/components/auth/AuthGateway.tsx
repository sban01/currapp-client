import type { ReactNode } from "react";
import { useState } from "react";
import { Alert, Box, Button, CircularProgress, Container, Paper, Typography } from "@mui/material";
import { useAuth } from "./authContext";

const SSO_LOGIN = import.meta.env.VITE_SSO_LOGIN !== "false";

/** App wordmark: a primary-coloured rounded tile + name, so the login screen
 *  reads as the same product as the in-app header. */
function BrandHeader() {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
      <Box
        sx={{
          width: 44,
          height: 44,
          borderRadius: 1.5,
          flexShrink: 0,
          bgcolor: "primary.main",
          color: "primary.contrastText",
          display: "grid",
          placeItems: "center",
          fontSize: 20,
          fontWeight: 700,
        }}
      >
        C
      </Box>
      <Typography variant="h4" component="h1" sx={{ fontWeight: 600, color: "text.primary" }}>
        SOM Curriculum App
      </Typography>
    </Box>
  );
}

export default function AuthGateway({ children }: { children: ReactNode }) {
  const { isAuthenticated, loading, login, authError, clearAuthError } = useAuth();
  // Once sign-in is accepted we show a spinner and disable the button so a slow
  // exchange can't be re-triggered by repeated clicks.
  const [signingIn, setSigningIn] = useState(false);

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh", bgcolor: "background.default" }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!isAuthenticated) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh", bgcolor: "background.default" }}>
        <Container maxWidth="sm">
          <Paper elevation={3} sx={{ p: 4, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
            <BrandHeader />
            {authError ? (
              <>
                <Alert severity="error" sx={{ width: "100%" }}>
                  {authError}
                </Alert>
                <Button variant="text" size="small" onClick={() => { setSigningIn(false); clearAuthError(); }}>
                  Try a different account
                </Button>
              </>
            ) : (
              <>
                <Typography variant="body1" color="text.secondary" align="center">
                  Sign in to access the Curriculum App.
                </Typography>
                {signingIn ? (
                  <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1.5, mt: 2 }}>
                    <CircularProgress size={28} />
                    <Typography variant="body2" color="text.secondary">
                      Signing you in…
                    </Typography>
                  </Box>
                ) : (
                  <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 2, alignItems: "center" }}>
                    {SSO_LOGIN ? (
                      <Button
                        variant="contained"
                        color="primary"
                        size="large"
                        onClick={() => { setSigningIn(true); login(); }}
                        sx={{ minWidth: 220 }}
                      >
                        Sign In with Microsoft
                      </Button>
                    ) : (
                      <Alert severity="info" sx={{ width: "100%" }}>
                        Microsoft sign-in is not configured. Set the Azure client/authority in .env.
                      </Alert>
                    )}
                  </Box>
                )}
              </>
            )}
          </Paper>
        </Container>
      </Box>
    );
  }

  return <>{children}</>;
}
