"use client";

import { motion, useScroll, useSpring } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { paragraphs } from "@/lib/format";

const SIZE_KEY = "eidothea.reader-size";
const SIZES = [0.92, 1.02, 1.14, 1.28];

/** Story body: scroll-progress bar, adjustable text size, paragraphs that surface as you reach them. */
export function Reader({ body }: { body: string }) {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 120, damping: 30, restDelta: 0.001 });
  const [size, setSize] = useState(1);
  const bodyRef = useRef<HTMLDivElement>(null);

  // Paragraphs surface as they scroll into view. The hiding class is only added
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
    el.querySelectorAll("p").forEach(p => io.observe(p));
    el.classList.add("armed");
    return () => io.disconnect();
  }, [body]);

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
        {paragraphs(body).map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>
    </>
  );
}
