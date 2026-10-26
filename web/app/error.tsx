"use client";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="denied">
      <h1 className="haunt flicker" data-text="THE LIGHTS WENT OUT">THE LIGHTS WENT OUT</h1>
      <p className="muted">The archive isn&apos;t answering. Is the API running on port 8000?</p>
      <p className="muted caps" style={{ fontSize: ".95rem" }}>cd api &amp;&amp; .venv/bin/uvicorn app.main:app --reload</p>
      <div className="actions" style={{ justifyContent: "center" }}>
        <button type="button" onClick={reset}>TRY AGAIN</button>
      </div>
    </div>
  );
}
