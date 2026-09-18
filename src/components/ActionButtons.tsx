import { Box, Button, Tooltip, Typography } from "@mui/material";

/** Action button group: a row of buttons that switch which report/action
 *  panel is shown below them. `onSelect` receives the clicked button's index. */
export function ActionButtons({
  title = "",
  labels,
  tooltips,
  onSelect,
}: {
  title?: string;
  labels: string[];
  tooltips?: (string | undefined)[];
  onSelect: (index: number) => void;
}) {
  return (
    <Box sx={{ borderBottom: 1, borderColor: "divider", pb: 1, mb: 2 }}>
      {title && <Typography variant="h6">{title}</Typography>}
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, justifyContent: "flex-start" }}>
        {labels.map((label, idx) => (
          <Tooltip key={label} title={tooltips?.[idx] ?? ""}>
            <Button onClick={() => onSelect(idx)} variant="outlined">
              <b>{label}</b>
            </Button>
          </Tooltip>
        ))}
      </Box>
    </Box>
  );
}
