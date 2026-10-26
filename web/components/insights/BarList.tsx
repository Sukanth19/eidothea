/** A ranked list with a bar per row. Magnitude only, so one hue; the label carries identity. */
export function BarList({ rows, unit, empty = "Nothing yet." }: { rows: { label: React.ReactNode; key: string; value: number }[]; unit: string; empty?: string }) {
  if (!rows.length) return <p className="muted">{empty}</p>;
  const max = Math.max(...rows.map(r => r.value), 1);
  return (
    <ul className="bar-list">
      {rows.map(r => (
        <li key={r.key} title={`${r.value} ${unit}`}>
          <span className="bar-label">{r.label}</span>
          <span className="bar-value">{r.value}</span>
          <span className="bar-track"><i style={{ width: `${(r.value / max) * 100}%` }} /></span>
        </li>
      ))}
    </ul>
  );
}
