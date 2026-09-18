import { useState } from "react";
import { Box, Button, Paper, TextField, Typography } from "@mui/material";
import { useQueryClient } from "@tanstack/react-query";
import { ActionButtons } from "../../components/ActionButtons";
import { EditTable } from "../../components/EditTable";
import type { EditColumnDef } from "../../components/EditTable";
import { UploadFile } from "../../components/UploadFile";
import { DataTable, FetchDataTable } from "../../components/DataTable";
import { cmAdminApi, apiErrorMessage } from "../../lib/apiClient";
import type { LoUploadReportRow } from "../../lib/apiClient";
import { useAuth } from "../../components/auth/authContext";
import { useGlobals } from "../../lib/GlobalsContext";

const CM_COLUMNS: EditColumnDef[] = [
  { key: "course", type: "text", editable: false },
  { key: "module", type: "text", editable: false },
  { key: "title", type: "text" },
  { key: "faculty1", type: "text" },
  { key: "faculty2", type: "text" },
  { key: "faculty3", type: "text" },
  { key: "faculty4", type: "text" },
];

const REPORT_COLUMNS: (keyof LoUploadReportRow)[] = ["status", "course", "module", "type", "disciplines", "activities_title", "lo_lecture_title"];

const STATUS_COLOR: Record<LoUploadReportRow["status"], string> = {
  matched: "limegreen",
  lo_only: "darkorange",
  activity_only: "red",
};

function LOUpload() {
  const [stage, setStage] = useState(0);
  const [message, setMessage] = useState("");
  const [report, setReport] = useState<LoUploadReportRow[] | null>(null);
  const { termY, termM } = useGlobals();
  const queryClient = useQueryClient();

  const upload = async (file: File) => {
    setStage(1);
    try {
      const data = await cmAdminApi.upload(file, termY, termM);
      setMessage(data.message);
      setReport(data.success ? data.data ?? [] : null);
    } catch (e) {
      setMessage(apiErrorMessage(e));
      setReport(null);
    }
    queryClient.clear();
    setStage(2);
  };

  if (stage < 2) {
    return (
      <UploadFile
        stage={stage}
        onFile={upload}
        dztxt="Learning objectives upload: choose a LO file (.xlsx format, one discipline per file). All sheets will be scanned for LOs."
      />
    );
  }

  return (
    <Box>
      <Typography variant="body2" sx={{ mb: 1 }}>{message}</Typography>
      {report && report.length > 0 && (
        <DataTable
          colnames={REPORT_COLUMNS}
          rows={report.map((r) => REPORT_COLUMNS.map((c) => r[c]))}
          caption="LOs with status 'matched' (green) were correctly matched and uploaded. Status 'lo_only' (orange) means the LO was found in the file but no matching activity title exists — please check the lecture title. Status 'activity_only' (red) means the activity requires LOs but none were found in this file."
          cellRender={(value, colIndex, row) => (
            <span style={{ color: STATUS_COLOR[row[0] as LoUploadReportRow["status"]] }}>{colIndex === 0 ? String(value) : String(value ?? "")}</span>
          )}
        />
      )}
    </Box>
  );
}

function LODelete() {
  const { termY, termM } = useGlobals();
  const { user } = useAuth();
  const discipline = user?.subrole;
  const [sent, setSent] = useState(false);
  const [reply, setReply] = useState("");
  const queryClient = useQueryClient();

  if (!discipline) {
    return (
      <Typography color="error" sx={{ fontWeight: "bold" }}>
        Error: no valid discipline listed for this user. Please contact the administrators to check the listed
        rights and roles.
      </Typography>
    );
  }

  const doDelete = async () => {
    setSent(true);
    setReply(`Sent request to delete LOs for discipline ${discipline} term ${termM} ${termY}. Waiting for reply...`);
    try {
      const data = await cmAdminApi.delete(termY, termM);
      setReply(data.message);
    } catch (e) {
      setReply(apiErrorMessage(e));
    }
    queryClient.clear();
  };

  if (sent) return <Typography variant="body2">{reply}</Typography>;

  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 2 }}>
        Really delete all learning objectives for discipline {discipline} in term {termM} {termY}?
      </Typography>
      <Button variant="contained" color="error" onClick={doDelete}>
        <b>Confirm delete</b>
      </Button>
    </Box>
  );
}

function CMEdits() {
  const { termY, termM } = useGlobals();
  return (
    <>
      <Typography variant="h6">Edit activity titles and faculty names</Typography>
      <Typography variant="body2" sx={{ mb: 2 }}>
        Content managers can update titles and faculty names for activities in their discipline, only those are
        listed. Adding or deleting activities is not possible here — that must be done via the course director and
        scheduling team.
      </Typography>
      <EditTable tableKey="activities" group="schedule" columns={CM_COLUMNS} where={{ termY, termM }} allowCreate={false} allowDelete={false} />
    </>
  );
}

function FacultyNameClashes() {
  const { termY, termM } = useGlobals();
  const [mint, setMint] = useState(0);
  const [show, setShow] = useState(false);

  if (!show) {
    return (
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
        <Button variant="outlined" onClick={() => setShow(true)}>
          <b>View faculty name clashes</b>
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
      queryName="scd_FacultyNameClashes"
      params={{ termY, termM, timegap: mint }}
      caption={`Faculty scheduling clashes for ${termM} ${termY}.`}
    />
  );
}

/** CM admin (upload/delete LOs, edit titles/names, schedule clashes) — role
 *  admin/CM, matching routers/lo_upload.py's `_ALLOWED_ROLES`. Ported from
 *  pages/cmadmin/*.jsx. */
export default function CMAdminPage() {
  const [buttonIdx, setButtonIdx] = useState<number | null>(null);
  const labels = ["upload LOs", "delete LOs", "edit titles/names", "find schedule clashes"];
  const panels = [<LOUpload key="u" />, <LODelete key="d" />, <CMEdits key="e" />, <FacultyNameClashes key="c" />];

  return (
    <Box>
      <ActionButtons labels={labels} onSelect={setButtonIdx} />
      {buttonIdx !== null && <Paper elevation={2} sx={{ p: 2 }}>{panels[buttonIdx]}</Paper>}
    </Box>
  );
}
