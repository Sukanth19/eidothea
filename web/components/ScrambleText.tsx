"use client";

import { useReducedMotion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useFx } from "./Atmosphere";

const GLYPHS = "†‡§¶ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const INTRUSIONS = ["BEHIND YOU", "LET ME OUT", "IT SEES YOU", "STILL HERE", "WAKE UP", "HELP ME"];

/** Text that settles out of a jumble of letters on mount, and again on hover.
 *  With haunt, it very rarely flashes something else for a moment. */
export function ScrambleText({
  text,
  className,
  duration = 900,
  onMount = true,
  haunt = false,
}: {
  text: string;
  className?: string;
  duration?: number;
  onMount?: boolean;
  haunt?: boolean;
}) {
  const [shown, setShown] = useState(text);
  const frame = useRef<number>(0);
  const reduced = useReducedMotion();
  const { fx } = useFx();

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

  useEffect(() => {
    if (!haunt || !fx || reduced) return;
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      timer = setTimeout(() => {
        if (!document.hidden && Math.random() < 0.4) {
          setShown(INTRUSIONS[Math.floor(Math.random() * INTRUSIONS.length)]);
          timer = setTimeout(() => {
            setShown(text);
            schedule();
          }, 160);
        } else schedule();
      }, 30000 + Math.random() * 60000);
    };
    schedule();
    return () => {
      clearTimeout(timer);
      setShown(text);
    };
  }, [haunt, fx, reduced, text]);

  return (
    <span className={className} onMouseEnter={run} aria-label={text}>
      <span aria-hidden="true">{shown}</span>
    </span>
  );
}
