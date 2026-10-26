import { Extension, InputRule, textInputRule, type JSONContent } from "@tiptap/react";
import { parseBlocks, serializeBlocks, type Block, type Mark, type Run } from "@/lib/markup";

// --------------------------------------------------------------------------- story text <-> editor document

const TO_EDITOR: Record<Mark, string> = { b: "bold", i: "italic", u: "underline", s: "strike" };
const FROM_EDITOR: Record<string, Mark> = { bold: "b", italic: "i", underline: "u", strike: "s" };

function runsToNodes(runs: Run[]): JSONContent[] | undefined {
  const nodes = runs
    .filter(r => r.text)
    .map(r => ({ type: "text", text: r.text, ...(r.marks.length ? { marks: r.marks.map(m => ({ type: TO_EDITOR[m] })) } : {}) }));
  return nodes.length ? nodes : undefined;
}

export function toDoc(body: string): JSONContent {
  const content = parseBlocks(body).map((b): JSONContent => {
    switch (b.type) {
      case "hr":
        return { type: "horizontalRule" };
      case "quote":
        return { type: "blockquote", content: b.lines.map(l => ({ type: "paragraph", content: runsToNodes(l) })) };
      case "h2":
      case "h3":
        return { type: "heading", attrs: { level: b.type === "h2" ? 2 : 3 }, content: runsToNodes(b.runs) };
      default:
        return { type: "paragraph", content: runsToNodes(b.runs) };
    }
  });
  return { type: "doc", content: content.length ? content : [{ type: "paragraph" }] };
}

function nodesToRuns(nodes: JSONContent[] = []): Run[] {
  return nodes.map(n => ({
    text: n.type === "text" ? (n.text ?? "") : " ",
    marks: (n.marks ?? []).map(m => FROM_EDITOR[m.type]).filter(Boolean),
  }));
}

/** Every textblock inside a quote becomes one quoted line, however it's nested. */
function quoteLines(node: JSONContent): Run[][] {
  return (node.content ?? []).flatMap(child =>
    child.type === "paragraph" || child.type === "heading" ? [nodesToRuns(child.content)] : quoteLines(child),
  );
}

export function fromDoc(doc: JSONContent): string {
  const blocks: Block[] = (doc.content ?? []).map((n): Block => {
    switch (n.type) {
      case "horizontalRule":
        return { type: "hr" };
      case "blockquote":
        return { type: "quote", lines: quoteLines(n) };
      case "heading":
        return { type: n.attrs?.level === 2 ? "h2" : "h3", runs: nodesToRuns(n.content) };
      default:
        return { type: "p", runs: nodesToRuns(n.content) };
    }
  });
  return serializeBlocks(blocks);
}

// --------------------------------------------------------------------------- typing helpers

/**
 * "--" becomes an em dash, "..." an ellipsis, and (when autocaps is on) sentences start
 * with a capital and a lone "i" becomes "I". Backspace right after any of them undoes it.
 */
export const Typing = Extension.create<{ autocaps: () => boolean }>({
  name: "typing",

  addOptions() {
    return { autocaps: () => true };
  },

  addInputRules() {
    const autocaps = this.options.autocaps;
    return [
      textInputRule({ find: /--$/, replace: "—" }),
      textInputRule({ find: /\.\.\.$/, replace: "…" }),
      new InputRule({
        // Start of a paragraph or after . ! ? (not after an ellipsis, which often trails off mid-sentence)
        find: /(?:^|[.!?]\s+)["“‘(]?([a-z])$/,
        handler: ({ state, range, match }) => {
          if (!autocaps()) return null;
          // The typed letter is already in the document, as the last character of the range
          state.tr.insertText(match[1].toUpperCase(), range.to - 1, range.to);
        },
      }),
      new InputRule({
        find: /(?:^|\s)i['’\s,.!?;:]$/,
        handler: ({ state, range }) => {
          if (!autocaps()) return null;
          // range ends "i" + the character just typed
          state.tr.insertText("I", range.to - 2, range.to - 1);
        },
      }),
    ];
  },
});
