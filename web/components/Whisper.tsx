"use client";

import { useRef } from "react";

/** A block with writing hidden on the wall behind it, visible only where the cursor's light falls. */
export function Whisper({ message, className = "", children }: { message: React.ReactNode; className?: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  function light(x: string, y: string) {
    ref.current!.style.setProperty("--x", x);
    ref.current!.style.setProperty("--y", y);
  }

  function onMove(e: React.PointerEvent) {
    const r = ref.current!.getBoundingClientRect();
    light(`${e.clientX - r.left}px`, `${e.clientY - r.top}px`);
  }

  return (
    <div ref={ref} className={`whisper ${className}`} onPointerMove={onMove} onPointerLeave={() => light("-999px", "-999px")}>
      <div className="flashlight" aria-hidden="true">{message}</div>
      {children}
    </div>
  );
}
