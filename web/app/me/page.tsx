import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Pagination } from "@/components/Pagination";
import { StoryGrid } from "@/components/StoryCard";
import { apiGet, currentUser, query } from "@/lib/server-api";
import { ROLE_LABEL, type StoryPage } from "@/lib/types";

export const metadata: Metadata = { title: "My stories" };

export default async function MyStoriesPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const user = await currentUser();
  if (!user) redirect("/login?next=/me");
  const { page } = await searchParams;
  const data = await apiGet<StoryPage>(`/api/stories${query({ mine: true, page })}`);

  return (
    <>
      <div className="section-head" style={{ marginTop: 0 }}>
        <div>
          <h1 className="flicker" style={{ marginBottom: ".2rem" }}>My stories</h1>
          <span className="muted">
            {user.username} · <span className={`role ${user.role}`}>{ROLE_LABEL[user.role].toUpperCase()}</span>
          </span>
        </div>
        <Link href="/stories/new" className="btn">+ NEW STORY</Link>
      </div>
      {data && data.total > 0 ? (
        <>
          <div className="result-count">{data.total} STORIES</div>
          <StoryGrid stories={data.items} />
          <Pagination page={data.page} pages={data.pages} params={page ? { page } : {}} />
        </>
      ) : (
        <p className="empty">YOU HAVEN&apos;T WRITTEN ANYTHING YET. EVERYONE HAS ONE STORY THEY DON&apos;T TELL.</p>
      )}
    </>
  );
}
