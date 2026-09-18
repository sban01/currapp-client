import axios from "axios";
import { API_BASE_URL, BASE } from "./auth/authConfig";
import type { Group } from "../config/cache";

const TOKEN_KEY = "currapp_token";

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
});

// Attach the internal JWT to every request.
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error),
);

// On 401, clear storage and bounce to the login screen.
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem("currapp_user");
      localStorage.removeItem("currapp_token_expiry");
      window.location.href = BASE;
    }
    return Promise.reject(error);
  },
);

/** Best-effort human-readable message from an axios error. */
export function apiErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail;
    if (typeof detail === "string") return detail;
    return error.message;
  }
  return error instanceof Error ? error.message : String(error);
}

// --- Reporting engine (routers/reports.py) ------------------------------------
// Named, DB-stored SQL reports. `listfetchall` shape: [columns, ...rows] as
// array-of-arrays (or, for a single-column result, [columnName, ...values] —
// a flat array). A flexquery (dynamic column/GROUP-BY selection) instead
// returns { data: <listfetchall shape>, varcfg }. See lib/reportRows.ts for a
// helper that normalises either shape into row objects.
export type ListFetchAll = unknown[];
export interface FlexQueryVarcfg {
  /** Columns currently selected for display, in join order. */
  displayed: string[];
  /** The rest of `varnames['vars']` — not currently displayed. Key has a
   *  literal space, matching utils/flexquery.py's wire shape exactly. */
  "not shown": string[];
}
export interface FlexQueryResult {
  data: ListFetchAll;
  varcfg: FlexQueryVarcfg | null;
}
export type CustomQueryResult = ListFetchAll | Record<string, unknown>[] | FlexQueryResult;

export const reportsApi = {
  /** Every callable report name. */
  async listQueries(): Promise<string[]> {
    const { data } = await apiClient.post("/reports/custom", {});
    return data as string[];
  },
  /** Run a named report. `varnames` (flexquery column/groupby overrides) are
   *  merged into the same params object the API expects. */
  async run(name: string, params: Record<string, unknown> = {}): Promise<CustomQueryResult> {
    const { data } = await apiClient.post("/reports/custom", { query: name, ...params });
    return data as CustomQueryResult;
  },
  /** Per-group source-data timestamps, for cache invalidation. Public
   *  endpoint (no auth) — polled by lib/useLastEditCheck. */
  async lastedit(): Promise<Record<Group, number>> {
    const { data } = await apiClient.get("/reports/lastedit");
    return data as Record<Group, number>;
  },
};

// --- Generic admin table editor (routers/admin_tables.py) ---------------------

export type AdminTableKey = "editableterms" | "acl" | "groupings" | "activitytypes" | "hlobjectives" | "activities";

export const adminTablesApi = {
  async getRows(tableKey: AdminTableKey, where: { termY?: number; termM?: string } = {}): Promise<Record<string, unknown>[]> {
    const { data } = await apiClient.get(`/admin/tables/${tableKey}`, { params: where });
    return data as Record<string, unknown>[];
  },
  async insert(tableKey: AdminTableKey, row: Record<string, unknown>): Promise<{ reply: string }> {
    const { data } = await apiClient.post(`/admin/tables/${tableKey}`, { type: "INS", data: row });
    return data;
  },
  /** One cell edit per entry: `{ id, [column]: value }`. */
  async update(
    tableKey: AdminTableKey,
    cells: Record<string, unknown>[],
    where: Record<string, unknown> = {},
  ): Promise<{ reply: string }> {
    const { data } = await apiClient.post(`/admin/tables/${tableKey}`, { type: "UPD", data: cells, where });
    return data;
  },
  async remove(tableKey: AdminTableKey, id: number): Promise<{ reply: string }> {
    const { data } = await apiClient.post(`/admin/tables/${tableKey}`, { type: "DEL", data: id });
    return data;
  },
};

// --- Schedule admin (routers/schedule_upload.py) -------------------------------

export const scheduleAdminApi = {
  async upload(file: File, termY: number, termM: string): Promise<{ message: string }> {
    const form = new FormData();
    form.append("file", file);
    form.append("termY", String(termY));
    form.append("termM", termM);
    const { data } = await apiClient.post("/schedule-admin/upload", form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data;
  },
  async update(
    file: File,
    termY: number,
    termM: string,
    updatecols: string[],
  ): Promise<{ message: string }> {
    const form = new FormData();
    form.append("file", file);
    form.append("termY", String(termY));
    form.append("termM", termM);
    for (const c of updatecols) form.append("updatecols", c);
    const { data } = await apiClient.post("/schedule-admin/update", form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data;
  },
  async delete(termY: number, termM: string, course: string): Promise<{ message: string }> {
    const { data } = await apiClient.post("/schedule-admin/delete", { termY, termM, course });
    return data;
  },
};

// --- CM admin (routers/lo_upload.py) -------------------------------------------

export interface LoUploadReportRow {
  status: "matched" | "lo_only" | "activity_only";
  course: string;
  module: string;
  type: string;
  disciplines: string;
  activities_title: string;
  lo_lecture_title: string;
}

export const cmAdminApi = {
  async upload(file: File, termY: number, termM: string): Promise<{ data?: LoUploadReportRow[]; message: string; success: boolean }> {
    const form = new FormData();
    form.append("file", file);
    form.append("termY", String(termY));
    form.append("termM", termM);
    const { data } = await apiClient.post("/cm-admin/upload", form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data;
  },
  async delete(termY: number, termM: string): Promise<{ message: string }> {
    const { data } = await apiClient.post("/cm-admin/delete", { termY, termM });
    return data;
  },
};
