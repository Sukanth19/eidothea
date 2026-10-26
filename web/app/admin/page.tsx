import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { UserTable } from "@/components/UserTable";
import { apiGet, currentUser } from "@/lib/server-api";
import { ROLE_LEVEL, type ManagedUser, type Role } from "@/lib/types";

export const metadata: Metadata = { title: "Control" };

export default async function AdminPage() {
  const user = await currentUser();
  if (!user) redirect("/login?next=/admin");
  if (ROLE_LEVEL[user.role] < ROLE_LEVEL.admin) {
    return (
      <div className="denied">
        <h1 className="haunt" data-text="YOU SHOULDN'T BE HERE">YOU SHOULDN&apos;T BE HERE</h1>
        <p className="muted">Admins and the Overseer only.</p>
        <p><Link href="/stories">← back to the archive</Link></p>
      </div>
    );
  }

  const data = await apiGet<{ users: ManagedUser[]; assignable_roles: Role[] }>("/api/users");

  return (
    <>
      <h1 className="flicker">Control room</h1>
      <p className="muted" style={{ maxWidth: "72ch" }}>
        Moderators and admins can edit or delete any story. Admins can promote users to moderator and remove accounts below them.
        {user.role === "overseer" && " As Overseer you can also appoint admins."} Suspending someone stops them posting for a while
        and keeps what they wrote; removing an account also deletes its stories.
      </p>
      <UserTable users={data?.users ?? []} assignable={data?.assignable_roles ?? []} meId={user.id} />
    </>
  );
}
