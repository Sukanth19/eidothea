"use client";

import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client-api";
import { landing } from "@/lib/landing";

const HEARD_FROM = ["Instagram story", "Instagram post or DM", "A friend", "WhatsApp", "Reddit", "Google or another search", "YouTube or TikTok", "Discord"];

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const params = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [heard, setHeard] = useState("");
  const [heardOther, setHeardOther] = useState("");

  // Only follow local redirects
  const next = params.get("next")?.startsWith("/") && !params.get("next")?.startsWith("//") ? params.get("next")! : "/stories";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const source = heard === "other" ? heardOther.trim() || "other" : heard || undefined;
      await api(`/api/auth/${mode}`, {
        method: "POST",
        body: mode === "register" ? { username, password, source, landing: landing() } : { username, password },
      });
      router.push(next);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setPassword("");
      setBusy(false);
    }
  }

  const isLogin = mode === "login";

  return (
    <div className="terminal">
      <div className="boot">
        EIDOTHEA · TERMINAL 7<br />
        LINK ESTABLISHED .......... OK<br />
        {isLogin ? "IDENTIFY YOURSELF." : "NEW OPERATOR ENROLMENT."}
      </div>
      <form onSubmit={submit}>
        <div className="field">
          <label htmlFor="u">Username</label>
          <input id="u" value={username} onChange={e => setUsername(e.target.value)} autoComplete="username" autoCapitalize="off" spellCheck={false} required autoFocus />
          {!isLogin && <p className="hint">3–24 characters: letters, numbers, _ or -</p>}
        </div>
        <div className="field">
          <label htmlFor="p">Password</label>
          <input id="p" type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete={isLogin ? "current-password" : "new-password"} required />
          {!isLogin && <p className="hint">At least 8 characters.</p>}
        </div>
        {!isLogin && (
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
        )}
        <AnimatePresence>
          {error && (
            <motion.p className="msg error" role="alert" initial={{ opacity: 0 }} animate={{ opacity: 1, x: [10, -8, 5, 0] }} exit={{ opacity: 0 }}>
              ✕ {error.toUpperCase()}
            </motion.p>
          )}
        </AnimatePresence>
        <div className="actions">
          <button type="submit" disabled={busy}>{busy ? "CONNECTING…" : isLogin ? "AUTHENTICATE" : "ENROL"}</button>
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
