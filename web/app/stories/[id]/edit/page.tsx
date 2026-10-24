import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { StoryForm } from "@/components/StoryForm";
import { apiGet, currentUser } from "@/lib/server-api";
import type { Category, Story } from "@/lib/types";

export const metadata: Metadata = { title: "Edit story" };

export default async function EditStoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await currentUser();
  if (!user) redirect(`/login?next=/stories/${id}/edit`);

  const [story, categories] = await Promise.all([
    /^\d+$/.test(id) ? apiGet<Story>(`/api/stories/${id}`) : null,
    apiGet<Category[]>("/api/categories"),
  ]);
  if (!story) notFound();

  if (!story.can_edit) {
    return (
      <div className="denied">
        <h1 className="glitch" data-text="ACCESS DENIED">ACCESS DENIED</h1>
        <p className="muted">You can only edit stories you wrote.</p>
        <p><Link href={`/stories/${story.id}`}>&lt; back to the story</Link></p>
      </div>
    );
  }

  // Keep any categories on the story even if they're rare
  const names = new Set([...(categories ?? []).map(c => c.name), ...story.categories]);

  return (
    <>
      <h1 className="flicker" style={{ textAlign: "center" }}>Amend file #{String(story.id).padStart(4, "0")}</h1>
      <StoryForm story={story} categories={[...names]} />
    </>
  );
}
