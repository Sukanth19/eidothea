import { Fragment, type ReactNode } from "react";
import { parseBlocks, type Block, type Run } from "@/lib/markup";

const TAGS = { s: "s", u: "u", b: "strong", i: "em" } as const;
// Same rule as the API's MENTION: "@name", but not inside an email address
const MENTION = /(?<![\w@])(@[A-Za-z0-9_-]{3,24})/;

function withMentions(text: string): ReactNode {
  const parts = text.split(MENTION);
  if (parts.length === 1) return text;
  return parts.map((p, i) => (i % 2 ? <span key={i} className="mention">{p}</span> : p));
}

function Runs({ runs, mentions }: { runs: Run[]; mentions?: boolean }) {
  return runs.map((r, i) => {
    let node: ReactNode = mentions ? withMentions(r.text) : r.text;
    for (const m of [...r.marks].reverse()) {
      const Tag = TAGS[m];
      node = <Tag>{node}</Tag>;
    }
    return <Fragment key={i}>{node}</Fragment>;
  });
}

export function BlockView({ block, mentions }: { block: Block; mentions?: boolean }) {
  switch (block.type) {
    case "hr":
      return <hr className="scene-break" />;
    case "quote":
      return (
        <blockquote>
          {block.lines.map((line, i) => <p key={i}><Runs runs={line} mentions={mentions} /></p>)}
        </blockquote>
      );
    case "h2":
      return <h2><Runs runs={block.runs} mentions={mentions} /></h2>;
    case "h3":
      return <h3><Runs runs={block.runs} mentions={mentions} /></h3>;
    default:
      return <p><Runs runs={block.runs} mentions={mentions} /></p>;
  }
}

/** Story or comment text, formatted (see lib/markup.ts). `mentions` picks out @names, for comments. */
export function Markup({ text, mentions }: { text: string; mentions?: boolean }) {
  return parseBlocks(text).map((b, i) => <BlockView key={i} block={b} mentions={mentions} />);
}
