/**
 * Story text format. Bodies are stored as plain text with light markup, one block per line:
 *
 *   ## Heading          ### Subheading         > quote (consecutive lines share a box)
 *   * * *  (or *****, -----, ____: a scene break)
 *   **bold**  *italic*  ***both***  __underline__  ~~strike~~  \* (a literal star)
 *
 * The archive's imported stories already use *stars* for emphasis and rows of stars or
 * underscores between scenes, so they render with the same rules. The reader, the
 * comment box and the editor all go through this file.
 */

export type Mark = "s" | "u" | "b" | "i";
export interface Run {
  text: string;
  marks: Mark[];
}
export type Block =
  | { type: "p" | "h2" | "h3"; runs: Run[] }
  | { type: "quote"; lines: Run[][] }
  | { type: "hr" };

// Outermost first, so bold+italic serializes as ***x***
const MARK_ORDER: Mark[] = ["s", "u", "b", "i"];
const ESCAPABLE = "\\*_~>#-=";
const SCENE_BREAK = /^(?:[*\-_=~]\s*){3,}$/;

// --------------------------------------------------------------------------- parsing

export function parseBlocks(body: string): Block[] {
  const blocks: Block[] = [];
  let afterBlank = true;
  for (const raw of body.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) {
      afterBlank = true;
      continue;
    }
    const last = blocks[blocks.length - 1];
    const quote = /^>\s?(.*)$/.exec(line);
    if (SCENE_BREAK.test(line)) {
      blocks.push({ type: "hr" });
    } else if (quote) {
      // Quote lines in a row share one box; a blank line starts a new one
      const runs = parseInline(quote[1]);
      if (last?.type === "quote" && !afterBlank) last.lines.push(runs);
      else blocks.push({ type: "quote", lines: [runs] });
    } else {
      const heading = /^(#{1,3})\s+(.+)$/.exec(line);
      if (heading) blocks.push({ type: heading[1].length === 3 ? "h3" : "h2", runs: parseInline(heading[2]) });
      else blocks.push({ type: "p", runs: parseInline(line) });
    }
    afterBlank = false;
  }
  return blocks;
}

const isSpace = (c: string | undefined) => c === undefined || /\s/.test(c);
const isWord = (c: string | undefined) => c !== undefined && /[\p{L}\p{N}]/u.test(c);

function runLength(s: string, at: number, ch: string): number {
  let n = 0;
  while (s[at + n] === ch) n++;
  return n;
}

/** Finds where a `delim` opened at `from` closes, or -1. */
function findCloser(s: string, from: number, delim: string): number {
  const ch = delim[0];
  for (let j = from; j < s.length; j++) {
    if (s[j] === "\\") {
      j++;
      continue;
    }
    if (s[j] !== ch) continue;
    const n = runLength(s, j, ch);
    const end = j + n; // a closer sits at the end of its run: "**a *b***"
    const fits = ch === "*" ? (delim.length === 1 ? n === 1 || n === 3 : delim.length === 2 ? n === 2 || n === 3 : n === 3) : n === delim.length;
    if (fits && j > from && !isSpace(s[j - 1]) && !(ch === "_" && isWord(s[end]))) return end - delim.length;
    j = end - 1;
  }
  return -1;
}

const DELIMS: [string, Mark[]][] = [
  ["***", ["b", "i"]],
  ["**", ["b"]],
  ["*", ["i"]],
  ["__", ["u"]],
  ["~~", ["s"]],
];

export function parseInline(s: string, marks: Mark[] = []): Run[] {
  const runs: Run[] = [];
  let text = "";
  const flush = () => {
    if (text) runs.push({ text, marks });
    text = "";
  };

  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "\\" && ESCAPABLE.includes(s[i + 1] ?? "")) {
      text += s[++i];
      continue;
    }
    if (c === "*" || c === "_" || c === "~") {
      const run = runLength(s, i, c);
      let matched = false;
      for (const [delim, add] of DELIMS) {
        if (delim[0] !== c || delim.length > run) continue;
        if (c !== "*" && delim.length !== run) continue; // "____" is a blank to fill in, not markup
        const inner = i + delim.length;
        if (isSpace(s[inner]) || (c !== "~" && isWord(s[i - 1]))) continue;
        const close = findCloser(s, inner, delim);
        if (close < 0) continue;
        flush();
        runs.push(...parseInline(s.slice(inner, close), sortMarks([...marks, ...add])));
        i = close + delim.length - 1;
        matched = true;
        break;
      }
      if (matched) continue;
      text += s.slice(i, i + run);
      i += run - 1;
      continue;
    }
    text += c;
  }
  flush();
  return runs;
}

function sortMarks(marks: Mark[]): Mark[] {
  return MARK_ORDER.filter(m => marks.includes(m));
}

// --------------------------------------------------------------------------- serializing

function escapeAll(text: string): string {
  return text.replace(/[\\*_~]/g, "\\$&");
}

function serializeRuns(runs: Run[], escape: boolean): string {
  let out = "";
  const open: Mark[] = [];
  const delim = { s: "~~", u: "__", b: "**", i: "*" } as const;

  const closeTo = (keep: number) => {
    while (open.length > keep) {
      const m = open.pop()!;
      const trailing = /\s*$/.exec(out)![0]; // markers must hug the text
      out = out.slice(0, out.length - trailing.length) + delim[m] + trailing;
    }
  };

  for (const run of runs) {
    if (!run.text) continue;
    const marks = sortMarks(run.marks);
    let keep = 0;
    while (keep < open.length && marks.includes(open[keep])) keep++;
    closeTo(keep);
    let text = escape ? escapeAll(run.text) : run.text;
    const opening = marks.filter(m => !open.includes(m));
    if (opening.length) {
      const lead = /^\s*/.exec(text)![0];
      out += lead;
      text = text.slice(lead.length);
      if (!text) continue; // whitespace-only run: nothing to wrap
      for (const m of opening) {
        out += delim[m];
        open.push(m);
      }
    }
    out += text;
  }
  closeTo(0);
  return out;
}

function sameRuns(a: Run[], b: Run[]): boolean {
  return JSON.stringify(normalizeRuns(a)) === JSON.stringify(normalizeRuns(b));
}

function normalizeRuns(runs: Run[]): Run[] {
  const out: Run[] = [];
  for (const r of runs) {
    if (!r.text) continue;
    const marks = sortMarks(r.marks);
    const last = out[out.length - 1];
    if (last && last.marks.join() === marks.join()) last.text += r.text;
    else out.push({ text: r.text, marks });
  }
  return out;
}

/** One line of text. Stays unescaped unless the plain version would read back differently. */
function serializeLine(runs: Run[]): string {
  let line = serializeRuns(runs, false);
  if (!sameRuns(parseInline(line), runs)) line = serializeRuns(runs, true);
  line = line.replace(/\s*\n\s*/g, " ").trim();
  // Text that would otherwise read as a heading, quote or scene break
  if (/^(>|#{1,3}\s)/.test(line) || SCENE_BREAK.test(line)) line = "\\" + line;
  return line;
}

export function serializeBlocks(blocks: Block[]): string {
  const lines: string[] = [];
  for (const b of blocks) {
    if (b.type === "hr") {
      lines.push("* * *");
    } else if (b.type === "quote") {
      const quoted = b.lines.map(serializeLine).filter(Boolean);
      if (!quoted.length) continue;
      // Keep two neighbouring quote boxes apart
      if (lines.length && lines[lines.length - 1].startsWith(">")) lines.push("");
      lines.push(...quoted.map(l => `> ${l}`));
    } else {
      const text = serializeLine(b.runs);
      if (!text) continue;
      lines.push(b.type === "h2" ? `## ${text}` : b.type === "h3" ? `### ${text}` : text);
    }
  }
  return lines.join("\n");
}

// --------------------------------------------------------------------------- plain text

export function plainText(body: string): string {
  return parseBlocks(body)
    .map(b => (b.type === "hr" ? "" : b.type === "quote" ? b.lines.map(runsText).join(" ") : runsText(b.runs)))
    .filter(Boolean)
    .join(" ");
}

function runsText(runs: Run[]): string {
  return runs.map(r => r.text).join("");
}
