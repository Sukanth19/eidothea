const PATHS = {
  back: ["m15 18-6-6 6-6"],
  undo: ["M9 14 4 9l5-5", "M4 9h10.5a5.5 5.5 0 0 1 0 11H11"],
  redo: ["m15 14 5-5-5-5", "M20 9H9.5a5.5 5.5 0 0 0 0 11H13"],
  bold: ["M6 12h9a4 4 0 0 1 0 8H6V4h8a4 4 0 0 1 0 8"],
  italic: ["M19 4h-9", "M14 20H5", "M15 4 9 20"],
  underline: ["M6 4v6a6 6 0 0 0 12 0V4", "M4 20h16"],
  strike: ["M16 4H9a3 3 0 0 0-2.83 4", "M14 12a4 4 0 0 1 0 8H6", "M4 12h16"],
  quote: ["M17 6H3", "M21 12H8", "M21 18H8", "M3 12v6"],
  dash: ["M4 12h16"],
  scene: ["M5 12h.01", "M12 12h.01", "M19 12h.01"],
  clear: ["M4 7V4h16v3", "M5 20h6", "M13 4 8 20", "m15 15 5 5", "m20 15-5 5"],
  sliders: ["M21 4h-7", "M10 4H3", "M21 12h-9", "M8 12H3", "M21 20h-5", "M12 20H3", "M14 2v4", "M8 10v4", "M16 18v4"],
  eye: ["M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z", "M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0"],
  close: ["M18 6 6 18", "m6 6 12 12"],
  up: ["M7 10v12", "M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z"],
  down: ["M17 14V2", "M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88Z"],
};

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={name === "scene" ? 3.2 : 2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[name].map(d => <path key={d} d={d} />)}
    </svg>
  );
}
