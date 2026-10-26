"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { api } from "@/lib/client-api";
import { formatDate } from "@/lib/format";
import { ROLE_LABEL, ROLE_LEVEL, type Comment, type User } from "@/lib/types";
import { Icon } from "./Icon";
import { Markup } from "./Markup";
import { MembersOnly } from "./MembersOnly";
import { ReportButton } from "./Reports";
import { Sigil } from "./Sigil";

type Sort = "top" | "new";
// Where a reply goes (always a top-level comment's thread) and who it's answering
type ReplyTo = { root: number; to: Comment };

export function Comments({ storyId, initial, user }: { storyId: number; initial: Comment[]; user: User | null }) {
  const [comments, setComments] = useState(initial);
  const [sort, setSort] = useState<Sort>("top");
  const [body, setBody] = useState("");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState("");
  const [replyTo, setReplyTo] = useState<ReplyTo | null>(null);
  const [reply, setReply] = useState("");

  function fail(e: unknown) {
    setError(e instanceof Error ? e.message : String(e));
  }

  async function changeSort(next: Sort) {
    setSort(next);
    try {
      setComments(await api<Comment[]>(`/api/stories/${storyId}/comments?sort=${next}`));
    } catch (e) {
      fail(e);
    }
  }

  async function post(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setPosting(true);
    try {
      const c = await api<Comment>(`/api/stories/${storyId}/comments`, { method: "POST", body: { body } });
      setComments(cs => [c, ...cs]);
      setBody("");
    } catch (e) {
      fail(e);
    }
    setPosting(false);
  }

  function startReply(root: number, to: Comment) {
    setReplyTo({ root, to });
    // Answering someone inside a thread: name them, so they're told
    setReply(to.id !== root && to.author_id !== user?.id ? `@${to.author} ` : "");
  }

  async function postReply(e: React.FormEvent) {
    e.preventDefault();
    if (!replyTo) return;
    setError("");
    setPosting(true);
    try {
      const c = await api<Comment>(`/api/stories/${storyId}/comments`, { method: "POST", body: { body: reply, parent_id: replyTo.to.id } });
      setComments(cs => [...cs, c]);
      setReplyTo(null);
      setReply("");
    } catch (e) {
      fail(e);
    }
    setPosting(false);
  }

  async function vote(c: Comment, value: 1 | -1) {
    try {
      const updated = await api<Comment>(`/api/comments/${c.id}/vote`, { method: "PUT", body: { value: c.my_vote === value ? 0 : value } });
      setComments(cs => cs.map(x => (x.id === c.id ? updated : x)));
    } catch (e) {
      fail(e);
    }
  }

  async function remove(c: Comment) {
    if (!window.confirm(c.parent_id ? "Delete this reply?" : "Delete this comment and its replies?")) return;
    try {
      await api(`/api/comments/${c.id}`, { method: "DELETE" });
      setComments(cs => cs.filter(x => x.id !== c.id && x.parent_id !== c.id));
    } catch (e) {
      fail(e);
    }
  }

  // Top-level comments in the chosen order; replies under them, oldest first
  const roots = comments.filter(c => !c.parent_id);
  const replies = new Map<number, Comment[]>();
  for (const c of [...comments].sort((a, b) => a.id - b.id)) {
    if (c.parent_id) replies.set(c.parent_id, [...(replies.get(c.parent_id) ?? []), c]);
  }

  // A plain function, not a component: a component defined here would remount on every keystroke
  function item(c: Comment, root: number) {
    return (
      <motion.li key={c.id} id={`c${c.id}`} className={`comment${c.parent_id ? " reply" : ""}`} layout initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }}>
        <div className="comment-head">
          <Sigil name={c.author} size={22} />
          <b>{c.author}</b>
          {ROLE_LEVEL[c.author_role] > 0 && <span className={`role ${c.author_role}`}>{ROLE_LABEL[c.author_role].toUpperCase()}</span>}
          <a href={`#c${c.id}`} className="muted">{formatDate(c.created_at)}</a>
        </div>
        <div className="comment-body"><Markup text={c.body} mentions /></div>
        <div className="comment-actions">
          <button type="button" className={`vote${c.my_vote === 1 ? " on" : ""}`} onClick={() => vote(c, 1)} disabled={!user?.member} aria-pressed={c.my_vote === 1} aria-label="Like">
            <Icon name="up" size={15} /> {c.likes}
          </button>
          <button type="button" className={`vote down${c.my_vote === -1 ? " on" : ""}`} onClick={() => vote(c, -1)} disabled={!user?.member} aria-pressed={c.my_vote === -1} aria-label="Dislike">
            <Icon name="down" size={15} /> {c.dislikes}
          </button>
          {user?.member && <button type="button" className="link-btn" onClick={() => startReply(root, c)}>[reply]</button>}
          {c.can_delete && <button type="button" className="link-btn" onClick={() => remove(c)}>[delete]</button>}
          {user && c.author_id !== user.id && <ReportButton target={{ comment_id: c.id }} user={user} />}
        </div>
      </motion.li>
    );
  }

  return (
    <section className="comments" aria-label="Comments">
      <div className="section-head">
        <h2>Comments <span className="muted">· {comments.length}</span></h2>
        <div className="chips quick" style={{ margin: 0 }}>
          {(["top", "new"] as const).map(s => (
            <button key={s} type="button" className={`chip${sort === s ? " on" : ""}`} onClick={() => changeSort(s)} aria-pressed={sort === s}>
              {s.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {user?.member ? (
        <form className="comment-form" onSubmit={post}>
          <textarea value={body} onChange={e => setBody(e.target.value)} maxLength={5000} rows={3} placeholder="What did you make of it?" aria-label="Your comment" required />
          <div className="comment-form-foot">
            <span className="hint">*italic* · **bold** · __underline__ · &gt; quote · @name</span>
            <button type="submit" disabled={posting || !body.trim()}>{posting ? "SENDING…" : "POST"}</button>
          </div>
        </form>
      ) : (
        <MembersOnly user={user} what="join the discussion" next={`/stories/${storyId}`} />
      )}

      {error && <p className="msg error" role="alert">✕ {error}</p>}

      {roots.length === 0 ? (
        <p className="empty">NO ONE HAS SAID ANYTHING. YET.</p>
      ) : (
        <ul className="comment-list">
          <AnimatePresence initial={false}>
            {roots.map(c => (
              <li key={c.id} className="thread">
                <ul className="comment-list nested">
                  <AnimatePresence initial={false}>
                    {item(c, c.id)}
                    {(replies.get(c.id) ?? []).map(r => item(r, c.id))}
                  </AnimatePresence>
                </ul>
                {replyTo?.root === c.id && (
                  <form className="comment-form reply-form" onSubmit={postReply}>
                    <textarea value={reply} onChange={e => setReply(e.target.value)} maxLength={5000} rows={2} autoFocus
                      placeholder={`Reply to ${replyTo.to.author}…`} aria-label={`Reply to ${replyTo.to.author}`} required />
                    <div className="comment-form-foot">
                      <button type="button" className="ghost" onClick={() => setReplyTo(null)}>CANCEL</button>
                      <button type="submit" disabled={posting || !reply.trim()}>{posting ? "SENDING…" : "REPLY"}</button>
                    </div>
                  </form>
                )}
              </li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </section>
  );
}
