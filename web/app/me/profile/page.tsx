import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ProfileForm } from "@/components/ProfileForm";
import { apiGet, currentUser } from "@/lib/server-api";
import type { Profile } from "@/lib/types";

export const metadata: Metadata = { title: "Your profile" };

export default async function ProfilePage() {
  const user = await currentUser();
  if (!user) redirect("/login?next=/me/profile");
  const profile = await apiGet<Profile>("/api/me/profile");
  if (!profile) redirect("/login?next=/me/profile");

  return (
    <>
      <p><Link href="/me">&lt; my stories</Link></p>
      <h1 className="flicker">Your profile</h1>
      <p className="muted" style={{ maxWidth: "60ch" }}>All of this is optional. Share as much or as little as you like.</p>
      <ProfileForm initial={profile} />
    </>
  );
}
