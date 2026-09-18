import type { CustomQueryResult, FlexQueryResult, ListFetchAll } from "./apiClient";

/**
 * Normalises the API's `listfetchall` wire shape into row objects.
 *
 * That shape (routers/reports.py::_listfetchall, ported verbatim from the
 * legacy Django app) is:
 *   - multi-column: [columns: string[], ...rows: unknown[][]]
 *   - single-column: [columnName, ...values] — a FLAT array, not nested,
 *     because a single-column result has no per-row array to nest into.
 */
export function normalizeListFetchAll(result: ListFetchAll): Record<string, unknown>[] {
  if (result.length === 0) return [];
  const first = result[0];
  if (Array.isArray(first)) {
    const columns = first as string[];
    const rows = result.slice(1) as unknown[][];
    return rows.map((row) => Object.fromEntries(columns.map((c, i) => [c, row[i]])));
  }
  const columnName = first as string;
  const values = result.slice(1);
  return values.map((v) => ({ [columnName]: v }));
}

/** Row objects + (for a flexquery) the effective column/groupby config the
 *  server actually applied, from either wire shape /reports/custom can return. */
export function extractRows(result: CustomQueryResult): {
  rows: Record<string, unknown>[];
  varcfg?: FlexQueryResult["varcfg"];
} {
  if (Array.isArray(result)) {
    // Either listfetchall (array of unknown) or dictfetchall (array of
    // objects, only when a caller explicitly asks for format=json).
    if (result.length > 0 && !Array.isArray(result[0]) && typeof result[0] === "object" && result[0] !== null) {
      return { rows: result as Record<string, unknown>[] };
    }
    return { rows: normalizeListFetchAll(result) };
  }
  return { rows: normalizeListFetchAll(result.data), varcfg: result.varcfg };
}

/** Columns + row-arrays (rather than row objects) — the shape DataTable/xlsx
 *  export want, preserving column order and letting a single-column result
 *  round-trip without inventing a synthetic key. */
export function toColumnsAndRows(result: CustomQueryResult): {
  columns: string[];
  rows: unknown[][];
  varcfg?: FlexQueryResult["varcfg"];
} {
  const listShape = Array.isArray(result) ? result : result.data;
  const varcfg = Array.isArray(result) ? undefined : result.varcfg;
  if (listShape.length === 0) return { columns: [], rows: [], varcfg };
  const first = listShape[0];
  if (Array.isArray(first)) {
    return { columns: first as string[], rows: listShape.slice(1) as unknown[][], varcfg };
  }
  if (typeof first === "object" && first !== null) {
    // dictfetchall (format=json) — only ever a flat array of row objects.
    const rows = listShape as unknown as Record<string, unknown>[];
    const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
    return { columns, rows: rows.map((r) => columns.map((c) => r[c])), varcfg };
  }
  const columnName = first as string;
  return { columns: [columnName], rows: listShape.slice(1).map((v) => [v]), varcfg };
}
