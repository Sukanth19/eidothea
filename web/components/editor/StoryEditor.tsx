"use client";

import { Slice } from "@tiptap/pm/model";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Placeholder } from "@tiptap/extensions";
import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { api } from "@/lib/client-api";
import { readingMinutes } from "@/lib/format";
import type { Story, User } from "@/lib/types";
import { DeleteStoryButton } from "../DeleteStoryButton";
import { Icon } from "../Icon";
import { Markup } from "../Markup";
import { fromDoc, toDoc, Typing } from "./extensions";
import { Toolbar } from "./Toolbar";

const MAX_CATEGORIES = 5;
const MIN_BODY = 50;
const AUTOSAVE_MS = 1500;
const AUTOCAPS_KEY = "eidothea.autocaps";

type SaveState = "new" | "dirty" | "saving" | "saved" | "error";
type Status = Story["status"];

/** Grows a textarea to fit its text, so the title and subtitle never scroll. */
function useAutoHeight(value: string) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  return ref;
}

/**
 * The writing screen. Drafts save themselves a moment after you stop typing;
 * published stories only change when you press Update, so readers never see half an edit.
 */
export function StoryEditor({ story, categories, user }: { story?: Story; categories: string[]; user: User }) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>(story?.status ?? "draft");
  const [title, setTitle] = useState(story?.title ?? "");
  const [subtitle, setSubtitle] = useState(story?.subtitle ?? "");
  const [tags, setTags] = useState((story?.tags ?? []).join(", "));
  const [picked, setPicked] = useState<string[]>(story?.categories ?? []);
  const [save, setSave] = useState<SaveState>(story ? "saved" : "new");
  const [error, setError] = useState("");
  const [panel, setPanel] = useState<null | "settings" | "publish">(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [autocaps, setAutocaps] = useState(true);
  const [stats, setStats] = useState({ words: 0, chars: 0 });
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Saving runs from timers and editor callbacks, so it reads the latest values from refs
  const latest = useRef({ title, subtitle, tags, picked, status });
  useEffect(() => {
    latest.current = { title, subtitle, tags, picked, status };
  });
  const idRef = useRef<number | null>(story?.id ?? null);
  const version = useRef(0);
  const saved = useRef(0);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const timer = useRef<number | undefined>(undefined);
  const autocapsRef = useRef(true);

  const titleRef = useAutoHeight(title);
  const subtitleRef = useAutoHeight(subtitle);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        code: false,
        codeBlock: false,
        link: false,
        bulletList: false,
        orderedList: false,
        listItem: false,
        listKeymap: false,
        hardBreak: false,
        heading: { levels: [2, 3] },
      }),
      Placeholder.configure({ placeholder: "Start writing…" }),
      Typing.configure({ autocaps: () => autocapsRef.current }),
    ],
    content: toDoc(story?.body ?? ""),
    editorProps: {
      attributes: { class: "story-body writer-body", "aria-label": "Story text" },
      // Pasted plain text may carry *markup* of its own; read it the way the archive does
      clipboardTextParser: (text, _context, _plain, view) =>
        Slice.maxOpen(view.state.schema.nodeFromJSON(toDoc(text)).content),
    },
    onCreate: ({ editor }) => countWords(editor.state.doc.textContent),
    onUpdate: ({ editor }) => {
      countWords(editor.state.doc.textContent);
      changed();
    },
  });

  function countWords(text: string) {
    const trimmed = text.trim();
    setStats({ words: trimmed ? trimmed.split(/\s+/).length : 0, chars: trimmed.length });
  }

  useEffect(() => {
    try {
      const on = localStorage.getItem(AUTOCAPS_KEY) !== "off";
      autocapsRef.current = on;
      setAutocaps(on);
    } catch {}
  }, []);

  function toggleAutocaps() {
    const on = !autocapsRef.current;
    autocapsRef.current = on;
    setAutocaps(on);
    try {
      localStorage.setItem(AUTOCAPS_KEY, on ? "on" : "off");
    } catch {}
  }

  function changed() {
    version.current++;
    setSave("dirty");
    window.clearTimeout(timer.current);
    if (latest.current.status === "draft") timer.current = window.setTimeout(() => void persist(), AUTOSAVE_MS);
  }

  /** Saves everything; with a status, also publishes or unpublishes. Saves never overlap. */
  function persist(extra: { status?: Status } = {}): Promise<Story | null> {
    window.clearTimeout(timer.current);
    const run = async () => {
      if (!editor) return null;
      const v = version.current;
      const f = latest.current;
      const payload = {
        title: f.title,
        subtitle: f.subtitle,
        body: fromDoc(editor.getJSON()),
        tags: f.tags.split(",").map(t => t.trim()).filter(Boolean),
        categories: f.picked,
        ...extra,
      };
      if (!idRef.current && !extra.status && !payload.title && !payload.subtitle && !payload.body) {
        saved.current = v; // nothing worth keeping yet
        setSave("new");
        return null;
      }

      setSave("saving");
      setError("");
      try {
        let result: Story;
        if (idRef.current) {
          result = await api<Story>(`/api/stories/${idRef.current}`, { method: "PATCH", body: payload });
        } else {
          result = await api<Story>("/api/stories", { method: "POST", body: { status: "draft", ...payload } });
          idRef.current = result.id;
          // Same screen, but a reload now reopens this draft instead of a blank page
          window.history.replaceState(null, "", `/stories/${result.id}/edit`);
        }
        saved.current = v;
        latest.current.status = result.status;
        setStatus(result.status);
        setSave(version.current === v ? "saved" : "dirty");
        if (version.current !== v && result.status === "draft") {
          timer.current = window.setTimeout(() => void persist(), AUTOSAVE_MS);
        }
        return result;
      } catch (e) {
        setSave("error");
        setError(e instanceof Error ? e.message : String(e));
        return null;
      }
    };
    const next = queue.current.then(run);
    queue.current = next.catch(() => {});
    return next;
  }

  const unsaved = () => version.current !== saved.current;

  // Warn before leaving with unsaved work; Ctrl/Cmd+S saves
  useEffect(() => {
    function beforeUnload(e: BeforeUnloadEvent) {
      if (unsaved()) e.preventDefault();
    }
    function keydown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void persist();
      }
    }
    window.addEventListener("beforeunload", beforeUnload);
    window.addEventListener("keydown", keydown);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      window.removeEventListener("keydown", keydown);
    };
  });

  useEffect(() => () => window.clearTimeout(timer.current), []);

  async function leave() {
    if (status === "draft") {
      if (unsaved()) await persist();
      if (unsaved()) return; // the save failed; the error is showing
      router.push(idRef.current ? "/me?tab=drafts" : "/me");
    } else {
      if (unsaved() && !window.confirm("Leave without saving your changes?")) return;
      router.push(`/stories/${idRef.current}`);
    }
    router.refresh();
  }

  async function publish() {
    const result = await persist({ status: "published" });
    if (!result) return;
    setPanel(null);
    router.push(`/stories/${result.id}?published=1`);
    router.refresh();
  }

  async function update() {
    const result = await persist();
    if (!result) return;
    router.push(`/stories/${result.id}`);
    router.refresh();
  }

  async function unpublish() {
    if (!window.confirm("Take this story out of the archive and back to your drafts?")) return;
    if (await persist({ status: "draft" })) setPanel(null);
  }

  function edit<T>(set: (v: T) => void) {
    return (v: T) => {
      set(v);
      changed();
    };
  }

  function toggleCategory(c: string) {
    edit(setPicked)(picked.includes(c) ? picked.filter(x => x !== c) : picked.length < MAX_CATEGORIES ? [...picked, c] : picked);
  }

  const pill: Record<SaveState, string> = {
    new: "New draft",
    dirty: status === "draft" ? "Editing…" : "Unsaved changes",
    saving: "Saving…",
    saved: status === "draft" ? "Draft saved" : "Saved",
    error: "Not saved",
  };
  const missing = !title.trim() ? "a title" : stats.chars < MIN_BODY ? `at least ${MIN_BODY} characters` : "";
  const isAuthor = !story || story.author_id === user.id;
  const author = story?.author ?? user.username;

  return (
    <div className="writer">
      <div className="writer-head">
        <div className="writer-top">
          <button type="button" className="tool" onClick={leave} aria-label="Back" title={status === "draft" ? "Save and go to your drafts" : "Back to the story"}>
            <Icon name="back" size={20} />
          </button>
          <span className={`pill ${save}`} role="status"><i />{pill[save]}</span>
          <span className="spacer" />
          <button type="button" className={`ghost${preview !== null ? " on" : ""}`} aria-label={preview !== null ? "Back to editing" : "Preview"} onClick={() => setPreview(p => (p === null && editor ? fromDoc(editor.getJSON()) : null))}>
            <Icon name="eye" size={16} /> <span className="wide-only">{preview !== null ? "EDIT" : "PREVIEW"}</span>
          </button>
          {status === "draft" ? (
            <button type="button" className="danger primary" onClick={() => setPanel("publish")}>CONTINUE</button>
          ) : (
            <button type="button" className="primary" onClick={update} disabled={save === "saving"}>UPDATE</button>
          )}
        </div>
        {editor && preview === null && <Toolbar editor={editor} autocaps={autocaps} onAutocaps={toggleAutocaps} />}
      </div>

      <AnimatePresence>
        {error && (
          <motion.p className="msg error writer-error" role="alert" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            ✕ {error}
          </motion.p>
        )}
      </AnimatePresence>

      <div className="writer-page">
        {preview !== null ? (
          <article className="doc">
            <header className="doc-head">
              <h1>{title || "Untitled"}</h1>
              {subtitle && <p className="subtitle">{subtitle}</p>}
              <div className="meta"><span>BY <b>{author}</b></span><span>{readingMinutes(preview)} MIN READ</span></div>
            </header>
            <div className="story-body"><Markup text={preview} /></div>
          </article>
        ) : (
          <>
            <textarea
              ref={titleRef}
              className="writer-title"
              rows={1}
              value={title}
              maxLength={200}
              placeholder="Title"
              aria-label="Title"
              onChange={e => edit(setTitle)(e.target.value.replace(/\n/g, ""))}
              onKeyDown={e => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  subtitleRef.current?.focus();
                }
              }}
            />
            <textarea
              ref={subtitleRef}
              className="writer-subtitle"
              rows={1}
              value={subtitle}
              maxLength={300}
              placeholder="Add a subtitle…"
              aria-label="Subtitle"
              onChange={e => edit(setSubtitle)(e.target.value.replace(/\n/g, ""))}
              onKeyDown={e => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (!editor) return;
                  // Focus right away (commands.focus waits a frame, and fast typing lands in the subtitle)
                  editor.view.focus();
                  editor.commands.setTextSelection(1);
                }
              }}
            />
            <div className="writer-byline">
              <span className="author-chip">{author}</span>
            </div>
            <EditorContent editor={editor} />
          </>
        )}
      </div>

      {/* Fixed bars go to <body>: the page-in animation's transform would pin them to the page instead */}
      {mounted &&
        createPortal(
          <>
            <div className="writer-bottom">
              <span>{stats.words.toLocaleString("en-US")} WORDS · ~{Math.max(1, Math.round(stats.words / 200))} MIN READ</span>
              <button type="button" className="ghost" onClick={() => setPanel("settings")}>
                <Icon name="sliders" size={16} /> SETTINGS
              </button>
            </div>

            <AnimatePresence>
              {panel && (
                <>
                  <motion.div className="scrim" onClick={() => setPanel(null)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
                  <motion.aside
                    className="drawer"
                    aria-label={panel === "publish" ? "Publish" : "Story settings"}
                    initial={{ x: "100%" }}
                    animate={{ x: 0 }}
                    exit={{ x: "100%" }}
                    transition={{ type: "spring", stiffness: 380, damping: 38 }}
                  >
                    <div className="drawer-head">
                      <h2>{panel === "publish" ? "Ready to publish?" : "Story settings"}</h2>
                      <button type="button" className="tool" onClick={() => setPanel(null)} aria-label="Close"><Icon name="close" /></button>
                    </div>

                    <div className="field">
                      <label>Categories ({picked.length}/{MAX_CATEGORIES})</label>
                      <div className="chips" style={{ marginTop: ".5rem" }}>
                        {categories.map(c => (
                          <button type="button" key={c} className={`chip${picked.includes(c) ? " on" : ""}`} onClick={() => toggleCategory(c)} aria-pressed={picked.includes(c)}>
                            {c}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="field">
                      <label htmlFor="tags">Tags</label>
                      <input id="tags" value={tags} onChange={e => edit(setTags)(e.target.value)} placeholder="woods, radio, sleep paralysis" />
                      <p className="hint">Comma-separated, up to 15.</p>
                    </div>

                    {panel === "publish" ? (
                      <div className="drawer-foot">
                        {missing ? (
                          <p className="hint">Add {missing} before publishing.</p>
                        ) : (
                          <p className="hint">It goes into the archive straight away. You can still edit it, or take it back to drafts.</p>
                        )}
                        <button type="button" className="danger primary" onClick={publish} disabled={!!missing || save === "saving"}>
                          PUBLISH NOW
                        </button>
                      </div>
                    ) : (
                      <div className="drawer-foot">
                        {status === "published" && isAuthor && (
                          <button type="button" className="ghost" onClick={unpublish}>BACK TO DRAFTS</button>
                        )}
                        {idRef.current && <DeleteStoryButton id={idRef.current} redirectTo="/me" />}
                      </div>
                    )}
                  </motion.aside>
                </>
              )}
            </AnimatePresence>
          </>,
          document.body,
        )}
    </div>
  );
}
