import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  Box, Button, CircularProgress, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TablePagination, TableRow, TableSortLabel, Typography,
} from "@mui/material";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import { useQuery } from "@tanstack/react-query";
import { reportsApi } from "../lib/apiClient";
import { toColumnsAndRows } from "../lib/reportRows";
import { exportCsv, exportXlsx } from "../lib/xlsxExport";
import type { Group } from "../config/cache";

const MAX_ROWS_PER_PAGE = 50;

export type CellRenderer = (value: unknown, colIndex: number, row: unknown[]) => ReactNode;

interface DataTableProps {
  colnames: string[];
  rows: unknown[][];
  caption?: ReactNode;
  loading?: boolean;
  exports?: ("csv" | "xlsx")[];
  cellRender?: CellRenderer;
  toolbarExtra?: ReactNode;
  exportFilename?: string;
}

/** Plain-MUI sortable/paginated results table — replaces the legacy
 *  MaterialReactTable-based BaseTable. Column order/identity always matches
 *  `colnames`; `rows` are row-arrays (not objects), the shape every named
 *  report already returns. */
export function DataTable({
  colnames,
  rows,
  caption = "",
  loading = false,
  exports = ["csv", "xlsx"],
  cellRender,
  toolbarExtra,
  exportFilename = "data",
}: DataTableProps) {
  const [sort, setSort] = useState<{ col: number; dir: "asc" | "desc" } | null>(null);
  const [page, setPage] = useState(0);

  const sortedRows = useMemo(() => {
    if (sort === null) return rows;
    const { col, dir } = sort;
    const copy = [...rows];
    copy.sort((a, b) => {
      const av = a[col];
      const bv = b[col];
      if (av === bv) return 0;
      if (av === null || av === undefined) return 1;
      if (bv === null || bv === undefined) return -1;
      const cmp = av > bv ? 1 : -1;
      return dir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [rows, sort]);

  const paginate = rows.length > MAX_ROWS_PER_PAGE;
  const pageRows = paginate
    ? sortedRows.slice(page * MAX_ROWS_PER_PAGE, (page + 1) * MAX_ROWS_PER_PAGE)
    : sortedRows;

  const toggleSort = (col: number) => {
    setSort((prev) => {
      if (!prev || prev.col !== col) return { col, dir: "asc" };
      if (prev.dir === "asc") return { col, dir: "desc" };
      return null;
    });
  };

  if (loading) {
    return (
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, p: 2 }}>
        <CircularProgress size={20} /> <Typography variant="body2">Loading data…</Typography>
      </Box>
    );
  }

  return (
    <Box>
      {(exports.length > 0 || toolbarExtra) && (
        <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap", pb: 1.5 }}>
          {exports.includes("csv") && (
            <Button
              variant="outlined"
              size="small"
              startIcon={<FileDownloadIcon />}
              onClick={() => exportCsv(colnames, rows, `${exportFilename}.csv`)}
            >
              Export to csv
            </Button>
          )}
          {exports.includes("xlsx") && (
            <Button
              variant="outlined"
              size="small"
              startIcon={<FileDownloadIcon />}
              onClick={() => exportXlsx(colnames, rows, `${exportFilename}.xlsx`)}
            >
              Export to Excel
            </Button>
          )}
          {toolbarExtra}
        </Box>
      )}
      {caption && (
        <Typography variant="body2" sx={{ pb: 1 }}>
          {caption}
        </Typography>
      )}
      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              {colnames.map((col, idx) => (
                <TableCell
                  key={col + idx}
                  sx={{ fontStyle: "italic", fontWeight: "bold", fontSize: 13, whiteSpace: "nowrap" }}
                >
                  <TableSortLabel
                    active={sort?.col === idx}
                    direction={sort?.col === idx ? sort.dir : "asc"}
                    onClick={() => toggleSort(idx)}
                  >
                    {col}
                  </TableSortLabel>
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {pageRows.map((row, rIdx) => (
              <TableRow key={rIdx} hover>
                {row.map((cell, cIdx) => (
                  <TableCell key={cIdx} sx={{ fontSize: 12, whiteSpace: "nowrap" }}>
                    {cellRender ? cellRender(cell, cIdx, row) : String(cell ?? "")}
                  </TableCell>
                ))}
              </TableRow>
            ))}
            {pageRows.length === 0 && (
              <TableRow>
                <TableCell colSpan={colnames.length || 1}>
                  <Typography variant="body2" color="text.secondary">
                    No data.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
      {paginate && (
        <TablePagination
          component="div"
          count={rows.length}
          page={page}
          onPageChange={(_e, p) => setPage(p)}
          rowsPerPage={MAX_ROWS_PER_PAGE}
          rowsPerPageOptions={[MAX_ROWS_PER_PAGE]}
        />
      )}
    </Box>
  );
}

/** DataTable that fetches its own data from a named report via
 *  /reports/custom. `group` namespaces the TanStack Query cache key so
 *  lib/useLastEditCheck's le_<group> poll invalidates it correctly. */
export function FetchDataTable({
  group,
  queryName,
  params,
  ...rest
}: Omit<DataTableProps, "colnames" | "rows" | "loading"> & {
  group: Group;
  queryName: string;
  params: Record<string, unknown>;
}) {
  const { data, isLoading, error } = useQuery({
    queryKey: [group, "report", queryName, params],
    queryFn: () => reportsApi.run(queryName, params),
  });

  if (error) {
    return (
      <Typography variant="body2" color="error">
        {(error as Error).message}
      </Typography>
    );
  }

  const { columns, rows } = data ? toColumnsAndRows(data) : { columns: [], rows: [] };
  return <DataTable colnames={columns} rows={rows} loading={isLoading} {...rest} />;
}
