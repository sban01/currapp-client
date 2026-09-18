import type { WorkBook } from "xlsx-js-style";
import { reportsApi } from "./apiClient";
import { toColumnsAndRows } from "./reportRows";

// Same production resource the legacy app fetched (a blank LO-upload
// template maintained outside this codebase). Ported from
// pages/objectives/objectivesviews.jsx::saveXlsx.
const LO_TEMPLATE_URL = "https://cai.sgu.edu/resources/LOtemplate.xlsx";

/** Fetch a named report's data and drop it into the CM-facing LO upload
 *  template's 'objectives' sheet. Returns an error string on failure, or
 *  `true` on success (a file download is triggered as a side effect). */
export async function saveLoTemplateXlsx(queryName: string, params: Record<string, unknown>): Promise<true | string> {
  const XLSX = await import("xlsx-js-style");
  let wb: WorkBook;
  let columns: string[];
  let rows: unknown[][];
  try {
    const result = await reportsApi.run(queryName, params);
    ({ columns, rows } = toColumnsAndRows(result));
    const res = await fetch(LO_TEMPLATE_URL);
    const ab = await res.arrayBuffer();
    wb = XLSX.read(ab);
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
  if (!wb.SheetNames.includes("objectives")) {
    return "Error: cannot parse LO template, requested LO file was not downloaded.";
  }
  if (rows.length === 0) {
    return "Query returned no data, requested LO file was not downloaded.";
  }

  const headerRow = columns.map((c) => c.replace(/_/g, " "));
  wb.Sheets["objectives"] = XLSX.utils.aoa_to_sheet([headerRow, ...rows]);
  XLSX.writeFile(wb, "LOs.xlsx");
  return true;
}
