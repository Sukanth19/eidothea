"use client";

import Link from "next/link";
import { useState } from "react";
import { api } from "@/lib/client-api";
import type { Profile } from "@/lib/types";

export function ProfileForm({ initial }: { initial: Profile }) {
  const [p, setP] = useState(initial);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      setP(await api<Profile>("/api/me/profile", { method: "PUT", body: p }));
      setMsg({ ok: true, text: "Saved." });
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : String(err) });
    }
    setSaving(false);
  }

  const set = (k: keyof Profile) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setP({ ...p, [k]: e.target.value });

  return (
    <form className="terminal profile-form" onSubmit={save}>
      <div className="field">
        <label htmlFor="dn">Display name</label>
        <input id="dn" value={p.display_name} onChange={set("display_name")} maxLength={40} placeholder={p.username} />
      </div>
      <div className="field">
        <label htmlFor="bio">About you</label>
        <textarea id="bio" value={p.bio} onChange={set("bio")} maxLength={300} rows={3} placeholder="What keeps you up at night?" />
      </div>
      <div className="field">
        <label htmlFor="ig">Instagram</label>
        <input id="ig" value={p.instagram} onChange={set("instagram")} maxLength={31} placeholder="@yourhandle" autoCapitalize="off" spellCheck={false} />
      </div>
      <label className="check">
        <input type="checkbox" checked={p.profile_public} onChange={e => setP({ ...p, profile_public: e.target.checked })} />
        <span>
          Show my profile publicly
          <span className="hint">
            Off: only the site&apos;s Overseer and a few people they trust can see it. On: anyone can open your profile from your stories.
          </span>
        </span>
      </label>
      {msg && <p className={`msg ${msg.ok ? "ok" : "error"}`} role="status">{msg.ok ? "✓" : "✕"} {msg.text}</p>}
      <div className="actions">
        <button type="submit" disabled={saving}>{saving ? "SAVING…" : "SAVE PROFILE"}</button>
        {p.profile_public && <Link href={`/u/${p.username}`}>view public profile &gt;</Link>}
      </div>
    </form>
  );
}
