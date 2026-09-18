import { useMemo, useState } from "react";
import { Box, Button, CircularProgress, List, Typography } from "@mui/material";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import { useQuery } from "@tanstack/react-query";
import { reportsApi } from "../lib/apiClient";
import { exportXlsx } from "../lib/xlsxExport";
import type { Group } from "../config/cache";
import { ColumnPicker, TreeNodeRow, type TreeNode } from "./TreeView";

const COLUMNS = ["course", "module", "discipline", "type", "lecture_title", "DLA_title"];
const DEFAULT_DISPLAYED = ["course", "module", "discipline", "lecture_title", "count"];

type LoRow = Record<string, unknown>;

/** Build the course/module/... tree from one-row-per-LO data. The deepest
 *  level shows its LO count, e.g. "Intro (3)", and unfolds to the LO text. */
function buildLoTree(rows: LoRow[], columns: string[], showCount: boolean, root: string): TreeNode[] {
  const roots: TreeNode[] = [];
  const leaves = new Map<TreeNode, LoRow[]>();
  for (const row of rows) {
    let level = roots;
    let node: TreeNode | undefined;
    for (const part of [root, ...columns.map((c) => String(row[c] ?? ""))]) {
      node = level.find((n) => n.label === part);
      if (!node) {
        node = { label: part, children: [] };
        level.push(node);
      }
      level = node.children;
    }
    if (node) leaves.set(node, [...(leaves.get(node) ?? []), row]);
  }
  for (const [node, los] of leaves) {
    if (showCount) node.label += ` (${los.length})`;
    node.details = los.map((r) => `${r.LO_code ?? ""} ${r.LO ?? ""}`.trim());
  }
  return roots;
}

/** Tree view of a one-row-per-LO report (obj_searchLOs), grouped client-side
 *  by the chosen columns, with LO counts per group that unfold to the LO text.
 *  Used instead of a stored flexquery graph report, which can't show both. */
export function LoTreeView({
  group,
  queryName,
  params,
  root,
}: {
  group: Group;
  queryName: string;
  params: Record<string, unknown>;
  root: string;
}) {
  const [displayed, setDisplayed] = useState(DEFAULT_DISPLAYED);
  const { data, isLoading, error } = useQuery({
    queryKey: [group, "report", queryName, { ...params, format: "json" }],
    queryFn: () => reportsApi.run(queryName, { ...params, format: "json" }),
  });

  const columns = displayed.filter((c) => c !== "count");
  const rows = useMemo(() => (Array.isArray(data) ? (data as LoRow[]) : []), [data]);
  const tree = useMemo(
    () => buildLoTree(rows, columns, displayed.includes("count"), root),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, displayed, root],
  );

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, p: 2 }}>
        <CircularProgress size={20} /> <Typography variant="body2">Loading data…</Typography>
      </Box>
    );
  }
  if (error) {
    return (
      <Typography variant="body2" color="error">
        {(error as Error).message}
      </Typography>
    );
  }

  return (
    <Box>
      <Box sx={{ display: "flex", gap: 1.5, pb: 1.5, flexWrap: "wrap" }}>
        <Button
          variant="outlined"
          size="small"
          startIcon={<FileDownloadIcon />}
          onClick={() =>
            exportXlsx(
              [...columns, "LO_code", "LO"],
              rows.map((r) => [...columns, "LO_code", "LO"].map((c) => r[c])),
              "graph.xlsx",
            )
          }
        >
          Export to Excel
        </Button>
        <ColumnPicker
          allVars={[...COLUMNS, "count"]}
          displayed={displayed}
          onChange={setDisplayed}
        />
      </Box>
      {tree.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          No data for the selected parameters.
        </Typography>
      ) : (
        <List disablePadding dense sx={{ border: 1, borderColor: "divider", borderRadius: 1, py: 0.5 }}>
          {tree.map((node, idx) => (
            <TreeNodeRow key={node.label + idx} node={node} depth={0} />
          ))}
        </List>
      )}
    </Box>
  );
}
