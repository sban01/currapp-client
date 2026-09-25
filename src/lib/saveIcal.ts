import { reportsApi } from "./apiClient";
import { extractRows } from "./reportRows";

// Escaping, line folding and the alarm trigger follow RFC 5545 (same as
// soms-client's lib/saveIcal.ts), which imports cleanly into Outlook, Google
// and Apple Calendar.

const EOL = "\r\n";

// Query column -> iCal property, in output order. Text values are escaped.
const KEYMAP: [column: string, property: string][] = [
  ["uid", "UID"],
  ["start", "DTSTART"],
  ["end", "DTEND"],
  ["title", "SUMMARY"],
  ["description", "DESCRIPTION"],
  ["location", "LOCATION"],
];
const DATE_PROPS = new Set(["DTSTART", "DTEND"]);

function escapeText(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Fold content lines at 75 octets (continuation lines start with a space). */
function fold(line: string): string {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;
  const out: string[] = [];
  let cur = "";
  let curLen = 0;
  for (const ch of line) {
    const n = enc.encode(ch).length;
    if (curLen + n > (out.length === 0 ? 75 : 74)) {
      out.push(cur);
      cur = "";
      curLen = 0;
    }
    cur += ch;
    curLen += n;
  }
  out.push(cur);
  return out.join(EOL + " ");
}

/** Run a personal-schedule named query (format=json) and offer the result as
 *  a downloaded .ics calendar file. Ported from components/saveical.jsx. */
export async function saveIcal(params: Record<string, unknown>): Promise<void> {
  const result = await reportsApi.run(params.query as string, {
    ...params,
    format: "json",
    dtformat: "%Y%m%dT%H%M%S",
  });
  const { rows } = extractRows(result);

  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//sgu.edu//NONSGML SOM schedule v1.0//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    // DTSTART/DTEND are floating local times (no TZ), i.e. Grenada time.
    "X-WR-TIMEZONE:America/Grenada",
  ];
  for (const row of rows as Record<string, unknown>[]) {
    lines.push("BEGIN:VEVENT", `DTSTAMP:${stamp}`);
    for (const [column, prop] of KEYMAP) {
      const v = row[column];
      if (v === null || v === undefined || String(v) === "") continue;
      lines.push(`${prop}:${DATE_PROPS.has(prop) ? String(v) : escapeText(String(v))}`);
    }
    const summary = String(row.title ?? row.description ?? "");
    lines.push("BEGIN:VALARM", "TRIGGER:-PT15M", "ACTION:DISPLAY", `DESCRIPTION:${escapeText(summary)}`, "END:VALARM", "END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  const ical = lines.map(fold).join(EOL) + EOL;

  const url = URL.createObjectURL(new Blob([ical], { type: "text/calendar;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "schedule.ics";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
