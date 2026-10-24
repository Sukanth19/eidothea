"use client";

import Link from "next/link";
import { useRef } from "react";
import { ScrambleText } from "./ScrambleText";
import { Typewriter } from "./Typewriter";

const LINES = [
  "3,000+ stories recovered from the dark corners of the internet.",
  "Some of them are true. We stopped checking which.",
  "Read with the lights on. Or don't.",
  "If you hear knocking, do not knock back.",
];

export function Hero({ loggedIn }: { loggedIn: boolean }) {
  const ref = useRef<HTMLElement>(null);

  // The cursor is a flashlight: the hidden message only shows where it points
  function onMove(e: React.PointerEvent) {
    const r = ref.current!.getBoundingClientRect();
    ref.current!.style.setProperty("--x", `${e.clientX - r.left}px`);
    ref.current!.style.setProperty("--y", `${e.clientY - r.top}px`);
  }

  return (
    <section ref={ref} className="hero" onPointerMove={onMove}>
      <div className="flashlight" aria-hidden="true">
        IT KNOWS
        <br />
        YOU&apos;RE READING
      </div>

      <div className="kicker rise" style={{ "--i": 4 } as React.CSSProperties}>
        // TRANSMISSION RECOVERED
      </div>
      <h1>
        <ScrambleText text="THE UNLIT ARCHIVE" duration={1400} />
      </h1>
      <Typewriter lines={LINES} />
      <div className="actions rise" style={{ "--i": 12 } as React.CSSProperties}>
        <Link href="/stories" className="btn">ENTER THE ARCHIVE</Link>
        <Link href="/random" className="btn ghost" prefetch={false}>READ SOMETHING RANDOM</Link>
        <Link href={loggedIn ? "/stories/new" : "/register"} className="btn danger">
          {loggedIn ? "SUBMIT A STORY" : "JOIN AND WRITE"}
        </Link>
      </div>
    </section>
  );
}
