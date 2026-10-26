import { Fragment, type ReactNode } from "react";
import { parseBlocks, type Block, type Run } from "@/lib/markup";

const TAGS = { s: "s", u: "u", b: "strong", i: "em" } as const;

function Runs({ runs }: { runs: Run[] }) {
  return runs.map((r, i) => {
    let node: ReactNode = r.text;
    for (const m of [...r.marks].reverse()) {
      const Tag = TAGS[m];
      node = <Tag>{node}</Tag>;
    }
    return <Fragment key={i}>{node}</Fragment>;
  });
}

export function BlockView({ block }: { block: Block }) {
  switch (block.type) {
    case "hr":
      return <hr className="scene-break" />;
    case "quote":
      return (
        <blockquote>
          {block.lines.map((line, i) => <p key={i}><Runs runs={line} /></p>)}
        </blockquote>
      );
    case "h2":
      return <h2><Runs runs={block.runs} /></h2>;
    case "h3":
      return <h3><Runs runs={block.runs} /></h3>;
    default:
      return <p><Runs runs={block.runs} /></p>;
  }
}

/** Story or comment text, formatted (see lib/markup.ts). */
export function Markup({ text }: { text: string }) {
  return parseBlocks(text).map((b, i) => <BlockView key={i} block={b} />);
}
