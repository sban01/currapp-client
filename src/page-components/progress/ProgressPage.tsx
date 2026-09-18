import type { ReactNode } from "react";
import { Box, Paper, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { FetchDataTable } from "../../components/DataTable";
import { reportsApi } from "../../lib/apiClient";
import { toColumnsAndRows } from "../../lib/reportRows";
import { useGlobals } from "../../lib/GlobalsContext";

/** Compact per-course activity-count strip shown at the top of the page.
 *  Ported from pages/progress/schedulebriefprogress.jsx. */
function ScheduleBriefProgress() {
  const { termY, termM, courses } = useGlobals();
  const { data, isLoading } = useQuery({
    queryKey: ["schedule", "report", "scd_nActivitiesByCourse", { termY, termM }],
    queryFn: () => reportsApi.run("scd_nActivitiesByCourse", { termY, termM }),
  });

  if (isLoading) return null;

  const counts: Record<string, number> = Object.fromEntries(courses.map((c) => [c, 0]));
  if (data) {
    const { rows } = toColumnsAndRows(data);
    for (const row of rows) counts[String(row[0])] = Number(row[1]);
  }

  return (
    <Box sx={{ borderBottom: 1, borderColor: "divider", pb: 1.5, mb: 2 }}>
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 4, justifyContent: "center" }}>
        {Object.entries(counts).map(([course, n]) => (
          <Typography key={course} variant="body2" sx={{ color: n ? "#66bb6a" : "red" }}>
            <b>{course}:</b> {n ? `${n} ${n === 1 ? "activity" : "activities"}` : "no data"}
          </Typography>
        ))}
      </Box>
    </Box>
  );
}

/** Detailed per-course activity-type + schedule-entry breakdown. Ported from
 *  pages/progress/scheduleprogress.jsx. */
function ScheduleProgress() {
  const { termY, termM, courses } = useGlobals();
  const { data, isLoading, error } = useQuery({
    queryKey: ["schedule", "report", "scd_progress", { termY, termM }, courses],
    queryFn: async () => {
      const [actResult, scdResult] = await Promise.all([
        reportsApi.run("scd_nActivitiesByCourseType", { termY, termM }),
        reportsApi.run("scd_nScheduleEntriesByCourse", { termY, termM }),
      ]);
      const { rows: actRows } = toColumnsAndRows(actResult); // course, activityType, plural, n
      const { rows: scdRows } = toColumnsAndRows(scdResult); // course, n

      const report: Record<string, { n_act: number; n_scd: number; actlist: string }> = {};
      for (const course of courses) report[course] = { n_act: 0, n_scd: 0, actlist: "" };

      let course = "";
      let n = 0;
      for (const row of actRows) {
        const [rCourse, , plural, count] = row as [string, string, string, number];
        const singular = row[1] as string;
        if (rCourse !== course) {
          if (n && course) {
            report[course].n_act = n;
            report[course].actlist += ".";
          }
          course = rCourse;
          if (!report[course]) report[course] = { n_act: 0, n_scd: 0, actlist: "" };
          report[course].actlist = `${count} ${count > 1 ? plural : singular}`;
          n = count;
        } else {
          n += count;
          report[course].actlist += `, ${count} ${count > 1 ? plural : singular}`;
        }
      }
      if (course) {
        report[course].n_act = n;
        report[course].actlist += ".";
      }
      for (const row of scdRows) {
        const [rCourse, count] = row as [string, number];
        if (report[rCourse]) report[rCourse].n_scd = count;
      }
      return report;
    },
  });

  if (isLoading) return <Typography variant="body2">Loading data…</Typography>;
  if (error) return <Typography color="error">{(error as Error).message}</Typography>;

  return (
    <Paper elevation={2} sx={{ p: 2 }}>
      <Typography variant="h6" sx={{ mb: 1 }}>
        Schedule upload summary for {termM} {termY}
      </Typography>
      {Object.entries(data ?? {}).map(([course, value]) =>
        value.n_act ? (
          <Typography key={course} variant="body2" sx={{ mb: 1 }}>
            <b style={{ color: "#66bb6a" }}>{course}:</b> {value.n_act} activities in {value.n_scd} schedule entries.
            <br />
            &emsp;&emsp;&emsp;{value.actlist}
          </Typography>
        ) : (
          <Typography key={course} variant="body2" sx={{ mb: 1 }}>
            <b style={{ color: "red" }}>{course}:</b> no data.
          </Typography>
        ),
      )}
    </Paper>
  );
}

function MissingNames() {
  const { termY, termM } = useGlobals();
  return (
    <FetchDataTable
      group="schedule"
      queryName="scd_missingNames"
      params={{ termY, termM }}
      caption={`Counts of activities (types LEC, SG, MCQ) with missing faculty names by discipline, course and module for term ${termM} ${termY}.`}
    />
  );
}

function LOprogress() {
  const { termY, termM } = useGlobals();
  return (
    <FetchDataTable
      group="objectives"
      queryName="los_nByCourseModuleDisc"
      params={{ termY, termM }}
      caption={`Learning objectives upload progress report for term ${termM} ${termY}. Only lectures are counted as activities that must have associated LOs.`}
      cellRender={(value, colIndex, row) => {
        if (colIndex !== 4) return String(value ?? "");
        const uploaded = Number(value);
        const required = Number(row[3]);
        const color = uploaded ? (uploaded >= required ? "#66bb6a" : "blue") : "red";
        return <span style={{ color }}>{String(value ?? "")}</span>;
      }}
    />
  );
}

/** Shared frame for the progress sub-pages: brief per-course strip on top,
 *  the selected report below. Each report is its own navbar sub-item. */
function ProgressShell({ children }: { children: ReactNode }) {
  return (
    <Box>
      <ScheduleBriefProgress />
      {children}
    </Box>
  );
}

export function ScheduleProgressPage() {
  return <ProgressShell><ScheduleProgress /></ProgressShell>;
}

export function MissingNamesPage() {
  return <ProgressShell><MissingNames /></ProgressShell>;
}

export function LOProgressPage() {
  return <ProgressShell><LOprogress /></ProgressShell>;
}
