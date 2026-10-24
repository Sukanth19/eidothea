"use client";

import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client-api";

/** Two-step delete: first click arms it, second one burns the story. */
export function DeleteStoryButton({ id, redirectTo = "/me" }: { id: number; redirectTo?: string }) {
  const router = useRouter();
  const [armed, setArmed] = useState(false);
  const [error, setError] = useState("");

  async function destroy() {
    try {
      await api(`/api/stories/${id}`, { method: "DELETE" });
      router.push(redirectTo);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <span style={{ display: "inline-flex", gap: ".5rem", alignItems: "center", flexWrap: "wrap" }}>
      <AnimatePresence mode="wait" initial={false}>
        {armed ? (
          <motion.span key="confirm" style={{ display: "inline-flex", gap: ".5rem" }} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
            <button type="button" className="danger" onClick={destroy}>YES, BURN IT</button>
            <button type="button" className="ghost" onClick={() => setArmed(false)}>KEEP</button>
          </motion.span>
        ) : (
          <motion.span key="arm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <button type="button" className="danger" onClick={() => setArmed(true)}>DELETE</button>
          </motion.span>
        )}
      </AnimatePresence>
      {error && <span className="msg error">{error}</span>}
    </span>
  );
}
