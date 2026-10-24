import Link from "next/link";

/** Plain links, so it works without JS and in server components. */
export function Pagination({ page, pages, params }: { page: number; pages: number; params: Record<string, string> }) {
  if (pages <= 1) return null;

  const href = (p: number) => {
    const qs = new URLSearchParams(params);
    if (p > 1) qs.set("page", String(p));
    else qs.delete("page");
    const s = qs.toString();
    return s ? `?${s}` : "?";
  };

  // 1 … 4 5 [6] 7 8 … 40
  const nums = new Set([1, pages, page - 2, page - 1, page, page + 1, page + 2].filter(n => n >= 1 && n <= pages));
  const sorted = [...nums].sort((a, b) => a - b);

  return (
    <nav className="pager" aria-label="Pages">
      {page > 1 && <Link href={href(page - 1)}>&lt; PREV</Link>}
      {sorted.map((n, i) => (
        <span key={n} style={{ display: "contents" }}>
          {i > 0 && n - sorted[i - 1] > 1 && <span className="gap">…</span>}
          {n === page ? <span className="current" aria-current="page">{n}</span> : <Link href={href(n)}>{n}</Link>}
        </span>
      ))}
      {page < pages && <Link href={href(page + 1)}>NEXT &gt;</Link>}
    </nav>
  );
}
