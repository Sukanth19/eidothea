import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Pagination } from "@/components/Pagination";
import { StoryGrid } from "@/components/StoryCard";
import { apiGet, currentUser, query } from "@/lib/server-api";
import type { StoryPage } from "@/lib/types";

export const metadata: Metadata = { title: "Saved stories" };

export default async function SavedPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const user = await currentUser();
  if (!user) redirect("/login?next=/saved");
  const { page } = await searchParams;
  const data = await apiGet<StoryPage>(`/api/stories${query({ bookmarked: true, page })}`);

  return (
    <>
      <div className="section-head" style={{ marginTop: 0 }}>
        <div>
          <h1 className="flicker" style={{ marginBottom: ".2rem" }}>Saved for later</h1>
          <span className="muted">Only you can see this list.</span>
        </div>
      </div>

      {data && data.total > 0 ? (
        <>
          <div className="result-count">{data.total} {data.total === 1 ? "STORY" : "STORIES"} WAITING</div>
          <StoryGrid stories={data.items} />
          <Pagination page={data.page} pages={data.pages} params={page ? { page } : {}} />
        </>
      ) : (
        <p className="empty">
          NOTHING SAVED. PRESS SAVE ON A STORY AND IT WAITS HERE FOR YOU. <Link href="/stories">BROWSE THE ARCHIVE →</Link>
        </p>
      )}
    </>
  );
}
