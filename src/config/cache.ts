/**
 * Query cache + staleness-polling configuration.
 *
 * Curriculum data updates on *source events* (a term rollover upload, an
 * admin edit), not on a clock: the API stamps each source group with a
 * `le_<group>` timestamp and we poll GET /reports/lastedit for changes. The
 * time-based settings below are only the backstop for a poll that never
 * arrived.
 */

/** Data-source groups, matching the API's le_<group> keys (utils/lastedit.py).
 *  Every query key starts with one of these, so one invalidateQueries per
 *  group clears exactly the queries that source feeds. */
export const GROUPS = ["schedule", "objectives", "admin", "graph"] as const;
export type Group = (typeof GROUPS)[number];

/** Read a positive number from an env var, falling back on anything unusable.
 *  `??` alone is not enough: a var that is present but EMPTY (`VITE_X=` in .env)
 *  arrives as "", which `??` passes straight through and Number("") turns into
 *  0 — a zero staleTime, i.e. silently no caching at all. */
function envNumber(raw: unknown, fallback: number): number {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/**
 * staleTime AND gcTime, both from the same setting, deliberately equal: a
 * daily floor for live *and* unmounted queries. gcTime matters as much as
 * staleTime here — react-query v5 defaults it to five minutes, so leaving it
 * alone would evict cached data long before staleTime was ever consulted,
 * and navigating between admin pages would refetch everything.
 */
export const STALE_TIME_MS = envNumber(import.meta.env.VITE_STALE_TIME_HOURS, 24) * 3_600_000;
export const GC_TIME_MS = STALE_TIME_MS;

/** How often to poll GET /reports/lastedit. Independent of the access-token
 *  lifetime — this is about data freshness, not sessions. */
export const LASTEDIT_POLL_MS = envNumber(import.meta.env.VITE_LASTEDIT_POLL_MS, 3_600_000);

/** On tab focus, re-check early if the last check is older than this. */
export const FOCUS_RECHECK_MS = 15 * 60_000;
