import Link from "next/link";

export default function NotFound() {
  return (
    <div className="denied">
      <h1 className="glitch flicker" data-text="FILE NOT FOUND">FILE NOT FOUND</h1>
      <p className="muted">There is no record here. There may never have been.</p>
      <p><Link href="/stories">&lt; return to the archive</Link></p>
    </div>
  );
}
