"use client";

import { animate, useInView, useReducedMotion } from "motion/react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

export function CountUp({ to }: { to: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const reduced = useReducedMotion();
  // The server renders the real number; the client resets to 0 before first paint
  // and counts up once visible, so no-JS visitors still see the right value.
  const [value, setValue] = useState(to);
  const [armed, setArmed] = useState(false);

  useLayoutEffect(() => {
    if (!reduced) {
      setValue(0);
      setArmed(true);
    }
  }, [reduced]);

  useEffect(() => {
    if (!inView || !armed) return;
    const controls = animate(0, to, { duration: 1.6, ease: [0.16, 1, 0.3, 1], onUpdate: v => setValue(Math.round(v)) });
    return () => controls.stop();
  }, [inView, armed, to]);

  return <span ref={ref}>{value.toLocaleString("en-US")}</span>;
}
