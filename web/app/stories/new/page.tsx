import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { StoryForm } from "@/components/StoryForm";
import { apiGet, currentUser } from "@/lib/server-api";
import type { Category } from "@/lib/types";

export const metadata: Metadata = { title: "Write" };

export default async function NewStoryPage() {
  const user = await currentUser();
  if (!user) redirect("/login?next=/stories/new");
  const categories = (await apiGet<Category[]>("/api/categories")) ?? [];

  return (
    <>
      <h1 className="flicker" style={{ textAlign: "center" }}>Submit a story</h1>
      <p className="muted" style={{ textAlign: "center", marginBottom: "2rem" }}>
        Only you (and the moderators) can edit or delete it once it&apos;s published.
      </p>
      <StoryForm categories={categories.map(c => c.name)} />
    </>
  );
}
