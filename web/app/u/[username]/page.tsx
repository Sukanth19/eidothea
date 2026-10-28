import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Sigil } from "@/components/Sigil";
import { FollowButton } from "@/components/Social";
import { StoryGrid } from "@/components/StoryCard";
import { formatDate } from "@/lib/format";
import { apiGet, currentUser, query } from "@/lib/server-api";
import { ROLE_LABEL, type Profile, type SocialInfo, type StoryPage } from "@/lib/types";

type Props = { params: Promise<{ username: string }>; searchParams: Promise<{ tab?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  return { title: decodeURIComponent(username) };
}

export default async function PublicProfile({ params, searchParams }: Props) {
  const username = decodeURIComponent((await params).username);
  const recommends = (await searchParams).tab === "recommends";
  // 404s unless the profile is public (or the viewer is its owner / has insights access)
  const profile = await apiGet<Profile>(`/api/profiles/${encodeURIComponent(username)}`);
  if (!profile) notFound();
  const [user, social, stories] = await Promise.all([
    currentUser(),
    apiGet<SocialInfo>(`/api/profiles/${encodeURIComponent(profile.username)}/social`),
    apiGet<StoryPage>(`/api/stories${query(recommends ? { recommended_by: profile.username, per_page: 24 } : { author: profile.username, per_page: 24 })}`),
  ]);
  const base = `/u/${encodeURIComponent(profile.username)}`;

  return (
    <>
      <header className="profile-head">
        <div className="profile-top">
          <Sigil name={profile.username} size={88} className="profile-sigil" />
          <div style={{ minWidth: 0 }}>
            <div className="caps muted">{profile.member ? "MEMBER OF THE ARCHIVE" : "READER ON RECORD"}</div>
            <h1 className="flicker" style={{ margin: ".1rem 0 .3rem" }}>{profile.display_name || profile.username}</h1>
            {social && <FollowButton username={profile.username} initial={social} user={user} />}
          </div>
        </div>
        <div className="meta">
          <span>@{profile.username}</span>
          {profile.role !== "user" && <span className={`role ${profile.role}`}>{ROLE_LABEL[profile.role].toUpperCase()}</span>}
          {social && <span>{social.followers} {social.followers === 1 ? "FOLLOWER" : "FOLLOWERS"} · {social.following} FOLLOWING</span>}
          <span>JOINED {formatDate(profile.created_at)}</span>
          {profile.stories_read !== undefined && (
            <span title={profile.show_reads ? undefined : "Only you can see this. Turn it on in your profile settings."}>
              {profile.stories_read} {profile.stories_read === 1 ? "STORY" : "STORIES"} READ{!profile.show_reads && " · ONLY YOU SEE THIS"}
            </span>
          )}
          {profile.instagram && (
            <a href={`https://instagram.com/${profile.instagram}`} target="_blank" rel="noopener noreferrer">INSTAGRAM @{profile.instagram}</a>
          )}
        </div>
        {profile.bio && <p className="profile-bio">{profile.bio}</p>}
        {!profile.profile_public && <p className="notice">This profile is private. You can see it because it&apos;s yours or you have insights access.</p>}
      </header>

      <div className="chips quick" style={{ marginBottom: "1.2rem" }}>
        <Link href={base} className={`chip${recommends ? "" : " on"}`}>STORIES · {profile.story_count ?? 0}</Link>
        <Link href={`${base}?tab=recommends`} className={`chip${recommends ? " on" : ""}`}>RECOMMENDS · {social?.recommends ?? 0}</Link>
      </div>
      {stories && stories.items.length > 0 ? (
        <StoryGrid stories={stories.items} />
      ) : (
        <p className="empty">{recommends ? "NOTHING RECOMMENDED YET." : "NO STORIES YET."}</p>
      )}
    </>
  );
}
