import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { StoryEditor } from "@/components/editor/StoryEditor";
import { apiGet, currentUser } from "@/lib/server-api";
import type { Category, Genre, Prompt, Story } from "@/lib/types";

export const metadata: Metadata = { title: "Edit story" };

export default async function EditStoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await currentUser();
  if (!user) redirect(`/login?next=/stories/${id}/edit`);

  const [story, categories, genres, prompts] = await Promise.all([
    /^\d+$/.test(id) ? apiGet<Story>(`/api/stories/${id}`) : null,
    apiGet<Category[]>("/api/categories"),
    apiGet<Genre[]>("/api/genres"),
    apiGet<Prompt[]>("/api/prompts"),
  ]);
  if (!story) notFound();

  if (!story.can_edit) {
    return (
      <div className="denied">
        <h1 className="haunt" data-text="YOU SHOULDN'T BE HERE">YOU SHOULDN&apos;T BE HERE</h1>
        <p className="muted">You can only edit stories you wrote.</p>
        <p><Link href={`/stories/${story.id}`}>← back to the story</Link></p>
      </div>
    );
  }

  // Keep any categories on the story even if they're rare
  const names = new Set([...(categories ?? []).map(c => c.name), ...story.categories]);

  return (
    <StoryEditor
      story={story}
      genres={(genres ?? []).map(g => g.name)}
      categories={[...names]}
      user={user}
      prompts={(prompts ?? []).filter(p => p.status === "open")}
    />
  );
}
