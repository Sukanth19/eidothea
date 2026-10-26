import Link from "next/link";
import type { User } from "@/lib/types";
import { ResendButton } from "./AccountForms";

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
