"use client";

import { useEditorState, type Editor } from "@tiptap/react";
import { Icon, type IconName } from "../Icon";

type Style = "p" | "h2" | "h3" | "quote";

function Tool({ icon, label, on, disabled, onClick }: { icon: IconName; label: string; on?: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      className={`tool${on ? " on" : ""}`}
      title={label}
      aria-label={label}
      aria-pressed={on}
      disabled={disabled}
      // Keep the text selection: a normal click would move focus out of the editor first
      onMouseDown={e => e.preventDefault()}
      onClick={onClick}
    >
      <Icon name={icon} />
    </button>
  );
}

export function Toolbar({ editor, autocaps, onAutocaps }: { editor: Editor; autocaps: boolean; onAutocaps: () => void }) {
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      underline: e.isActive("underline"),
      strike: e.isActive("strike"),
      quote: e.isActive("blockquote"),
      style: (e.isActive("blockquote") ? "quote" : e.isActive("heading", { level: 2 }) ? "h2" : e.isActive("heading", { level: 3 }) ? "h3" : "p") as Style,
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  });

  function setStyle(style: Style) {
    let chain = editor.chain().focus();
    if (s.quote && style !== "quote") chain = chain.lift("blockquote");
    if (style === "quote") chain = chain.setParagraph().wrapIn("blockquote");
    else if (style === "p") chain = chain.setParagraph();
    else chain = chain.setHeading({ level: style === "h2" ? 2 : 3 });
    chain.run();
  }

  const run = (fn: (c: ReturnType<Editor["chain"]>) => ReturnType<Editor["chain"]>) => () => fn(editor.chain().focus()).run();

  return (
    <div className="writer-tools" role="toolbar" aria-label="Formatting">
      <Tool icon="undo" label="Undo (Ctrl+Z)" disabled={!s.canUndo} onClick={run(c => c.undo())} />
      <Tool icon="redo" label="Redo (Ctrl+Shift+Z)" disabled={!s.canRedo} onClick={run(c => c.redo())} />
      <span className="sep" />
      <select aria-label="Paragraph style" value={s.style} onChange={e => setStyle(e.target.value as Style)}>
        <option value="p">Normal text</option>
        <option value="h2">Heading</option>
        <option value="h3">Subheading</option>
        <option value="quote">Quote box</option>
      </select>
      <span className="sep" />
      <Tool icon="bold" label="Bold (Ctrl+B)" on={s.bold} onClick={run(c => c.toggleBold())} />
      <Tool icon="italic" label="Italic (Ctrl+I)" on={s.italic} onClick={run(c => c.toggleItalic())} />
      <Tool icon="underline" label="Underline (Ctrl+U)" on={s.underline} onClick={run(c => c.toggleUnderline())} />
      <Tool icon="strike" label="Strikethrough (Ctrl+Shift+S)" on={s.strike} onClick={run(c => c.toggleStrike())} />
      <span className="sep" />
      <Tool icon="quote" label="Quote box (Ctrl+Shift+B)" on={s.quote} onClick={run(c => c.toggleBlockquote())} />
      <Tool icon="dash" label="Em dash (or type --)" onClick={run(c => c.insertContent("—"))} />
      <Tool icon="scene" label="Scene break" onClick={run(c => c.setHorizontalRule())} />
      <Tool icon="clear" label="Clear formatting" onClick={run(c => c.unsetAllMarks().clearNodes())} />
      <span className="sep" />
      <button
        type="button"
        className={`tool caps${autocaps ? " on" : ""}`}
        title="Auto-capitalize sentences"
        aria-pressed={autocaps}
        onMouseDown={e => e.preventDefault()}
        onClick={onAutocaps}
      >
        Aa <span className="tool-label">AUTOCAPS {autocaps ? "ON" : "OFF"}</span>
      </button>
    </div>
  );
}
