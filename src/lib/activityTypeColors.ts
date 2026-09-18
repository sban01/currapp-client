// Stable per-activityType pastel colours for calendar views.
//
// Known types (the activitytypes table's seed rows) get evenly spread hues by
// position so common types are always visually distinct; any type added later
// falls back to a hash-derived hue.
const KNOWN_TYPES = [
  "LEC", "DLA", "SG", "MCQ", "EXM", "LAB", "LABX", "US", "SIM", "OSPE", "OCEX",
  "OSPEmini", "OCEXmini", "ESQ", "BLS", "HOL", "OSCE", "HPS", "MISC", "RR", "ER",
];

// Golden-angle stepping keeps neighbouring indices far apart on the colour wheel.
const GOLDEN_ANGLE = 137.508;

function hueFor(type: string): number {
  const idx = KNOWN_TYPES.indexOf(type);
  if (idx >= 0) return (idx * GOLDEN_ANGLE) % 360;
  let h = 0;
  for (const ch of type) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h % 360;
}

export interface PastelColor {
  bg: string;
  border: string;
  text: string;
}

export function pastelFor(type: string): PastelColor {
  const h = Math.round(hueFor(type));
  return {
    bg: `hsl(${h} 70% 86%)`,
    border: `hsl(${h} 55% 68%)`,
    text: `hsl(${h} 35% 22%)`,
  };
}

/** Class name safe for use in a CSS selector, one per activityType. */
export function activityTypeClass(type: string): string {
  return `at-${type.replace(/[^a-zA-Z0-9_-]/g, "_") || "none"}`;
}

/** CSS colouring SVAR calendar events carrying `activityTypeClass(type)` in
 *  their `css` field. SVAR appends that class to both the box and bar event
 *  elements; the class is doubled to out-specify its scoped rules. */
export function buildActivityTypeCss(types: Iterable<string>): string {
  const rules: string[] = [];
  for (const type of new Set(types)) {
    const c = activityTypeClass(type);
    const { bg, border, text } = pastelFor(type);
    const paint = `{background-color:${bg} !important;border-color:${border} !important;color:${text} !important;}`;
    rules.push(`.wx-box-event.${c}.${c}${paint}.wx-bar-event.${c}.${c}${paint}`);
  }
  return rules.join("\n");
}
