import { createContext, useContext } from "react";
import type { AuthContextType } from "../../types";

export const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  user: null,
  loading: true,
  login: () => {},
  logout: () => {},
  token: null,
  authError: null,
  clearAuthError: () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}
