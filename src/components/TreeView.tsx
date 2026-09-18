import { useMemo, useState } from "react";
import {
  Box, Button, Checkbox, CircularProgress, FormControlLabel, FormGroup, List, ListItemButton,
  ListItemIcon, ListItemText, Popover, Typography,
} from "@mui/material";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import { useQuery } from "@tanstack/react-query";
import { reportsApi } from "../lib/apiClient";
import { toColumnsAndRows } from "../lib/reportRows";
import { exportXlsx } from "../lib/xlsxExport";
import type { Group } from "../config/cache";

export interface TreeNode {
  label: string;
  children: TreeNode[];
  /** Optional text lines shown when a childless node is unfolded (e.g. LOs). */
  details?: string[];
}

/** A report row's cells are joined with '!' (e.g. "MED1!M1!LEC!Intro (3)").
 *  Drop the separator right before a trailing " (n)" count so it stays fused
 *  to its parent segment instead of becoming its own leaf — matches legacy's
 *  identical regex in components/treeview.jsx. */
function splitRow(row: string): string[] {
  return row.replace(/!(\s\(\d+\))/, "$1").split("!");
}

function buildTree(rows: string[]): TreeNode[] {
  const roots: TreeNode[] = [];
  for (const row of rows) {
    let level = roots;
    for (const part of splitRow(row)) {
      let node = level.find((n) => n.label === part);
      if (!node) {
        node = { label: part, children: [] };
        level.push(node);
      }
      level = node.children;
    }
  }
  return roots;
}

export function TreeNodeRow({ node, depth }: { node: TreeNode; depth: number }) {
  const hasChildren = node.children.length > 0;
  const hasDetails = !hasChildren && (node.details?.length ?? 0) > 0;
  const expandable = hasChildren || hasDetails;
  // Branches start unfolded; detail lines start folded behind their count.
  const [open, setOpen] = useState(!hasDetails);
  return (
    <>
      <ListItemButton
        dense
        sx={{ pl: 1 + depth * 2.5 }}
        onClick={() => expandable && setOpen((o) => !o)}
      >
        {expandable ? (
          <ListItemIcon sx={{ minWidth: 24 }}>
            {open ? <ExpandMoreIcon fontSize="small" /> : <ChevronRightIcon fontSize="small" />}
          </ListItemIcon>
        ) : (
          <Box sx={{ width: 24 }} />
        )}
        <ListItemText primary={node.label} slotProps={{ primary: { sx: { fontSize: 13 } } }} />
      </ListItemButton>
      {hasChildren && open && (
        <List disablePadding>
          {node.children.map((child, idx) => (
            <TreeNodeRow key={child.label + idx} node={child} depth={depth + 1} />
          ))}
        </List>
      )}
      {hasDetails && open && (
        <List disablePadding>
          {node.details!.map((line, idx) => (
            <ListItemText
              key={idx}
              sx={{ pl: 1 + (depth + 1) * 2.5 + 3, pr: 1, my: 0.25 }}
              primary={line}
              slotProps={{ primary: { sx: { fontSize: 13 } } }}
            />
          ))}
        </List>
      )}
    </>
  );
}

/** Column/GROUP-BY picker for a flexquery — a simplified stand-in for
 *  legacy's drag-and-drop reorder list (components/dnd/dndLists.jsx):
 *  checking a column appends it to the display order, unchecking removes it. */
export function ColumnPicker({
  allVars,
  displayed,
  onChange,
}: {
  allVars: string[];
  displayed: string[];
  onChange: (next: string[]) => void;
}) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  const toggle = (name: string) => {
    if (displayed.includes(name)) onChange(displayed.filter((v) => v !== name));
    else onChange([...displayed, name]);
  };

  return (
    <>
      <Button variant="outlined" size="small" onClick={(e) => setAnchor(e.currentTarget)}>
        Graph options
      </Button>
      <Popover
        open={Boolean(anchor)}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
      >
        <Box sx={{ p: 2, minWidth: 220 }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Columns to display
          </Typography>
          <FormGroup>
            {allVars.map((name) => (
              <FormControlLabel
                key={name}
                control={<Checkbox size="small" checked={displayed.includes(name)} onChange={() => toggle(name)} />}
                label={name}
              />
            ))}
          </FormGroup>
        </Box>
      </Popover>
    </>
  );
}

/** Collapsible nested-list rendering of a delimiter-separated named report
 *  (e.g. act_graphByCourse1), grouped by shared path prefixes. Replaces
 *  legacy's Observable Plot cluster diagram (components/treeview.jsx) with a
 *  dependency-free tree list — same underlying data, a simpler visual. */
export function TreeView({
  group,
  queryName,
  params,
}: {
  group: Group;
  queryName: string;
  params: Record<string, unknown>;
}) {
  const [varsOverride, setVarsOverride] = useState<string[] | null>(null);
  const effectiveParams = varsOverride ? { ...params, vars: varsOverride } : params;

  const { data, isLoading, error } = useQuery({
    queryKey: [group, "report", queryName, effectiveParams],
    queryFn: () => reportsApi.run(queryName, effectiveParams),
  });

  const { rows, varcfg } = useMemo(() => {
    if (!data) return { rows: [] as string[], varcfg: undefined };
    const { rows: rawRows, varcfg } = toColumnsAndRows(data);
    // Single-column result: each row-array is [value] — flatten back to a
    // plain string for the '!'-delimited tree parser.
    return { rows: rawRows.map((r) => String(r[0] ?? "")), varcfg };
  }, [data]);

  const tree = useMemo(() => buildTree(rows), [rows]);
  const allVars = varcfg ? [...varcfg.displayed, ...varcfg["not shown"]] : [];

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
          onClick={() => exportXlsx(varcfg?.displayed ?? ["value"], rows.map(splitRow), "graph.xlsx")}
        >
          Export to Excel
        </Button>
        {varcfg && (
          <ColumnPicker
            allVars={allVars}
            displayed={varcfg.displayed}
            onChange={(next) => setVarsOverride(next)}
          />
        )}
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
