import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { StoryEditor } from "@/components/editor/StoryEditor";
import { MembersOnly } from "@/components/MembersOnly";
import { apiGet, currentUser } from "@/lib/server-api";
import type { Category, Genre, Prompt } from "@/lib/types";

export const metadata: Metadata = { title: "Write" };

export default async function NewStoryPage({ searchParams }: { searchParams: Promise<{ prompt?: string }> }) {
  const user = await currentUser();
  if (!user) redirect("/login?next=/stories/new");
  if (!user.member) {
    return (
      <div className="denied">
        <h1 className="flicker">Members write here</h1>
        <MembersOnly user={user} what="write" next="/stories/new" />
      </div>
    );
  }
  const [categories, genres, prompts] = await Promise.all([
    apiGet<Category[]>("/api/categories"),
    apiGet<Genre[]>("/api/genres"),
    apiGet<Prompt[]>("/api/prompts"),
  ]);
  const open = (prompts ?? []).filter(p => p.status === "open");
  const asked = Number((await searchParams).prompt);

  return (
    <StoryEditor
      genres={(genres ?? []).map(g => g.name)}
      categories={(categories ?? []).map(c => c.name)}
      user={user}
      prompts={open}
      prompt={open.some(p => p.id === asked) ? asked : undefined}
    />
  );
}
