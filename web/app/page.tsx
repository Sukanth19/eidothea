import Link from "next/link";
import { CountUp } from "@/components/CountUp";
import { Hero } from "@/components/Hero";
import { StoryGrid } from "@/components/StoryCard";
import { apiGet, currentUser } from "@/lib/server-api";
import type { Category, ForYou, Stats, StoryPage } from "@/lib/types";

export default async function Home() {
  const [user, stats, trending, top, fresh, categories] = await Promise.all([
    currentUser(),
    apiGet<Stats>("/api/stats"),
    apiGet<StoryPage>("/api/stories?sort=trending&per_page=6"),
    apiGet<StoryPage>("/api/stories?sort=rating&per_page=6"),
    apiGet<StoryPage>("/api/stories?source=user&per_page=3"),
    apiGet<Category[]>("/api/categories"),
  ]);
  const forYou = user?.email_verified ? await apiGet<ForYou>("/api/stories/for-you?limit=3") : null;

  return (
    <>
      <Hero member={!!user?.member} loggedIn={!!user} />

      {stats && (
        <div className="stats">
          <div className="stat"><div className="n"><CountUp to={stats.stories} /></div><div className="l">Stories on file</div></div>
          <div className="stat"><div className="n"><CountUp to={stats.community} /></div><div className="l">Written by members</div></div>
          <div className="stat"><div className="n"><CountUp to={stats.users} /></div><div className="l">Souls registered</div></div>
          <div className="stat"><div className="n"><CountUp to={Math.round(stats.minutes / 60)} /></div><div className="l">Hours of reading</div></div>
        </div>
      )}

      {forYou && forYou.items.length > 0 && (
        <>
          <div className="section-head">
            <h2>For you</h2>
            <span className="muted">because you read {forYou.based_on.join(", ").toLowerCase()}</span>
          </div>
          <StoryGrid stories={forYou.items} />
        </>
      )}

      {trending && trending.items.length > 0 && (
        <>
          <div className="section-head">
            <h2>Spreading now</h2>
            <Link href="/stories?sort=trending" className="caps">ALL TRENDING →</Link>
          </div>
          <StoryGrid stories={trending.items} />
        </>
      )}

      {fresh && fresh.items.length > 0 && (
        <>
          <div className="section-head">
            <h2>Fresh from the community</h2>
            <Link href="/stories?source=user" className="caps">ALL COMMUNITY STORIES →</Link>
          </div>
          <StoryGrid stories={fresh.items} />
        </>
      )}

      <div className="section-head">
        <h2>Highest rated</h2>
        <Link href="/stories?sort=rating" className="caps">SEE MORE →</Link>
      </div>
      <StoryGrid stories={top?.items ?? []} />

      {categories && categories.length > 0 && (
        <>
          <div className="section-head"><h2>Browse by fear</h2></div>
          <div className="chips">
            {categories.slice(0, 30).map(c => (
              <Link key={c.name} href={`/stories?category=${encodeURIComponent(c.name)}`} className="chip" style={{ fontSize: ".85rem", padding: ".2rem .7rem" }}>
                {c.name} <span className="muted">· {c.count}</span>
              </Link>
            ))}
          </div>
        </>
      )}
    </>
  );
}
