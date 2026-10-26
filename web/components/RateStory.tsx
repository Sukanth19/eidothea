"use client";

import Link from "next/link";
import { useState } from "react";
import { api } from "@/lib/client-api";
import type { RatingState } from "@/lib/types";

/** 1-10 rating scale under a story. `blocked` explains why this reader can't rate. */
export function RateStory({ storyId, initial, blocked }: { storyId: number; initial: RatingState; blocked?: "login" | "member" | "own" }) {
  const [state, setState] = useState(initial);
  const [hover, setHover] = useState<number | null>(null);
  const [error, setError] = useState("");

  async function rate(score: number | null) {
    setError("");
    try {
      setState(
        await api<RatingState>(`/api/stories/${storyId}/rating`, score === null ? { method: "DELETE" } : { method: "PUT", body: { score } }),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  const shown = hover ?? state.my_rating ?? 0;

  return (
    <section className="rate-box" aria-label="Rating">
      <div className="rate-head">
        <span className="caps">RATE THIS FILE</span>
        <span className="muted">
          {state.rating != null ? (
            <><b className="score">{state.rating.toFixed(1)}</b> / 10 · {state.rating_count} {state.rating_count === 1 ? "rating" : "ratings"}</>
          ) : (
            "No ratings yet"
          )}
        </span>
      </div>

      {blocked === "login" ? (
        <p className="hint"><Link href={`/login?next=/stories/${storyId}`}>Log in</Link> to rate it out of 10.</p>
      ) : blocked === "member" ? (
        <p className="hint">Only members can rate. <Link href="/membership">Get an invite or join the waiting list</Link>.</p>
      ) : blocked === "own" ? (
        <p className="hint">You can&apos;t rate your own story.</p>
      ) : (
        <>
          <div className="scale" role="radiogroup" aria-label="Your rating out of 10" onMouseLeave={() => setHover(null)}>
            {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={state.my_rating === n}
                className={n <= shown ? "lit" : ""}
                onMouseEnter={() => setHover(n)}
                onFocus={() => setHover(n)}
                onBlur={() => setHover(null)}
                onClick={() => rate(n)}
              >
                {n}
              </button>
            ))}
          </div>
          <p className="hint">
            {state.my_rating ? (
              <>You gave it {state.my_rating}/10. <button type="button" className="link-btn" onClick={() => rate(null)}>[remove]</button></>
            ) : (
              "Click a number to rate."
            )}
          </p>
        </>
      )}
      {error && <p className="msg error">✕ {error}</p>}
    </section>
  );
}
