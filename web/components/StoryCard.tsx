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
  const draft = s.status === "draft";
  const title = s.title || "Untitled draft";
  return (
    <Link href={draft ? `/stories/${s.id}/edit` : `/stories/${s.id}`} className={`card ${draft ? "draft" : s.source}`}>
      <div className="top">
        <span>#{String(s.id).padStart(4, "0")} · {s.reading_minutes} MIN</span>
        {draft ? (
          <span className="badge draft">DRAFT</span>
        ) : s.rating != null ? (
          <Rating value={s.rating} />
        ) : (
          s.source === "user" && <span className="badge user">NEW BLOOD</span>
        )}
      </div>
      <h3 className="glitch" data-text={title}>{title}</h3>
      <div className="by">
        {draft ? `LAST SAVED ${formatDate(s.updated_at ?? s.published_at)}` : <>{s.author ?? "Unknown author"} · {formatDate(s.published_at)}</>}
        {s.comment_count > 0 && <> · {s.comment_count} {s.comment_count === 1 ? "comment" : "comments"}</>}
      </div>
      <p>{s.subtitle || excerpt(s.excerpt, 200) || (draft ? "Nothing written yet." : "")}</p>
      <div className="chips">
        {s.categories.slice(0, 3).map(c => (
          <span key={c} className="chip">{c}</span>
        ))}
      </div>
    </Link>
  );
}
