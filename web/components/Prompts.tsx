"use client";

import Link from "next/link";
import { useState } from "react";
import { api } from "@/lib/client-api";
import { excerpt, formatDate } from "@/lib/format";
import type { Prompt, User } from "@/lib/types";

/** "OPEN UNTIL 3 NOV 2026", "OPENS 10 NOV 2026", "CLOSED 1 OCT 2026" */
export function promptWhen(p: Prompt): string {
  if (p.status === "open") return `OPEN UNTIL ${formatDate(p.ends_on)}`;
  if (p.status === "upcoming") return `OPENS ${formatDate(p.starts_on)}`;
  return `CLOSED ${formatDate(p.ends_on)}`;
}

/** A prompt as a card: its theme, dates, entries, and a way in for members. */
export function PromptCard({ prompt: p, user, full = false }: { prompt: Prompt; user: User | null; full?: boolean }) {
  return (
    <article className={`prompt-card ${p.status}`}>
      <div className="caps muted">
        <span className={`prompt-status ${p.status}`}>{promptWhen(p)}</span> · {p.entries} {p.entries === 1 ? "ENTRY" : "ENTRIES"}
      </div>
      <h2>{full ? p.title : <Link href={`/prompts/${p.id}`}>{p.title}</Link>}</h2>
      {p.body && <p className="prompt-body">{full ? p.body : excerpt(p.body, 260)}</p>}
      <div className="actions" style={{ marginTop: ".8rem" }}>
        {p.status === "open" && user?.member && <Link href={`/stories/new?prompt=${p.id}`} className="btn">WRITE FOR THIS</Link>}
        {!full && <Link href={`/prompts/${p.id}`} className="btn ghost">{p.entries ? "READ THE ENTRIES" : "SEE IT"}</Link>}
      </div>
    </article>
  );
}

/** Prompts on the keepers' desk: set a new one, take one down. */
export function PromptManager({ initial }: { initial: Prompt[] }) {
  const [prompts, setPrompts] = useState(initial);
  const [form, setForm] = useState({ title: "", body: "", starts_on: "", ends_on: "" });
  const [error, setError] = useState("");

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await api("/api/prompts", { method: "POST", body: form });
      setPrompts(await api<Prompt[]>("/api/prompts"));
      setForm({ title: "", body: "", starts_on: "", ends_on: "" });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function remove(p: Prompt) {
    if (!window.confirm(`Take down "${p.title}"? Its stories stay, but stop being entries.`)) return;
    try {
      setPrompts(await api<Prompt[]>(`/api/prompts/${p.id}`, { method: "DELETE" }));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm(f => ({ ...f, [k]: e.target.value }));

  return (
    <>
      {error && <p className="msg error" role="alert">✕ {error}</p>}
      <ul className="plain-list" style={{ marginBottom: "1.2rem" }}>
        {prompts.map(p => (
          <li key={p.id} style={{ display: "flex", gap: "1rem", alignItems: "baseline" }}>
            <span style={{ flex: 1 }}>
              <Link href={`/prompts/${p.id}`}><b style={{ fontWeight: 600 }}>{p.title}</b></Link>{" "}
              <span className="muted">· {promptWhen(p).toLowerCase()} · {p.entries} {p.entries === 1 ? "entry" : "entries"}</span>
            </span>
            <button type="button" className="link-btn" onClick={() => remove(p)}>remove</button>
          </li>
        ))}
      </ul>
      <form onSubmit={add} className="profile-form">
        <div className="field"><label htmlFor="p-title">New prompt</label><input id="p-title" value={form.title} onChange={set("title")} minLength={3} maxLength={120} required placeholder="The Last Streetlight" /></div>
        <div className="field"><label htmlFor="p-body">What to write about</label><textarea id="p-body" value={form.body} onChange={set("body")} maxLength={2000} rows={3} placeholder="Every light on your street has gone out but one…" /></div>
        <div className="field-row">
          <div className="field"><label htmlFor="p-start">Opens</label><input id="p-start" type="date" value={form.starts_on} onChange={set("starts_on")} required /></div>
          <div className="field"><label htmlFor="p-end">Last day for entries</label><input id="p-end" type="date" value={form.ends_on} min={form.starts_on || undefined} onChange={set("ends_on")} required /></div>
        </div>
        <div className="actions"><button type="submit">SET THE PROMPT</button></div>
      </form>
    </>
  );
}
