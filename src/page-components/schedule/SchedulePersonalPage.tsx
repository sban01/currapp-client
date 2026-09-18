import { useMemo, useState } from "react";
import { Autocomplete, Box, Button, Checkbox, FormControlLabel, TextField, Typography } from "@mui/material";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import dayjs from "dayjs";
import type { Dayjs } from "dayjs";
import { useQuery } from "@tanstack/react-query";
import { FetchDataTable } from "../../components/DataTable";
import { reportsApi } from "../../lib/apiClient";
import { toColumnsAndRows } from "../../lib/reportRows";
import { saveIcal } from "../../lib/saveIcal";
import { useGlobals } from "../../lib/GlobalsContext";

type View = "schedule" | "workload";

/** Personal schedule / workload view + ical download, by term or date range.
 *  Ported from pages/schedule/schedulepersonal.jsx. */
export default function SchedulePersonalPage() {
  const { termY, termM } = useGlobals();
  const [name, setName] = useState<string | null>(null);
  const [view, setView] = useState<View>("schedule");
  const [showResults, setShowResults] = useState(false);
  const [useDateRange, setUseDateRange] = useState(false);
  // The term month sets a default range (Jan-Jun / Jul-Dec); an explicit
  // pick here overrides it until the term month changes again.
  const [dateOverride, setDateOverride] = useState<{ start: Dayjs; end: Dayjs } | null>(null);
  const [message, setMessage] = useState("");

  const defaultRange = useMemo(
    () =>
      termM === "August"
        ? { start: dayjs(new Date(termY, 6, 1)), end: dayjs(new Date(termY, 11, 31)) }
        : { start: dayjs(new Date(termY, 0, 1)), end: dayjs(new Date(termY, 5, 30)) },
    [termY, termM],
  );
  const { start, end } = dateOverride ?? defaultRange;
  const setStart = (v: Dayjs) => setDateOverride({ start: v, end });
  const setEnd = (v: Dayjs) => setDateOverride({ start, end: v });

  const { data: names, isPending } = useQuery({
    queryKey: ["schedule", "report", "scd_facultyNames", { termY, termM }],
    queryFn: async () => {
      const result = await reportsApi.run("scd_facultyNames", { termY, termM });
      const { rows } = toColumnsAndRows(result);
      return rows.map((r) => String(r[0]));
    },
  });

  if (isPending) return <Typography variant="body2">Loading name list…</Typography>;

  const paddedName = `%${name ?? ""}%`;
  const params = useDateRange
    ? { query: `scd_personal_${view}_dtrng`, start, end: end.add(1, "day"), name: paddedName }
    : { query: `scd_personal_${view}`, termY, termM, name: paddedName };
  const caption =
    (view === "workload" ? "Workload summary (n = number of unique activities, repeats are not counted)" : "Personal schedule") +
    (useDateRange
      ? ` for ${name} from ${start.format("D MMMM YYYY")} to ${end.format("D MMMM YYYY")}.`
      : ` for ${name} for term ${termM} ${termY}.`);

  const requireName = (action: () => void) => {
    if (!name) {
      setMessage("Please select a name first.");
      setTimeout(() => setMessage(""), 1500);
      return;
    }
    action();
  };

  return (
    <Box>
      <LocalizationProvider dateAdapter={AdapterDayjs}>
        <Box sx={{ display: "flex", justifyContent: "flex-start", flexWrap: "wrap", gap: 1.5, p: 1 }}>
          <Autocomplete
            options={names ?? []}
            value={name}
            size="small"
            sx={{ width: 250 }}
            onChange={(_e, value) => setName(value)}
            renderInput={(params) => <TextField {...params} label="select name" />}
          />
          <Button
            variant="outlined"
            onClick={() =>
              requireName(() => {
                setMessage(`downloading personal schedule ical for ${name}`);
                void saveIcal(
                  useDateRange
                    ? { query: "scd_personal_ical_dtrng", start, end: end.add(1, "day"), name: paddedName }
                    : { query: "scd_personal_ical", termY, termM, name: paddedName },
                );
              })
            }
          >
            <b>download</b>
          </Button>
          <Button
            variant="outlined"
            onClick={() =>
              requireName(() => {
                setView("schedule");
                setShowResults(true);
              })
            }
          >
            <b>schedule view</b>
          </Button>
          <Button
            variant="outlined"
            onClick={() =>
              requireName(() => {
                setView("workload");
                setShowResults(true);
              })
            }
          >
            <b>workload view</b>
          </Button>
          <FormControlLabel
            control={<Checkbox checked={useDateRange} onChange={() => setUseDateRange((v) => !v)} />}
            label="date range"
          />
          {useDateRange && (
            <>
              <DatePicker label="start date" value={start} onChange={(v) => v && setStart(v)} sx={{ width: 160 }} />
              <DatePicker label="end date" value={end} onChange={(v) => v && setEnd(v)} sx={{ width: 160 }} />
            </>
          )}
        </Box>
      </LocalizationProvider>
      {message && <Typography variant="body2">{message}</Typography>}
      {showResults && !message && (
        <FetchDataTable group="schedule" queryName={params.query} params={params} caption={caption} />
      )}
    </Box>
  );
}
