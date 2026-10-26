import type { Metadata } from "next";
import { Suspense } from "react";
import { Filters } from "@/components/Filters";
import { Pagination } from "@/components/Pagination";
import { StoryGrid } from "@/components/StoryCard";
import { apiGet, query } from "@/lib/server-api";
import type { Category, Genre, StoryPage } from "@/lib/types";

export const metadata: Metadata = { title: "Archive" };

const KEYS = ["q", "category", "sort", "source", "page"] as const;

export default async function StoriesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const raw = await searchParams;
  const params: Record<string, string> = {};
  for (const k of KEYS) {
    const v = raw[k];
    if (typeof v === "string" && v) params[k] = v;
  }

  const [data, categories, genres] = await Promise.all([
    apiGet<StoryPage>(`/api/stories${query(params)}`),
    apiGet<Category[]>("/api/categories"),
    apiGet<Genre[]>("/api/genres"),
  ]);
  // New genres are offered even before anyone has written in them
  const seen = new Set((categories ?? []).map(c => c.name));
  const all = [...(categories ?? []), ...(genres ?? []).filter(g => !seen.has(g.name)).map(({ name, count }) => ({ name, count }))];

  return (
    <>
      <h1 className="flicker">The Archive</h1>
      <p className="muted" style={{ maxWidth: "70ch" }}>
        Recovered accounts from across the internet, and new ones from people who should probably have stayed quiet.
      </p>
      <Suspense>
        <Filters categories={all} />
      </Suspense>
      {data ? (
        <>
          <div className="result-count">
            {data.total.toLocaleString("en-US")} RECORD{data.total === 1 ? "" : "S"} · PAGE {data.page} OF {data.pages}
          </div>
          <StoryGrid stories={data.items} />
          <Pagination page={data.page} pages={data.pages} params={params} />
        </>
      ) : (
        <p className="empty">THE ARCHIVE DID NOT ANSWER.</p>
      )}
    </>
  );
}
