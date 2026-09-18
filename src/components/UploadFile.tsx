import { useRef } from "react";
import { Box, Button, CircularProgress, Typography } from "@mui/material";

/** Stage-based Excel file picker: 0 = select, 1 = uploading, 2 = reply shown.
 *  Replaces legacy's mui-file-dropzone-based UploadFile with a plain button
 *  + hidden file input (mui-file-dropzone was dropped as a dependency —
 *  uncertain MUI v9/React 19 compatibility for a purely cosmetic drag target). */
export function UploadFile({
  stage,
  dztxt,
  onFile,
  replyMessage,
}: {
  stage: number;
  dztxt: string;
  onFile: (file: File) => void;
  replyMessage?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  if (stage === 0) {
    return (
      <Box sx={{ border: "2px dashed", borderColor: "divider", borderRadius: 1, p: 3, textAlign: "center" }}>
        <Typography variant="body2" sx={{ mb: 2 }}>
          {dztxt}
        </Typography>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xlsm"
          style={{ display: "none" }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onFile(file);
            e.target.value = ""; // allow re-selecting the same file name later
          }}
        />
        <Button variant="contained" onClick={() => inputRef.current?.click()}>
          Choose file
        </Button>
      </Box>
    );
  }

  if (stage === 1) {
    return (
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, p: 2 }}>
        <CircularProgress size={20} />
        <Typography variant="body2" color="error">
          <b>Uploading…</b>
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="body2">{replyMessage}</Typography>
    </Box>
  );
}
