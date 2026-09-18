import { Autocomplete, Box, Button, TextField } from "@mui/material";

export interface MultiSelectState {
  idx1: number;
  value1: string;
  value2?: string;
}

interface MultiSelectProps {
  selector: MultiSelectState;
  setSelector: (s: MultiSelectState) => void;
  onClick: (buttonIndex: number) => void;
  selectoptions: string[];
  /** Value lists for the 2nd dropdown, one per 1st-dropdown option. An entry
   *  of `undefined` hides the 2nd dropdown for that 1st-dropdown option
   *  (e.g. "all activities" needs no course/module/discipline). */
  valueoptions: (string[] | undefined)[];
  buttons: string[];
}

/** Two chained dropdowns (what to view by / which value) + action buttons.
 *  Ported from components/multiselector.jsx. */
export function MultiSelect({ selector, setSelector, onClick, selectoptions, valueoptions, buttons }: MultiSelectProps) {
  const selectChange = (value: string | null) => {
    if (value === null) return;
    const idx = selectoptions.indexOf(value);
    if (idx === -1) return;
    const values2 = valueoptions[idx];
    setSelector({ idx1: idx, value1: value, value2: values2?.[0] });
  };

  const currentValues2 = valueoptions[selector.idx1];

  return (
    <Box sx={{ display: "flex", justifyContent: "flex-start", pt: 1, gap: 1, flexWrap: "wrap" }}>
      {buttons.map((button, idx) => (
        <Button key={button} onClick={() => onClick(idx)} variant="outlined" size="small">
          <b>{button}</b>
        </Button>
      ))}
      <Autocomplete
        options={selectoptions}
        value={selector.value1}
        disableClearable
        size="small"
        sx={{ width: 200 }}
        onChange={(_e, value) => selectChange(value)}
        renderInput={(params) => <TextField {...params} label="select" />}
      />
      {currentValues2 !== undefined && (
        <Autocomplete
          options={currentValues2}
          value={selector.value2 ?? ""}
          disableClearable
          size="small"
          sx={{ width: 200 }}
          onChange={(_e, value) => setSelector({ ...selector, value2: value ?? undefined })}
          renderInput={(params) => <TextField {...params} label="choose value" />}
        />
      )}
    </Box>
  );
}
