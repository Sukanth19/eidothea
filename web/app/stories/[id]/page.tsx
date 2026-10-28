import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Comments } from "@/components/Comments";
import { DeleteStoryButton } from "@/components/DeleteStoryButton";
import { RateStory } from "@/components/RateStory";
import { ReportButton } from "@/components/Reports";
import { ShareStory } from "@/components/ShareStory";
import { Reader } from "@/components/Reader";
import { ReadingNow } from "@/components/ReadingNow";
import { ScrambleText } from "@/components/ScrambleText";
import { Rating, StoryGrid } from "@/components/StoryCard";
import { Sigil } from "@/components/Sigil";
import { BookmarkButton, FollowButton, RecommendButton } from "@/components/Social";
import { WarningGate } from "@/components/WarningGate";
import { Whisper } from "@/components/Whisper";
import { excerpt, formatDate } from "@/lib/format";
import { apiGet, currentUser } from "@/lib/server-api";
import type { Comment, SocialInfo, Story, StorySummary } from "@/lib/types";

// Scrawled behind the end of each story, found only by the cursor's light
const ENDINGS = ["IT READ THIS TOO", "YOU WEREN'T READING ALONE", "DON'T LOOK BEHIND YOU", "IT FOLLOWED YOU HERE", "NOW IT KNOWS YOUR NAME"];

type Props = { params: Promise<{ id: string }>; searchParams?: Promise<{ published?: string; share?: string }> };

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

export default async function StoryPage({ params, searchParams }: Props) {
  const [story, user] = await Promise.all([load((await params).id), currentUser()]);
  const query = await searchParams;
  const justPublished = query?.published === "1";
  if (!story) notFound();

  const ownStory = !!user && story.author_id === user.id;
  const draft = story.status === "draft";
  const [comments, social, related] = await Promise.all([
    draft ? [] : apiGet<Comment[]>(`/api/stories/${story.id}/comments`).then(c => c ?? []),
    // Community authors can be followed; imported stories have no account behind them
    story.author_id && story.author ? apiGet<SocialInfo>(`/api/profiles/${encodeURIComponent(story.author)}/social`) : null,
    draft ? null : apiGet<{ items: StorySummary[] }>(`/api/stories/${story.id}/related?limit=4`),
  ]);

  return (
    <article className="doc">
      <p><Link href="/stories">← back to archive</Link></p>

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
        <div className="caps muted" style={{ fontSize: ".95rem" }}>
          FILE #{String(story.id).padStart(4, "0")} ·{" "}
          <span className={`badge ${story.source}`}>{story.source === "user" ? "COMMUNITY" : "CLASSIC ARCHIVE"}</span>
        </div>
        <h1 style={{ marginTop: ".5rem" }}><ScrambleText text={story.title || "Untitled draft"} duration={700} haunt={!draft} /></h1>
        {story.subtitle && <p className="subtitle">{story.subtitle}</p>}
        {story.prompt && (
          <p className="caps muted prompt-line">WRITTEN FOR THE PROMPT <Link href={`/prompts/${story.prompt.id}`}>{story.prompt.title}</Link></p>
        )}
        <div className="meta">
          <span>
            BY{" "}
            {story.author_public && story.author ? (
              <Link href={`/u/${encodeURIComponent(story.author)}`}><b>{story.author}</b></Link>
            ) : (
              <b>{story.author ?? "Unknown author"}</b>
            )}
          </span>
          <span>{formatDate(story.published_at)}</span>
          <span>{story.reading_minutes} MIN READ</span>
          {story.rating != null && (
            <span><Rating value={story.rating} /> · {story.rating_count} {story.rating_count === 1 ? "RATING" : "RATINGS"}</span>
          )}
          {story.updated_at && <span>EDITED {formatDate(story.updated_at)}</span>}
          {!draft && <ReadingNow storyId={story.id} />}
        </div>
        {social && story.author && (
          <div className="byline">
            <Sigil name={story.author} size={34} />
            <span>
              {story.author_public ? <Link href={`/u/${encodeURIComponent(story.author)}`}>{story.author}</Link> : story.author}
              <span className="caps muted"> · {social.followers} {social.followers === 1 ? "FOLLOWER" : "FOLLOWERS"}</span>
            </span>
            <FollowButton username={story.author} initial={social} user={user} />
          </div>
        )}
        {!draft && (
          <div className="head-share">
            <ShareStory
              storyId={story.id}
              title={story.title}
              autoOpen={(justPublished && ownStory) || query?.share === "1"}
              heading={justPublished && ownStory ? "Your story is live. Share it." : undefined}
            />
            {!ownStory && <BookmarkButton storyId={story.id} initial={!!story.bookmarked} user={user} />}
          </div>
        )}
        <div className="chips">
          {story.categories.map(c => (
            <Link key={c} href={`/stories?category=${encodeURIComponent(c)}`} className="chip">{c}</Link>
          ))}
        </div>
      </header>

      <WarningGate warnings={ownStory ? [] : story.warnings}>
        <Reader
          body={story.body}
          storyId={story.id}
          // Commands are for the community's stories; the classic archive is left as it was found
          live={story.source === "user"}
          reader={user?.username}
          finished={!!story.my_read?.finished}
          track={!draft && user?.email_verified ? story.id : undefined}
          resume={story.my_read && !story.my_read.finished && story.my_read.progress >= 0.15 ? story.my_read.progress : undefined}
        />
      </WarningGate>

      {story.truncated && (
        <p className="notice">
          ⚠ THE REST OF THIS PAGE WAS TORN AWAY. The source dataset stored each story in a single spreadsheet cell,
          and this one ran past the 32,767-character limit. The rest is lost.
        </p>
      )}

      <Whisper className="end-whisper" message={ENDINGS[story.id % ENDINGS.length]}>
        <div className="end-mark">— NOTHING MORE WAS FOUND —</div>
      </Whisper>

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
            blocked={!user ? "login" : !user.member ? "member" : ownStory ? "own" : undefined}
          />
          <div className="actions" style={{ justifyContent: "center", marginTop: "1.5rem" }}>
            <RecommendButton storyId={story.id} count={story.recommend_count} recommended={!!story.recommended} user={user} own={ownStory} />
          </div>
          <div className="actions" style={{ justifyContent: "center", marginTop: "1.5rem" }}>
            <ShareStory storyId={story.id} title={story.title} label="SHARE THIS STORY" />
            <Link href="/random" className="btn" prefetch={false}>ANOTHER ONE</Link>
          </div>
          {!ownStory && (
            <div className="actions" style={{ justifyContent: "center", marginTop: ".8rem" }}>
              <ReportButton target={{ story_id: story.id }} user={user} label="[report this story]" />
            </div>
          )}
          {related && related.items.length > 0 && (
            <section className="related" aria-label="More like this">
              <div className="section-head"><h2>If this one got under your skin…</h2></div>
              <StoryGrid stories={related.items} />
            </section>
          )}
          <Comments storyId={story.id} initial={comments} user={user} />
        </>
      )}
    </article>
  );
}
