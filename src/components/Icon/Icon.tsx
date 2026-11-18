/*
 * The site's one icon set: a 20 px box, 1.6 stroke, round caps and joins,
 * drawn in the current text colour. Add a glyph here rather than inlining an
 * SVG somewhere else, so every icon keeps the same weight.
 */
const PATHS = {
  'arrow-right': <path d="M4 10h12M11 5l5 5-5 5" />,
  'arrow-down': <path d="M10 4v12M5 11l5 5 5-5" />,
  'arrow-up-right': <path d="M6 14l8-8M7 6h7v7" />,
  menu: <path d="M3 7h14M3 13h14" />,
  close: <path d="M5 5l10 10M15 5L5 15" />,
  play: <path d="M7 4.5v11l9-5.5z" />,
  search: (
    <>
      <circle cx="9" cy="9" r="5.5" />
      <path d="M13.2 13.2L17 17" />
    </>
  ),
  check: <path d="M4 10.5l4 4 8-9" />,
  copy: (
    <>
      <rect x="7" y="7" width="10" height="10" rx="2" />
      <path d="M13 4.5V4a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h.5" />
    </>
  ),
  download: <path d="M10 3v10M5.5 8.5L10 13l4.5-4.5M4 17h12" />,
  mail: (
    <>
      <rect x="3" y="5" width="14" height="10" rx="2" />
      <path d="M3.5 6.5l6.5 5 6.5-5" />
    </>
  ),
} as const;

export type IconName = keyof typeof PATHS;

export default function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <svg
      className="icon"
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  );
}
