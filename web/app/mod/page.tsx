import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { GenreManager, Queue } from "@/components/Membership";
import { PromptManager } from "@/components/Prompts";
import { ReportQueue } from "@/components/Reports";
import { apiGet, currentUser } from "@/lib/server-api";
import { ROLE_LEVEL, type Genre, type OpenReport, type Prompt, type QueuedApplication } from "@/lib/types";

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

  const [reports, queue, genres, prompts] = await Promise.all([
    apiGet<OpenReport[]>("/api/reports"),
    apiGet<QueuedApplication[]>("/api/applications"),
    apiGet<Genre[]>("/api/genres"),
    apiGet<Prompt[]>("/api/prompts"),
  ]);

  return (
    <>
      <h1 className="flicker">The keepers&apos; desk</h1>
      <h2>Reports</h2>
      <p className="muted" style={{ maxWidth: "70ch" }}>Stories and comments readers flagged. Dismiss a report if nothing&apos;s wrong; taking something down deletes it.</p>
      <ReportQueue initial={reports ?? []} />
      <h2>Waiting list</h2>
      <p className="muted" style={{ maxWidth: "70ch" }}>Readers asking to become members. Letting someone in means they can post, comment and rate. They get an email either way.</p>
      <Queue initial={queue ?? []} />
      <h2>Prompts</h2>
      <p className="muted" style={{ maxWidth: "70ch" }}>A theme and a deadline for members to write to. Dates count anywhere on Earth, so nobody&apos;s timezone shuts them out.</p>
      <PromptManager initial={prompts ?? []} />
      <h2>Genres</h2>
      <p className="muted" style={{ maxWidth: "70ch" }}>Offered to writers above the archive&apos;s original categories.</p>
      <GenreManager initial={genres ?? []} />
    </>
  );
}
