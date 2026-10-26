"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/client-api";
import type { User } from "@/lib/types";

type Msg = { ok: boolean; text: string } | null;

const NO_MAIL = "Email isn't set up on this server yet, so nothing was sent. The site's admin needs to add the email settings.";

function errorText(e: unknown) {
  return e instanceof Error ? e.message : String(e);
}

function Message({ msg }: { msg: Msg }) {
  if (!msg) return null;
  return <p className={`msg ${msg.ok ? "ok" : "error"}`} role={msg.ok ? "status" : "alert"}>{msg.ok ? "" : "✕ "}{msg.text.toUpperCase()}</p>;
}

/** Sends the confirmation link again (for whatever address is waiting to be confirmed). */
export function ResendButton({ label = "SEND THE LINK AGAIN" }: { label?: string }) {
  const [msg, setMsg] = useState<Msg>(null);
  const [busy, setBusy] = useState(false);
  async function resend() {
    setBusy(true);
    try {
      const r = await api<{ email: string; mail_ready: boolean }>("/api/auth/resend", { method: "POST" });
      setMsg(r.mail_ready ? { ok: true, text: `Sent to ${r.email}` } : { ok: false, text: NO_MAIL });
    } catch (e) {
      setMsg({ ok: false, text: errorText(e) });
    }
    setBusy(false);
  }
  return (
    <>
      <button type="button" className="ghost" onClick={resend} disabled={busy}>{busy ? "SENDING…" : label}</button>
      <Message msg={msg} />
    </>
  );
}

/** /verify: with ?token= it confirms the address; without, it says where to look. */
export function VerifyEmail({ user }: { user: User | null }) {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token");
  const [state, setState] = useState<{ done: boolean; became?: string | null; error?: string }>({ done: false });
  const sent = useRef(false);

  useEffect(() => {
    // Strict mode runs effects twice; the link only works once
    if (!token || sent.current) return;
    sent.current = true;
    api<{ became_member: string | null }>("/api/auth/verify", { method: "POST", body: { token } })
      .then(r => {
        setState({ done: true, became: r.became_member });
        router.refresh();
      })
      .catch(e => setState({ done: true, error: errorText(e) }));
  }, [token, router]);

  if (token) {
    if (!state.done) return <p className="empty">CHECKING THE LINK…</p>;
    if (state.error) {
      return (
        <>
          <p className="msg error">✕ {state.error.toUpperCase()}</p>
          {user && !user.email_verified && <div className="actions"><ResendButton /></div>}
        </>
      );
    }
    return (
      <>
        <p className="msg ok">YOUR EMAIL IS CONFIRMED.</p>
        {state.became === "founding" && <p>You&apos;re one of the archive&apos;s founding members. You can write, comment and rate.</p>}
        {state.became === "invite" && <p>Your invite worked: you&apos;re a member. You can write, comment and rate.</p>}
        {!state.became && !user?.member && (
          <p>You can read everything and follow writers. To write, comment and rate, <Link href="/membership">become a member</Link>.</p>
        )}
        <div className="actions">
          <Link href={user?.member ? "/stories/new" : "/stories"} className="btn">{user?.member ? "WRITE SOMETHING" : "TO THE ARCHIVE"}</Link>
        </div>
      </>
    );
  }

  if (!user) return <p>Open the link from your email to confirm your address, or <Link href="/login?next=/verify">log in</Link>.</p>;
  if (user.email_verified) return <p className="msg ok">YOUR EMAIL IS ALREADY CONFIRMED.</p>;
  return (
    <>
      {user.mail_ready === false && <p className="msg error">✕ {NO_MAIL.toUpperCase()}</p>}
      <p>We sent a link to <b>{user.email ?? "your email"}</b>. Open it to confirm the address, then come back.</p>
      <p className="hint">Nothing there? Check spam, or send it again.</p>
      <div className="actions"><ResendButton /></div>
    </>
  );
}

export function ForgotForm() {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState<Msg>(null);
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api("/api/auth/forgot", { method: "POST", body: { email } });
      setMsg({ ok: true, text: "If that address has a confirmed account, a reset link is on its way." });
    } catch (err) {
      setMsg({ ok: false, text: errorText(err) });
    }
    setBusy(false);
  }
  return (
    <form className="ledger" onSubmit={submit}>
      <div className="field">
        <label htmlFor="e">Your account&apos;s email</label>
        <input id="e" type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" required autoFocus />
      </div>
      <Message msg={msg} />
      <div className="actions">
        <button type="submit" disabled={busy}>{busy ? "SENDING…" : "SEND A RESET LINK"}</button>
        <Link href="/login" className="muted">back to log in</Link>
      </div>
    </form>
  );
}

export function ResetForm() {
  const params = useSearchParams();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<Msg>(null);
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api("/api/auth/reset", { method: "POST", body: { token: params.get("token") ?? "", password } });
      router.push("/stories");
      router.refresh();
    } catch (err) {
      setMsg({ ok: false, text: errorText(err) });
      setBusy(false);
    }
  }
  return (
    <form className="ledger" onSubmit={submit}>
      <div className="field">
        <label htmlFor="p">New password</label>
        <input id="p" type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" minLength={8} required autoFocus />
        <p className="hint">At least 8 characters. This logs you out everywhere else.</p>
      </div>
      <Message msg={msg} />
      <div className="actions">
        <button type="submit" disabled={busy}>{busy ? "SAVING…" : "SET PASSWORD"}</button>
        <Link href="/forgot" className="muted">need a new link?</Link>
      </div>
    </form>
  );
}

/** Adding or changing the account's address, on the profile page. */
export function EmailSettings({ user }: { user: User }) {
  const [email, setEmail] = useState(user.email ?? "");
  const [msg, setMsg] = useState<Msg>(null);
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await api<{ email: string; mail_ready: boolean }>("/api/me/email", { method: "PUT", body: { email } });
      setMsg(r.mail_ready ? { ok: true, text: `Link sent to ${r.email}. The change happens once you open it.` } : { ok: false, text: NO_MAIL });
    } catch (err) {
      setMsg({ ok: false, text: errorText(err) });
    }
    setBusy(false);
  }
  return (
    <form className="ledger profile-form" onSubmit={submit} style={{ marginBottom: "1.5rem" }}>
      <div className="field">
        <label htmlFor="acct-email">Account email</label>
        <input id="acct-email" type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" required />
        <p className="hint">
          {!user.email ? "Add one so you can reset your password and get membership news." : user.email_verified ? "Confirmed. Never shown to anyone." : "Not confirmed yet."}
        </p>
      </div>
      <Message msg={msg} />
      <div className="actions">
        <button type="submit" disabled={busy || (email === user.email && user.email_verified)}>{busy ? "SENDING…" : user.email ? "CHANGE EMAIL" : "ADD EMAIL"}</button>
        {user.email && !user.email_verified && <ResendButton />}
      </div>
    </form>
  );
}
