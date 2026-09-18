import { useState } from "react";
import { Box, Paper, Typography } from "@mui/material";
import { ActionButtons } from "../../components/ActionButtons";
import { EditTable, boolSelectOptions } from "../../components/EditTable";
import type { EditColumnDef } from "../../components/EditTable";

const LOCK_COLUMNS: EditColumnDef[] = [
  { key: "year", type: "number", required: true },
  { key: "month", type: "select", options: ["January", "April", "August"], required: true },
  { key: "activities", type: "boolean", options: boolSelectOptions("locked", "editable") },
  { key: "LOs", type: "boolean", options: boolSelectOptions("locked", "editable") },
  { key: "names", type: "boolean", options: boolSelectOptions("locked", "editable") },
];

const ACL_COLUMNS: EditColumnDef[] = [
  { key: "name", type: "text", required: true },
  { key: "email", type: "text", required: true },
  { key: "role", type: "select", options: ["CD", "CM", "scheduler", "admin"], required: true },
  { key: "subrole", type: "text" },
];

const GROUPINGS_COLUMNS: EditColumnDef[] = [
  { key: "type", type: "select", options: ["course", "module", "discipline"], required: true },
  { key: "name", type: "text", required: true },
  { key: "sortorder", type: "number", required: true },
];

const ACTIVITYTYPES_COLUMNS: EditColumnDef[] = [
  { key: "type", type: "text", required: true },
  { key: "description", type: "text", required: true },
  { key: "plural", type: "text", required: true },
  { key: "reqName", type: "boolean", options: boolSelectOptions("no", "yes") },
  { key: "reqDiscipline", type: "boolean", options: boolSelectOptions("no", "yes") },
  { key: "reqLOs", type: "boolean", options: boolSelectOptions("no", "yes") },
];

const HLOBJECTIVES_COLUMNS: EditColumnDef[] = [
  { key: "level", type: "select", options: ["program", "course", "module"], required: true },
  { key: "domain", type: "text", required: true },
  { key: "LO_code", type: "text", required: true },
  { key: "LO", type: "text", required: true },
];

function EditLocks() {
  return (
    <>
      <Typography variant="h6">Enable/disable data editing for specific terms</Typography>
      <Typography variant="body2" sx={{ mb: 2 }}>
        Each term is identified by year and month of intake. Set whether the activities details, learning
        objectives (LOs) and faculty names for teaching activities for the term are editable or locked. Terms can
        be removed via the delete icon, which will lock their data by default. Please save all changes before
        leaving this page.
      </Typography>
      <EditTable tableKey="editableterms" group="admin" columns={LOCK_COLUMNS} rowDefaults={{ year: new Date().getFullYear() + 1, month: "August", activities: true, LOs: true, names: true }} />
    </>
  );
}

function EditACL() {
  return (
    <>
      <Typography variant="h6">Edit user roles and rights</Typography>
      <Typography variant="body2" sx={{ mb: 2 }}>
        The access control list sets the roles for named users. Users not listed here cannot edit any data and
        will not see any of the administrative pages. Those with role 'admin' have access to Admin, Schedule Admin
        and CM Admin. Schedulers and course directors (CD) have access to Schedule Admin. Course directors must be
        listed with role='CD' and subrole=[course code] (e.g. BPM1, PCM1) to get access to their course. Content
        managers have access to CM Admin and must be listed with role='CM' and subrole=[discipline code] (e.g.
        ANAT, PHARM) to enable edit access to their discipline.
      </Typography>
      <EditTable tableKey="acl" group="admin" columns={ACL_COLUMNS} />
    </>
  );
}

function EditGroupings() {
  return (
    <>
      <Typography variant="h6">Edit course, module and discipline codes</Typography>
      <Typography variant="body2" sx={{ mb: 2 }}>
        The list of valid course, module and discipline codes. Column 'sortorder' determines the displayed sorting
        order for courses, and modules within each course. Please make sure to save any edits before leaving this
        page.
      </Typography>
      <EditTable tableKey="groupings" group="admin" columns={GROUPINGS_COLUMNS} />
    </>
  );
}

function EditActivityTypes() {
  return (
    <>
      <Typography variant="h6">Edit activity types</Typography>
      <Typography variant="body2" sx={{ mb: 2 }}>
        The list of valid activity types. Description and plural spelling are used in various reports. Columns
        reqName, reqDiscipline and reqLOs define if the activity type requires faculty names, discipline codes and
        learning objectives, respectively. Please make sure to save any edits before leaving this page.
      </Typography>
      <EditTable tableKey="activitytypes" group="admin" columns={ACTIVITYTYPES_COLUMNS} />
    </>
  );
}

function EditHLObjectives() {
  return (
    <>
      <Typography variant="h6">Edit higher-level objectives</Typography>
      <Typography variant="body2" sx={{ mb: 2 }}>
        All program, course and module objectives. Column 'domain' specifies the groupings within each level.
        Please make sure to save any edits before leaving this page.
      </Typography>
      <EditTable tableKey="hlobjectives" group="admin" columns={HLOBJECTIVES_COLUMNS} />
    </>
  );
}

/** Admin-only static-table editors (editableterms/acl/groupings/activitytypes/
 *  hlobjectives) — every one of these is `min_role=["admin"]` server-side
 *  (utils/table_registry.py). Ported from pages/admin/admin.jsx. */
export default function AdminPage() {
  const [buttonIdx, setButtonIdx] = useState<number | null>(null);
  const labels = ["editing locks", "user roles", "CMD codes", "activity types", "higher-level objectives"];
  const panels = [<EditLocks key="l" />, <EditACL key="a" />, <EditGroupings key="g" />, <EditActivityTypes key="t" />, <EditHLObjectives key="h" />];

  return (
    <Box>
      <ActionButtons labels={labels} onSelect={setButtonIdx} />
      {buttonIdx !== null && <Paper elevation={2} sx={{ p: 2 }}>{panels[buttonIdx]}</Paper>}
    </Box>
  );
}
