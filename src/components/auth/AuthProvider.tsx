import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { PublicClientApplication } from "@azure/msal-browser";
import { msalConfig, API_BASE_URL, BASE } from "../../lib/auth/authConfig";
import type { AuthContextType, TokenExchangeResponse } from "../../types";
import { AuthContext } from "./authContext";

const msalInstance = new PublicClientApplication(msalConfig);

const TOKEN_KEY = "currapp_token";
const USER_KEY = "currapp_user";
const EXPIRY_KEY = "currapp_token_expiry";

// Post-logout / 401 landing.
const LOGIN_URL = BASE;

const MS_SCOPES = ["openid", "profile", "User.Read"];

export default function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<AuthContextType["user"]>(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearAuthError = useCallback(() => setAuthError(null), []);

  const saveTokenToStorage = useCallback(
    (tokenData: TokenExchangeResponse, userName: string, userEmail: string) => {
      localStorage.setItem(TOKEN_KEY, tokenData.token);
      localStorage.setItem(
        USER_KEY,
        JSON.stringify({ name: userName, username: userEmail, role: tokenData.rl, subrole: tokenData.sr }),
      );
      localStorage.setItem(EXPIRY_KEY, (tokenData.exp * 1000).toString());
    },
    [],
  );

  const clearTokenFromStorage = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(EXPIRY_KEY);
  }, []);

  const getTokenExpirySeconds = useCallback((): number => {
    const expiryStr = localStorage.getItem(EXPIRY_KEY);
    if (!expiryStr) return 0;
    return Math.floor((parseInt(expiryStr, 10) - Date.now()) / 1000);
  }, []);

  const exchangeToken = useCallback(
    async (idToken: string, userName: string, userEmail: string): Promise<boolean> => {
      try {
        const response = await fetch(`${API_BASE_URL}/auth/exchange`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idToken }),
        });
        if (response.ok) {
          const data: TokenExchangeResponse = await response.json();
          saveTokenToStorage(data, userName, userEmail);
          setToken(data.token);
          setUser({ name: userName, username: userEmail, role: data.rl, subrole: data.sr });
          setIsAuthenticated(true);
          setAuthError(null);
          return true;
        }
        // Surface the server's reason (e.g. 403 — email not in the acl table).
        let detail = "Sign-in was rejected. Please contact an administrator.";
        try {
          const body = await response.json();
          if (body?.detail) detail = body.detail;
        } catch {
          // non-JSON body — keep the default message
        }
        setAuthError(detail);
        return false;
      } catch (error) {
        console.error("Error exchanging token:", error);
        setAuthError("Could not reach the server. Please try again.");
        return false;
      }
    },
    [saveTokenToStorage],
  );

  const stopTokenRefreshMonitor = useCallback(() => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
  }, []);

  const refreshToken = useCallback(async (): Promise<boolean> => {
    try {
      await msalInstance.initialize();
      const accounts = msalInstance.getAllAccounts();
      if (accounts.length === 0) return false;
      const response = await msalInstance.acquireTokenSilent({ scopes: MS_SCOPES, account: accounts[0] });
      if (response.idToken) {
        return await exchangeToken(response.idToken, response.account?.name || "", response.account?.username || "");
      }
      return false;
    } catch {
      return false;
    }
  }, [exchangeToken]);

  // Holds the latest startTokenRefreshMonitor so the scheduled timer can re-arm
  // itself without referencing its own binding before declaration.
  const startMonitorRef = useRef<(expiresInSeconds: number) => void>(() => {});

  const startTokenRefreshMonitor = useCallback(
    (expiresInSeconds: number) => {
      stopTokenRefreshMonitor();
      if (expiresInSeconds <= 0) {
        clearTokenFromStorage();
        setIsAuthenticated(false);
        setUser(null);
        setToken(null);
        return;
      }
      const refreshInMs = Math.max((expiresInSeconds - 10) * 1000, 0);
      refreshTimerRef.current = setTimeout(async () => {
        const refreshed = await refreshToken();
        if (refreshed) {
          startMonitorRef.current(getTokenExpirySeconds());
        } else {
          stopTokenRefreshMonitor();
          clearTokenFromStorage();
          setIsAuthenticated(false);
          setUser(null);
          setToken(null);
        }
      }, refreshInMs);
    },
    [stopTokenRefreshMonitor, clearTokenFromStorage, refreshToken, getTokenExpirySeconds],
  );
  useEffect(() => {
    startMonitorRef.current = startTokenRefreshMonitor;
  }, [startTokenRefreshMonitor]);

  const checkSession = useCallback(async () => {
    try {
      await msalInstance.initialize();
      const redirectResponse = await msalInstance.handleRedirectPromise();
      if (redirectResponse?.idToken) {
        const success = await exchangeToken(
          redirectResponse.idToken,
          redirectResponse.account?.name || "",
          redirectResponse.account?.username || "",
        );
        if (success) startTokenRefreshMonitor(getTokenExpirySeconds());
        setLoading(false);
        return;
      }

      const storedToken = localStorage.getItem(TOKEN_KEY);
      const storedUser = localStorage.getItem(USER_KEY);
      if (storedToken && storedUser) {
        const expiresIn = getTokenExpirySeconds();
        if (expiresIn <= 10) {
          const refreshed = await refreshToken();
          if (refreshed) {
            const newUser = localStorage.getItem(USER_KEY);
            const newToken = localStorage.getItem(TOKEN_KEY);
            if (newUser && newToken) {
              setUser(JSON.parse(newUser));
              setToken(newToken);
              setIsAuthenticated(true);
              startTokenRefreshMonitor(getTokenExpirySeconds());
            }
          } else {
            clearTokenFromStorage();
          }
        } else {
          setUser(JSON.parse(storedUser));
          setToken(storedToken);
          setIsAuthenticated(true);
          startTokenRefreshMonitor(expiresIn);
        }
      }
    } catch (error) {
      console.error("Error checking session:", error);
    } finally {
      setLoading(false);
    }
  }, [exchangeToken, getTokenExpirySeconds, clearTokenFromStorage, refreshToken, startTokenRefreshMonitor]);

  useEffect(() => {
    void (async () => {
      await checkSession();
    })();
    return () => stopTokenRefreshMonitor();
  }, [checkSession, stopTokenRefreshMonitor]);

  const login = async () => {
    try {
      setAuthError(null);
      await msalInstance.initialize();
      await msalInstance.loginRedirect({ scopes: MS_SCOPES });
    } catch (error) {
      console.error("Error initiating login:", error);
    }
  };

  const logout = async () => {
    try {
      stopTokenRefreshMonitor();
      setIsAuthenticated(false);
      setUser(null);
      setToken(null);
      clearTokenFromStorage();

      await msalInstance.initialize();
      const tokenCacheKeys = Object.keys(localStorage).filter((key) =>
        key.startsWith(`msal.${msalConfig.auth.clientId}`),
      );
      tokenCacheKeys.forEach((key) => localStorage.removeItem(key));
      window.location.href = LOGIN_URL;
    } catch {
      setIsAuthenticated(false);
      setUser(null);
      setToken(null);
      clearTokenFromStorage();
      window.location.href = LOGIN_URL;
    }
  };

  return (
    <AuthContext.Provider
      value={{ isAuthenticated, user, loading, login, logout, token, authError, clearAuthError }}
    >
      {children}
    </AuthContext.Provider>
  );
}
