"use client";

import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client-api";
import { formatDate } from "@/lib/format";
import { ROLE_LABEL, type ManagedUser, type Role } from "@/lib/types";

export function UserTable({ users, assignable, meId }: { users: ManagedUser[]; assignable: Role[]; meId: number }) {
  const router = useRouter();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [armed, setArmed] = useState<number | null>(null);

  async function run(action: () => Promise<unknown>, success: string) {
    try {
      await action();
      setMsg({ ok: true, text: success });
      router.refresh();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : String(e) });
    }
    setArmed(null);
  }

  return (
    <>
      <AnimatePresence mode="wait">
        {msg && (
          <motion.p key={msg.text} className={`msg ${msg.ok ? "ok" : "error"}`} role="status" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            {msg.text.toUpperCase()}
          </motion.p>
        )}
      </AnimatePresence>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Operator</th><th>Role</th><th>Stories</th><th>Joined</th><th></th></tr>
          </thead>
          <tbody>
            <AnimatePresence initial={false}>
              {users.map(u => (
                <motion.tr key={u.id} className={u.id === meId ? "you" : ""} layout exit={{ opacity: 0, x: 40 }}>
                  <td>{u.username}{u.id === meId && " (you)"}</td>
                  <td>
                    {u.can_manage ? (
                      <select
                        value={u.role}
                        aria-label={`Role for ${u.username}`}
                        onChange={e => run(
                          () => api(`/api/users/${u.id}`, { method: "PATCH", body: { role: e.target.value } }),
                          `${u.username} is now ${ROLE_LABEL[e.target.value as Role]}`,
                        )}
                      >
                        {assignable.map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                      </select>
                    ) : (
                      <span className={`role ${u.role}`}>{ROLE_LABEL[u.role].toUpperCase()}</span>
                    )}
                  </td>
                  <td>{u.story_count}</td>
                  <td className="muted">{formatDate(u.created_at)}</td>
                  <td>
                    {u.can_manage && (armed === u.id ? (
                      <span style={{ display: "inline-flex", gap: ".4rem" }}>
                        <button type="button" className="danger" onClick={() => run(() => api(`/api/users/${u.id}`, { method: "DELETE" }), `${u.username} and their stories were removed`)}>CONFIRM</button>
                        <button type="button" className="ghost" onClick={() => setArmed(null)}>NO</button>
                      </span>
                    ) : (
                      <button type="button" className="danger" onClick={() => setArmed(u.id)}>REMOVE</button>
                    ))}
                  </td>
                </motion.tr>
              ))}
            </AnimatePresence>
          </tbody>
        </table>
      </div>
    </>
  );
}
