"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { rememberLanding } from "@/lib/landing";

/**
 * Counts a page view on every navigation for /insights. Sends only the path and where the
 * visit came from; the server keeps a daily-salted hash instead of the visitor's IP.
 */
export function Tracker() {
  const pathname = usePathname();
  const first = useRef(true);

  useEffect(() => {
    const url = new URL(location.href);
    const ref = url.searchParams.get("ref");
    const referrer = first.current ? document.referrer : "";
    if (first.current) rememberLanding(ref, referrer);
    first.current = false;

    const body = JSON.stringify({ path: pathname, source: ref ?? undefined, referrer: referrer || undefined });
    try {
      if (!navigator.sendBeacon?.("/api/hit", new Blob([body], { type: "application/json" }))) {
        void fetch("/api/hit", { method: "POST", body, headers: { "content-type": "application/json" }, keepalive: true });
      }
    } catch {}

    // The tag has done its job; keep shared links clean
    if (ref) {
      url.searchParams.delete("ref");
      history.replaceState(history.state, "", url.pathname + url.search + url.hash);
    }
  }, [pathname]);

  return null;
}
