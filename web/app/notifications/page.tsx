import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { NotificationList } from "@/components/Notifications";
import { apiGet, currentUser } from "@/lib/server-api";
import type { Notification } from "@/lib/types";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const user = await currentUser();
  if (!user) redirect("/login?next=/notifications");
  const data = await apiGet<{ unread: number; items: Notification[] }>("/api/notifications");

  return (
    <article className="doc">
      <h1 className="flicker">Whispers for you</h1>
      <NotificationList items={data?.items ?? []} />
    </article>
  );
}
