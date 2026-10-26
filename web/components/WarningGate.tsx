"use client";

import { useEffect, useState } from "react";
import { WARNING_LABEL, type ContentWarning } from "@/lib/types";

const SKIP_KEY = "eidothea.skip-warnings";

/** Holds a story back behind its content warnings until the reader chooses to go on. */
export function WarningGate({ warnings, children }: { warnings: ContentWarning[]; children: React.ReactNode }) {
  const [open, setOpen] = useState(warnings.length === 0);
  const [skip, setSkip] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(SKIP_KEY) === "1") setOpen(true);
    } catch {}
  }, []);

  if (open) return <>{children}</>;

  function goOn() {
    if (skip) {
      try {
        localStorage.setItem(SKIP_KEY, "1");
      } catch {}
    }
    setOpen(true);
  }

  return (
    <section className="warning-gate" aria-label="Content warnings">
      <h2>BEFORE YOU READ</h2>
      <p className="muted">The writer says this story contains:</p>
      <div className="chips">
        {warnings.map(w => <span key={w} className="chip">{WARNING_LABEL[w]}</span>)}
      </div>
      <button type="button" className="danger" onClick={goOn}>READ ANYWAY</button>
      <label className="check">
        <input type="checkbox" checked={skip} onChange={e => setSkip(e.target.checked)} />
        Don&apos;t hold stories back for warnings again
      </label>
    </section>
  );
}
