import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { formatDate } from "@/lib/format";
import { apiGet, currentUser } from "@/lib/server-api";
import type { WriterStats } from "@/lib/types";

export const metadata: Metadata = { title: "Your stats" };

const pct = (n: number, of: number) => (of ? `${Math.round((n / of) * 100)}%` : "—");

export default async function StatsPage() {
  const user = await currentUser();
  if (!user) redirect("/login?next=/me/stats");
  const data = await apiGet<WriterStats>("/api/me/stats");
  const t = data?.totals;

  return (
    <>
      <p><Link href="/me">← my stories</Link></p>
      <h1 className="flicker">Who&apos;s been reading</h1>
      <p className="muted" style={{ maxWidth: "72ch" }}>
        Visits count everyone who opened a story, once a day each. Readers are people with a confirmed account, whose reading
        is recorded: a story counts as finished when they reach the end and spend a fair share of the reading time on it.
      </p>

      {t && (
        <div className="stats">
          <div className="stat"><div className="n">{t.visits}</div><div className="l">Visits</div></div>
          <div className="stat"><div className="n">{t.readers}</div><div className="l">Readers</div></div>
          <div className="stat"><div className="n">{pct(t.finished, t.readers)}</div><div className="l">Read to the end</div></div>
          <div className="stat"><div className="n">{t.followers}</div><div className="l">Followers</div></div>
          <div className="stat"><div className="n">{t.saves}</div><div className="l">Saved for later</div></div>
        </div>
      )}

      {data && data.stories.length > 0 ? (
        <div className="table-wrap" style={{ marginTop: "2rem" }}>
          <table>
            <thead>
              <tr><th>Story</th><th>Visits</th><th>Readers</th><th>Finished</th><th>Rating</th><th>Comments</th><th>Saves</th><th>Recs</th></tr>
            </thead>
            <tbody>
              {data.stories.map(s => (
                <tr key={s.id}>
                  <td>
                    <Link href={`/me/stats/${s.id}`}>{s.title}</Link>
                    <div className="muted" style={{ fontSize: ".85rem" }}>{formatDate(s.published_at)}</div>
                  </td>
                  <td>{s.visits}</td>
                  <td>{s.readers}</td>
                  <td>{s.finished} <span className="muted">({pct(s.finished, s.readers)})</span></td>
                  <td>{s.avg_score != null ? <>{s.avg_score} <span className="muted">· {s.ratings}</span></> : "—"}</td>
                  <td>{s.comments}</td>
                  <td>{s.saves}</td>
                  <td>{s.recommends}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="empty">NOTHING PUBLISHED YET. NUMBERS SHOW UP HERE ONCE PEOPLE START READING.</p>
      )}
    </>
  );
}
