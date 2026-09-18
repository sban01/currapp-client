# currapp-client

React + Vite frontend for **SOM Curriculum App** (by CAI). Served at `/currapp`,
proxied in dev to the FastAPI backend (`../currapp-api`) on port 8000. A
from-scratch port of a legacy Django-templated React app
(`../../webscripts/currapp`), rebuilt against this repo's own backend and the
conventions established by the sibling clients (`soms-client`,
`projects-frontend`).

## Stack

- **React 19** + TypeScript + Vite (`base: '/currapp'`, dev port 3002)
- **@azure/msal-browser** — Azure AD SSO only (no Google/email login); trades
  a Microsoft ID token for an internal JWT
- **@tanstack/react-query** — data fetching/cache, driven by server-side
  `lastedit` timestamps rather than time-based expiry (see below)
- **@mui/material** — all UI (no Tailwind, no separate component kit)
- **react-router-dom v7** — real routes, replacing the legacy app's
  tab-index navigation
- **xlsx-js-style** — client-side Excel/CSV export

Deliberately **not** used, despite the legacy app depending on them:
`material-react-table`, `mui-file-dropzone`, `@observablehq/plot`,
`react-dnd`, `react-tracked`, `moment` — each replaced with a plain-MUI or
dependency-free equivalent (see *Key patterns* below) to avoid pinning
libraries of uncertain React 19 / MUI v9 compatibility. Functionality is
preserved; only the underlying widget changed.

## Setup

```bash
npm install
cp .env.example .env   # fill in VITE_CLIENT_ID and VITE_AUTHORITY

npm run dev            # http://localhost:3002/currapp
npm run build           # output to build/
```

## Directory structure

```
src/
├── main.tsx                        # App bootstrap: QueryClient, theme, providers
├── App.tsx                         # Router + role-gated routes, from config/menu.tsx
├── config/
│   ├── cache.ts                    # GROUPS, staleTime/lastedit-poll settings
│   └── menu.tsx                    # Single source of truth: route -> component -> min roles
├── lib/
│   ├── apiClient.ts                # Axios + JWT interceptor; reportsApi/adminTablesApi/scheduleAdminApi/cmAdminApi
│   ├── reportRows.ts               # Normalises the reporting engine's listfetchall wire shape
│   ├── GlobalsContext.tsx          # termY/termM + course/module/discipline lists
│   ├── useLastEditCheck.ts         # le_<group> staleness poll -> query invalidation
│   ├── roles.ts                    # hasRole() for currapp's PARALLEL (non-ladder) roles
│   ├── searchQuery.ts              # AND/OR/AND-NOT search-string -> regex compiler
│   ├── saveIcal.ts, xlsxExport.ts, loTemplateExport.ts
│   └── auth/authConfig.ts          # MSAL PublicClientApplication config
├── types/index.ts                  # Auth/role types
├── components/
│   ├── auth/{AuthProvider,AuthGateway,authContext}.tsx
│   ├── Layout.tsx                  # App shell: top bar (term selectors, user menu) + nav drawer
│   ├── StalenessMonitor.tsx        # Mounts useLastEditCheck
│   ├── DataTable.tsx               # Sortable/paginated results table (+ FetchDataTable wrapper)
│   ├── EditTable.tsx               # Generic admin CRUD table, backed by /admin/tables/{key}
│   ├── TreeView.tsx                # Collapsible tree list for '!'-delimited graph reports
│   ├── MultiSelect.tsx             # Chained "view by X" dropdowns
│   ├── UploadFile.tsx              # Staged Excel file picker
│   └── ActionButtons.tsx
└── page-components/
    ├── progress/ProgressPage.tsx
    ├── schedule/{SchedulePage,SchedulePersonalPage}.tsx
    ├── objectives/{ObjectivesPage,ObjectivesSearchPage,ObjectivesTracePage,StudentView}.tsx
    ├── admin/AdminPage.tsx              # editableterms/acl/groupings/activitytypes/hlobjectives
    ├── scheduleadmin/ScheduleAdminPage.tsx
    └── cmadmin/CMAdminPage.tsx
```

## Key patterns

### Authentication flow

Same shape as `soms-client`/`projects-frontend`, MS-only:

1. `AuthProvider` (`components/auth/AuthProvider.tsx`) initializes MSAL with
   `clientId`/`authority` from `.env` and attempts a silent SSO on mount,
   falling back to `loginRedirect`.
2. The Microsoft ID token is posted to `POST /currapp-api/auth/exchange`.
   The API validates it and — only for emails already listed in the
   backend's `acl` table — returns `{ token, exp, rl, sr }` (an internal JWT
   plus role/subrole).
3. Stored in `localStorage` under `currapp_token` / `currapp_user` /
   `currapp_token_expiry`. A **self-rescheduling** `setTimeout` refreshes
   the token ~10s before `exp`, independent of the `lastedit` poll below.
4. A 401 from any API call (axios response interceptor in `lib/apiClient.ts`)
   clears storage and bounces to `/currapp`.

### lastedit staleness polling (not time-based cache expiry)

`react-query`'s `staleTime`/`gcTime` are set to a **daily** floor
(`config/cache.ts`) — queries don't expire on their own. Freshness instead
comes from `lib/useLastEditCheck.ts`, mounted once via
`components/StalenessMonitor.tsx`: it polls `GET /currapp-api/reports/
lastedit` (public, no auth) hourly and invalidates exactly the query group
(`schedule` / `objectives` / `admin` / `graph`) whose `le_<group>` stamp
advanced. Every query key used against a report or admin-table endpoint
starts with its owning group, so `invalidateQueries({queryKey:[group]})`
clears precisely what that source feeds — see any call site in
`components/DataTable.tsx`/`EditTable.tsx` for the pattern.

### Roles are parallel, not a ladder

Unlike `soms-client`'s `'' < invite < admin` rank, currapp's roles
(`admin` / `scheduler` / `CD` / `CM`) gate different, mostly-disjoint parts
of the app — `admin` happens to also satisfy every role-gated route because
it's listed explicitly everywhere, not because it outranks the others.
`lib/roles.ts::hasRole(userRole, allowedRoles[])` is a plain set-membership
check, not a rank comparison. `config/menu.tsx`'s `MenuItem.roles` and
`App.tsx`'s `RequireRole` both take a role **array**. This is client-side
convenience only — the API enforces the real rule on every request
(`dependencies.require_roles`, and for the `activities` table,
`utils/table_registry.py`'s `activities_access_policy`).

### GlobalsContext: term + lookup lists

`lib/GlobalsContext.tsx` holds the selected `termY`/`termM` (persisted to
`localStorage`, editable from the top bar in `Layout.tsx`) plus
`courses`/`modules`/`disciplines`, fetched once via the public
`list_groupingValues` named report (not the admin-only `/admin/tables/
groupings` route, since every role needs these lists for dropdowns).
`courses` narrows to `['BPM1']` when `termM === 'April'` — a fixed business
rule carried over from the legacy app's `globalstate.jsx`, not derived from
the DB.

### Reporting engine consumption

`lib/apiClient.ts::reportsApi.run(name, params)` calls `POST /reports/
custom`. The response is one of three wire shapes (see that file's
docstring): a plain `listfetchall` array (`[columns, ...rows]`, or a flat
`[columnName, ...values]` for a single-column result), a dict array
(`format=json`), or `{ data, varcfg }` for a flexquery. `lib/reportRows.ts`
normalizes any of these into row objects (`extractRows`) or
columns-plus-row-arrays (`toColumnsAndRows`, what `DataTable`/xlsx export
want, since it preserves column order without inventing synthetic keys for
a single-column result).

### EditTable: the generic admin CRUD table

`components/EditTable.tsx` is a thin, honest client for
`/admin/tables/{table_key}` — it does not itself decide who can edit what;
it renders whatever `columns` config the page passes (e.g.
`page-components/scheduleadmin/ScheduleAdminPage.tsx`'s `CD_COLUMNS` vs.
`cmadmin/CMAdminPage.tsx`'s `CM_COLUMNS`, matching the legacy split of
separate CD/CM edit pages) and lets every write attempt go to the server,
which is the actual authority (locked-term / wrong-role edits come back as
a rejected mutation, shown inline). Pending cell edits are batched
client-side (`Map` keyed `${id}:${column}`, last-write-wins) and flushed on
"Save updates", mirroring the API's own per-cell dedup.

### TreeView: dependency-free graph rendering

The legacy app rendered its "graph view" reports (course → module → type →
title, `!`-delimited rows) with `@observablehq/plot`'s cluster diagram.
`components/TreeView.tsx` instead parses those same delimited rows into a
nested structure (grouping by shared path prefixes) and renders a
collapsible MUI `List` — same underlying data and drill-down interaction,
no charting-library dependency. A `flexquery`'s column/GROUP-BY picker
(legacy: drag-and-drop reorder list) is a simplified checkbox list here
(check = append to display order, uncheck = remove).

### Dev proxy

`vite.config.ts` proxies `/currapp-api` to `http://localhost:8000` in dev,
so `VITE_API_BASE_URL=/currapp-api` works same-origin without CORS.
