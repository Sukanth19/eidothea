"use client";

import { useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { useFx } from "./Atmosphere";

const TAB_KEY = "eidothea.tab";
const CHECK_IN_MS = 20000;

// One id per browser tab, so a reload doesn't count as somebody new
function tabId() {
  try {
    let id = sessionStorage.getItem(TAB_KEY);
    if (!id) sessionStorage.setItem(TAB_KEY, (id = crypto.randomUUID()));
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

function line(n: number) {
  return n === 0 ? "ONLY YOU ARE READING THIS" : n === 1 ? "1 OTHER IS READING THIS" : `${n} OTHERS ARE READING THIS`;
}

/** How many other people have this story open right now. Once a visit it miscounts by one, for a moment. */
export function ReadingNow({ storyId }: { storyId: number }) {
  const [others, setOthers] = useState<number | null>(null);
  const [extra, setExtra] = useState(false);
  const reduced = useReducedMotion();
  const { fx } = useFx();

  useEffect(() => {
    const tab = tabId();
    const url = `/api/stories/${storyId}/here`;
    let live = true;
    const checkIn = () => {
      if (document.hidden) return;
      fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ tab }) })
        .then(r => (r.ok ? r.json() : null))
        .then(r => live && r && setOthers(r.others))
        .catch(() => {});
    };
    const leave = () => {
      // keepalive lets it out as the page closes
      fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ tab, leaving: true }), keepalive: true }).catch(() => {});
    };
    const onVisibility = () => (document.hidden ? leave() : checkIn());
    checkIn();
    const timer = setInterval(checkIn, CHECK_IN_MS);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", leave);
    return () => {
      live = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", leave);
      leave();
    };
  }, [storyId]);

  // Once per story visit, not every time the count changes
  useEffect(() => {
    if (others === null || !fx || reduced) return;
    let off: ReturnType<typeof setTimeout>;
    const on = setTimeout(() => {
      if (document.hidden) return;
      setExtra(true);
      off = setTimeout(() => setExtra(false), 1300);
    }, 40000 + Math.random() * 60000);
    return () => {
      clearTimeout(on);
      clearTimeout(off);
    };
  }, [storyId, fx, reduced, others === null]);

  if (others === null) return null;
  return (
    <span className={`reading-now${extra ? " miscount" : ""}`} role="status">
      <i aria-hidden="true" />
      {line(others + (extra ? 1 : 0))}
    </span>
  );
}
