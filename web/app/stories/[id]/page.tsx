import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Comments } from "@/components/Comments";
import { DeleteStoryButton } from "@/components/DeleteStoryButton";
import { RateStory } from "@/components/RateStory";
import { Reader } from "@/components/Reader";
import { ScrambleText } from "@/components/ScrambleText";
import { Rating } from "@/components/StoryCard";
import { excerpt, formatDate } from "@/lib/format";
import { apiGet, currentUser } from "@/lib/server-api";
import type { Comment, Story } from "@/lib/types";

type Props = { params: Promise<{ id: string }> };

async function load(id: string) {
  if (!/^\d+$/.test(id)) return null;
  return apiGet<Story>(`/api/stories/${id}`);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const story = await load((await params).id);
  if (!story) return { title: "Not found" };
  const title = story.title || "Untitled draft";
  const description = excerpt(story.subtitle || story.body, 180);
  return {
    title,
    description,
    openGraph: { title, description, type: "article", authors: story.author ? [story.author] : undefined },
  };
}

export default async function StoryPage({ params }: Props) {
  const [story, user] = await Promise.all([load((await params).id), currentUser()]);
  if (!story) notFound();

  const ownStory = !!user && story.author_id === user.id;
  const draft = story.status === "draft";
  const comments = draft ? [] : ((await apiGet<Comment[]>(`/api/stories/${story.id}/comments`)) ?? []);

  return (
    <article className="doc">
      <p><Link href="/stories">&lt; back to archive</Link></p>

      {draft && (
        <div className="owner-bar draft">
          <span className="label">DRAFT · ONLY YOU CAN SEE THIS</span>
          <Link href={`/stories/${story.id}/edit`} className="btn">KEEP WRITING</Link>
        </div>
      )}

      {story.can_edit && !draft && (
        <div className="owner-bar">
          <span className="label">{ownStory ? "YOUR STORY" : "MODERATOR ACCESS"}</span>
          <Link href={`/stories/${story.id}/edit`} className="btn">EDIT</Link>
          <DeleteStoryButton id={story.id} redirectTo={ownStory ? "/me" : "/stories"} />
        </div>
      )}

      <header className="doc-head">
        <div className="term muted" style={{ fontSize: "1.2rem" }}>
          FILE #{String(story.id).padStart(4, "0")} ·{" "}
          <span className={`badge ${story.source}`}>{story.source === "user" ? "COMMUNITY" : "CLASSIC ARCHIVE"}</span>
        </div>
        <h1 style={{ marginTop: ".5rem" }}><ScrambleText text={story.title || "Untitled draft"} duration={700} /></h1>
        {story.subtitle && <p className="subtitle">{story.subtitle}</p>}
        <div className="meta">
          <span>BY <b>{story.author ?? "Unknown author"}</b></span>
          <span>{formatDate(story.published_at)}</span>
          <span>{story.reading_minutes} MIN READ</span>
          {story.rating != null && (
            <span><Rating value={story.rating} /> · {story.rating_count} {story.rating_count === 1 ? "RATING" : "RATINGS"}</span>
          )}
          {story.updated_at && <span>EDITED {formatDate(story.updated_at)}</span>}
        </div>
        <div className="chips">
          {story.categories.map(c => (
            <Link key={c} href={`/stories?category=${encodeURIComponent(c)}`} className="chip">{c}</Link>
          ))}
        </div>
      </header>

      <Reader body={story.body} />

      {story.truncated && (
        <p className="notice">
          ⚠ THIS TRANSMISSION WAS CUT OFF. The source dataset stored each story in a single spreadsheet cell,
          and this one ran past the 32,767-character limit. The rest is lost.
        </p>
      )}

      <div className="end-mark">— END OF FILE —</div>

      {story.tags.length > 0 && (
        <div className="chips" style={{ justifyContent: "center" }}>
          {story.tags.map(t => (
            <Link key={t} href={`/stories?q=${encodeURIComponent(t)}`} className="chip">#{t}</Link>
          ))}
        </div>
      )}

      {!draft && (
        <>
          <RateStory
            storyId={story.id}
            initial={{ rating: story.rating, rating_count: story.rating_count, my_rating: story.my_rating ?? null }}
            blocked={!user ? "login" : ownStory ? "own" : undefined}
          />
          <div className="actions" style={{ justifyContent: "center", marginTop: "2.5rem" }}>
            <Link href="/random" className="btn" prefetch={false}>ANOTHER ONE</Link>
          </div>
          <Comments storyId={story.id} initial={comments} user={user} />
        </>
      )}
    </article>
  );
}
