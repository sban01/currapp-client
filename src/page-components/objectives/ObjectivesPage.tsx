import { useState } from "react";
import { Box, Typography } from "@mui/material";
import { MultiSelect } from "../../components/MultiSelect";
import type { MultiSelectState } from "../../components/MultiSelect";
import { FetchDataTable } from "../../components/DataTable";
import { StudentView } from "./StudentView";
import { saveLoTemplateXlsx } from "../../lib/loTemplateExport";
import { useGlobals } from "../../lib/GlobalsContext";

/** View/download learning objectives by discipline/module/course, in one of
 *  five formats. Ported from pages/objectives/objectivesviews.jsx. */
export default function ObjectivesPage() {
  const { termY, termM, disciplines, modules, courses } = useGlobals();
  const [msg, setMsg] = useState("");
  const selectoptions = ["by discipline", "by module", "by course"];
  const valueoptions = [disciplines, modules, courses];
  const [selector, setSelector] = useState<MultiSelectState>({ idx1: 0, value1: selectoptions[0], value2: disciplines[0] });
  const [stage, setStage] = useState(0);

  const queries = ["obj_viewByDiscipline", "obj_viewByModule", "obj_viewByCourse"];
  const compactQueries = ["obj_compactViewByDiscipline", "obj_compactViewByModule", "obj_compactViewByCourse"];
  const studentQueries = ["obj_studentViewByDiscipline", "obj_studentViewByModule", "obj_studentViewByCourse"];
  const dlaQueries = ["obj_DLAsByDiscipline", "obj_DLAsByModule", "obj_DLAsByCourse"];
  const termstr = `term ${termM} ${termY}`;
  const captions = [
    `Learning objectives for discipline ${selector.value2} in ${termstr}`,
    `Learning objectives for module ${selector.value2} in ${termstr}`,
    `Learning objectives for course ${selector.value2} in ${termstr}`,
  ];
  const caption = captions[selector.idx1];
  const paramStub = { termM, termY };
  const params = { ...paramStub, query: queries[selector.idx1], value: `%${selector.value2 ?? ""}%` };

  const onClick = async (buttonIdx: number) => {
    if (buttonIdx === 0) {
      const status = await saveLoTemplateXlsx(queries[selector.idx1], params);
      setMsg(status === true ? `${caption} saved to file.` : status);
    }
    setStage(buttonIdx);
  };

  return (
    <Box>
      <MultiSelect
        selector={selector}
        setSelector={setSelector}
        onClick={onClick}
        selectoptions={selectoptions}
        valueoptions={valueoptions}
        buttons={["download CM version", "detailed view", "compact view", "student version", "DLA catalog"]}
      />
      {stage === 0 && msg && <Typography variant="body2" sx={{ mt: 1 }}>{msg}</Typography>}
      {stage === 1 && <Box sx={{ mt: 2 }}><FetchDataTable group="objectives" queryName={queries[selector.idx1]} params={params} caption={caption} /></Box>}
      {stage === 2 && (
        <Box sx={{ mt: 2 }}>
          <FetchDataTable group="objectives" queryName={compactQueries[selector.idx1]} params={{ ...paramStub, value: `%${selector.value2 ?? ""}%` }} caption={caption} />
        </Box>
      )}
      {stage === 3 && (
        <Box sx={{ mt: 2 }}>
          <StudentView group="objectives" queryName={studentQueries[selector.idx1]} params={{ ...paramStub, value: `%${selector.value2 ?? ""}%` }} caption={caption} />
        </Box>
      )}
      {stage === 4 && (
        <Box sx={{ mt: 2 }}>
          <FetchDataTable
            group="objectives"
            queryName={dlaQueries[selector.idx1]}
            params={{ ...paramStub, value: `%${selector.value2 ?? ""}%` }}
            caption={caption.replace("Learning objectives", "DLA catalog")}
          />
        </Box>
      )}
    </Box>
  );
}
