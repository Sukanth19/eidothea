"use client";

import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/client-api";
import { landing } from "@/lib/landing";
import { Turnstile, turnstileEnabled } from "./Turnstile";

const HEARD_FROM = ["Instagram story", "Instagram post or DM", "A friend", "WhatsApp", "Reddit", "Google or another search", "YouTube or TikTok", "Discord"];

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const params = useSearchParams();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [website, setWebsite] = useState("");
  const [turnstile, setTurnstile] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [heard, setHeard] = useState("");
  const [heardOther, setHeardOther] = useState("");
  // undefined while checking, null if the invite is no good
  const [inviter, setInviter] = useState<string | null | undefined>(undefined);
  const opened = useRef(0);

  const invite = params.get("invite") ?? "";
  // Only follow local redirects
  const next = params.get("next")?.startsWith("/") && !params.get("next")?.startsWith("//") ? params.get("next")! : "/stories";

  useEffect(() => {
    opened.current = Date.now();
  }, []);

  useEffect(() => {
    if (mode !== "register" || !invite) return;
    api<{ valid: boolean; inviter: string | null }>(`/api/invites/${encodeURIComponent(invite)}`)
      .then(r => setInviter(r.valid ? r.inviter : null))
      .catch(() => setInviter(null));
  }, [mode, invite]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (mode === "register") {
        const source = heard === "other" ? heardOther.trim() || "other" : heard || undefined;
        await api("/api/auth/register", {
          method: "POST",
          body: {
            username, email, password, source, landing: landing(), invite: invite || undefined,
            website, elapsed_ms: Date.now() - opened.current, turnstile: turnstile || undefined,
          },
        });
        router.push("/verify");
      } else {
        await api("/api/auth/login", { method: "POST", body: { username, password } });
        router.push(next);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setPassword("");
      setBusy(false);
    }
  }

  const isLogin = mode === "login";

  return (
    <div className="ledger">
      <div className="preface">
        THE EIDOTHEA ARCHIVE<br />
        A CANDLE IS LIT. THE DOOR IS UNLOCKED.<br />
        {isLogin ? "STATE YOUR NAME." : "WRITE YOUR NAME IN THE REGISTER."}
      </div>
      {!isLogin && inviter && <p className="notice" style={{ marginTop: 0 }}>{inviter.toUpperCase()} HAS INVITED YOU. Confirm your email and you&apos;re in as a member.</p>}
      {!isLogin && invite && inviter === null && <p className="hint" style={{ marginTop: 0 }}>That invite is used up or mistyped. You can still join as a reader and ask to become a member.</p>}
      <form onSubmit={submit}>
        <div className="field">
          <label htmlFor="u">{isLogin ? "Username or email" : "Username"}</label>
          <input id="u" value={username} onChange={e => setUsername(e.target.value)} autoComplete={isLogin ? "username" : "nickname"} autoCapitalize="off" spellCheck={false} required autoFocus />
          {!isLogin && <p className="hint">3–24 characters: letters, numbers, _ or -</p>}
        </div>
        {!isLogin && (
          <div className="field">
            <label htmlFor="e">Email</label>
            <input id="e" type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" autoCapitalize="off" spellCheck={false} required />
            <p className="hint">We send one link to confirm it. Never shown to anyone.</p>
          </div>
        )}
        <div className="field">
          <label htmlFor="p">Password</label>
          <input id="p" type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete={isLogin ? "current-password" : "new-password"} required />
          {isLogin ? <p className="hint"><Link href="/forgot">Forgot it?</Link></p> : <p className="hint">At least 8 characters.</p>}
        </div>
        {!isLogin && (
          <>
            {/* Invisible to people; bots fill in every field they find */}
            <div className="trap" aria-hidden="true">
              <label htmlFor="website">Website</label>
              <input id="website" tabIndex={-1} autoComplete="off" value={website} onChange={e => setWebsite(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="heard">How did you hear about Eidothea? (optional)</label>
              <select id="heard" value={heard} onChange={e => setHeard(e.target.value)}>
                <option value="">Rather not say</option>
                {HEARD_FROM.map(h => <option key={h} value={h.toLowerCase()}>{h}</option>)}
                <option value="other">Somewhere else…</option>
              </select>
              {heard === "other" && (
                <input aria-label="Where did you hear about it?" value={heardOther} onChange={e => setHeardOther(e.target.value)} maxLength={60} placeholder="Where?" style={{ marginTop: ".5rem" }} />
              )}
            </div>
            <Turnstile onToken={setTurnstile} />
          </>
        )}
        <AnimatePresence>
          {error && (
            <motion.p className="msg error" role="alert" initial={{ opacity: 0 }} animate={{ opacity: 1, x: [10, -8, 5, 0] }} exit={{ opacity: 0 }}>
              ✕ {error.toUpperCase()}
            </motion.p>
          )}
        </AnimatePresence>
        <div className="actions">
          <button type="submit" disabled={busy || (!isLogin && turnstileEnabled && !turnstile)}>
            {busy ? "THE DOOR CREAKS…" : isLogin ? "ENTER" : "SIGN THE REGISTER"}
          </button>
          {isLogin ? (
            <Link href={`/register${params.get("next") ? `?next=${encodeURIComponent(next)}` : ""}`} className="muted">no account? join</Link>
          ) : (
            <Link href="/login" className="muted">already enrolled? log in</Link>
          )}
        </div>
      </form>
    </div>
  );
}
