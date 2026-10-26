import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { StoryEditor } from "@/components/editor/StoryEditor";
import { apiGet, currentUser } from "@/lib/server-api";
import type { Category, Genre } from "@/lib/types";

export const metadata: Metadata = { title: "Write" };

export default async function NewStoryPage() {
  const user = await currentUser();
  if (!user) redirect("/login?next=/stories/new");
  const [categories, genres] = await Promise.all([apiGet<Category[]>("/api/categories"), apiGet<Genre[]>("/api/genres")]);

  return <StoryEditor genres={(genres ?? []).map(g => g.name)} categories={(categories ?? []).map(c => c.name)} user={user} />;
}
