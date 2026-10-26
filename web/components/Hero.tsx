"use client";

import Link from "next/link";
import { ScrambleText } from "./ScrambleText";
import { Typewriter } from "./Typewriter";
import { Whisper } from "./Whisper";

const LINES = [
  "3,000+ stories recovered from the dark corners of the internet.",
  "Some of them are true. We stopped checking which.",
  "Read with the lights on. Or don't.",
  "If you hear knocking, do not knock back.",
];

export function Hero({ loggedIn }: { loggedIn: boolean }) {
  return (
    <Whisper className="hero" message={<>IT KNOWS<br />YOU&apos;RE READING</>}>
      <div className="kicker rise" style={{ "--i": 4 } as React.CSSProperties}>
        RECOVERED FROM THE STACKS
      </div>
      <h1>
        <ScrambleText text="EIDOTHEA" duration={1400} haunt />
      </h1>
      <Typewriter lines={LINES} />
      <div className="actions rise" style={{ "--i": 12 } as React.CSSProperties}>
        <Link href="/stories" className="btn">ENTER THE ARCHIVE</Link>
        <Link href="/random" className="btn ghost" prefetch={false}>READ SOMETHING RANDOM</Link>
        <Link href={loggedIn ? "/stories/new" : "/register"} className="btn danger">
          {loggedIn ? "SUBMIT A STORY" : "JOIN AND WRITE"}
        </Link>
      </div>
    </Whisper>
  );
}
