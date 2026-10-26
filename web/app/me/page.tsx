import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Pagination } from "@/components/Pagination";
import { StoryGrid } from "@/components/StoryCard";
import { apiGet, currentUser, query } from "@/lib/server-api";
import { ROLE_LABEL, type StoryPage } from "@/lib/types";

export const metadata: Metadata = { title: "My stories" };

export default async function MyStoriesPage({ searchParams }: { searchParams: Promise<{ page?: string; tab?: string }> }) {
  const user = await currentUser();
  if (!user) redirect("/login?next=/me");
  const { page, tab } = await searchParams;
  const drafts = tab === "drafts";
  const [data, draftCount] = await Promise.all([
    apiGet<StoryPage>(`/api/stories${query({ mine: true, status: drafts ? "draft" : undefined, page })}`),
    apiGet<StoryPage>("/api/stories?mine=true&status=draft&per_page=1").then(d => d?.total ?? 0),
  ]);

  return (
    <>
      <div className="section-head" style={{ marginTop: 0 }}>
        <div>
          <h1 className="flicker" style={{ marginBottom: ".2rem" }}>My stories</h1>
          <span className="muted">
            {user.username} · <span className={`role ${user.role}`}>{ROLE_LABEL[user.role].toUpperCase()}</span>
          </span>
        </div>
        <span style={{ display: "inline-flex", gap: ".6rem", flexWrap: "wrap" }}>
          <Link href="/me/profile" className="btn ghost">EDIT PROFILE</Link>
          <Link href="/stories/new" className="btn">+ NEW STORY</Link>
        </span>
      </div>

      <div className="chips quick" style={{ marginBottom: "1.2rem" }}>
        <Link href="/me" className={`chip${drafts ? "" : " on"}`}>PUBLISHED</Link>
        <Link href="/me?tab=drafts" className={`chip${drafts ? " on" : ""}`}>DRAFTS · {draftCount}</Link>
      </div>

      {data && data.total > 0 ? (
        <>
          <div className="result-count">{data.total} {drafts ? (data.total === 1 ? "DRAFT" : "DRAFTS") : "STORIES"}</div>
          <StoryGrid stories={data.items} />
          <Pagination page={data.page} pages={data.pages} params={{ ...(page ? { page } : {}), ...(drafts ? { tab: "drafts" } : {}) }} />
        </>
      ) : drafts ? (
        <p className="empty">NO DRAFTS. ANYTHING YOU START WRITING IS KEPT HERE UNTIL YOU PUBLISH IT.</p>
      ) : (
        <p className="empty">YOU HAVEN&apos;T WRITTEN ANYTHING YET. EVERYONE HAS ONE STORY THEY DON&apos;T TELL.</p>
      )}
    </>
  );
}
