"use client";

import { MotionConfig } from "motion/react";
import { createContext, useContext, useEffect, useState } from "react";

const FX_KEY = "eidothea.fx";
const CALLED_KEY = "eidothea.called";

const FxContext = createContext<{ fx: boolean; toggle: () => void }>({ fx: true, toggle: () => {} });
export const useFx = () => useContext(FxContext);

/** Overlays, cursor candlelight, the lights failing now and then, and the global FX switch. */
export function Atmosphere({ children }: { children: React.ReactNode }) {
  const [fx, setFx] = useState(true);

  useEffect(() => {
    try {
      if (localStorage.getItem(FX_KEY) === "off") setFx(false);
    } catch {}
  }, []);

  useEffect(() => {
    document.documentElement.dataset.fx = fx ? "on" : "off";
    try {
      localStorage.setItem(FX_KEY, fx ? "on" : "off");
    } catch {}
  }, [fx]);

  // Candlelight follows the cursor via CSS variables (no re-renders)
  useEffect(() => {
    if (!fx) return;
    const root = document.documentElement;
    const move = (e: PointerEvent) => {
      root.style.setProperty("--mx", `${e.clientX}px`);
      root.style.setProperty("--my", `${e.clientY}px`);
    };
    window.addEventListener("pointermove", move, { passive: true });
    return () => window.removeEventListener("pointermove", move);
  }, [fx]);

  // Now and then the lights nearly go out
  useEffect(() => {
    if (!fx) return;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      timer = setTimeout(() => {
        if (!document.hidden) {
          document.documentElement.classList.add("dim");
          setTimeout(() => document.documentElement.classList.remove("dim"), 950);
        }
        schedule();
      }, 15000 + Math.random() * 25000);
    };
    schedule();
    return () => clearTimeout(timer);
  }, [fx]);

  // Leave the tab and, once a session, it asks you to come back
  useEffect(() => {
    if (!fx) return;
    let title = "";
    let timer: ReturnType<typeof setTimeout>;
    const onVisibility = () => {
      clearTimeout(timer);
      if (document.hidden) {
        try {
          if (sessionStorage.getItem(CALLED_KEY)) return;
        } catch {}
        timer = setTimeout(() => {
          title = document.title;
          document.title = "come back…";
          try {
            sessionStorage.setItem(CALLED_KEY, "1");
          } catch {}
        }, 4000);
      } else if (title) {
        document.title = title;
        title = "";
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
      if (title) document.title = title;
    };
  }, [fx]);

  return (
    <FxContext.Provider value={{ fx, toggle: () => setFx(v => !v) }}>
      <MotionConfig reducedMotion={fx ? "user" : "always"}>
        <div className="fx-layer lantern" aria-hidden="true" />
        <div className="fx-layer static" aria-hidden="true" />
        <div className="fx-layer fog" aria-hidden="true" />
        <div className="fx-layer vignette" aria-hidden="true" />
        <div className="fx-layer dark" aria-hidden="true" />
        {children}
      </MotionConfig>
    </FxContext.Provider>
  );
}

export function FxToggle() {
  const { fx, toggle } = useFx();
  return (
    <button type="button" className="link-btn" onClick={toggle} aria-pressed={fx}>
      [FX: {fx ? "ON" : "OFF"}]
    </button>
  );
}
