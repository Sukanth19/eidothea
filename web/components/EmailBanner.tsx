import Link from "next/link";
import { formatDate } from "@/lib/format";
import type { User } from "@/lib/types";
import { ResendButton } from "./AccountForms";

/** Tells a suspended account why it can only read. */
export function SuspendedBanner({ user }: { user: User | null }) {
  if (!user?.suspended_until) return null;
  const when = user.suspended_until.startsWith("9999") ? "until a keeper lifts it" : `until ${formatDate(user.suspended_until)}`;
  return (
    <div className="banner wrap suspended-banner" role="status">
      <span>
        Your account is suspended {when}. You can still read, but not write, comment, rate or report.
        {user.suspended_reason && <> Reason: <b>{user.suspended_reason}</b></>}
      </span>
    </div>
  );
}

/** Nags until the account has a confirmed email. */
export function EmailBanner({ user }: { user: User | null }) {
  if (!user || user.email_verified) return null;
  return (
    <div className="banner wrap" role="status">
      {user.email ? (
        <>
          <span>Confirm your email: we sent a link to <b>{user.email}</b>.</span>
          <ResendButton label="RESEND" />
        </>
      ) : (
        <span>Your account has no email, so a lost password can&apos;t be recovered. <Link href="/me/profile">Add one</Link>.</span>
      )}
    </div>
  );
}
