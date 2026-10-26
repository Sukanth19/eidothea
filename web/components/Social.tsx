"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client-api";
import type { SocialInfo, User } from "@/lib/types";

/** Follow / unfollow a writer. Readers and members can follow; it doesn't move any rankings. */
export function FollowButton({ username, initial, user }: { username: string; initial: SocialInfo; user: User | null }) {
  const [info, setInfo] = useState(initial);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (user?.username.toLowerCase() === username.toLowerCase()) return null;
  if (!user) return <Link href={`/login?next=/u/${encodeURIComponent(username)}`} className="btn ghost follow-btn">FOLLOW</Link>;

  async function toggle() {
    setBusy(true);
    setError("");
    try {
      setInfo(await api<SocialInfo>(`/api/users/${encodeURIComponent(username)}/follow`, { method: info.is_following ? "DELETE" : "PUT" }));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
    setBusy(false);
  }

  return (
    <span className="follow">
      <button type="button" className={`follow-btn${info.is_following ? " ghost" : ""}`} onClick={toggle} disabled={busy} aria-pressed={info.is_following}>
        {info.is_following ? "FOLLOWING" : "FOLLOW"}
      </button>
      {error && <span className="msg error">{error}</span>}
    </span>
  );
}

/** Members can recommend stories; recommendations show on their profile and lift a story in trending. */
export function RecommendButton({ storyId, count, recommended, user, own }: { storyId: number; count: number; recommended: boolean; user: User | null; own: boolean }) {
  const router = useRouter();
  const [state, setState] = useState({ recommend_count: count, recommended });
  const [error, setError] = useState("");

  async function toggle() {
    setError("");
    try {
      setState(await api(`/api/stories/${storyId}/recommend`, { method: state.recommended ? "DELETE" : "PUT" }));
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  const label = `${state.recommend_count} ${state.recommend_count === 1 ? "RECOMMENDATION" : "RECOMMENDATIONS"}`;
  if (!user?.member || own) return <span className="caps muted">{label}</span>;
  return (
    <span className="follow">
      <button type="button" className={state.recommended ? "" : "ghost"} onClick={toggle} aria-pressed={state.recommended}>
        {state.recommended ? "✓ RECOMMENDED" : "RECOMMEND"}
      </button>
      <span className="caps muted">{label}</span>
      {error && <span className="msg error">{error}</span>}
    </span>
  );
}
