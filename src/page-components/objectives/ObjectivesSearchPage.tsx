import { useState } from "react";
import {
  Autocomplete, Box, Button, Checkbox, FormControlLabel, TextField, Tooltip, Typography,
} from "@mui/material";
import { FetchDataTable } from "../../components/DataTable";
import { LoTreeView } from "../../components/LoTreeView";
import { TreeView } from "../../components/TreeView";
import { parseSearchString } from "../../lib/searchQuery";
import { useGlobals } from "../../lib/GlobalsContext";

const SEARCH_IN_OPTIONS = ["LO text", "Lecture/DLA titles", "higher-level objectives"] as const;
type SearchIn = (typeof SEARCH_IN_OPTIONS)[number];
type ViewType = "table" | "tree";

/** Search learning objectives (or titles / HL objectives) with AND/OR/AND-NOT
 *  logic or a raw regex, viewed as a table or a tree graph. Ported from
 *  pages/objectives/objectivesearch.jsx. */
export default function ObjectivesSearchPage() {
  const { termY, termM } = useGlobals();
  const [searchterm, setSearchterm] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [viewType, setViewType] = useState<ViewType>("tree");
  const [regexp, setRegexp] = useState(false);
  const [padWordBoundary, setPadWordBoundary] = useState(true);
  const [searchIn, setSearchIn] = useState<SearchIn>(SEARCH_IN_OPTIONS[0]);
  const [msg, setMsg] = useState("");

  const showResults = (view: ViewType) => {
    if (searchterm.trim() === "") {
      setMsg("Please enter a search term first.");
      setTimeout(() => setMsg(""), 1500);
      return;
    }
    setViewType(view);
    setSubmitted(searchterm);
  };

  let query: string;
  // The LO-text tree is built client-side from obj_searchLOs (see LoTreeView),
  // so both views of an LO search use that one stored query.
  if (searchIn === SEARCH_IN_OPTIONS[0]) query = "obj_searchLOs";
  else if (searchIn === SEARCH_IN_OPTIONS[1]) query = viewType === "tree" ? "obj_searchTitles_graph1" : "obj_searchTitles";
  else query = viewType === "tree" ? "obj_searchHLLOs_graph" : "obj_searchHLLOs";

  const searchstr = regexp ? submitted.split("/").join("//") : parseSearchString(submitted, padWordBoundary);
  const params = { query, root: submitted, searchterm: searchstr, termM, termY };
  const caption = `Learning objectives matching search term '${submitted}' in term ${termM} ${termY}.`;

  return (
    <Box sx={{ lineHeight: 1.4 }}>
      {!regexp ? (
        <Typography variant="body2" align="left">
          Search supports logical operators AND, OR, AND NOT to combine individual terms.
        </Typography>
      ) : (
        <Typography variant="body2" align="left">
          The search term will be interpreted as a regular expression, supporting the{" "}
          <a href="https://docs.python.org/3/library/re.html" target="_blank" rel="noreferrer">
            python regular expression syntax
          </a>
          .
        </Typography>
      )}
      <Tooltip
        enterDelay={700}
        title="If unchecked, the search term is interpreted to provide logical operators AND, OR, and AND NOT. If checked, the search term is interpreted as a python regular expression."
      >
        <FormControlLabel control={<Checkbox checked={regexp} onChange={() => setRegexp((v) => !v)} />} label="use regular expression syntax" />
      </Tooltip>
      {!regexp && (
        <Tooltip
          enterDelay={700}
          title="If checked, only results where the search term matches an entire word will be returned. If unchecked, matches where the search term is part of a longer word will also be included."
        >
          <FormControlLabel
            control={<Checkbox checked={padWordBoundary} onChange={() => setPadWordBoundary((v) => !v)} />}
            label="match whole words only"
          />
        </Tooltip>
      )}
      <Box sx={{ display: "flex", justifyContent: "flex-start", gap: 1, pt: 1, pb: 1, flexWrap: "wrap" }}>
        <Autocomplete
          options={[...SEARCH_IN_OPTIONS]}
          value={searchIn}
          disableClearable
          size="small"
          sx={{ width: 220 }}
          onChange={(_e, value) => setSearchIn(value as SearchIn)}
          renderInput={(params) => <TextField {...params} label="search in" />}
        />
        <Button size="small" variant="outlined" onClick={() => showResults("table")}>
          <b>Table view</b>
        </Button>
        <Button size="small" variant="outlined" onClick={() => showResults("tree")}>
          <b>Tree view</b>
        </Button>
        <TextField
          label="enter search term"
          size="small"
          sx={{ width: 400 }}
          slotProps={{ htmlInput: { maxLength: 100 } }}
          onBlur={(e) => setSearchterm(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              setSearchterm((e.target as HTMLInputElement).value);
              setSubmitted((e.target as HTMLInputElement).value);
            }
          }}
        />
      </Box>
      {msg && <Typography variant="body2">{msg}</Typography>}
      {submitted && viewType === "table" && (
        <FetchDataTable group="objectives" queryName={query} params={params} caption={caption} />
      )}
      {submitted && viewType === "tree" && searchIn === SEARCH_IN_OPTIONS[0] && (
        <LoTreeView group="objectives" queryName={query} params={params} root={submitted} />
      )}
      {submitted && viewType === "tree" && searchIn !== SEARCH_IN_OPTIONS[0] && (
        <TreeView group="objectives" queryName={query} params={params} />
      )}
    </Box>
  );
}
