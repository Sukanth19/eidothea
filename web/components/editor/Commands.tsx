"use client";

import { Extension, type Editor } from "@tiptap/react";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ANY_TOKEN, COMMAND, COMMANDS, snippetParts, type CommandDef, type CommandName } from "@/lib/commands";

/**
 * Story commands in the editor: typing ` opens the palette, and every {{command}} in the text
 * is marked, so writers can see what the reader will play out (and spot a misspelt one).
 */
export const StoryCommands = Extension.create<{ open: (from: number, to: number) => void }>({
  name: "storyCommands",

  addOptions() {
    return { open: () => {} };
  },

  addProseMirrorPlugins() {
    const open = this.options.open;
    return [
      new Plugin({
        key: new PluginKey("storyCommands"),
        props: {
          handleTextInput(_view, from, to, text) {
            if (text !== "`") return false;
            open(from, to);
            return true;
          },
          decorations(state) {
            const marks: Decoration[] = [];
            state.doc.descendants((node, pos) => {
              if (!node.isText || !node.text?.includes("{{")) return;
              for (const m of node.text.matchAll(ANY_TOKEN)) {
                const known = m[1].toLowerCase() in COMMAND;
                marks.push(Decoration.inline(pos + m.index, pos + m.index + m[0].length, {
                  class: known ? "cmd-mark" : "cmd-mark unknown",
                  title: known ? COMMAND[m[1].toLowerCase() as CommandName].summary : "Not a command the reader knows. Type ` to see them all.",
                }));
              }
            });
            return DecorationSet.create(state.doc, marks);
          },
        },
      }),
    ];
  },
});

const GROUPS: [CommandDef["group"], string][] = [["knows", "THE STORY KNOWS THE READER"], ["changes", "TEXT THAT CHANGES"]];

/** The list of commands, opened by ` or the toolbar. Picking one writes it in at the cursor. */
export function CommandPalette({ editor, range, onClose }: { editor: Editor; range: { from: number; to: number }; onClose: () => void }) {
  const [filter, setFilter] = useState("");
  const [pick, setPick] = useState(0);
  const [place, setPlace] = useState<React.CSSProperties>({ visibility: "hidden" });
  const box = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const selected = editor.state.doc.textBetween(range.from, range.to, " ");

  const q = filter.trim().toLowerCase();
  const shown = GROUPS.flatMap(([g]) => COMMANDS.filter(c => c.group === g && (!q || c.name.includes(q) || c.summary.toLowerCase().includes(q))));

  // Under the cursor, or above it when there's more room there (a phone keyboard takes the bottom),
  // never over the line being written
  useLayoutEffect(() => {
    const caret = editor.view.coordsAtPos(range.from);
    const vh = window.visualViewport?.height ?? window.innerHeight;
    const vw = window.innerWidth;
    const w = Math.min(420, vw - 16);
    const left = Math.max(8, Math.min(caret.left, vw - w - 8));
    const below = vh - caret.bottom - 14;
    const above = caret.top - 14;
    const tall = 416;
    setPlace(below >= Math.min(tall, 260) || below >= above
      ? { top: caret.bottom + 6, left, width: w, maxHeight: Math.min(tall, below) }
      : { bottom: vh - caret.top + 6, left, width: w, maxHeight: Math.min(tall, above) });
  }, [editor, range.from]);

  useEffect(() => setPick(0), [filter]);

  // After the editor has finished handling the keypress that opened it, or it takes the focus back
  useEffect(() => {
    const t = setTimeout(() => input.current?.focus());
    return () => clearTimeout(t);
  }, []);

  function close(insert?: string) {
    onClose();
    const chain = editor.chain().focus();
    if (insert) chain.insertContentAt({ from: range.from, to: range.to }, insert).run();
    else chain.setTextSelection(range).run();
  }

  function choose(c: CommandDef) {
    const { text, select } = snippetParts(c.snippet);
    // Text selected before opening goes in as the command's text: select a line, pick {{glitch}}
    const hasSlot = select[0] !== select[1];
    const filled = hasSlot && selected ? text.slice(0, select[0]) + selected + text.slice(select[1]) : text;
    onClose();
    const at = range.from;
    editor.chain().focus().insertContentAt({ from: range.from, to: range.to }, { type: "text", text: filled }).run();
    if (hasSlot && !selected) editor.commands.setTextSelection({ from: at + select[0], to: at + select[1] });
  }

  function keys(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (shown.length) setPick(p => (p + (e.key === "ArrowDown" ? 1 : -1) + shown.length) % shown.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (shown[pick]) choose(shown[pick]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "`" && !filter) {
      // A second ` means they wanted the character itself
      e.preventDefault();
      close("`");
    }
  }

  return (
    <>
      <div className="palette-scrim" onPointerDown={() => close()} />
      <div ref={box} className="palette" role="dialog" aria-label="Story commands" style={place}>
        <input
          ref={input}
          value={filter}
          onChange={e => setFilter(e.target.value)}
          onKeyDown={keys}
          placeholder={selected ? `Use “${selected.slice(0, 24)}${selected.length > 24 ? "…" : ""}” in…` : "Find a command…"}
          aria-label="Find a command"
          role="combobox"
          aria-expanded="true"
          aria-controls="palette-list"
          aria-activedescendant={shown[pick] ? `cmd-${shown[pick].name}` : undefined}
          autoCapitalize="off"
          spellCheck={false}
        />
        <ul id="palette-list" role="listbox">
          {GROUPS.map(([g, title]) => {
            const items = shown.filter(c => c.group === g);
            if (!items.length) return null;
            return (
              <li key={g} role="presentation">
                <div className="palette-group">{title}</div>
                <ul role="presentation">
                  {items.map(c => {
                    const i = shown.indexOf(c);
                    return (
                      <li
                        key={c.name}
                        id={`cmd-${c.name}`}
                        role="option"
                        aria-selected={i === pick}
                        className={i === pick ? "on" : ""}
                        onPointerDown={e => {
                          e.preventDefault();
                          choose(c);
                        }}
                        onPointerEnter={() => setPick(i)}
                      >
                        <code>{snippetParts(c.snippet).text.replace(/\|.*\}\}$/, "|…}}")}</code>
                        <span>{c.summary}</span>
                      </li>
                    );
                  })}
                </ul>
              </li>
            );
          })}
          {!shown.length && <li className="palette-empty">No command by that name.</li>}
        </ul>
        <div className="palette-foot">
          <span>` TWICE TYPES A `</span>
          <a href="/guide" target="_blank" rel="noopener">WRITER&apos;S GUIDE →</a>
        </div>
      </div>
    </>
  );
}
