import { plainText } from "./markup";

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

/** "2020-02-20" or "2026-10-24 19:30:00" → "20 FEB 2020" (no timezone shifts). */
export function formatDate(s: string | null | undefined): string {
  if (!s) return "";
  const [y, m, d] = s.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return s;
  return `${String(d).padStart(2, "0")} ${MONTHS[m - 1]} ${y}`;
}

export function excerpt(text: string, max = 220): string {
  const flat = plainText(text).replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  return flat.slice(0, flat.lastIndexOf(" ", max)) + "…";
}

export function readingMinutes(body: string): number {
  const words = body.trim() ? body.trim().split(/\s+/).length : 0;
  return Math.max(1, Math.round(words / 200));
}

/** "2026-10-26 19:30:00" (UTC, from SQLite) → "3h ago". */
export function timeAgo(ts: string | null | undefined, now = Date.now()): string {
  if (!ts) return "never";
  const then = Date.parse(ts.replace(" ", "T") + "Z");
  if (Number.isNaN(then)) return ts;
  const mins = Math.max(0, Math.round((now - then) / 60000));
  if (mins < 5) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return days < 60 ? `${days}d ago` : formatDate(ts);
}
