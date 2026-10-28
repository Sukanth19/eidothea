import { Fragment, type ReactNode } from "react";
import { splitTokens } from "@/lib/commands";
import { parseBlocks, type Block, type Run } from "@/lib/markup";
import { LiveToken } from "./LiveText";

const TAGS = { s: "s", u: "u", b: "strong", i: "em" } as const;
// Same rule as the API's MENTION: "@name", but not inside an email address
const MENTION = /(?<![\w@])(@[A-Za-z0-9_-]{3,24})/;

function withMentions(text: string): ReactNode {
  const parts = text.split(MENTION);
  if (parts.length === 1) return text;
  return parts.map((p, i) => (i % 2 ? <span key={i} className="mention">{p}</span> : p));
}

// {{commands}} in a community story, played out for the reader (see lib/commands.ts)
function withCommands(text: string): ReactNode {
  const parts = splitTokens(text);
  if (parts.length === 1 && typeof parts[0] === "string") return text;
  return parts.map((p, i) => (typeof p === "string" ? p : <LiveToken key={i} token={p} />));
}

type Options = { mentions?: boolean; live?: boolean };

function Runs({ runs, mentions, live }: { runs: Run[] } & Options) {
  return runs.map((r, i) => {
    let node: ReactNode = mentions ? withMentions(r.text) : live ? withCommands(r.text) : r.text;
    for (const m of [...r.marks].reverse()) {
      const Tag = TAGS[m];
      node = <Tag>{node}</Tag>;
    }
    return <Fragment key={i}>{node}</Fragment>;
  });
}

export function BlockView({ block, ...opts }: { block: Block } & Options) {
  switch (block.type) {
    case "hr":
      return <hr className="scene-break" />;
    case "quote":
      return (
        <blockquote>
          {block.lines.map((line, i) => <p key={i}><Runs runs={line} {...opts} /></p>)}
        </blockquote>
      );
    case "h2":
      return <h2><Runs runs={block.runs} {...opts} /></h2>;
    case "h3":
      return <h3><Runs runs={block.runs} {...opts} /></h3>;
    default:
      return <p><Runs runs={block.runs} {...opts} /></p>;
  }
}

/** Story or comment text, formatted (see lib/markup.ts). `mentions` picks out @names, for comments;
 *  `live` plays out a community story's {{commands}}. */
export function Markup({ text, ...opts }: { text: string } & Options) {
  return parseBlocks(text).map((b, i) => <BlockView key={i} block={b} {...opts} />);
}
