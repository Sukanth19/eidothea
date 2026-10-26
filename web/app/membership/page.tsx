import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ResendButton } from "@/components/AccountForms";
import { BecomeMember, Invites } from "@/components/Membership";
import { apiGet, currentUser } from "@/lib/server-api";
import type { Application, InviteList } from "@/lib/types";

export const metadata: Metadata = { title: "Membership" };

export default async function MembershipPage() {
  const user = await currentUser();
  if (!user) redirect("/login?next=/membership");

  return (
    <article className="doc">
      <h1 className="flicker">Membership</h1>
      <p className="muted" style={{ maxWidth: "65ch" }}>
        Anyone can read the archive. Members can also write, comment and rate. Keeping that to members keeps out the bots,
        and the people who&apos;d game the rankings.
      </p>

      {user.tier === "unverified" && (
        <div className="ledger profile-form">
          <p style={{ marginTop: 0 }}>First, confirm your email{user.email ? <> (<b>{user.email}</b>)</> : ""}. {!user.email && <Link href="/me/profile">Add one on your profile.</Link>}</p>
          {user.email && <div className="actions"><ResendButton /></div>}
        </div>
      )}

      {user.tier === "reader" && <BecomeMember application={await apiGet<Application>("/api/me/application")} />}

      {user.tier === "member" && (
        <>
          <p className="msg ok">YOU&apos;RE A MEMBER.</p>
          <Invites initial={(await apiGet<InviteList>("/api/me/invites")) ?? { left: 0, invites: [] }} />
        </>
      )}
    </article>
  );
}
