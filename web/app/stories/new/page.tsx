import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { StoryEditor } from "@/components/editor/StoryEditor";
import { MembersOnly } from "@/components/MembersOnly";
import { apiGet, currentUser } from "@/lib/server-api";
import type { Category, Genre } from "@/lib/types";

export const metadata: Metadata = { title: "Write" };

export default async function NewStoryPage() {
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
  const [categories, genres] = await Promise.all([apiGet<Category[]>("/api/categories"), apiGet<Genre[]>("/api/genres")]);

  return <StoryEditor genres={(genres ?? []).map(g => g.name)} categories={(categories ?? []).map(c => c.name)} user={user} />;
}
