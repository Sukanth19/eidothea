import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { StoryEditor } from "@/components/editor/StoryEditor";
import { apiGet, currentUser } from "@/lib/server-api";
import type { Category } from "@/lib/types";

export const metadata: Metadata = { title: "Write" };

export default async function NewStoryPage() {
  const user = await currentUser();
  if (!user) redirect("/login?next=/stories/new");
  const categories = (await apiGet<Category[]>("/api/categories")) ?? [];

  return <StoryEditor categories={categories.map(c => c.name)} user={user} />;
}
