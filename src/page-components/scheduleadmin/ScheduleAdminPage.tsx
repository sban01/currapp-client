import { useState } from "react";
import { Autocomplete, Box, Button, Paper, TextField, Typography } from "@mui/material";
import { useQueryClient } from "@tanstack/react-query";
import { ActionButtons } from "../../components/ActionButtons";
import { EditTable } from "../../components/EditTable";
import type { EditColumnDef } from "../../components/EditTable";
import { UploadFile } from "../../components/UploadFile";
import { FetchDataTable } from "../../components/DataTable";
import { scheduleAdminApi, apiErrorMessage } from "../../lib/apiClient";
import { useGlobals } from "../../lib/GlobalsContext";

const ACTIVITY_TYPES = [
  "LEC", "SG", "MCQ", "EXM", "LAB", "LABX", "US", "SIM", "OSPE", "OCEX", "OSPEmini",
  "OCEXmini", "ESQ", "BLS", "HOL", "OSCE", "HPS", "MISC",
];

const CD_COLUMNS: EditColumnDef[] = [
  { key: "course", type: "text", editable: false },
  { key: "module", type: "text", editable: false },
  { key: "disciplines", type: "text" },
  { key: "type", type: "select", options: ACTIVITY_TYPES },
  { key: "title", type: "text" },
];

function ScheduleUpload() {
  const [stage, setStage] = useState(0);
  const [message, setMessage] = useState("");
  const { termY, termM } = useGlobals();
  const queryClient = useQueryClient();

  const upload = async (file: File) => {
    setStage(1);
    try {
      const data = await scheduleAdminApi.upload(file, termY, termM);
      setMessage(data.message);
    } catch (e) {
      setMessage(apiErrorMessage(e));
    }
    queryClient.clear();
    setStage(2);
  };

  return (
    <UploadFile
      stage={stage}
      onFile={upload}
      replyMessage={message}
      dztxt="Schedule upload: choose a schedule file (.xlsx or .xlsm). The file must contain sheets 'schedule' and 'activities', both will be imported."
    />
  );
}

const UPDATE_COL_SETS: Record<string, string[]> = {
  names: ["names"],
  titles: ["titles"],
  disciplines: ["disciplines"],
  schedule: ["schedule"],
  "update all": ["names", "titles", "disciplines", "schedule"],
};

function ScheduleUpdate() {
  const [updatecols, setUpdatecols] = useState<string[] | null>(null);
  const [stage, setStage] = useState(0);
  const [message, setMessage] = useState("");
  const { termY, termM } = useGlobals();
  const queryClient = useQueryClient();

  if (updatecols === null) {
    return (
      <Box>
        <Typography variant="h6">Schedule Update</Typography>
        <Typography variant="body2" sx={{ mb: 2 }}>
          Schedule, activities and learning objectives (lecture titles) will be updated from sheet 'activities' in
          the uploaded file. Selecting 'schedule' will update scheduled locations, dates and times from sheet
          'schedule'. Selecting 'update all' will update both. Please select the information to update.
        </Typography>
        <ActionButtons labels={Object.keys(UPDATE_COL_SETS)} onSelect={(idx) => setUpdatecols(Object.values(UPDATE_COL_SETS)[idx])} />
      </Box>
    );
  }

  const upload = async (file: File) => {
    setStage(1);
    try {
      const data = await scheduleAdminApi.update(file, termY, termM, updatecols);
      setMessage(data.message);
    } catch (e) {
      setMessage(apiErrorMessage(e));
    }
    queryClient.clear();
    setStage(2);
  };

  return (
    <UploadFile
      stage={stage}
      onFile={upload}
      replyMessage={message}
      dztxt={`Activities update: choose a schedule file (.xlsx or .xlsm). All selected information (${updatecols.join(", ")}) for term ${termM} ${termY} will be updated from that file.`}
    />
  );
}

function ScheduleDelete() {
  const { termY, termM, courses } = useGlobals();
  const [course, setCourse] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [sent, setSent] = useState(false);
  const queryClient = useQueryClient();

  const doDelete = async () => {
    setSent(true);
    setReply(`Sent request to delete schedule for course ${course} term ${termM} ${termY}. Waiting for reply...`);
    try {
      const data = await scheduleAdminApi.delete(termY, termM, course!);
      setReply(data.message);
    } catch (e) {
      setReply(apiErrorMessage(e));
    }
    queryClient.clear();
  };

  if (sent) return <Typography variant="body2">{reply}</Typography>;

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
      <Typography variant="body2">Delete all schedule data for course</Typography>
      <Autocomplete
        options={courses}
        value={course ?? ""}
        disableClearable
        size="small"
        sx={{ width: 150 }}
        onChange={(_e, value) => setCourse(value)}
        renderInput={(params) => <TextField {...params} label="select course" />}
      />
      <Typography variant="body2">in term {termM} {termY}?</Typography>
      <Button variant="outlined" color="error" disabled={!course} onClick={doDelete}>
        <b>Confirm delete</b>
      </Button>
    </Box>
  );
}

function CDEdits() {
  const { termY, termM } = useGlobals();
  return (
    <>
      <Typography variant="h6">Edit activity disciplines, type and titles</Typography>
      <Typography variant="body2" sx={{ mb: 2 }}>
        Course directors can update activity disciplines, types and titles for activities in their course, only
        those are listed. Schedulers can do the same for all courses. Adding or deleting activities is not possible
        here — that must be done via the schedule file upload.
      </Typography>
      <EditTable tableKey="activities" group="schedule" columns={CD_COLUMNS} where={{ termY, termM }} allowCreate={false} allowDelete={false} />
    </>
  );
}

function LocationClashes() {
  const { termY, termM } = useGlobals();
  const [mint, setMint] = useState(0);
  const [show, setShow] = useState(false);

  if (!show) {
    return (
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
        <Button variant="outlined" onClick={() => setShow(true)}>
          <b>View room booking clashes</b>
        </Button>
        <Typography variant="body2">allowing at least</Typography>
        <TextField
          type="number"
          size="small"
          value={mint}
          onChange={(e) => setMint(Number(e.target.value))}
          slotProps={{ htmlInput: { min: 0, max: 120 } }}
          sx={{ width: 90 }}
        />
        <Typography variant="body2">minutes time gap between events.</Typography>
      </Box>
    );
  }

  return (
    <FetchDataTable
      group="schedule"
      queryName="scd_LocationClashes"
      params={{ termY, termM, timegap: mint }}
      caption={`Room booking clashes for ${termM} ${termY}.`}
    />
  );
}

/** Schedule admin (upload/delete/edit/update/clashes) — role admin/scheduler/
 *  CD, matching routers/schedule_upload.py's `_ALLOWED_ROLES`. Ported from
 *  pages/scheduleadmin/*.jsx. */
export default function ScheduleAdminPage() {
  const [buttonIdx, setButtonIdx] = useState<number | null>(null);
  const labels = ["upload", "delete", "edit", "update from file", "location clashes"];
  const panels = [
    <ScheduleUpload key="u" />, <ScheduleDelete key="d" />, <CDEdits key="e" />, <ScheduleUpdate key="uf" />, <LocationClashes key="lc" />,
  ];

  return (
    <Box>
      <ActionButtons labels={labels} onSelect={setButtonIdx} />
      {buttonIdx !== null && <Paper elevation={2} sx={{ p: 2 }}>{panels[buttonIdx]}</Paper>}
    </Box>
  );
}
