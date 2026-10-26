"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { api } from "@/lib/client-api";
import { formatDate } from "@/lib/format";
import { ROLE_LABEL, ROLE_LEVEL, type Comment, type User } from "@/lib/types";
import { Icon } from "./Icon";
import { Markup } from "./Markup";
import { MembersOnly } from "./MembersOnly";

type Sort = "top" | "new";

export function Comments({ storyId, initial, user }: { storyId: number; initial: Comment[]; user: User | null }) {
  const [comments, setComments] = useState(initial);
  const [sort, setSort] = useState<Sort>("top");
  const [body, setBody] = useState("");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState("");

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

  async function vote(c: Comment, value: 1 | -1) {
    try {
      const updated = await api<Comment>(`/api/comments/${c.id}/vote`, { method: "PUT", body: { value: c.my_vote === value ? 0 : value } });
      setComments(cs => cs.map(x => (x.id === c.id ? updated : x)));
    } catch (e) {
      fail(e);
    }
  }

  async function remove(c: Comment) {
    if (!window.confirm("Delete this comment?")) return;
    try {
      await api(`/api/comments/${c.id}`, { method: "DELETE" });
      setComments(cs => cs.filter(x => x.id !== c.id));
    } catch (e) {
      fail(e);
    }
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
            <span className="hint">*italic* · **bold** · __underline__ · &gt; quote</span>
            <button type="submit" disabled={posting || !body.trim()}>{posting ? "SENDING…" : "POST"}</button>
          </div>
        </form>
      ) : (
        <MembersOnly user={user} what="join the discussion" next={`/stories/${storyId}`} />
      )}

      {error && <p className="msg error" role="alert">✕ {error}</p>}

      {comments.length === 0 ? (
        <p className="empty">NO ONE HAS SAID ANYTHING. YET.</p>
      ) : (
        <ul className="comment-list">
          <AnimatePresence initial={false}>
            {comments.map(c => (
              <motion.li key={c.id} className="comment" layout initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }}>
                <div className="comment-head">
                  <b>{c.author}</b>
                  {ROLE_LEVEL[c.author_role] > 0 && <span className={`role ${c.author_role}`}>{ROLE_LABEL[c.author_role].toUpperCase()}</span>}
                  <span className="muted">{formatDate(c.created_at)}</span>
                </div>
                <div className="comment-body"><Markup text={c.body} /></div>
                <div className="comment-actions">
                  <button type="button" className={`vote${c.my_vote === 1 ? " on" : ""}`} onClick={() => vote(c, 1)} disabled={!user?.member} aria-pressed={c.my_vote === 1} aria-label="Like">
                    <Icon name="up" size={15} /> {c.likes}
                  </button>
                  <button type="button" className={`vote down${c.my_vote === -1 ? " on" : ""}`} onClick={() => vote(c, -1)} disabled={!user?.member} aria-pressed={c.my_vote === -1} aria-label="Dislike">
                    <Icon name="down" size={15} /> {c.dislikes}
                  </button>
                  {c.can_delete && <button type="button" className="link-btn" onClick={() => remove(c)}>[delete]</button>}
                </div>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </section>
  );
}
