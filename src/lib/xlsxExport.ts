/** Export column headers + row-array data as an .xlsx file. `rows` is an
 *  array of arrays (one row per entry), matching the `listfetchall` shape
 *  most report tables already carry. The xlsx library is loaded lazily on
 *  first use, hence async. */
export async function exportXlsx(colnames: string[], rows: unknown[][], filename = "data.xlsx") {
  // Loaded on demand: xlsx-js-style is by far the largest dependency.
  const XLSX = await import("xlsx-js-style");
  const aoa = [colnames, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "data");
  XLSX.writeFile(wb, filename);
}

/** Minimal CSV export (no external dependency) — quotes any cell containing
 *  a comma, quote, or newline, doubling embedded quotes per RFC 4180. */
export function exportCsv(colnames: string[], rows: unknown[][], filename = "data.csv") {
  const escape = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [colnames, ...rows].map((row) => row.map(escape).join(","));
  const blob = new Blob([lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
