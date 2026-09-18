import { useState } from "react";
import { Box } from "@mui/material";
import { FetchDataTable } from "../../components/DataTable";
import { TreeView } from "../../components/TreeView";
import { MultiSelect } from "../../components/MultiSelect";
import type { MultiSelectState } from "../../components/MultiSelect";
import { useGlobals } from "../../lib/GlobalsContext";
import type { Group } from "../../config/cache";

/** Shared "view by course/module/discipline" selector + results, used for
 *  both the schedule and activities views. Ported from
 *  pages/schedule/scheduleviews.jsx::CMDselect. */
function CMDSelect({
  group,
  name,
  selectoptions,
  queries,
  graphqueries,
  buttons,
}: {
  group: Group;
  name: string;
  selectoptions: string[];
  queries: string[];
  graphqueries?: string[];
  buttons: string[];
}) {
  const { termY, termM, courses, modules, disciplines } = useGlobals();
  const valueoptions = [undefined, courses, modules, disciplines];
  const [selector, setSelector] = useState<MultiSelectState>({ idx1: 0, value1: selectoptions[0], value2: courses[0] });
  const [stage, setStage] = useState<0 | 1 | 2>(0);

  const onClick = (buttonIdx: number) => setStage(buttonIdx === 1 && graphqueries ? 2 : 1);

  const termstr = `term ${termM} ${termY}`;
  let caption: string;
  if (selector.idx1 === 0) caption = `${selectoptions[0].replace("all", "All")} in ${termstr}.`;
  else if (selector.idx1 === 1) caption = `${name} for course ${selector.value2} in ${termstr}.`;
  else if (selector.idx1 === 2) caption = `${name} for module ${selector.value2} in ${termstr}.`;
  else caption = `${name} for discipline ${selector.value2} in ${termstr}.`;

  const params = { query: queries[selector.idx1], value: `%${selector.value2 ?? ""}%`, termM, termY };

  return (
    <Box>
      <MultiSelect selector={selector} setSelector={setSelector} onClick={onClick} selectoptions={selectoptions} valueoptions={valueoptions} buttons={buttons} />
      {stage === 1 && <Box sx={{ mt: 2 }}><FetchDataTable group={group} queryName={params.query} params={params} caption={caption} /></Box>}
      {stage === 2 && graphqueries && (
        <Box sx={{ mt: 2 }}>
          <TreeView group={group} queryName={graphqueries[selector.idx1]} params={{ termM, termY, value: selector.value2 }} />
        </Box>
      )}
    </Box>
  );
}

export function ScheduleMainPage() {
  return (
    <CMDSelect
      group="schedule"
      name="Schedule"
      selectoptions={["all schedules", "by course", "by module", "by discipline"]}
      queries={["scd_viewTerm", "scd_viewByCourse", "scd_viewByModule", "scd_viewByDiscipline"]}
      buttons={["view"]}
    />
  );
}

export function ScheduleActivitiesPage() {
  return (
    <CMDSelect
      group="schedule"
      name="Activities"
      selectoptions={["all activities", "by course", "by module", "by discipline"]}
      queries={["act_viewTerm", "act_viewByCourse", "act_viewByModule", "act_viewByDiscipline"]}
      graphqueries={["act_graphTerm1", "act_graphByCourse1", "act_graphByModule1", "act_graphByDiscipline1"]}
      buttons={["table view", "tree view"]}
    />
  );
}
