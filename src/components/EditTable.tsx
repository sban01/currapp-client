import { useMemo, useState } from "react";
import {
  Alert, Box, Button, CircularProgress, IconButton, MenuItem,
  Paper, Select, Table, TableBody, TableCell, TableContainer, TableHead, TablePagination, TableRow, TextField,
  Tooltip, Typography,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminTablesApi, apiErrorMessage } from "../lib/apiClient";
import type { AdminTableKey } from "../lib/apiClient";
import { exportXlsx } from "../lib/xlsxExport";
import type { Group } from "../config/cache";

export interface EditColumnDef {
  key: string;
  label?: string;
  type?: "text" | "number" | "select" | "boolean";
  /** Select options, or a {displayed: dbValue} map when the DB value differs
   *  from what's shown (e.g. locked/editable -> false/true). */
  options?: string[] | Record<string, string | boolean>;
  editable?: boolean;
  width?: number;
  required?: boolean;
}

interface EditTableProps {
  tableKey: AdminTableKey;
  group: Group;
  columns: EditColumnDef[];
  where?: Record<string, unknown>;
  allowCreate?: boolean;
  allowDelete?: boolean;
  rowDefaults?: Record<string, unknown>;
}

/** Pending cell edit, keyed `${id}:${column}` so only the latest edit per
 *  cell is kept (matches the server's own dedup in routers/admin_tables.py). */
type PendingEdits = Map<string, { id: number; column: string; value: unknown }>;

function optionEntries(options: EditColumnDef["options"]): [string, string | boolean][] {
  if (!options) return [];
  if (Array.isArray(options)) return options.map((o) => [o, o]);
  return Object.entries(options);
}

/** Generic admin table editor — replaces legacy's cmw/edit_table.py +
 *  components/edittable.jsx (which used material-react-table; this is a
 *  plain-MUI equivalent to avoid pinning a grid library of uncertain React 19
 *  compatibility). Every table/column-name string here is a literal from
 *  `columns`/`tableKey`, never client input — the actual injection-surface
 *  fix lives server-side (utils/table_registry.py); this component only
 *  needs to stay a well-behaved caller of that API. */
export function EditTable({ tableKey, group, columns, where = {}, allowCreate = true, allowDelete = true, rowDefaults }: EditTableProps) {
  const queryClient = useQueryClient();
  const [edits, setEdits] = useState<PendingEdits>(new Map());
  const [creating, setCreating] = useState(false);
  const [newRow, setNewRow] = useState<Record<string, unknown>>({});
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const [filter, setFilter] = useState("");

  const queryKey = useMemo(() => [group, "admin-table", tableKey, where], [group, tableKey, where]);
  const { data: rows, isLoading, isError, error } = useQuery({
    queryKey,
    queryFn: () => adminTablesApi.getRows(tableKey, where),
  });

  // Only one page of rows is ever mounted: a term's activities run to several
  // thousand rows, and rendering an input per editable cell for all of them
  // freezes the tab. Pending edits live in `edits` (keyed by row id), so they
  // survive paging and filtering.
  const filteredRows = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q || !rows) return rows ?? [];
    return rows.filter((r) => columns.some((c) => String(r[c.key] ?? "").toLowerCase().includes(q)));
  }, [rows, filter, columns]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: [group] });

  const updateMutation = useMutation({
    mutationFn: () =>
      adminTablesApi.update(
        tableKey,
        Array.from(edits.values()).map((e) => ({ id: e.id, [e.column]: e.value })),
        where,
      ),
    onSuccess: (data) => {
      setMessage({ text: data.reply, error: false });
      setEdits(new Map());
      invalidate();
    },
    onError: (err) => setMessage({ text: apiErrorMessage(err), error: true }),
  });

  const createMutation = useMutation({
    mutationFn: () => adminTablesApi.insert(tableKey, newRow),
    onSuccess: (data) => {
      setMessage({ text: data.reply, error: false });
      setCreating(false);
      setNewRow({});
      invalidate();
    },
    onError: (err) => setMessage({ text: apiErrorMessage(err), error: true }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => adminTablesApi.remove(tableKey, id),
    onSuccess: (data) => {
      setMessage({ text: data.reply, error: false });
      invalidate();
    },
    onError: (err) => setMessage({ text: apiErrorMessage(err), error: true }),
  });

  const setEdit = (id: number, column: string, value: unknown) => {
    setEdits((prev) => {
      const next = new Map(prev);
      next.set(`${id}:${column}`, { id, column, value });
      return next;
    });
  };

  const editedValue = (id: number, column: string, fallback: unknown) => {
    const pending = edits.get(`${id}:${column}`);
    return pending ? pending.value : fallback;
  };

  const startCreate = () => {
    setNewRow(rowDefaults ?? {});
    setCreating(true);
  };

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, p: 2 }}>
        <CircularProgress size={20} /> <Typography variant="body2">Loading…</Typography>
      </Box>
    );
  }
  if (isError) {
    return <Alert severity="error">{apiErrorMessage(error)}</Alert>;
  }

  const allRows = rows ?? [];
  const lastPage = Math.max(0, Math.ceil(filteredRows.length / rowsPerPage) - 1);
  const currentPage = Math.min(page, lastPage);
  const pageRows = filteredRows.slice(currentPage * rowsPerPage, (currentPage + 1) * rowsPerPage);

  return (
    <Box>
      <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap", pb: 1.5, alignItems: "center" }}>
        <Button
          color="success"
          variant="contained"
          size="small"
          disabled={edits.size === 0 || updateMutation.isPending}
          onClick={() => updateMutation.mutate()}
        >
          {updateMutation.isPending ? <CircularProgress size={18} /> : `Save updates${edits.size ? ` (${edits.size})` : ""}`}
        </Button>
        {allowCreate && (
          <Button variant="outlined" size="small" disabled={creating} onClick={startCreate}>
            Create new entry
          </Button>
        )}
        <Button
          variant="outlined"
          size="small"
          startIcon={<FileDownloadIcon />}
          onClick={() =>
            exportXlsx(
              ["id", ...columns.map((c) => c.key)],
              allRows.map((r) => ["id", ...columns.map((c) => c.key)].map((k) => r[k])),
              `${tableKey}.xlsx`,
            )
          }
        >
          Export to Excel
        </Button>
        <TextField
          size="small"
          label="filter rows"
          value={filter}
          onChange={(e) => {
            setFilter(e.target.value);
            setPage(0);
          }}
          sx={{ width: 220 }}
        />
      </Box>
      {message && (
        <Alert severity={message.error ? "error" : "success"} sx={{ mb: 1.5 }} onClose={() => setMessage(null)}>
          {message.text}
        </Alert>
      )}
      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              {columns.map((col) => (
                <TableCell key={col.key} sx={{ fontStyle: "italic", fontWeight: "bold", fontSize: 13 }}>
                  {col.label ?? col.key}
                </TableCell>
              ))}
              {allowDelete && <TableCell sx={{ width: 48 }} />}
            </TableRow>
          </TableHead>
          <TableBody>
            {creating && (
              <TableRow>
                {columns.map((col) => (
                  <TableCell key={col.key}>
                    <EditCell
                      col={col}
                      value={newRow[col.key] ?? ""}
                      onCommit={(v) => setNewRow((r) => ({ ...r, [col.key]: v }))}
                    />
                  </TableCell>
                ))}
                {allowDelete && (
                  <TableCell>
                    <Box sx={{ display: "flex", gap: 0.5 }}>
                      <Button size="small" variant="contained" onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
                        Save
                      </Button>
                      <Button size="small" onClick={() => setCreating(false)}>
                        Cancel
                      </Button>
                    </Box>
                  </TableCell>
                )}
              </TableRow>
            )}
            {pageRows.map((row) => {
              const id = Number(row.id);
              return (
                <TableRow key={id} hover>
                  {columns.map((col) => (
                    <TableCell key={col.key} sx={{ fontSize: 13, p: col.editable === false ? 1 : 0.25 }}>
                      {col.editable === false ? (
                        String(row[col.key] ?? "")
                      ) : (
                        <EditCell
                          col={col}
                          value={editedValue(id, col.key, row[col.key])}
                          onCommit={(v) => setEdit(id, col.key, v)}
                        />
                      )}
                    </TableCell>
                  ))}
                  {allowDelete && (
                    <TableCell>
                      <Tooltip title="Delete">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => {
                            if (window.confirm("Are you sure you want to delete this row?")) deleteMutation.mutate(id);
                          }}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
            {filteredRows.length === 0 && !creating && (
              <TableRow>
                <TableCell colSpan={columns.length + 1}>
                  <Typography variant="body2" color="text.secondary">
                    No rows.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        <TablePagination
          component="div"
          count={filteredRows.length}
          page={currentPage}
          onPageChange={(_e, p) => setPage(p)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(Number(e.target.value));
            setPage(0);
          }}
          rowsPerPageOptions={[25, 50, 100, 200]}
        />
      </TableContainer>
    </Box>
  );
}

function EditCell({
  col,
  value,
  onCommit,
}: {
  col: EditColumnDef;
  value: unknown;
  onCommit: (value: unknown) => void;
}) {
  if (col.type === "select" || col.type === "boolean") {
    const entries = optionEntries(col.options);
    return (
      <Select
        size="small"
        fullWidth
        value={String(value ?? "")}
        onChange={(e) => {
          const entry = entries.find(([label]) => label === e.target.value);
          onCommit(entry ? entry[1] : e.target.value);
        }}
      >
        {entries.map(([label]) => (
          <MenuItem key={label} value={label}>
            {label}
          </MenuItem>
        ))}
      </Select>
    );
  }
  return (
    <TextField
      size="small"
      fullWidth
      required={col.required}
      type={col.type === "number" ? "number" : "text"}
      defaultValue={value ?? ""}
      onBlur={(e) => {
        const v = col.type === "number" ? Number(e.target.value) : e.target.value;
        if (v !== value) onCommit(v);
      }}
    />
  );
}

/** Convenience label wrapper for a boolean-select column whose DB value is a
 *  real boolean but displays as two named states (e.g. locked/editable). */
export function boolSelectOptions(falseLabel: string, trueLabel: string): Record<string, boolean> {
  return { [falseLabel]: false, [trueLabel]: true };
}
