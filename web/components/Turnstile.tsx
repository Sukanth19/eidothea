"use client";

import { useEffect, useRef } from "react";

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";
const SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

declare global {
  interface Window {
    turnstile?: { render: (el: HTMLElement, opts: Record<string, unknown>) => string; remove: (id: string) => void };
  }
}

export const turnstileEnabled = SITE_KEY !== "";

/** Cloudflare's "are you human" check. Renders nothing unless NEXT_PUBLIC_TURNSTILE_SITE_KEY is set. */
export function Turnstile({ onToken }: { onToken: (token: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!SITE_KEY || !ref.current) return;
    let id: string | undefined;
    const draw = () => {
      if (ref.current && window.turnstile) {
        id = window.turnstile.render(ref.current, { sitekey: SITE_KEY, theme: "dark", callback: onToken, "expired-callback": () => onToken("") });
      }
    };
    if (window.turnstile) draw();
    else {
      let s = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT}"]`);
      if (!s) {
        s = document.createElement("script");
        s.src = SCRIPT;
        s.async = true;
        document.head.appendChild(s);
      }
      s.addEventListener("load", draw);
    }
    return () => {
      if (id && window.turnstile) window.turnstile.remove(id);
    };
  }, [onToken]);

  if (!SITE_KEY) return null;
  return <div ref={ref} className="field" />;
}
