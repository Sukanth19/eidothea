"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client-api";

/** Overseer only: let someone into /insights, or take them out. */
export function AccessToggle({ userId, username, granted }: { userId: number; username: string; granted: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function toggle() {
    if (!granted && !window.confirm(`Let ${username} see insights? They'll see every member's activity and how they found the site.`)) return;
    setBusy(true);
    setError("");
    try {
      await api(`/api/insights/users/${userId}/access`, { method: "PUT", body: { insights: !granted } });
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
    setBusy(false);
  }

  return (
    <span style={{ display: "inline-flex", gap: ".6rem", alignItems: "center", flexWrap: "wrap" }}>
      <button type="button" className={granted ? "danger" : ""} onClick={toggle} disabled={busy}>
        {granted ? "REVOKE INSIGHTS ACCESS" : "GRANT INSIGHTS ACCESS"}
      </button>
      {error && <span className="msg error">✕ {error}</span>}
    </span>
  );
}
