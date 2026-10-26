import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BarList } from "@/components/insights/BarList";
import { DailyChart } from "@/components/insights/DailyChart";
import { InsightsDenied } from "@/components/insights/Denied";
import { formatDate, timeAgo } from "@/lib/format";
import { apiGet, currentUser } from "@/lib/server-api";
import { ROLE_LABEL, type InsightUser, type Insights } from "@/lib/types";

export const metadata: Metadata = { title: "Insights" };

const RANGES = [7, 30, 90];
const SOURCE_NAMES: Record<string, string> = {
  direct: "Direct / unknown",
  instagram: "Instagram story link",
  qr: "QR code",
  link: "Copied link",
  share: "Phone share menu",
  whatsapp: "WhatsApp",
  x: "X",
  reddit: "Reddit",
  facebook: "Facebook",
};

type Props = { searchParams: Promise<{ days?: string; sort?: string }> };

export default async function InsightsPage({ searchParams }: Props) {
  const user = await currentUser();
  if (!user) redirect("/login?next=/insights");
  if (!user.insights) return <InsightsDenied />;

  const sp = await searchParams;
  const days = RANGES.includes(Number(sp.days)) ? Number(sp.days) : 30;
  const sort = sp.sort === "active" ? "active" : "joined";
  const [data, users] = await Promise.all([
    apiGet<Insights>(`/api/insights/overview?days=${days}`),
    apiGet<InsightUser[]>(`/api/insights/users?sort=${sort}`),
  ]);
  if (!data || !users) return <InsightsDenied />;

  const qs = (d: number, s: string) => `?days=${d}${s === "active" ? "&sort=active" : ""}`;

  return (
    <>
      <div className="section-head" style={{ marginTop: 0 }}>
        <div>
          <h1 className="flicker" style={{ marginBottom: ".2rem" }}>Insights</h1>
          <span className="muted">Who&apos;s reading, where they come from, and who&apos;s joining. Visible to the Overseer and the people they let in.</span>
        </div>
        <div className="chips quick" style={{ margin: 0 }}>
          {RANGES.map(r => (
            <Link key={r} href={qs(r, sort)} className={`chip${r === days ? " on" : ""}`}>{r} DAYS</Link>
          ))}
        </div>
      </div>

      <div className="stats">
        <div className="stat"><div className="n">{data.today.visitors}</div><div className="l">Visitors today</div></div>
        <div className="stat"><div className="n">{data.week.visitors}</div><div className="l">Visitors this week</div></div>
        <div className="stat"><div className="n">{data.month.visitors}</div><div className="l">Visitors, 30 days</div></div>
        <div className="stat"><div className="n">{data.week.signups}</div><div className="l">Joined this week</div></div>
        <div className="stat"><div className="n">{data.totals.users}</div><div className="l">Members</div></div>
        <div className="stat"><div className="n">{data.totals.community_stories}</div><div className="l">Member stories</div></div>
      </div>
      <p className="hint">
        A visitor is one browser on one day; the same person tomorrow counts again. Nothing identifies them: no cookies, no stored IP addresses.
      </p>

      <DailyChart data={data.daily} days={days} />

      <div className="insight-grid">
        <section>
          <h2>Most read</h2>
          <BarList
            unit="readers"
            empty="No story views yet."
            rows={data.top_stories.map(s => ({ key: String(s.id), value: s.readers, label: <Link href={`/stories/${s.id}`}>{s.title}</Link> }))}
          />
        </section>
        <section>
          <h2>Where visitors come from</h2>
          <BarList unit="visitors" empty="No visits yet." rows={data.sources.map(s => ({ key: s.source, value: s.visitors, label: SOURCE_NAMES[s.source] ?? s.source }))} />
        </section>
        <section>
          <h2>How members heard about it</h2>
          <BarList unit="members" rows={data.heard_from.map(h => ({ key: h.source, value: h.users, label: h.source }))} />
        </section>
        <section>
          <h2>Devices</h2>
          <BarList unit="visitors" empty="No visits yet." rows={data.devices.map(d => ({ key: d.device, value: d.visitors, label: d.device }))} />
        </section>
      </div>

      <h2>New this week</h2>
      {data.new_users.length ? (
        <ul className="new-users">
          {data.new_users.map(u => (
            <li key={u.id}>
              <Link href={`/insights/users/${u.id}`}><b>{u.username}</b></Link>
              <span className="muted">joined {timeAgo(u.created_at)}</span>
              {u.source && <span>heard from <b>{u.source}</b></span>}
              {u.landing && u.landing !== "direct" && <span className="muted">first visit via {SOURCE_NAMES[u.landing] ?? u.landing}</span>}
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">No one new this week.</p>
      )}

      <div className="section-head">
        <h2>Members</h2>
        <div className="chips quick" style={{ margin: 0 }}>
          <Link href={qs(days, "joined")} className={`chip${sort === "joined" ? " on" : ""}`}>NEWEST</Link>
          <Link href={qs(days, "active")} className={`chip${sort === "active" ? " on" : ""}`}>RECENTLY ACTIVE</Link>
        </div>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Member</th><th>Joined</th><th>Last active</th><th>Heard from</th><th>Stories</th><th>Comments</th><th>Ratings</th></tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id}>
                <td>
                  <Link href={`/insights/users/${u.id}`}>{u.username}</Link>
                  {u.display_name && <span className="muted"> · {u.display_name}</span>}
                  {u.role !== "user" && <> <span className={`role ${u.role}`}>{ROLE_LABEL[u.role].toUpperCase()}</span></>}
                  {u.insights && u.role !== "overseer" && <> <span className="badge user">INSIGHTS</span></>}
                </td>
                <td className="muted">{formatDate(u.created_at)}</td>
                <td>{timeAgo(u.last_seen_at)}</td>
                <td>{u.source ?? <span className="muted">—</span>}</td>
                <td>{u.stories}{u.drafts > 0 && <span className="muted"> +{u.drafts} draft{u.drafts > 1 ? "s" : ""}</span>}</td>
                <td>{u.comments}</td>
                <td>{u.ratings}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
