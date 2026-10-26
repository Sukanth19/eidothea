import Link from "next/link";
import type { User } from "@/lib/types";

/** Shown in place of anything only members can do. */
export function MembersOnly({ user, what, next }: { user: User | null; what: string; next: string }) {
  if (!user) {
    return <p className="hint"><Link href={`/login?next=${encodeURIComponent(next)}`}>Log in</Link> to {what}. Only members can.</p>;
  }
  if (user.tier === "unverified") {
    return <p className="hint">Confirm your email first, then <Link href="/membership">become a member</Link> to {what}.</p>;
  }
  return <p className="hint">Only members can {what}. <Link href="/membership">Get an invite or join the waiting list</Link>.</p>;
}
