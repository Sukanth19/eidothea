import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { BarList } from "@/components/insights/BarList";
import { DailyChart } from "@/components/insights/DailyChart";
import { apiGet, currentUser } from "@/lib/server-api";
import type { StoryStatsDetail } from "@/lib/types";

export const metadata: Metadata = { title: "Story stats" };

export default async function StoryStatsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await currentUser();
  if (!user) redirect(`/login?next=/me/stats/${id}`);
  const s = /^\d+$/.test(id) ? await apiGet<StoryStatsDetail>(`/api/me/stats/${id}`) : null;
  if (!s) notFound();
  const stoppedTotal = s.stopped.reduce((a, b) => a + b, 0);

  return (
    <>
      <p><Link href="/me/stats">← all your stats</Link></p>
      <h1 className="flicker"><Link href={`/stories/${s.id}`}>{s.title}</Link></h1>

      <div className="stats">
        <div className="stat"><div className="n">{s.visits}</div><div className="l">Visits</div></div>
        <div className="stat"><div className="n">{s.readers}</div><div className="l">Readers</div></div>
        <div className="stat"><div className="n">{s.finished}</div><div className="l">Read to the end</div></div>
        <div className="stat"><div className="n">{s.avg_score ?? "—"}</div><div className="l">Average rating · {s.ratings}</div></div>
        <div className="stat"><div className="n">{s.saves}</div><div className="l">Saved for later</div></div>
      </div>

      <div className="section-head"><h2>Visitors, last 30 days</h2></div>
      <DailyChart data={s.daily} days={30} visitorsOnly />

      <div className="section-head">
        <h2>Where readers stopped</h2>
        <span className="muted">readers who didn&apos;t finish, by how far they got</span>
      </div>
      <BarList
        unit="readers"
        empty="No one has stopped partway yet."
        rows={stoppedTotal ? s.stopped.map((n, i) => ({ key: String(i), label: `${i * 10}–${i * 10 + 10}%`, value: n })) : []}
      />
    </>
  );
}
