"use client";

import { useState } from "react";
import { api } from "@/lib/client-api";
import { formatDate } from "@/lib/format";

const FOREVER = "9999-12-31 00:00:00";
const LENGTHS: [string, number | null][] = [["1 day", 1], ["3 days", 3], ["1 week", 7], ["30 days", 30], ["until lifted", null]];

export function suspendedText(until: string): string {
  return until === FOREVER ? "SUSPENDED UNTIL LIFTED" : `SUSPENDED UNTIL ${formatDate(until)}`;
}

/** Suspend someone (they keep reading, stop posting) or lift it. For keepers who outrank them. */
export function SuspendControl({ userId, username, until: initial }: { userId: number; username: string; until: string | null }) {
  const [until, setUntil] = useState(initial);
  const [open, setOpen] = useState(false);
  const [days, setDays] = useState<string>("7");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  async function run(method: "PUT" | "DELETE") {
    setError("");
    try {
      const body = method === "PUT" ? { days: days === "" ? null : Number(days), reason } : undefined;
      const r = await api<{ suspended_until: string | null }>(`/api/users/${userId}/suspension`, { method, body });
      setUntil(r.suspended_until);
      setOpen(false);
      setReason("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  if (until) {
    return (
      <span className="report-actions">
        <span className="caps suspended">{suspendedText(until)}</span>
        <button type="button" className="ghost" onClick={() => run("DELETE")}>LIFT</button>
        {error && <span className="msg error">{error}</span>}
      </span>
    );
  }
  if (!open) return <button type="button" className="ghost" onClick={() => setOpen(true)}>SUSPEND {username.toUpperCase()}</button>;
  return (
    <span className="report-form">
      <select value={days} onChange={e => setDays(e.target.value)} aria-label="How long">
        {LENGTHS.map(([label, d]) => <option key={label} value={d ?? ""}>{label}</option>)}
      </select>
      <input value={reason} onChange={e => setReason(e.target.value)} maxLength={300} placeholder="Reason (they'll see it)" aria-label="Reason" />
      <span className="report-actions">
        <button type="button" className="danger" onClick={() => run("PUT")}>SUSPEND</button>
        <button type="button" className="ghost" onClick={() => setOpen(false)}>CANCEL</button>
      </span>
      {error && <span className="msg error">{error}</span>}
    </span>
  );
}
