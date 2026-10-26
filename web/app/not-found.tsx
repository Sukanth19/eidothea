import Link from "next/link";

export default function NotFound() {
  return (
    <div className="denied">
      <h1 className="haunt flicker" data-text="NOTHING IS HERE">NOTHING IS HERE</h1>
      <p className="muted">There is no record here. There may never have been.</p>
      <p><Link href="/stories">← return to the archive</Link></p>
    </div>
  );
}
