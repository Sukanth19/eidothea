"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client-api";
import { formatDate } from "@/lib/format";
import type { Application, InviteList, QueuedApplication } from "@/lib/types";

type Msg = { ok: boolean; text: string } | null;

function errorText(e: unknown) {
  return e instanceof Error ? e.message : String(e);
}

function Message({ msg }: { msg: Msg }) {
  if (!msg) return null;
  return <p className={`msg ${msg.ok ? "ok" : "error"}`} role={msg.ok ? "status" : "alert"}>{msg.ok ? "" : "✕ "}{msg.text.toUpperCase()}</p>;
}

/** A reader's two ways in: someone's invite code, or a note to the mods. */
export function BecomeMember({ application }: { application: Application | null }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [note, setNote] = useState("");
  const [app, setApp] = useState(application);
  const [msg, setMsg] = useState<Msg>(null);
  const [busy, setBusy] = useState(false);

  async function redeem(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      await api("/api/me/redeem", { method: "POST", body: { code } });
      router.refresh();
    } catch (err) {
      setMsg({ ok: false, text: errorText(err) });
    }
    setBusy(false);
  }

  async function apply(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      setApp(await api<Application>("/api/me/application", { method: "POST", body: { note } }));
    } catch (err) {
      setMsg({ ok: false, text: errorText(err) });
    }
    setBusy(false);
  }

  return (
    <>
      <Message msg={msg} />
      <form className="ledger profile-form" onSubmit={redeem} style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ marginTop: 0 }}>Have an invite?</h2>
        <div className="field">
          <label htmlFor="code">Invite code</label>
          <input id="code" value={code} onChange={e => setCode(e.target.value)} placeholder="ABCD-EFGH" autoCapitalize="characters" spellCheck={false} required />
          <p className="hint">Any member can invite a few people.</p>
        </div>
        <div className="actions"><button type="submit" disabled={busy || !code.trim()}>USE INVITE</button></div>
      </form>

      <div className="ledger profile-form">
        <h2 style={{ marginTop: 0 }}>Or ask the keepers</h2>
        {app?.status === "pending" ? (
          <p>Your request from {formatDate(app.created_at)} is waiting. You&apos;ll get an email when a moderator decides.</p>
        ) : (
          <form onSubmit={apply}>
            {app?.status === "rejected" && <p className="notice" style={{ marginTop: 0 }}>Your last request was turned down on {formatDate(app.decided_at ?? app.created_at)}. You can ask again a week after.</p>}
            <div className="field">
              <label htmlFor="note">Why do you want to write here?</label>
              <textarea id="note" value={note} onChange={e => setNote(e.target.value)} rows={5} minLength={20} maxLength={1000} required
                placeholder="What do you read, what would you post? A link to something you've written helps." />
              <p className="hint">20–1000 characters. Moderators read every one.</p>
            </div>
            <div className="actions"><button type="submit" disabled={busy || note.trim().length < 20}>JOIN THE WAITING LIST</button></div>
          </form>
        )}
      </div>
    </>
  );
}

/** A member's invite links. */
export function Invites({ initial }: { initial: InviteList }) {
  const [list, setList] = useState(initial);
  const [msg, setMsg] = useState<Msg>(null);
  const [copied, setCopied] = useState("");

  async function create() {
    setMsg(null);
    try {
      setList(await api<InviteList>("/api/me/invites", { method: "POST" }));
    } catch (e) {
      setMsg({ ok: false, text: errorText(e) });
    }
  }

  async function copy(code: string) {
    const url = `${window.location.origin}/register?invite=${code}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(code);
    } catch {
      window.prompt("Copy this invite link:", url);
    }
  }

  return (
    <section>
      <div className="section-head">
        <h2>Your invites</h2>
        <span className="caps muted">{list.left === null ? "NO LIMIT" : `${list.left} LEFT`}</span>
      </div>
      <p className="muted" style={{ maxWidth: "65ch" }}>
        Whoever signs up with your link becomes a member once they confirm their email. Invite people you&apos;d vouch for: the archive remembers who let whom in.
      </p>
      <Message msg={msg} />
      {list.invites.length > 0 && (
        <ul className="plain-list" style={{ marginBottom: "1rem" }}>
          {list.invites.map(i => (
            <li key={i.code} style={{ display: "flex", flexWrap: "wrap", gap: ".4rem 1rem", alignItems: "center" }}>
              <b className="caps" style={{ fontWeight: 400, letterSpacing: ".1em" }}>{i.code}</b>
              {i.used_by ? (
                <span className="muted">used by {i.used_by} · {formatDate(i.used_at!)}</span>
              ) : (
                <>
                  <span className="muted">unused</span>
                  <button type="button" className="link-btn" onClick={() => copy(i.code)}>{copied === i.code ? "link copied ✓" : "copy link"}</button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      {list.left !== 0 && <button type="button" onClick={create}>+ NEW INVITE</button>}
    </section>
  );
}

/** The waiting list, for moderators. */
export function Queue({ initial }: { initial: QueuedApplication[] }) {
  const [items, setItems] = useState(initial);
  const [msg, setMsg] = useState<Msg>(null);

  async function decide(a: QueuedApplication, approve: boolean) {
    setMsg(null);
    try {
      setItems(await api<QueuedApplication[]>(`/api/applications/${a.id}/decision`, { method: "POST", body: { approve } }));
      setMsg({ ok: true, text: `${a.username} ${approve ? "is now a member" : "was turned away"}` });
    } catch (e) {
      setMsg({ ok: false, text: errorText(e) });
    }
  }

  return (
    <>
      <Message msg={msg} />
      {items.length === 0 ? (
        <p className="empty">NO ONE IS WAITING.</p>
      ) : (
        <ul className="plain-list">
          {items.map(a => (
            <li key={a.id} style={{ padding: "1rem 0" }}>
              <div className="caps muted">{a.username} · joined {formatDate(a.joined)} · asked {formatDate(a.created_at)}</div>
              <p style={{ margin: ".4rem 0 .7rem", whiteSpace: "pre-wrap" }}>{a.note}</p>
              <span style={{ display: "inline-flex", gap: ".5rem" }}>
                <button type="button" onClick={() => decide(a, true)}>LET THEM IN</button>
                <button type="button" className="danger" onClick={() => decide(a, false)}>TURN AWAY</button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

/** Genres writers can choose, for moderators. */
export function GenreManager({ initial }: { initial: { name: string; blurb: string; count: number }[] }) {
  const [genres, setGenres] = useState(initial);
  const [name, setName] = useState("");
  const [blurb, setBlurb] = useState("");
  const [msg, setMsg] = useState<Msg>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    try {
      setGenres(await api("/api/genres", { method: "POST", body: { name, blurb } }));
      setName("");
      setBlurb("");
    } catch (err) {
      setMsg({ ok: false, text: errorText(err) });
    }
  }

  async function remove(g: string) {
    if (!window.confirm(`Stop offering "${g}" to writers? Stories already in it keep it.`)) return;
    try {
      setGenres(await api(`/api/genres/${encodeURIComponent(g)}`, { method: "DELETE" }));
    } catch (err) {
      setMsg({ ok: false, text: errorText(err) });
    }
  }

  return (
    <>
      <Message msg={msg} />
      <ul className="plain-list" style={{ marginBottom: "1.2rem" }}>
        {genres.map(g => (
          <li key={g.name} style={{ display: "flex", gap: "1rem", alignItems: "baseline" }}>
            <span style={{ flex: 1 }}><b style={{ fontWeight: 600 }}>{g.name}</b> <span className="muted">· {g.count} {g.count === 1 ? "story" : "stories"}{g.blurb && ` · ${g.blurb}`}</span></span>
            <button type="button" className="link-btn" onClick={() => remove(g.name)}>remove</button>
          </li>
        ))}
      </ul>
      <form onSubmit={add} className="field-row" style={{ alignItems: "end" }}>
        <div className="field"><label htmlFor="g-name">New genre</label><input id="g-name" value={name} onChange={e => setName(e.target.value)} minLength={2} maxLength={60} required /></div>
        <div className="field"><label htmlFor="g-blurb">One line about it (optional)</label><input id="g-blurb" value={blurb} onChange={e => setBlurb(e.target.value)} maxLength={200} /></div>
        <div className="field"><button type="submit">ADD GENRE</button></div>
      </form>
    </>
  );
}
