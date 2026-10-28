/**
 * Story commands: {{name}} or {{name:text}}, written into a community story's text and
 * played out by the reader (components/LiveText.tsx). The editor's ` palette, the
 * writer's guide (/guide) and plain-text excerpts all read this list.
 *
 *   {{reader}}  {{reader|stranger}}        the reader, with a fallback for logged-out readers
 *   {{shift:before|after}}                 text with a second part after the bar
 */

export type CommandName = "reader" | "time" | "day" | "date" | "daypart" | "place" | "device" | "shift" | "vanish" | "glitch" | "reread" | "night";

export interface CommandDef {
  name: CommandName;
  group: "knows" | "changes";
  /** What the palette inserts; the part between ‹ › is selected afterwards, ready to type over */
  snippet: string;
  summary: string;
  /** A line using it, and what one reader might see */
  example: string;
  seen: string;
  /** Stands in for it in excerpts, link previews and share cards */
  still: (text?: string, alt?: string) => string;
}

export const COMMANDS: CommandDef[] = [
  {
    name: "reader",
    group: "knows",
    snippet: "{{reader}}",
    summary: "The reader's username. Logged-out readers are called “stranger”; {{reader|you}} picks another word for them.",
    example: "I know you're there, {{reader}}.",
    seen: "I know you're there, sukanth.",
    still: (_, alt) => alt || "stranger",
  },
  {
    name: "time",
    group: "knows",
    snippet: "{{time}}",
    summary: "The time on the reader's clock when they reach it.",
    example: "It was {{time}} when the knocking started.",
    seen: "It was 2:14 AM when the knocking started.",
    still: () => "late",
  },
  {
    name: "daypart",
    group: "knows",
    snippet: "{{daypart}}",
    summary: "Where the reader is in their day: “this morning”, “this afternoon”, “this evening” or “tonight”.",
    example: "Why are you reading this {{daypart}}?",
    seen: "Why are you reading this tonight?",
    still: () => "tonight",
  },
  {
    name: "day",
    group: "knows",
    snippet: "{{day}}",
    summary: "The reader's weekday.",
    example: "It always comes back on a {{day}}.",
    seen: "It always comes back on a Tuesday.",
    still: () => "night like this",
  },
  {
    name: "date",
    group: "knows",
    snippet: "{{date}}",
    summary: "The reader's date, like “28 October”.",
    example: "The last entry is dated {{date}}.",
    seen: "The last entry is dated 28 October.",
    still: () => "today",
  },
  {
    name: "place",
    group: "knows",
    snippet: "{{place}}",
    summary: "The big city the reader's clock is set to, from their time zone. Never their address; just “here” when it can't tell.",
    example: "They found three more in {{place}}.",
    seen: "They found three more in Kolkata.",
    still: () => "your city",
  },
  {
    name: "device",
    group: "knows",
    snippet: "{{device}}",
    summary: "What they're reading on: phone, tablet or computer.",
    example: "Put the {{device}} down. Now.",
    seen: "Put the phone down. Now.",
    still: () => "screen",
  },
  {
    name: "shift",
    group: "changes",
    snippet: "{{shift:‹what it says first›|what it says when they look back}}",
    summary: "Says the first part. Once the reader scrolls past it and comes back, it says the second.",
    example: "There were {{shift:three|four}} of us in the cabin.",
    seen: "There were three of us… and later, four.",
    still: text => text ?? "",
  },
  {
    name: "vanish",
    group: "changes",
    snippet: "{{vanish:‹text›}}",
    summary: "Fades away a few seconds after the reader sees it, leaving a gap.",
    example: "{{vanish:Don't trust the narrator.}}",
    seen: "Don't trust the narrator. (then nothing)",
    still: text => text ?? "",
  },
  {
    name: "glitch",
    group: "changes",
    snippet: "{{glitch:‹text›}}",
    summary: "Breaks into static now and then, and settles again.",
    example: "The voice said {{glitch:come downstairs}}.",
    seen: "The voice said c#m3 d0wn$t… come downstairs.",
    still: text => text ?? "",
  },
  {
    name: "reread",
    group: "changes",
    snippet: "{{reread:‹only there the second time›}}",
    summary: "Hidden the first time. Shows up for readers who have already finished the story once.",
    example: "I went to bed. {{reread:It didn't.}}",
    seen: "Second read: I went to bed. It didn't.",
    still: () => "",
  },
  {
    name: "night",
    group: "changes",
    snippet: "{{night:‹only there after midnight›}}",
    summary: "Only appears between midnight and 4 AM on the reader's clock.",
    example: "Go to sleep. {{night:Why are you still awake?}}",
    seen: "At 1 AM: Go to sleep. Why are you still awake?",
    still: () => "",
  },
];

export const COMMAND = Object.fromEntries(COMMANDS.map(c => [c.name, c])) as Record<CommandName, CommandDef>;

export interface Token {
  name: CommandName;
  /** After the colon, up to the bar */
  text?: string;
  /** After the bar: shift's second part, or reader's fallback */
  alt?: string;
}

// {{name}}, {{name|alt}}, {{name:text}}, {{name:text|alt}}; no braces inside
const TOKEN = /\{\{\s*([a-z]+)\s*(?::([^{}|]*))?(?:\|([^{}]*))?\}\}/g;

/** Anything shaped like a command, known or not; the editor marks these so writers can see them */
export const ANY_TOKEN = /\{\{\s*([a-z]*)[^{}]*\}\}/gi;

/** Splits text into plain strings and the commands in it. Unknown {{names}} stay as they are. */
export function splitTokens(text: string): (string | Token)[] {
  if (!text.includes("{{")) return [text];
  const out: (string | Token)[] = [];
  let last = 0;
  for (const m of text.matchAll(TOKEN)) {
    const name = m[1] as CommandName;
    if (!(name in COMMAND)) continue;
    if (m.index > last) out.push(text.slice(last, m.index));
    out.push({ name, text: m[2]?.trim(), alt: m[3]?.trim() });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/** The text with every command replaced by its still stand-in, for excerpts and previews. */
export function stillText(text: string): string {
  return splitTokens(text)
    .map(p => (typeof p === "string" ? p : COMMAND[p.name].still(p.text, p.alt)))
    .join("");
}

/** Where a snippet's ‹selected part› sits once inserted, and the snippet without the markers. */
export function snippetParts(snippet: string): { text: string; select: [number, number] } {
  const start = snippet.indexOf("‹");
  if (start < 0) return { text: snippet, select: [snippet.length, snippet.length] };
  const end = snippet.indexOf("›") - 1;
  return { text: snippet.replace("‹", "").replace("›", ""), select: [start, end] };
}
