"use client";

import { motion, useScroll, useSpring } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { Markup } from "./Markup";

const SIZE_KEY = "eidothea.reader-size";
const SIZES = [0.92, 1.02, 1.14, 1.28];

/** Story body: scroll-progress bar, adjustable text size, blocks that surface as you reach them.
 *  With `track` (a story id), reports how far the reader got and for how long. */
export function Reader({ body, track }: { body: string; track?: number }) {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 120, damping: 30, restDelta: 0.001 });
  const [size, setSize] = useState(1);
  const bodyRef = useRef<HTMLDivElement>(null);

  // Blocks surface as they scroll into view. The hiding class is only added
  // here, so without JS (or with reduced motion) the text is simply there.
  useEffect(() => {
    const el = bodyRef.current;
    if (!el || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(
      entries => entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add("seen");
          io.unobserve(e.target);
        }
      }),
      { rootMargin: "0px 0px -8% 0px" },
    );
    el.querySelectorAll(":scope > *").forEach(b => io.observe(b));
    el.classList.add("armed");
    return () => io.disconnect();
  }, [body]);

  // Furthest point reached and seconds on screen, sent every 15s and when leaving
  useEffect(() => {
    const el = bodyRef.current;
    if (!track || !el) return;
    let furthest = 0;
    let sent = 0;
    let unsent = 0;
    const measure = () => {
      const r = el.getBoundingClientRect();
      const seen = (window.innerHeight - r.top) / Math.max(1, r.height);
      furthest = Math.max(furthest, Math.min(1, Math.max(0, seen)));
    };
    const send = () => {
      if (unsent === 0 && furthest <= sent) return;
      const body = JSON.stringify({ progress: Math.round(furthest * 100) / 100, seconds: Math.min(600, unsent) });
      // keepalive lets the last report out as the page closes
      fetch(`/api/stories/${track}/read`, { method: "POST", headers: { "content-type": "application/json" }, body, keepalive: true }).catch(() => {});
      sent = furthest;
      unsent = 0;
    };
    const tick = setInterval(() => {
      if (document.hidden) return;
      unsent += 1;
      if (unsent >= 15) send();
    }, 1000);
    const onHide = () => {
      if (document.hidden) send();
    };
    measure();
    window.addEventListener("scroll", measure, { passive: true });
    document.addEventListener("visibilitychange", onHide);
    return () => {
      send();
      clearInterval(tick);
      window.removeEventListener("scroll", measure);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, [track]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SIZE_KEY);
      const saved = raw === null ? NaN : Number(raw);
      if (saved >= 0 && saved < SIZES.length) setSize(saved);
    } catch {}
  }, []);

  function changeSize(delta: number) {
    const next = Math.min(SIZES.length - 1, Math.max(0, size + delta));
    setSize(next);
    try {
      localStorage.setItem(SIZE_KEY, String(next));
    } catch {}
  }

  return (
    <>
      <motion.div className="progress" style={{ scaleX }} aria-hidden="true" />
      <div className="reader-tools">
        TEXT SIZE
        <button type="button" className="ghost" onClick={() => changeSize(-1)} disabled={size === 0} aria-label="Smaller text">A−</button>
        <button type="button" className="ghost" onClick={() => changeSize(1)} disabled={size === SIZES.length - 1} aria-label="Larger text">A+</button>
      </div>
      <div ref={bodyRef} className="story-body" style={{ "--reader-size": `${SIZES[size]}rem` } as React.CSSProperties}>
        <Markup text={body} />
      </div>
    </>
  );
}
