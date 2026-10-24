"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { excerpt, formatDate } from "@/lib/format";
import type { StorySummary } from "@/lib/types";

export function Rating({ value }: { value: number | null }) {
  if (value == null) return null;
  return (
    <span className="rating" title={`Rated ${value.toFixed(2)} / 10`}>
      <span className="bar"><i style={{ width: `${value * 10}%` }} /></span>
      {value.toFixed(1)}
    </span>
  );
}

export function StoryGrid({ stories }: { stories: StorySummary[] }) {
  if (!stories.length) return <p className="empty">NOTHING HERE. OR NOTHING THAT WANTS TO BE FOUND.</p>;
  return (
    // Keyed on the result set so the staggered entrance replays when filters change
    <div className="grid" key={stories.map(s => s.id).join(",")}>
      {stories.map((s, i) => (
        <motion.div
          key={s.id}
          className="rise"
          style={{ "--i": Math.min(i, 12) } as React.CSSProperties}
          whileHover={{ y: -4 }}
          transition={{ type: "spring", stiffness: 400, damping: 28 }}
        >
          <StoryCard story={s} />
        </motion.div>
      ))}
    </div>
  );
}

function StoryCard({ story: s }: { story: StorySummary }) {
  return (
    <Link href={`/stories/${s.id}`} className={`card ${s.source}`}>
      <div className="top">
        <span>#{String(s.id).padStart(4, "0")} · {s.reading_minutes} MIN</span>
        {s.source === "user" ? <span className="badge user">NEW BLOOD</span> : <Rating value={s.rating} />}
      </div>
      <h3 className="glitch" data-text={s.title}>{s.title}</h3>
      <div className="by">
        {s.author ?? "Unknown author"} · {formatDate(s.published_at)}
      </div>
      <p>{excerpt(s.excerpt, 200)}</p>
      <div className="chips">
        {s.categories.slice(0, 3).map(c => (
          <span key={c} className="chip">{c}</span>
        ))}
      </div>
    </Link>
  );
}
