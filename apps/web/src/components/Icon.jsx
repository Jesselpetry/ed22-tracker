// Small inline icon set (24px grid, stroke-based). No icon font or CDN, so
// the CSP can stay at 'self'.
const ICONS = {
  alert: [["path", { d: "M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" }], ["path", { d: "M12 9v4M12 17h.01" }]],
  auto: [["circle", { cx: 12, cy: 12, r: 9 }], ["path", { d: "M12 3a9 9 0 0 1 0 18z", fill: "currentColor" }]],
  back: [["path", { d: "M19 12H5M12 19l-7-7 7-7" }]],
  cards: [["rect", { x: 3, y: 7, width: 14, height: 14, rx: 2 }], ["path", { d: "M7 3h12a2 2 0 0 1 2 2v12" }]],
  chart: [["path", { d: "M3 21h18M6 17v-5M11 17V7M16 17v-8M21 17V4" }]],
  check: [["path", { d: "M20 6 9 17l-5-5" }]],
  chevron: [["path", { d: "m9 18 6-6-6-6" }]],
  code: [["path", { d: "m16 18 6-6-6-6M8 6l-6 6 6 6" }]],
  doc: [["path", { d: "M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" }], ["path", { d: "M14 3v6h6M8 13h8M8 17h5" }]],
  download: [["path", { d: "M12 3v12M7 10l5 5 5-5M5 21h14" }]],
  eye: [["path", { d: "M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" }], ["circle", { cx: 12, cy: 12, r: 3 }]],
  info: [["circle", { cx: 12, cy: 12, r: 9 }], ["path", { d: "M12 16v-4M12 8h.01" }]],
  lock: [["rect", { x: 4, y: 11, width: 16, height: 10, rx: 2 }], ["path", { d: "M8 11V7a4 4 0 0 1 8 0v4" }]],
  logout: [["path", { d: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" }]],
  moon: [["path", { d: "M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" }]],
  plus: [["path", { d: "M12 5v14M5 12h14" }]],
  refresh: [["path", { d: "M21 12a9 9 0 1 1-2.64-6.36" }], ["path", { d: "M21 3v6h-6" }]],
  search: [["circle", { cx: 11, cy: 11, r: 7 }], ["path", { d: "m21 21-4.3-4.3" }]],
  shield: [["path", { d: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" }]],
  sun: [["circle", { cx: 12, cy: 12, r: 4 }], ["path", { d: "M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" }]],
  trash: [["path", { d: "M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6" }]],
  upload: [["path", { d: "M12 21V9M7 14l5-5 5 5M5 3h14" }]],
  x: [["path", { d: "M18 6 6 18M6 6l12 12" }]],
};

export function Icon({ name, size = 20, className = "" }) {
  return (
    <svg
      className={`icon ${className}`.trim()}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {ICONS[name].map(([Tag, props], i) => <Tag key={i} {...props} />)}
    </svg>
  );
}
