"use client";

import Link from "next/link";
import { useState } from "react";
import { api } from "@/lib/client-api";
import { formatDate, excerpt } from "@/lib/format";
import { REPORT_REASON, type OpenReport, type ReportReason, type User } from "@/lib/types";

type Target = { story_id: number } | { comment_id: number };

/** "[report]": a reason and an optional note, sent to the keepers. */
export function ReportButton({ target, user, label = "[report]" }: { target: Target; user: User | null; label?: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason>("spam");
  const [note, setNote] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState("");

  if (!user) return null;
  if (state === "sent") return <span className="hint report-done">Reported. The keepers will look.</span>;
  if (!open) return <button type="button" className="link-btn" onClick={() => setOpen(true)}>{label}</button>;

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    setError("");
    try {
      await api("/api/reports", { method: "POST", body: { ...target, reason, note } });
      setState("sent");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setState("idle");
    }
  }

  return (
    <form className="report-form" onSubmit={send}>
      <select value={reason} onChange={e => setReason(e.target.value as ReportReason)} aria-label="What's wrong">
        {(Object.keys(REPORT_REASON) as ReportReason[]).map(r => <option key={r} value={r}>{REPORT_REASON[r]}</option>)}
      </select>
      <input value={note} onChange={e => setNote(e.target.value)} maxLength={500} placeholder="Anything the keepers should know (optional)" aria-label="Note" />
      <span className="report-actions">
        <button type="submit" className="danger" disabled={state === "sending"}>REPORT</button>
        <button type="button" className="ghost" onClick={() => setOpen(false)}>CANCEL</button>
      </span>
      {error && <span className="msg error">{error}</span>}
    </form>
  );
}

/** Open reports on the keepers' desk: dismiss them, or take the thing down. */
export function ReportQueue({ initial }: { initial: OpenReport[] }) {
  const [items, setItems] = useState(initial);
  const [armed, setArmed] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function resolve(r: OpenReport, action: "dismiss" | "remove") {
    setError("");
    try {
      const target = r.story_id ? { story_id: r.story_id } : { comment_id: r.comment_id };
      setItems(await api<OpenReport[]>("/api/reports/resolve", { method: "POST", body: { ...target, action } }));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
    setArmed(null);
  }

  if (!items.length) return <p className="empty">NOTHING REPORTED. THE ARCHIVE IS QUIET.</p>;
  return (
    <>
      {error && <p className="msg error" role="alert">✕ {error}</p>}
      <ul className="plain-list">
        {items.map(r => {
          const key = `${r.kind}-${r.story_id ?? r.comment_id}`;
          const count = Object.values(r.reasons).reduce((a, b) => a + b, 0);
          const href = r.kind === "story" ? `/stories/${r.link_story}` : `/stories/${r.link_story}#c${r.comment_id}`;
          return (
            <li key={key} className="report-item">
              <div className="caps muted">
                {r.kind === "story" ? "STORY" : "COMMENT"} BY {r.author ?? "UNKNOWN"} · {count} {count === 1 ? "REPORT" : "REPORTS"} · FIRST {formatDate(r.first_at)}
              </div>
              <p style={{ margin: ".3rem 0" }}>
                {r.kind === "story" ? (
                  <Link href={href}><b>{r.story_title || "Untitled"}</b></Link>
                ) : (
                  <>“{excerpt(r.comment_body ?? "", 240)}” <Link href={href} className="muted">on {r.story_title}</Link></>
                )}
              </p>
              <div className="chips" style={{ marginBottom: ".4rem" }}>
                {Object.entries(r.reasons).map(([reason, n]) => (
                  <span key={reason} className="chip">{REPORT_REASON[reason as ReportReason] ?? reason}{n > 1 ? ` ×${n}` : ""}</span>
                ))}
              </div>
              {r.notes.map((n, i) => <p key={i} className="hint" style={{ margin: "0 0 .3rem" }}>{n.by}: {n.note}</p>)}
              <span className="report-actions">
                <button type="button" className="ghost" onClick={() => resolve(r, "dismiss")}>DISMISS</button>
                {armed === key ? (
                  <>
                    <button type="button" className="danger" onClick={() => resolve(r, "remove")}>YES, TAKE IT DOWN</button>
                    <button type="button" className="ghost" onClick={() => setArmed(null)}>KEEP</button>
                  </>
                ) : (
                  <button type="button" className="danger" onClick={() => setArmed(key)}>TAKE IT DOWN</button>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </>
  );
}
