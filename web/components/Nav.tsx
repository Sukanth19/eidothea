"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/client-api";
import { ROLE_LABEL, ROLE_LEVEL, type User } from "@/lib/types";
import { ScrambleText } from "./ScrambleText";

export function Nav({ user }: { user: User | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  // Phones get a menu button instead of the full row of links; close it after navigating
  useEffect(() => setOpen(false), [pathname]);

  const links = [{ href: "/stories", label: "ARCHIVE" }];
  if (user) {
    links.push({ href: "/stories/new", label: "WRITE" }, { href: "/me", label: "MY STORIES" });
    if (ROLE_LEVEL[user.role] >= ROLE_LEVEL.admin) links.push({ href: "/admin", label: "CONTROL" });
    if (user.insights) links.push({ href: "/insights", label: "INSIGHTS" });
  }

  // Longest matching prefix wins, so /stories/new doesn't also light up /stories
  const active = links
    .filter(l => pathname === l.href || pathname.startsWith(l.href + "/"))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  async function logout() {
    await api("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  return (
    <header className="site-header">
      <div className="wrap">
        <Link href="/" className="logo flicker">
          <ScrambleText text="EIDOTHEA" />
        </Link>
        <button type="button" className="menu-btn link-btn" onClick={() => setOpen(o => !o)} aria-expanded={open} aria-controls="main-nav">
          {open ? "CLOSE" : "MENU"}
        </button>
        <nav id="main-nav" className={`nav${open ? " open" : ""}`} aria-label="Main">
          {links.map(l => (
            <Link key={l.href} href={l.href} className={active === l.href ? "active" : ""}>
              {l.label}
              {active === l.href && (
                <motion.span layoutId="nav-underline" className="underline" transition={{ type: "spring", stiffness: 500, damping: 35 }} />
              )}
            </Link>
          ))}
          {user ? (
            <>
              <span className="whoami">
                <b>{ROLE_LABEL[user.role].toUpperCase()}</b> {user.username}
              </span>
              <button type="button" className="link-btn" onClick={logout}>
                [LOG OUT]
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className={pathname === "/login" ? "active" : ""}>LOG IN</Link>
              <Link href="/register" className={pathname === "/register" ? "active" : ""}>JOIN</Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
