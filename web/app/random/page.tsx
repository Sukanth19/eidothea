import { connection } from "next/server";
import { redirect } from "next/navigation";
import { apiGet } from "@/lib/server-api";

// A page rather than a route handler: <Link> navigations fetch RSC payloads,
// which a route handler's plain 307 can't answer (it looped back to /random).
export default async function RandomStory() {
  await connection();
  const story = await apiGet<{ id: number }>("/api/stories/random");
  redirect(story ? `/stories/${story.id}` : "/stories");
}
