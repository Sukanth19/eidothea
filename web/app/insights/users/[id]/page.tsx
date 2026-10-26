import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AccessToggle } from "@/components/insights/AccessToggle";
import { InsightsDenied } from "@/components/insights/Denied";
import { excerpt, formatDate, timeAgo } from "@/lib/format";
import { apiGet, currentUser } from "@/lib/server-api";
import { ROLE_LABEL, type InsightUserDetail } from "@/lib/types";

export const metadata: Metadata = { title: "Member" };

export default async function InsightUserPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await currentUser();
  if (!viewer) redirect(`/login?next=/insights/users/${id}`);
  if (!viewer.insights) return <InsightsDenied />;
  const u = /^\d+$/.test(id) ? await apiGet<InsightUserDetail>(`/api/insights/users/${id}`) : null;
  if (!u) notFound();

  const facts: [string, React.ReactNode][] = [
    ["Joined", `${formatDate(u.created_at)} (${timeAgo(u.created_at)})`],
    ["Last active", timeAgo(u.last_seen_at)],
    ["Heard about it from", u.source ?? "didn't say"],
    ["First visit came from", u.landing ?? "unknown"],
    ["Published stories", u.stories],
    ["Drafts", u.drafts],
    ["Comments", u.comments],
    ["Ratings given", u.ratings ? `${u.ratings} (average ${u.average_rating_given}/10)` : 0],
  ];

  return (
    <>
      <p><Link href="/insights">&lt; insights</Link></p>
      <header className="profile-head">
        <div className="term muted">MEMBER FILE #{String(u.id).padStart(4, "0")}</div>
        <h1 className="flicker">{u.username}</h1>
        <div className="meta">
          {u.display_name && <span>{u.display_name}</span>}
          <span className={`role ${u.role}`}>{ROLE_LABEL[u.role].toUpperCase()}</span>
          {u.instagram && <a href={`https://instagram.com/${u.instagram}`} target="_blank" rel="noopener noreferrer">INSTAGRAM @{u.instagram}</a>}
          <span>PROFILE {u.profile_public ? <Link href={`/u/${u.username}`}>PUBLIC</Link> : "PRIVATE"}</span>
        </div>
        {u.bio && <p className="profile-bio">{u.bio}</p>}
      </header>

      <dl className="facts">
        {facts.map(([k, v]) => (
          <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
        ))}
      </dl>

      {viewer.role === "overseer" && u.role !== "overseer" && (
        <div className="owner-bar">
          <span className="label">{u.insights ? `${u.username.toUpperCase()} CAN SEE INSIGHTS` : "INSIGHTS ACCESS"}</span>
          <AccessToggle userId={u.id} username={u.username} granted={u.insights} />
        </div>
      )}

      <div className="insight-grid">
        <section>
          <h2>Stories</h2>
          {u.recent_stories.length ? (
            <ul className="plain-list">
              {u.recent_stories.map(s => (
                <li key={s.id}>
                  {/* Drafts stay private to their author, even here */}
                  {s.status === "published" ? <Link href={`/stories/${s.id}`}>{s.title}</Link> : <span>{s.title || "Untitled draft"}</span>}
                  <span className="muted"> · {s.status === "draft" ? "draft" : formatDate(s.published_at)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">Hasn&apos;t written anything yet.</p>
          )}
        </section>
        <section>
          <h2>Recent comments</h2>
          {u.recent_comments.length ? (
            <ul className="plain-list">
              {u.recent_comments.map(c => (
                <li key={c.id}>
                  “{excerpt(c.body, 140)}”
                  <span className="muted"> on <Link href={`/stories/${c.story_id}`}>{c.story_title}</Link> · {timeAgo(c.created_at)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">No comments yet.</p>
          )}
        </section>
      </div>
    </>
  );
}
