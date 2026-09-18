import { reportsApi } from "./apiClient";
import { extractRows } from "./reportRows";

const KEYMAP: Record<string, string> = {
  uid: "UID:",
  description: "DESCRIPTION:",
  title: "SUMMARY:",
  start: "DTSTART:",
  end: "DTEND:",
  location: "LOCATION:",
};

/** Run a personal-schedule named query (format=json) and offer the result as
 *  a downloaded .ics calendar file. Ported from components/saveical.jsx. */
export async function saveIcal(params: Record<string, unknown>): Promise<void> {
  const result = await reportsApi.run(params.query as string, {
    ...params,
    format: "json",
    dtformat: "%Y%m%dT%H%M%S",
  });
  const { rows } = extractRows(result);

  const icshead = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//sgu.edu//NONSGML SOM schedule v1.0//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-TIMEZONE:America/Grenada",
  ];
  const eol = "\r\n";
  let ical = icshead.join(eol) + eol;
  const createDT = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d+Z$/, ""); // YYYYMMDDThhmmss, no TZ offset (whole calendar is Grenada time per X-WR-TIMEZONE)

  for (const row of rows) {
    const newrows = ["BEGIN:VEVENT", "DTSTAMP:" + createDT];
    for (const [key, value] of Object.entries(row)) {
      if (key in KEYMAP) newrows.push(KEYMAP[key] + String(value ?? ""));
    }
    newrows.push("BEGIN:VALARM", "TRIGGER:PT15M", "ACTION:DISPLAY", "DESCRIPTION:" + String(row.title ?? ""), "END:VALARM");
    newrows.push("END:VEVENT");
    ical += newrows.join(eol) + eol;
  }
  ical += "END:VCALENDAR";

  const blob = new Blob([ical], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "schedule.ics";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
