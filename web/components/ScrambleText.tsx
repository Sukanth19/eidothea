"use client";

import { useReducedMotion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";

const GLYPHS = "†‡§¶ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/** Text that settles out of a jumble of letters on mount, and again on hover. */
export function ScrambleText({
  text,
  className,
  duration = 900,
  onMount = true,
}: {
  text: string;
  className?: string;
  duration?: number;
  onMount?: boolean;
}) {
  const [shown, setShown] = useState(text);
  const frame = useRef<number>(0);
  const reduced = useReducedMotion();

  const run = useCallback(() => {
    if (reduced) return;
    cancelAnimationFrame(frame.current);
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const settled = Math.floor(t * text.length);
      let out = text.slice(0, settled);
      for (let i = settled; i < text.length; i++) {
        out += text[i] === " " ? " " : GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
      }
      setShown(out);
      if (t < 1) frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
  }, [text, duration, reduced]);

  useEffect(() => {
    setShown(text);
    if (onMount) run();
    return () => cancelAnimationFrame(frame.current);
  }, [text, onMount, run]);

  return (
    <span className={className} onMouseEnter={run} aria-label={text}>
      <span aria-hidden="true">{shown}</span>
    </span>
  );
}
