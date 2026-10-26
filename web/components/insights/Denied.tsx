import Link from "next/link";

export function InsightsDenied() {
  return (
    <div className="denied">
      <h1 className="haunt" data-text="YOU SHOULDN'T BE HERE">YOU SHOULDN&apos;T BE HERE</h1>
      <p className="muted">Insights are for the Overseer and the few they let in.</p>
      <p><Link href="/stories">← back to the archive</Link></p>
    </div>
  );
}
