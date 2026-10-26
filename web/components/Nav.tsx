"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/client-api";
import { ROLE_LABEL, ROLE_LEVEL, type User } from "@/lib/types";
import { Bell } from "./Notifications";
import { ScrambleText } from "./ScrambleText";

type NavLink = { href: string; label: string };

// Longest matching prefix wins, so /stories/new doesn't also light up /stories
function activeHref(links: NavLink[], pathname: string) {
  return links
    .filter(l => pathname === l.href || pathname.startsWith(l.href + "/"))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
}

export function Nav({ user }: { user: User | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [account, setAccount] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);

  // Phones get a menu button instead of the full row of links; close menus after navigating
  useEffect(() => {
    setOpen(false);
    setAccount(false);
  }, [pathname]);

  // The account menu closes on a click elsewhere or Escape
  useEffect(() => {
    if (!account) return;
    const onClick = (e: MouseEvent) => {
      if (!accountRef.current?.contains(e.target as Node)) setAccount(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAccount(false);
    };
    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [account]);

  // The main row stays short; everything about you and your role lives under your name
  const links: NavLink[] = [{ href: "/stories", label: "ARCHIVE" }, { href: "/prompts", label: "PROMPTS" }];
  const yours: NavLink[] = [];
  const staff: NavLink[] = [];
  if (user) {
    if (user.member) {
      links.push({ href: "/stories/new", label: "WRITE" });
      yours.push({ href: "/me", label: "MY STORIES" }, { href: "/me/stats", label: "STATS" });
    } else {
      links.push({ href: "/membership", label: "BECOME A MEMBER" });
    }
    yours.push({ href: "/saved", label: "SAVED" }, { href: "/me/profile", label: "PROFILE" });
    if (ROLE_LEVEL[user.role] >= ROLE_LEVEL.mod) staff.push({ href: "/mod", label: "KEEPERS" });
    if (ROLE_LEVEL[user.role] >= ROLE_LEVEL.admin) staff.push({ href: "/admin", label: "CONTROL" });
    if (user.insights) staff.push({ href: "/insights", label: "INSIGHTS" });
  }

  const active = activeHref([...links, ...yours, ...staff], pathname);
  const inAccount = [...yours, ...staff].some(l => l.href === active);

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
              <Bell initial={user.unread ?? 0} />
              <div className="account" ref={accountRef}>
                <button
                  type="button"
                  className={`account-toggle link-btn${inAccount ? " active" : ""}`}
                  onClick={() => setAccount(a => !a)}
                  aria-expanded={account}
                  aria-controls="account-menu"
                >
                  <span className="whoami">
                    <b>{user.role !== "user" ? ROLE_LABEL[user.role].toUpperCase() : user.tier === "unverified" ? "UNCONFIRMED" : user.tier.toUpperCase()}</b> {user.username}
                  </span>
                  <span className="caret-down" aria-hidden="true">▾</span>
                </button>
                <div id="account-menu" className={`account-menu${account ? " open" : ""}`}>
                  {[yours, staff].filter(g => g.length).map((group, i) => (
                    <div key={i} className="account-group">
                      {group.map(l => (
                        <Link key={l.href} href={l.href} className={active === l.href ? "active" : ""}>{l.label}</Link>
                      ))}
                    </div>
                  ))}
                  <div className="account-group">
                    <button type="button" className="link-btn" onClick={logout}>LOG OUT</button>
                  </div>
                </div>
              </div>
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
