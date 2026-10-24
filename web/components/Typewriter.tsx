"use client";

import { useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";

/** Types each line, holds, erases, moves on to the next. */
export function Typewriter({ lines, speed = 45, hold = 2600 }: { lines: string[]; speed?: number; hold?: number }) {
  const reduced = useReducedMotion();
  const [line, setLine] = useState(0);
  const [count, setCount] = useState(0);
  const [erasing, setErasing] = useState(false);

  useEffect(() => {
    if (reduced) return;
    const full = lines[line];
    let delay = erasing ? speed / 2 : speed + Math.random() * 40;
    if (!erasing && count === full.length) delay = hold;

    const t = setTimeout(() => {
      if (!erasing && count === full.length) setErasing(true);
      else if (erasing && count === 0) {
        setErasing(false);
        setLine((line + 1) % lines.length);
      } else setCount(c => c + (erasing ? -1 : 1));
    }, delay);
    return () => clearTimeout(t);
  }, [count, erasing, line, lines, speed, hold, reduced]);

  const text = reduced ? lines[0] : lines[line].slice(0, count);
  return (
    <p className="tagline" aria-live="off">
      &gt; {text}
      <span className="caret" style={{ display: "inline-block", verticalAlign: "-.15em", marginLeft: ".2rem" }} />
    </p>
  );
}
