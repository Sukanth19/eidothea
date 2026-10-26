import Link from "next/link";

export function InsightsDenied() {
  return (
    <div className="denied">
      <h1 className="glitch" data-text="ACCESS DENIED">ACCESS DENIED</h1>
      <p className="muted">Insights are for the Overseer and the few they let in.</p>
      <p><Link href="/stories">&lt; back to the archive</Link></p>
    </div>
  );
}
