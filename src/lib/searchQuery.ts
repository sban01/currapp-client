// Search-string -> regex compiler for the objectives search page. Ported
// verbatim (pure logic, no UI) from pages/objectives/objectivesearch.jsx —
// supports combining terms with AND (implicit), OR, and AND NOT, compiling
// to a Python-`re`-compatible regex string consumed by SQLite's REGEXP
// (utils/sqlite_utils.py::_regexp) on the API side.

interface Token {
  type: "operator" | "term";
  value: string;
}

interface TermNode {
  type: "term";
  value: string;
  negate: boolean;
}

interface GroupNode {
  type: "AND" | "OR";
  children: (TermNode | GroupNode)[];
}

function tokenize(str: string): Token[] {
  return (
    str.match(/(?:[^\s"]+|"[^"]*")+/g)?.map((token) => ({
      type: /^(AND|OR|NOT)$/.test(token) ? "operator" : "term",
      value: token.replace(/"/g, ""),
    })) ?? []
  );
}

function buildAST(tokens: Token[]): GroupNode {
  const ast: GroupNode = { type: "AND", children: [] };
  let currentGroup = ast.children;
  let i = 0;

  while (i < tokens.length) {
    const token = tokens[i];

    if (token.type === "term") {
      currentGroup.push({ type: "term", value: token.value, negate: false });
    } else if (token.value === "AND" && tokens[i + 1]?.value === "NOT") {
      currentGroup.push({ type: "term", value: tokens[i + 2].value, negate: true });
      i += 2;
    } else if (token.value === "OR") {
      const newOr: GroupNode = { type: "OR", children: [] };
      if (currentGroup.length) {
        newOr.children.push(currentGroup.pop()!);
      }
      currentGroup.push(newOr);
      currentGroup = newOr.children;
    }
    i++;
  }

  return ast;
}

function generateRegex(ast: TermNode | GroupNode, padWordBoundary: boolean): string {
  function processNode(node: TermNode | GroupNode): string {
    if (node.type === "term") {
      const escaped = node.value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const term = padWordBoundary ? `\\b${escaped}\\b` : escaped;
      return node.negate ? `(?!.*${term})` : `(?=.*${term})`;
    }
    const children = node.children.map(processNode);
    if (node.type === "AND") return children.join("");
    return `(?:${children.join("|")})`;
  }
  return `^${processNode(ast)}.*$`;
}

/** Compile a search string with logical operators (AND / OR / AND NOT) into
 *  a Python-regex string. `padWordBoundary` restricts matches to whole
 *  words. */
export function parseSearchString(searchString: string, padWordBoundary = true): string {
  const tokens = tokenize(searchString);
  const ast = buildAST(tokens);
  return generateRegex(ast, padWordBoundary);
}
