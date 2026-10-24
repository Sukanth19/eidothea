// Re-mounts on every navigation, so each page fades in out of the static.
// A CSS animation rather than Motion so the page is visible even before JS loads.
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-in">{children}</div>;
}
