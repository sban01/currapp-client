// Authentication types.
//
// `role` is NOT a rank ladder here (unlike soms-client): admin/scheduler/CD/CM
// are parallel roles gating different, mostly-disjoint parts of the app, not
// points on a single privilege scale. See lib/roles.ts.

export type Role = "admin" | "scheduler" | "CD" | "CM" | "";

export interface AuthContextType {
  isAuthenticated: boolean;
  user: {
    name?: string;
    username?: string;
    role?: Role;
    subrole?: string;
  } | null;
  loading: boolean;
  login: () => void;
  logout: () => void;
  token: string | null;
  /** Set when token exchange is rejected (e.g. 403 — email not authorized). */
  authError: string | null;
  clearAuthError: () => void;
}

export interface TokenExchangeResponse {
  token: string;
  exp: number;
  rl: Role;
  sr: string;
}
