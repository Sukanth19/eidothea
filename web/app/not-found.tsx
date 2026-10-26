import Link from "next/link";
import { Whisper } from "@/components/Whisper";

export default function NotFound() {
  return (
    <Whisper className="denied lost" message={<>WE TOOK IT<br />YOU&apos;RE NEXT</>}>
      <h1 className="haunt flicker" data-text="NOTHING IS HERE">NOTHING IS HERE</h1>
      <p className="muted">There is no record here. There may never have been.</p>
      <p><Link href="/stories">← return to the archive</Link></p>
    </Whisper>
  );
}
