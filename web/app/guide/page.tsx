import type { Metadata } from "next";
import Link from "next/link";
import { LivePreview } from "@/components/LivePreview";
import { COMMANDS, type CommandDef } from "@/lib/commands";
import { currentUser } from "@/lib/server-api";

export const metadata: Metadata = {
  title: "Writer's guide",
  description: "Formatting, and the commands that let a story know who's reading it.",
};

const FORMATTING: [string, string][] = [
  ["*italic*", "italic"],
  ["**bold**", "bold"],
  ["__underline__", "underline"],
  ["~~strike~~", "struck through"],
  ["## Heading", "a heading on its own line"],
  ["### Subheading", "a smaller one"],
  ["> a quote", "a boxed quote; lines in a row share the box"],
  ["* * *", "a scene break, on a line of its own"],
  ["--", "an em dash (—), as you type"],
  ["\\*", "a plain star that isn't formatting"],
];

function Command({ c, reader }: { c: CommandDef; reader?: string }) {
  return (
    <div className="guide-cmd" id={c.name}>
      <code className="guide-snippet">{c.snippet.replace(/[‹›]/g, "")}</code>
      <p>{c.summary}</p>
      <div className="guide-example">
        <span className="caps muted">YOU WRITE</span>
        <code>{c.example}</code>
        <span className="caps muted">{c.group === "knows" ? "YOU'D SEE, RIGHT NOW" : "THE READER SEES"}</span>
        <div className="guide-live">
          {c.group === "knows" ? <LivePreview text={c.example} reader={reader} /> : <p>{c.seen}</p>}
        </div>
      </div>
    </div>
  );
}

export default async function GuidePage() {
  const user = await currentUser();
  const reader = user?.username;

  return (
    <article className="doc prose guide">
      <h1 className="flicker">The writer&apos;s guide</h1>
      <p className="muted">
        Everything you can do with a story&apos;s text. In the editor, type <kbd>`</kbd> (or press <b>{"{ }"} COMMANDS</b> on the
        toolbar) and pick from the list; you don&apos;t need to remember any of this.
      </p>
      <nav className="chips quick" aria-label="On this page">
        <a href="#formatting" className="chip">FORMATTING</a>
        <a href="#knows" className="chip">THE STORY KNOWS</a>
        <a href="#changes" className="chip">TEXT THAT CHANGES</a>
        <a href="#rules" className="chip">GOOD TO KNOW</a>
      </nav>

      <h2 id="formatting">Formatting</h2>
      <p>The toolbar does all of this, and the shortcuts work when you type or paste them.</p>
      <dl className="facts guide-formatting">
        {FORMATTING.map(([code, what]) => (
          <div key={code}><dt><code>{code}</code></dt><dd>{what}</dd></div>
        ))}
      </dl>

      <h2 id="knows">The story knows who&apos;s reading</h2>
      <p>
        These fill in for each reader as they read: their name, their clock, their city. Nothing is sent anywhere to do it;
        the reader&apos;s own browser fills it in.
        {reader ? " The examples below are filled in for you." : " Log in and the examples below fill in for you."}
      </p>
      {COMMANDS.filter(c => c.group === "knows").map(c => <Command key={c.name} c={c} reader={reader} />)}

      <h2 id="changes">Text that changes</h2>
      <p>For the line that wasn&apos;t there before, or the word that&apos;s different when they look back.</p>
      {COMMANDS.filter(c => c.group === "changes").map(c => <Command key={c.name} c={c} reader={reader} />)}

      <h2 id="rules">Good to know</h2>
      <ul>
        <li>
          <b>Format the whole command, not inside it.</b> <code>*{"{{reader}}"}*</code> makes the name italic;
          <code>{" {{glitch:*come*}}"}</code> won&apos;t work.
        </li>
        <li><b>Select text first</b>, then pick a command like {"{{glitch}}"} or {"{{vanish}}"}, and the selected text goes inside it.</li>
        <li>In the editor every command is <span className="cmd-mark">highlighted</span>. One marked <span className="cmd-mark unknown">like this</span> is misspelt, and readers will see it as plain text.</li>
        <li><b>Preview</b> in the editor plays them out the way a reader would see them, with your name.</li>
        <li>
          Excerpts, link previews and share cards can&apos;t know who&apos;ll read them, so they use a stand-in:{" "}
          {"{{reader}}"} becomes “stranger”, {"{{time}}"} “late”, and {"{{reread}}"} and {"{{night}}"} lines are left out.
        </li>
        <li>Readers who turn the site&apos;s effects off, or ask their device for less motion, still get every word; {"{{glitch}}"} just stays still for them.</li>
        <li>Commands work in community stories. The classic archive is left exactly as it was found.</li>
      </ul>

      <p className="actions">
        {user?.member ? <Link href="/stories/new" className="btn">START WRITING</Link> : <Link href="/membership" className="btn">BECOME A MEMBER TO WRITE</Link>}
      </p>
    </article>
  );
}
