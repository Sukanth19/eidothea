"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import type { Category } from "@/lib/types";

// One-click shortcuts shown above the toolbar; video games first, as asked
const QUICK = [
  { label: "VIDEO GAMES", category: "Video Games and Gaming" },
  { label: "ORIGINAL CRYPTIDS", category: "Original Cryptids" },
  { label: "ANOMALY FILES", category: "Anomaly Files" },
  { label: "CRYPTIDS", category: "Monsters, Creatures, and Cryptids" },
  { label: "GHOSTS", category: "Ghosts and Spirits" },
  { label: "ENTITIES", category: "Beings and Entities" },
  { label: "THE INTERNET", category: "Technology, the Internet, and the Deep Web" },
  { label: "RITUALS", category: "Rites and Rituals" },
];

export function Filters({ categories }: { categories: Category[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [pending, startTransition] = useTransition();

  function update(changes: Record<string, string>) {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(changes)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    next.delete("page"); // any filter change starts from page 1
    startTransition(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }));
  }

  // Debounce typing so we don't hit the API on every keystroke
  useEffect(() => {
    if (q === (params.get("q") ?? "")) return;
    const t = setTimeout(() => update({ q }), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const current = params.get("category") ?? "";
  const known = new Set(categories.map(c => c.name));

  return (
    <>
      <div className="chips quick" role="group" aria-label="Quick filters">
        {QUICK.filter(f => known.has(f.category)).map(f => (
          <button
            type="button"
            key={f.category}
            className={`chip${current === f.category ? " on" : ""}`}
            aria-pressed={current === f.category}
            onClick={() => update({ category: current === f.category ? "" : f.category })}
          >
            {f.label}
          </button>
        ))}
      </div>
      <div className="toolbar" style={{ opacity: pending ? 0.6 : 1, transition: "opacity .2s" }}>
        <input
          type="search"
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="search title, tag or author"
          aria-label="Search stories"
        />
        <select value={params.get("category") ?? ""} onChange={e => update({ category: e.target.value })} aria-label="Category">
          <option value="">ALL CATEGORIES</option>
          {categories.map(c => (
            <option key={c.name} value={c.name}>
              {c.name} ({c.count})
            </option>
          ))}
        </select>
        <select value={params.get("sort") ?? "new"} onChange={e => update({ sort: e.target.value === "new" ? "" : e.target.value })} aria-label="Sort">
          <option value="new">NEWEST</option>
          <option value="rating">HIGHEST RATED</option>
          <option value="short">SHORTEST</option>
          <option value="long">LONGEST</option>
        </select>
        <select value={params.get("source") ?? "all"} onChange={e => update({ source: e.target.value === "all" ? "" : e.target.value })} aria-label="Source">
          <option value="all">ALL SOURCES</option>
          <option value="user">COMMUNITY ONLY</option>
          <option value="import">CLASSIC ARCHIVE</option>
        </select>
      </div>
    </>
  );
}
