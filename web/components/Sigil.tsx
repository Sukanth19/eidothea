/** No profile pictures here: everyone gets a sigil drawn from their username instead.
 *  The same name always draws the same mark. */

function seeded(text: string) {
  // FNV-1a hash into a mulberry32 generator
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return () => {
    h = (h + 0x6d2b79f5) | 0;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);

export function Sigil({ name, size = 40, className = "" }: { name: string; size?: number; className?: string }) {
  const rand = seeded(name.toLowerCase());
  const points = 5 + Math.floor(rand() * 5); // 5-9
  // Skip over vertices to draw a star; fall back to a polygon when the step doesn't visit them all
  const steps = [2, 3, 4].filter(k => k < points / 2 && gcd(points, k) === 1);
  const step = steps.length ? steps[Math.floor(rand() * steps.length)] : 1;
  const spin = rand() * Math.PI * 2;
  const r = 34;
  const at = (i: number, radius = r) => {
    const a = spin + (i / points) * Math.PI * 2;
    return [Math.cos(a) * radius, Math.sin(a) * radius] as const;
  };

  const star = Array.from({ length: points }, (_, i) => at((i * step) % points).map(v => v.toFixed(1)).join(",")).join(" ");
  const tickCount = points * (rand() < 0.5 ? 1 : 2);
  const ticks = Array.from({ length: tickCount }, (_, i) => {
    const a = spin + (i / tickCount) * Math.PI * 2;
    return [Math.cos(a) * 42, Math.sin(a) * 42, Math.cos(a) * 48, Math.sin(a) * 48];
  });
  const inner = rand() < 0.6;
  const centre = Math.floor(rand() * 3); // dot, eye or line
  const mark = Math.floor(rand() * points);
  const [mx, my] = at(mark);

  return (
    <svg className={`sigil ${className}`} width={size} height={size} viewBox="-50 -50 100 100" aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round">
        <circle r="42" />
        {inner && <circle r="20" opacity=".6" />}
        <polygon points={star} />
        {ticks.map(([x1, y1, x2, y2], i) => <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} />)}
        {centre === 1 && <path d="M-10 0 Q0 -8 10 0 Q0 8 -10 0 Z" />}
        {centre === 2 && <line x1="0" y1="-12" x2="0" y2="12" />}
      </g>
      {centre === 0 && <circle r="4" fill="currentColor" />}
      {centre === 1 && <circle r="2.6" fill="var(--red)" />}
      <circle cx={mx} cy={my} r="4.5" fill="var(--red)" />
    </svg>
  );
}
