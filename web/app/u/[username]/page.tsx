import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StoryGrid } from "@/components/StoryCard";
import { formatDate } from "@/lib/format";
import { apiGet, query } from "@/lib/server-api";
import { ROLE_LABEL, type Profile, type StoryPage } from "@/lib/types";

type Props = { params: Promise<{ username: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  return { title: decodeURIComponent(username) };
}

export default async function PublicProfile({ params }: Props) {
  const username = decodeURIComponent((await params).username);
  // 404s unless the profile is public (or the viewer is its owner / has insights access)
  const profile = await apiGet<Profile>(`/api/profiles/${encodeURIComponent(username)}`);
  if (!profile) notFound();
  const stories = await apiGet<StoryPage>(`/api/stories${query({ author: profile.username, per_page: 24 })}`);

  return (
    <>
      <header className="profile-head">
        <div className="term muted">OPERATOR FILE</div>
        <h1 className="flicker">{profile.display_name || profile.username}</h1>
        <div className="meta">
          <span>@{profile.username}</span>
          {profile.role !== "user" && <span className={`role ${profile.role}`}>{ROLE_LABEL[profile.role].toUpperCase()}</span>}
          <span>JOINED {formatDate(profile.created_at)}</span>
          <span>{profile.story_count ?? 0} {profile.story_count === 1 ? "STORY" : "STORIES"}</span>
          {profile.instagram && (
            <a href={`https://instagram.com/${profile.instagram}`} target="_blank" rel="noopener noreferrer">INSTAGRAM @{profile.instagram}</a>
          )}
        </div>
        {profile.bio && <p className="profile-bio">{profile.bio}</p>}
        {!profile.profile_public && <p className="notice">This profile is private. You can see it because it&apos;s yours or you have insights access.</p>}
      </header>
      <StoryGrid stories={stories?.items ?? []} />
    </>
  );
}
