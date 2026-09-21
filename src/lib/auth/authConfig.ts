import type { Configuration } from "@azure/msal-browser";

// Router basename / post-login-logout landing path. Matches vite.config.ts's
// `base` (prod build: '/app/', dev: '/') via Vite's own BASE_URL env var,
// so this only needs to be set in one place. The Azure AD app registration's
// redirect URI is a separate, fixed path per environment — see .env.example.
export const BASE = import.meta.env.BASE_URL.replace(/\/$/, "") || "/";

export const msalConfig: Configuration = {
  auth: {
    clientId: import.meta.env.VITE_CLIENT_ID || "",
    authority: import.meta.env.VITE_AUTHORITY || "",
    redirectUri: import.meta.env.VITE_REDIRECT_URI || "",
    postLogoutRedirectUri: BASE,
  },
  cache: {
    cacheLocation: "localStorage",
  },
  system: {
    loggerOptions: {
      logLevel: 3, // Error level only
    },
  },
};

// API base URL — the currapp-api prefix (same-origin proxy in dev, full URL in prod).
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/currapp-api";
