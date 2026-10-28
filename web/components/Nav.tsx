"use client";

import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/client-api";
import { ROLE_LABEL, ROLE_LEVEL, type User } from "@/lib/types";
import { Icon, type IconName } from "./Icon";
import { Bell, useUnread } from "./Notifications";
import { ScrambleText } from "./ScrambleText";

type NavLink = { href: string; label: string };
type Tab = NavLink & { icon: IconName; short: string };

// Longest matching prefix wins, so /stories/new doesn't also light up /stories
function activeHref(links: NavLink[], pathname: string) {
  return links
    .filter(l => pathname === l.href || pathname.startsWith(l.href + "/"))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
}

export function Nav({ user }: { user: User | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const [account, setAccount] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [tucked, setTucked] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);
  const unread = useUnread(user?.unread ?? 0);

  // Close menus after navigating
  useEffect(() => {
    setAccount(false);
    setSheet(false);
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

  useEffect(() => {
    if (!sheet) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setSheet(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sheet]);

  // The phone tab bar tucks away while reading down the page and comes back on the way up,
  // or at the very end where the rating and comments are
  useEffect(() => {
    let last = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      const atEnd = window.innerHeight + y >= document.documentElement.scrollHeight - 80;
      if (y < 80 || atEnd) setTucked(false);
      else if (y - last > 8) setTucked(true);
      else if (last - y > 8) setTucked(false);
      else return;
      last = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  useEffect(() => setTucked(false), [pathname]);

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

  // The phone tab bar: the same places, each with an icon and a word short enough for a thumb
  const tabs: Tab[] = [
    { href: "/stories", label: "ARCHIVE", short: "ARCHIVE", icon: "archive" },
    { href: "/prompts", label: "PROMPTS", short: "PROMPTS", icon: "feather" },
  ];
  if (!user) tabs.push({ href: "/login", label: "LOG IN", short: "LOG IN", icon: "login" }, { href: "/register", label: "JOIN", short: "JOIN", icon: "join" });
  else if (user.member) tabs.push({ href: "/stories/new", label: "WRITE", short: "WRITE", icon: "pen" });
  else tabs.push({ href: "/membership", label: "BECOME A MEMBER", short: "MEMBER", icon: "join" });

  const active = activeHref([...links, ...yours, ...staff, ...tabs], pathname);
  const inAccount = [...yours, ...staff].some(l => l.href === active);
  const rank = user ? (user.role !== "user" ? ROLE_LABEL[user.role].toUpperCase() : user.tier === "unverified" ? "UNCONFIRMED" : user.tier.toUpperCase()) : "";

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
        <nav className="nav" aria-label="Main">
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
              <Bell count={unread} />
              <div className="account" ref={accountRef}>
                <button
                  type="button"
                  className={`account-toggle link-btn${inAccount ? " active" : ""}`}
                  onClick={() => setAccount(a => !a)}
                  aria-expanded={account}
                  aria-controls="account-menu"
                >
                  <span className="whoami">
                    <b>{rank}</b> {user.username}
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

      {/* Phones: everything within reach of the thumb holding the phone */}
      <div className={`tabbar${tucked && !sheet ? " tucked" : ""}`}>
        {/* Pages with their own controls (the reader's text size) put them here */}
        <div id="dock-slot" />
        <nav className="tabs" aria-label="Main">
          {tabs.map(t => (
            <Link key={t.href} href={t.href} className={`tab${active === t.href ? " active" : ""}`}>
              <Icon name={t.icon} size={22} />
              <span className="tab-label">{t.short}</span>
            </Link>
          ))}
          {user && (
            <>
              <Bell count={unread} label="ALERTS" />
              <button type="button" className={`tab link-btn${inAccount || sheet ? " active" : ""}`} onClick={() => setSheet(o => !o)} aria-expanded={sheet} aria-controls="you-sheet">
                <Icon name="user" size={22} />
                <span className="tab-label">YOU</span>
              </button>
            </>
          )}
        </nav>
      </div>

      <AnimatePresence>
        {user && sheet && (
          <>
            <motion.div className="scrim" onClick={() => setSheet(false)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
            <motion.div
              id="you-sheet"
              className="you-sheet"
              role="dialog"
              aria-label="Your pages"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 420, damping: 40 }}
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.6 }}
              onDragEnd={(_, info) => (info.offset.y > 80 || info.velocity.y > 500) && setSheet(false)}
            >
              <div className="sheet-grip" aria-hidden="true" />
              <p className="whoami"><b>{rank}</b> {user.username}</p>
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
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </header>
  );
}
