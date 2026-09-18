import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { reportsApi } from "./apiClient";
import { extractRows } from "./reportRows";

export type TermMonth = "January" | "April" | "August";

const STORAGE_KEY = "currapp_term";

interface StoredTerm {
  termY: number;
  termM: TermMonth;
}

function loadStoredTerm(): StoredTerm {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.termY === "number" && typeof parsed.termM === "string") {
        return parsed;
      }
    }
  } catch {
    // ignore — fall through to default
  }
  return { termY: new Date().getFullYear(), termM: "January" };
}

// April intake only ever runs BPM1 — a fixed business rule carried over from
// the legacy app (components/globalstate.jsx), not derived from the DB.
const COURSES_APRIL = ["BPM1"];

interface GlobalsContextType {
  termY: number;
  termM: TermMonth;
  setTermY: (y: number) => void;
  setTermM: (m: TermMonth) => void;
  /** Course codes valid for the CURRENT termM (April intake -> BPM1 only). */
  courses: string[];
  /** All course codes, regardless of term month. */
  coursesAll: string[];
  modules: string[];
  disciplines: string[];
  loading: boolean;
}

const GlobalsContext = createContext<GlobalsContextType | null>(null);

/** Named-report-backed lookup lists (course/module/discipline codes), fetched
 *  from the `groupings` table via the public `list_groupingValues` report —
 *  not the admin-only /admin/tables/groupings route, since every signed-in
 *  role (not just admin) needs these lists to populate selectors. */
function useGroupingValues(type: "course" | "module" | "discipline"): string[] {
  const { data } = useQuery({
    queryKey: ["admin", "groupingValues", type],
    queryFn: async () => {
      const result = await reportsApi.run("list_groupingValues", { type });
      return extractRows(result).rows.map((r) => String(Object.values(r)[0]));
    },
  });
  return data ?? [];
}

export function GlobalsProvider({ children }: { children: ReactNode }) {
  const [term, setTerm] = useState<StoredTerm>(loadStoredTerm);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(term));
    } catch {
      // best-effort persistence only
    }
  }, [term]);

  const coursesAll = useGroupingValues("course");
  const modules = useGroupingValues("module");
  const disciplines = useGroupingValues("discipline");

  const courses = useMemo(
    () => (term.termM === "April" ? COURSES_APRIL : coursesAll),
    [term.termM, coursesAll],
  );

  const value = useMemo<GlobalsContextType>(
    () => ({
      termY: term.termY,
      termM: term.termM,
      setTermY: (y: number) => setTerm((t) => ({ ...t, termY: y })),
      setTermM: (m: TermMonth) => setTerm((t) => ({ ...t, termM: m })),
      courses,
      coursesAll,
      modules,
      disciplines,
      loading: coursesAll.length === 0,
    }),
    [term, courses, coursesAll, modules, disciplines],
  );

  return <GlobalsContext.Provider value={value}>{children}</GlobalsContext.Provider>;
}

export function useGlobals(): GlobalsContextType {
  const ctx = useContext(GlobalsContext);
  if (!ctx) throw new Error("useGlobals must be used within a GlobalsProvider");
  return ctx;
}
