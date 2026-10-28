"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/client-api";
import { formatDate } from "@/lib/format";
import type { Notification } from "@/lib/types";
import { Icon } from "./Icon";
import { Sigil } from "./Sigil";

function Text({ n }: { n: Notification }) {
  const who = n.actor ? <Link href={`/u/${encodeURIComponent(n.actor)}`}><b>{n.actor}</b></Link> : <b>Someone</b>;
  const story = n.story_id ? <Link href={`/stories/${n.story_id}`}>{n.story_title || "your story"}</Link> : null;
  const there = n.story_id ? <Link href={`/stories/${n.story_id}${n.comment_id ? `#c${n.comment_id}` : ""}`}>{n.story_title || "a story"}</Link> : null;
  switch (n.kind) {
    case "follow": return <>{who} started following you.</>;
    case "story": return <>{who} published {story}.</>;
    case "comment": return <>{who} commented on {there}.</>;
    case "reply": return <>{who} replied to you on {there}.</>;
    case "mention": return <>{who} mentioned you on {there}.</>;
    case "recommend": return <>{who} recommended {story}.</>;
    case "invite_used": return <>{who} joined with your invite.</>;
    case "member": return <>You&apos;re a member now. You can <Link href="/stories/new">write</Link>, comment and rate.</>;
    case "suspended": return <>A keeper suspended your account. You can still read; the notice at the top of the page says until when.</>;
    case "rejected": return <>Your membership request wasn&apos;t accepted this time. <Link href="/membership">You can ask again in a week</Link>.</>;
  }
}

/** The list on /notifications. Opening it marks everything read. */
export function NotificationList({ items }: { items: Notification[] }) {
  useEffect(() => {
    if (items.some(n => !n.read)) {
      api("/api/notifications/read", { method: "POST" }).then(() => window.dispatchEvent(new Event("eidothea:read"))).catch(() => {});
    }
  }, [items]);

  if (items.length === 0) return <p className="empty">NOTHING YET. FOLLOW A FEW WRITERS AND THE ARCHIVE WILL START TALKING.</p>;
  return (
    <ul className="notes">
      {items.map(n => (
        <li key={n.id} className={n.read ? "" : "unread"}>
          {n.actor ? <Sigil name={n.actor} size={30} /> : <span className="sigil-gap" />}
          <span className="note-text"><Text n={n} /></span>
          <span className="caps muted">{formatDate(n.created_at)}</span>
        </li>
      ))}
    </ul>
  );
}

/** Unread count, refreshed every minute and on every page change. */
export function useUnread(initial: number) {
  const pathname = usePathname();
  const [count, setCount] = useState(initial);

  useEffect(() => {
    let live = true;
    const check = () => {
      if (document.hidden) return;
      api<{ unread: number }>("/api/notifications/unread").then(r => live && setCount(r.unread)).catch(() => {});
    };
    check();
    const timer = setInterval(check, 60000);
    const cleared = () => setCount(0);
    window.addEventListener("eidothea:read", cleared);
    return () => {
      live = false;
      clearInterval(timer);
      window.removeEventListener("eidothea:read", cleared);
    };
  }, [pathname]);

  return count;
}

/** Nav link with the unread count; `label` adds a caption under it in the phone tab bar. */
export function Bell({ count, label }: { count: number; label?: string }) {
  const pathname = usePathname();
  return (
    <Link href="/notifications" className={`bell${pathname === "/notifications" ? " active" : ""}`} aria-label={count ? `${count} unread notifications` : "Notifications"}>
      <span className="bell-icon">
        <Icon name="bell" size={label ? 22 : 17} />
        {count > 0 && <span className="bell-count">{count > 99 ? "99+" : count}</span>}
      </span>
      {label && <span className="tab-label" aria-hidden="true">{label}</span>}
    </Link>
  );
}
