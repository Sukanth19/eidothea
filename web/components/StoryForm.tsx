"use client";

import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client-api";
import { readingMinutes } from "@/lib/format";
import type { Story } from "@/lib/types";

const MAX_CATEGORIES = 5;

export function StoryForm({ story, categories }: { story?: Story; categories: string[] }) {
  const router = useRouter();
  const [title, setTitle] = useState(story?.title ?? "");
  const [body, setBody] = useState(story?.body ?? "");
  const [tags, setTags] = useState((story?.tags ?? []).join(", "));
  const [picked, setPicked] = useState<string[]>(story?.categories ?? []);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const words = body.trim() ? body.trim().split(/\s+/).length : 0;

  function toggleCategory(c: string) {
    setPicked(p => (p.includes(c) ? p.filter(x => x !== c) : p.length < MAX_CATEGORIES ? [...p, c] : p));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    const payload = {
      title,
      body,
      categories: picked,
      tags: tags.split(",").map(t => t.trim()).filter(Boolean),
    };
    try {
      const saved = story
        ? await api<Story>(`/api/stories/${story.id}`, { method: "PATCH", body: payload })
        : await api<Story>("/api/stories", { method: "POST", body: payload });
      router.push(`/stories/${saved.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSaving(false);
    }
  }

  return (
    <form className="editor" onSubmit={submit}>
      <div className="field">
        <label htmlFor="title">Title</label>
        <input id="title" value={title} onChange={e => setTitle(e.target.value)} maxLength={200} required placeholder="What did you see?" />
      </div>

      <div className="field">
        <label htmlFor="body">Story</label>
        <textarea
          id="body"
          className="body"
          value={body}
          onChange={e => setBody(e.target.value)}
          required
          placeholder="Start at the beginning. Leave a blank line between paragraphs."
        />
        <div className="counter">
          <span>{words.toLocaleString("en-US")} WORDS · ~{readingMinutes(body)} MIN READ</span>
          <span style={{ color: body.trim().length < 50 ? "var(--red)" : undefined }}>MIN 50 CHARACTERS</span>
        </div>
      </div>

      <div className="field">
        <label>Categories ({picked.length}/{MAX_CATEGORIES})</label>
        <div className="chips" style={{ marginTop: ".5rem" }}>
          {categories.map(c => (
            <motion.button
              type="button"
              key={c}
              className={`chip${picked.includes(c) ? " on" : ""}`}
              onClick={() => toggleCategory(c)}
              whileTap={{ scale: 0.92 }}
              aria-pressed={picked.includes(c)}
            >
              {c}
            </motion.button>
          ))}
        </div>
      </div>

      <div className="field">
        <label htmlFor="tags">Tags</label>
        <input id="tags" value={tags} onChange={e => setTags(e.target.value)} placeholder="woods, radio, sleep paralysis" />
        <p className="hint">Comma-separated, up to 15.</p>
      </div>

      <AnimatePresence>
        {error && (
          <motion.p className="msg error" role="alert" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: [8, -6, 4, 0] }} exit={{ opacity: 0 }}>
            ✕ {error}
          </motion.p>
        )}
      </AnimatePresence>

      <div className="actions">
        <button type="submit" disabled={saving}>{saving ? "TRANSMITTING…" : story ? "SAVE CHANGES" : "PUBLISH STORY"}</button>
        <button type="button" className="ghost" onClick={() => router.back()}>CANCEL</button>
      </div>
    </form>
  );
}
