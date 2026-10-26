import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { GenreManager, Queue } from "@/components/Membership";
import { apiGet, currentUser } from "@/lib/server-api";
import { ROLE_LEVEL, type Genre, type QueuedApplication } from "@/lib/types";

export const metadata: Metadata = { title: "Keepers" };

export default async function ModPage() {
  const user = await currentUser();
  if (!user) redirect("/login?next=/mod");
  if (ROLE_LEVEL[user.role] < ROLE_LEVEL.mod) {
    return (
      <div className="denied">
        <h1 className="haunt" data-text="YOU SHOULDN'T BE HERE">YOU SHOULDN&apos;T BE HERE</h1>
        <p className="muted">Moderators and up only.</p>
        <p><Link href="/stories">← back to the archive</Link></p>
      </div>
    );
  }

  const [queue, genres] = await Promise.all([
    apiGet<QueuedApplication[]>("/api/applications"),
    apiGet<Genre[]>("/api/genres"),
  ]);

  return (
    <>
      <h1 className="flicker">The keepers&apos; desk</h1>
      <h2>Waiting list</h2>
      <p className="muted" style={{ maxWidth: "70ch" }}>Readers asking to become members. Letting someone in means they can post, comment and rate. They get an email either way.</p>
      <Queue initial={queue ?? []} />
      <h2>Genres</h2>
      <p className="muted" style={{ maxWidth: "70ch" }}>Offered to writers above the archive&apos;s original categories.</p>
      <GenreManager initial={genres ?? []} />
    </>
  );
}
