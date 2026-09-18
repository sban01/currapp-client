import { useMemo } from "react";
import { Button, Typography } from "@mui/material";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import * as XLSX from "xlsx-js-style";
import { useQuery } from "@tanstack/react-query";
import { DataTable } from "../../components/DataTable";
import { reportsApi } from "../../lib/apiClient";
import { toColumnsAndRows } from "../../lib/reportRows";
import type { Group } from "../../config/cache";

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Student-handout view: LOs grouped into headed blocks per activity/DLA
 *  title, code + text only. Ported from pages/objectives/studentview.jsx.
 *  Source row shape: actID, type, lecture_title, DLA_title, LO_code, LO, discipline. */
export function StudentView({ group, queryName, params, caption }: { group: Group; queryName: string; params: Record<string, unknown>; caption: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: [group, "report", queryName, params],
    queryFn: () => reportsApi.run(queryName, params),
  });

  const processed = useMemo(() => {
    if (!data) return [] as (string | null)[][];
    const { rows } = toColumnsAndRows(data);
    const out: (string | null)[][] = [];
    let actid: unknown, type: unknown, dlatitle = "";
    for (const row of rows) {
      const [rActid, rType, lectureTitle, rDlaTitle] = row as [unknown, string, string, string];
      const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, "");
      if (actid !== rActid || type !== rType || normalize(dlatitle) !== normalize(rDlaTitle)) {
        actid = rActid;
        type = rType;
        dlatitle = rDlaTitle;
        const title = rType === "DLA" ? rDlaTitle : lectureTitle;
        if (out.length > 0) out.push([null, null]);
        out.push([`${capitalize(String(rType))} ${row[6]}`, title]);
      }
      out.push([String(row[4] ?? ""), String(row[5] ?? "")]);
    }
    return out;
  }, [data]);

  const exportPretty = () => {
    const ws = XLSX.utils.json_to_sheet([]);
    XLSX.utils.sheet_add_aoa(ws, [[caption]]);
    const offset = 2;
    XLSX.utils.sheet_add_aoa(ws, processed, { origin: { r: offset, c: 0 } });
    if (!ws["!cols"]) ws["!cols"] = [];
    ws["!cols"][0] = { wch: 32 };
    ws["!cols"][1] = { wch: 60 };
    processed.forEach((row, index) => {
      if (row[0] !== null && !row[0]!.includes(".")) {
        const cellRef = XLSX.utils.encode_cell({ r: index + offset, c: 1 });
        if (ws[cellRef]) ws[cellRef].s = { fill: { fgColor: { rgb: "90EE90" } }, font: { bold: true } };
      }
    });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "LOs");
    XLSX.writeFile(wb, "objectives.xlsx");
  };

  if (error) return <Typography color="error">{(error as Error).message}</Typography>;

  return (
    <DataTable
      colnames={["LO code", "LO text"]}
      rows={processed}
      loading={isLoading}
      caption={caption}
      exports={["csv"]}
      toolbarExtra={
        <Button variant="outlined" size="small" startIcon={<FileDownloadIcon />} onClick={exportPretty}>
          Export to xlsx
        </Button>
      }
      cellRender={(value, colIndex, row) => {
        if (colIndex === 1 && row[0] !== null && !String(row[0]).includes(".")) {
          return <span style={{ backgroundColor: "#90EE90", fontWeight: "bold" }}>{String(value ?? "")}</span>;
        }
        return String(value ?? "");
      }}
    />
  );
}
