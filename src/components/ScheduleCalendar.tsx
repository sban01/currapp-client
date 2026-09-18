import { useMemo } from "react";
import { Box, Chip, CircularProgress, IconButton, Typography } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { Calendar, Willow } from "@svar-ui/react-calendar";
import type { CalendarEvent } from "@svar-ui/react-calendar";
// all.css (not style.css): the latter omits the toolbar/menu/editor styles.
import "@svar-ui/react-calendar/all.css";
import { reportsApi } from "../lib/apiClient";
import { toColumnsAndRows } from "../lib/reportRows";
import { activityTypeClass, buildActivityTypeCss, pastelFor } from "../lib/activityTypeColors";
import type { Group } from "../config/cache";

// Matches the toolbar sizing used in projects-frontend.
const CALENDAR_TOOLBAR_CSS = `
.wx-calendar .wx-toolbar .wx-label,
.wx-calendar .wx-toolbar .wx-item,
.wx-calendar .wx-toolbar .wx-radio-text,
.wx-calendar .wx-toolbar .wx-segment {
  font-size: 0.8125rem;
  font-weight: 500;
}
`;

// Report columns shown as-is in the detail popup, in order. faculty1..4 are
// merged into one "Faculty" line; Start/End become the date line.
const DETAIL_COLUMNS: [column: string, label: string][] = [
  ["Subject", "Subject"],
  ["course", "Course"],
  ["term", "Term"],
  ["Location", "Location"],
];

type DetailEvent = {
  text: string;
  start: Date;
  end: Date;
  activityType: string;
  fields: [label: string, value: string][];
};

function detailFields(columns: string[], row: unknown[], facultyIdx: number[]): DetailEvent["fields"] {
  const fields: DetailEvent["fields"] = [];
  for (const [column, label] of DETAIL_COLUMNS) {
    const v = row[columns.indexOf(column)];
    if (v !== null && v !== undefined && String(v).trim() !== "") fields.push([label, String(v)]);
  }
  const faculty = facultyIdx.map((i) => row[i]).filter((v) => v !== null && v !== undefined && String(v).trim() !== "");
  if (faculty.length > 0) fields.push(["Faculty", faculty.join(", ")]);
  return fields;
}

function formatWhen(start: Date, end: Date): string {
  const s = dayjs(start);
  const e = dayjs(end);
  if (s.isSame(e, "day")) return `${s.format("ddd D MMM YYYY, HH:mm")} – ${e.format("HH:mm")}`;
  return `${s.format("ddd D MMM YYYY HH:mm")} – ${e.format("ddd D MMM YYYY HH:mm")}`;
}

/** Full-detail card SVAR shows anchored to a clicked event (see `eventPopup`).
 *  Defined at module level so its identity is stable across renders. */
function EventDetails({ event: ev, close }: { event: CalendarEvent; close: () => void }) {
  const event = ev as CalendarEvent & DetailEvent;
  const c = pastelFor(event.activityType);
  return (
    <Box sx={{ width: 340, maxWidth: "90vw", p: 2, bgcolor: "background.paper", borderRadius: 1, boxShadow: 6, borderLeft: `6px solid ${c.border}` }}>
      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, flex: 1, lineHeight: 1.3 }}>
          {event.text}
        </Typography>
        <IconButton size="small" onClick={close} aria-label="close" sx={{ mt: -0.5, mr: -0.5 }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>
      <Chip
        size="small"
        label={event.activityType || "(none)"}
        sx={{ mt: 0.5, bgcolor: c.bg, color: c.text, border: `1px solid ${c.border}`, fontWeight: 500 }}
      />
      <Typography variant="body2" sx={{ mt: 1.5, fontWeight: 500 }}>
        {formatWhen(event.start, event.end)}
      </Typography>
      <Box sx={{ mt: 1, display: "grid", gridTemplateColumns: "auto 1fr", columnGap: 1.5, rowGap: 0.5 }}>
        {event.fields.map(([label, value]) => (
          <Box key={label} sx={{ display: "contents" }}>
            <Typography variant="body2" color="text.secondary">{label}</Typography>
            <Typography variant="body2" sx={{ wordBreak: "break-word" }}>{value}</Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

/** Read-only SVAR calendar over a named schedule report. The report must
 *  return Subject, title, activityType, Start, End (and optionally Location),
 *  as scd_personal_schedule / scd_personal_schedule_dtrng do. Events are
 *  colour-coded by activityType. Shares its query cache key with
 *  FetchDataTable, so toggling table/calendar doesn't refetch. */
export function ScheduleCalendar({
  group,
  queryName,
  params,
  caption,
}: {
  group: Group;
  queryName: string;
  params: Record<string, unknown>;
  caption?: string;
}) {
  const { data, isLoading, error } = useQuery({
    queryKey: [group, "report", queryName, params],
    queryFn: () => reportsApi.run(queryName, params),
  });

  const { events, types, initialDate } = useMemo(() => {
    if (!data) return { events: [], types: [] as string[], initialDate: new Date() };
    const { columns, rows } = toColumnsAndRows(data);
    const col = (name: string) => columns.indexOf(name);
    const [iSubject, iTitle, iType, iStart, iEnd, iLoc] =
      ["Subject", "title", "activityType", "Start", "End", "Location"].map(col);
    const facultyIdx = columns.flatMap((name, idx) => (/^faculty\d+$/.test(name) ? [idx] : []));

    const evs = rows.flatMap((row, i) => {
      // Start/End are naive wall-clock strings; dayjs parses them as local
      // time, so the calendar shows the same clock time the table does.
      const start = dayjs(String(row[iStart]));
      const end = dayjs(String(row[iEnd]));
      if (!start.isValid() || !end.isValid()) return [];
      const type = String(row[iType] ?? "");
      const title = row[iTitle] ? String(row[iTitle]) : "";
      const subject = row[iSubject] ? String(row[iSubject]) : "";
      const location = iLoc >= 0 && row[iLoc] ? String(row[iLoc]) : "";
      return [{
        id: i,
        text: title || subject,
        details: [subject !== title ? subject : "", location].filter(Boolean).join(" · ") || undefined,
        activityType: type,
        fields: detailFields(columns, row, facultyIdx),
        css: activityTypeClass(type),
        start: start.toDate(),
        end: end.toDate(),
      }];
    });
    const typeList = [...new Set(evs.map((e) => e.activityType))].sort();
    return { events: evs, types: typeList, initialDate: evs[0]?.start ?? new Date() };
  }, [data]);

  if (error) {
    return <Typography variant="body2" color="error">{(error as Error).message}</Typography>;
  }
  if (isLoading) {
    return (
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, p: 2 }}>
        <CircularProgress size={20} /> <Typography variant="body2">Loading data…</Typography>
      </Box>
    );
  }

  return (
    <Box>
      {caption && <Typography variant="body2" sx={{ pb: 1 }}>{caption}</Typography>}
      {types.length > 0 && (
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, pb: 1.5 }}>
          {types.map((t) => {
            const c = pastelFor(t);
            return (
              <Chip
                key={t}
                size="small"
                label={t || "(none)"}
                sx={{ bgcolor: c.bg, color: c.text, border: `1px solid ${c.border}`, fontWeight: 500 }}
              />
            );
          })}
        </Box>
      )}
      {events.length === 0 ? (
        <Typography variant="body2" color="text.secondary">No data.</Typography>
      ) : (
        <Box
          sx={{
            height: "calc(100vh - 260px)",
            minHeight: 480,
            border: 1,
            borderColor: "divider",
            borderRadius: 1,
            overflow: "hidden",
            "& > *": { height: "100%" },
          }}
        >
          <Willow>
            <style>{CALENDAR_TOOLBAR_CSS}</style>
            <style>{buildActivityTypeCss(types)}</style>
            {/* Keyed so a new result set re-centres on its first event. */}
            <Calendar
              key={`${queryName}:${initialDate.getTime()}`}
              events={events}
              date={initialDate}
              view="month"
              readonly
              eventPopup={EventDetails}
            />
          </Willow>
        </Box>
      )}
    </Box>
  );
}
