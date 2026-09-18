import type { Role } from "../types";

// currapp's roles are NOT a rank ladder (unlike soms-client's '' < invite <
// admin): admin/scheduler/CD/CM each gate different, mostly-disjoint parts of
// the app (see cmw/edit_table.py::rightscheck() and navbar.jsx's tab list —
// admin happens to also see every privileged tab, but that's because it's
// listed explicitly everywhere, not because it out-ranks the others).
//
// Client-side gating here is convenience only (hides menu entries / redirects
// away from a page) — the API enforces the real access control on every
// request via dependencies.require_roles() and, for `activities`,
// table_registry.activities_access_policy().

/** True when `userRole` is one of `allowedRoles`. No restriction (open to any
 *  signed-in user) when `allowedRoles` is undefined or empty. */
export function hasRole(userRole: Role | undefined, allowedRoles?: readonly Role[]): boolean {
  if (!allowedRoles || allowedRoles.length === 0) return true;
  return !!userRole && allowedRoles.includes(userRole);
}
