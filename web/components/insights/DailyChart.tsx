"use client";

import { useState } from "react";
import { formatDate } from "@/lib/format";

type Day = { day: string; visitors: number; views: number; signups: number };

/** Fills in days with no visits, so gaps show as gaps. */
function everyDay(days: Day[], count: number): Day[] {
  const byDay = new Map(days.map(d => [d.day, d]));
  const out: Day[] = [];
  const today = new Date();
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - i));
    const key = d.toISOString().slice(0, 10);
    out.push(byDay.get(key) ?? { day: key, visitors: 0, views: 0, signups: 0 });
  }
  return out;
}

/** Daily visitors: one series, so no legend; hover or focus a bar for the numbers. */
export function DailyChart({ data, days }: { data: Day[]; days: number }) {
  const series = everyDay(data, days);
  const max = Math.max(1, ...series.map(d => d.visitors));
  const [active, setActive] = useState<number | null>(null);
  const [asTable, setAsTable] = useState(false);
  const shown = active !== null ? series[active] : null;

  return (
    <figure className="chart">
      <figcaption className="chart-head">
        <span>Visitors per day</span>
        <button type="button" className="link-btn" onClick={() => setAsTable(t => !t)}>{asTable ? "[show chart]" : "[show as table]"}</button>
      </figcaption>

      {asTable ? (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Day</th><th>Visitors</th><th>Page views</th><th>Sign-ups</th></tr></thead>
            <tbody>
              {[...series].reverse().map(d => (
                <tr key={d.day}><td>{formatDate(d.day)}</td><td>{d.visitors}</td><td>{d.views}</td><td>{d.signups}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <>
          <div className="chart-tip" aria-live="polite">
            {shown ? (
              <><b>{formatDate(shown.day)}</b> · {shown.visitors} visitors · {shown.views} page views{shown.signups ? ` · ${shown.signups} joined` : ""}</>
            ) : (
              <span className="muted">Hover or tap a bar for that day&apos;s numbers.</span>
            )}
          </div>
          <div className="chart-plot" onMouseLeave={() => setActive(null)}>
            <span className="chart-max">{max}</span>
            <div className="chart-bars">
              {series.map((d, i) => (
                <button
                  key={d.day}
                  type="button"
                  className={`chart-col${active === i ? " on" : ""}`}
                  aria-label={`${formatDate(d.day)}: ${d.visitors} visitors`}
                  onMouseEnter={() => setActive(i)}
                  onFocus={() => setActive(i)}
                  onClick={() => setActive(i)}
                >
                  <i style={{ height: `${(d.visitors / max) * 100}%` }} />
                </button>
              ))}
            </div>
          </div>
          <div className="chart-axis">
            <span>{formatDate(series[0].day)}</span>
            <span>{formatDate(series[series.length - 1].day)}</span>
          </div>
        </>
      )}
    </figure>
  );
}
