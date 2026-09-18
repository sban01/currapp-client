import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { reportsApi } from "./apiClient";
import { FOCUS_RECHECK_MS, GROUPS, LASTEDIT_POLL_MS } from "../config/cache";
import type { Group } from "../config/cache";

/**
 * Poll GET /reports/lastedit and invalidate the query groups whose source
 * data moved.
 *
 * This is what actually keeps the app fresh: with a daily staleTime, queries
 * never expire on their own, so a group is refetched when — and only when —
 * its `le_<group>` stamp advances on the server. Direct invalidation after a
 * local mutation stays the primary path; this is the safety net for changes
 * made elsewhere (another admin's edit, an Excel upload from a different
 * session).
 *
 * Mounted once, by components/StalenessMonitor.
 */
export function useLastEditCheck() {
  const queryClient = useQueryClient();
  // In-memory only. There is no query persister, so the cache is empty after a
  // reload anyway — nothing to invalidate, nothing worth persisting.
  const last = useRef<Record<Group, number> | null>(null);
  const checkedAt = useRef(0);

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      let stamps: Record<Group, number>;
      try {
        stamps = await reportsApi.lastedit();
      } catch {
        return; // offline / API down — try again next tick
      }
      if (cancelled) return;

      // Shape guard: a misrouted base URL returns index.html, which parses as
      // something other than a set of numbers. Acting on that would invalidate
      // everything on every tick.
      if (!GROUPS.every((g) => Number.isFinite(stamps[g]))) return;

      checkedAt.current = Date.now();
      if (last.current) {
        for (const g of GROUPS) {
          // Strictly greater: a server clock that steps backwards must not trigger.
          if (stamps[g] > last.current[g]) {
            queryClient.invalidateQueries({ queryKey: [g] });
          }
        }
      }
      // The first tick only records the baseline — no invalidation storm on mount.
      last.current = stamps;
    };

    void check();
    const id = setInterval(() => void check(), LASTEDIT_POLL_MS);

    const onOnline = () => void check();
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - checkedAt.current < FOCUS_RECHECK_MS) return;
      void check();
    };
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      clearInterval(id);
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [queryClient]);
}
