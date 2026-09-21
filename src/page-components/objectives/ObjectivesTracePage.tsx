import { useState } from "react";
import { Box, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { MultiSelect } from "../../components/MultiSelect";
import type { MultiSelectState } from "../../components/MultiSelect";
import { FetchDataTable } from "../../components/DataTable";
import { LoTreeView } from "../../components/LoTreeView";
import { reportsApi } from "../../lib/apiClient";
import { toColumnsAndRows } from "../../lib/reportRows";
import { useGlobals } from "../../lib/GlobalsContext";

const SELECT_OPTIONS = ["program objective", "course objective", "module objective"];
const SELECT_QUERIES = ["obj_getProgramObjectives", "obj_getCourseObjectives", "obj_getModuleObjectives"];
const TABLE_QUERIES = ["obj_tablePOtrace", "obj_tableCOtrace", "obj_tableMOtrace"];
// Tree view groups the one-row-per-LO table query client-side, by these columns
// (each objective column also shows its `<column>_name`), and unfolds the LO text.
const TREE_COLUMNS = [
  ["program_objective", "course_objective", "module_objective", "discipline", "type", "lecture_title", "DLA_title"],
  ["course_objective", "module_objective", "discipline", "type", "lecture_title", "DLA_title"],
  ["module_objective", "discipline", "type", "lecture_title", "DLA_title"],
];
const treeDefaults = (cols: string[]) => [...cols.filter((c) => c !== "DLA_title"), "count"];

/** Trace a program/course/module objective through discipline and activity
 *  type down to lecture/LO level. Ported from pages/objectives/hltrace.jsx
 *  (the Observable-Plot cluster diagram is replaced by components/LoTreeView's
 *  collapsible tree list, whose lecture nodes unfold to the LO text). */
export default function ObjectivesTracePage() {
  const { termY, termM } = useGlobals();
  const paramStub = { termM, termY };
  const [selector, setSelector] = useState<MultiSelectState>({ idx1: 0, value1: SELECT_OPTIONS[0], value2: "" });
  const [stage, setStage] = useState<0 | 1 | 2>(0);

  const { data: selectValues, isPending, error } = useQuery({
    queryKey: ["objectives", "report", "objTraceSelectors", paramStub],
    queryFn: async () => {
      const results = await Promise.all(SELECT_QUERIES.map((q) => reportsApi.run(q, paramStub)));
      return results.map((r) => toColumnsAndRows(r).rows.map((row) => String(row[0])));
    },
  });

  if (isPending) return <Typography variant="body2">Loading data…</Typography>;
  if (error) return <Typography color="error">{(error as Error).message}</Typography>;

  // Fall back to the first fetched value until the user actually picks one —
  // the initial state can't know it before this query resolves.
  const effectiveSelector: MultiSelectState = {
    ...selector,
    value2: selector.value2 || selectValues[selector.idx1]?.[0],
  };
  const termstr = `term ${termM} ${termY}`;
  const caption = `Representation of ${effectiveSelector.value1} ${effectiveSelector.value2} in ${termstr}`;
  const params = { ...paramStub, objective: `%${effectiveSelector.value2 ?? ""}%` };

  return (
    <Box>
      <MultiSelect
        selector={effectiveSelector}
        setSelector={setSelector}
        onClick={(idx) => setStage(idx === 0 ? 1 : 2)}
        selectoptions={SELECT_OPTIONS}
        valueoptions={selectValues}
        buttons={["table view", "tree view"]}
      />
      {stage === 1 && (
        <Box sx={{ mt: 2 }}>
          <FetchDataTable group="objectives" queryName={TABLE_QUERIES[selector.idx1]} params={params} caption={caption} />
        </Box>
      )}
      {stage === 2 && (
        <Box sx={{ mt: 2 }}>
          <LoTreeView
            key={selector.idx1}
            group="objectives"
            queryName={TABLE_QUERIES[selector.idx1]}
            params={params}
            columns={TREE_COLUMNS[selector.idx1]}
            defaultDisplayed={treeDefaults(TREE_COLUMNS[selector.idx1])}
          />
        </Box>
      )}
    </Box>
  );
}
