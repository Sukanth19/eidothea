"use client";

import { useReducedMotion } from "motion/react";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { COMMAND, type Token } from "@/lib/commands";
import { useFx } from "./Atmosphere";

/** Who is reading, for {{reader}}, and whether they've finished this story before, for {{reread}}. */
export const ReaderContext = createContext<{ name?: string; reread: boolean }>({ reread: false });

const GLYPHS = "†‡§¶#%&$@0123456789";

/** Runs once the page is in the browser; until then (and on the server) the command shows its still text. */
function useClient<T>(read: () => T): T | undefined {
  const [value, setValue] = useState<T>();
  // Read once on arrival: a clock that ticks along mid-sentence would be a giveaway
  useEffect(() => setValue(read()), []);
  return value;
}

function hourNow() {
  return new Date().getHours();
}

// Old names some browsers still report for a time zone
const RENAMED: Record<string, string> = { Calcutta: "Kolkata", Saigon: "Ho Chi Minh City", Rangoon: "Yangon", Katmandu: "Kathmandu", Kiev: "Kyiv", Godthab: "Nuuk" };

function place() {
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? "";
  const city = zone.includes("/") && !zone.startsWith("Etc/") ? zone.split("/").pop()!.replace(/_/g, " ") : "";
  return RENAMED[city] ?? (city || "here");
}

function device() {
  const coarse = window.matchMedia?.("(pointer: coarse)").matches;
  if (!coarse) return "computer";
  return Math.min(window.screen.width, window.screen.height) < 600 ? "phone" : "tablet";
}

function daypart(h: number) {
  return h < 5 ? "tonight" : h < 12 ? "this morning" : h < 17 ? "this afternoon" : h < 21 ? "this evening" : "tonight";
}

/** Calls back as the element comes into view (true) and leaves it (false). */
function useInView(onChange: (inView: boolean) => void) {
  const ref = useRef<HTMLSpanElement>(null);
  const cb = useRef(onChange);
  useEffect(() => {
    cb.current = onChange;
  });
  useEffect(() => {
    const el = ref.current;
    if (!el || !("IntersectionObserver" in window)) return;
    // The bottom of the screen doesn't count: on phones the tab bar sits over it
    const io = new IntersectionObserver(([e]) => cb.current(e.isIntersecting), { threshold: 1, rootMargin: "0px 0px -15% 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return ref;
}

function Shift({ first, then }: { first: string; then: string }) {
  const [state, setState] = useState<"first" | "seen" | "then">("first");
  // Seen, then scrolled away: the next time it's looked at, it says something else
  const ref = useInView(inView => setState(s => (inView && s === "first" ? "seen" : !inView && s === "seen" ? "then" : s)));
  return <span ref={ref} className="cmd-shift">{state === "then" ? then : first}</span>;
}

function Vanish({ text }: { text: string }) {
  const [gone, setGone] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const ref = useInView(inView => {
    clearTimeout(timer.current);
    if (inView && !gone) timer.current = setTimeout(() => setGone(true), 3500);
  });
  useEffect(() => () => clearTimeout(timer.current), []);
  return <span ref={ref} className={`cmd-vanish${gone ? " gone" : ""}`} aria-hidden={gone}>{text}</span>;
}

function Glitch({ text }: { text: string }) {
  const [shown, setShown] = useState(text);
  const visible = useRef(false);
  const reduced = useReducedMotion();
  const { fx } = useFx();
  const ref = useInView(inView => {
    visible.current = inView;
  });

  useEffect(() => {
    if (reduced || !fx) return;
    let timer: ReturnType<typeof setTimeout>;
    let frame = 0;
    const schedule = () => {
      timer = setTimeout(() => {
        if (!visible.current || document.hidden) return schedule();
        const start = performance.now();
        const tick = (now: number) => {
          const t = (now - start) / 700;
          if (t >= 1) {
            setShown(text);
            return schedule();
          }
          setShown([...text].map(c => (c !== " " && Math.random() > t ? GLYPHS[Math.floor(Math.random() * GLYPHS.length)] : c)).join(""));
          frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
      }, 2500 + Math.random() * 6000);
    };
    schedule();
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(frame);
      setShown(text);
    };
  }, [text, reduced, fx]);

  return (
    <span ref={ref} className="cmd-glitch" aria-label={text}>
      <span aria-hidden="true">{shown}</span>
    </span>
  );
}

/** One {{command}} in a story, played out for whoever is reading. */
export function LiveToken({ token }: { token: Token }) {
  const { name: reader, reread } = useContext(ReaderContext);
  const hour = useClient(hourNow);
  const local = useClient(() => ({
    // "2:14 AM" whatever the device's own clock style; it reads better in a story
    time: new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }),
    day: new Date().toLocaleDateString("en-GB", { weekday: "long" }),
    date: new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long" }),
    place: place(),
    device: device(),
  }));
  const still = COMMAND[token.name].still(token.text, token.alt);
  const text = token.text ?? "";

  switch (token.name) {
    case "reader":
      return <span className="cmd-knows">{reader || still}</span>;
    case "daypart":
      return <span className="cmd-knows">{hour === undefined ? still : daypart(hour)}</span>;
    case "time":
    case "day":
    case "date":
    case "place":
    case "device":
      return <span className="cmd-knows">{local ? local[token.name] : still}</span>;
    case "shift":
      return <Shift first={text} then={token.alt ?? text} />;
    case "vanish":
      return <Vanish text={text} />;
    case "glitch":
      return <Glitch text={text} />;
    case "reread":
      return reread ? <span className="cmd-reread">{text}</span> : null;
    case "night":
      return hour !== undefined && hour < 4 ? <span className="cmd-night">{text}</span> : null;
  }
}

