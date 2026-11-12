/**
 * The footer's illustration: a cartographer in the field, at a plane table,
 * sighting along the alidade to a flagged ranging pole on the next rise.
 *
 * An original drawing in the icons' own stroke (1.6, round caps and joins),
 * so it reads as part of the same hand. Three layers at three distances; the
 * stylesheet lets the far ones drift a little as the footer scrolls in. The
 * flag is the one accent detail.
 *
 * Decoration only: hidden from assistive tech, no text.
 */
export default function FieldCartographer() {
  return (
    <svg
      className="field-cartographer"
      viewBox="0 0 1440 320"
      // Anchored to the ground line; a narrow footer crops the sides, never the figure.
      preserveAspectRatio="xMidYMax slice"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {/* Far: two ridges closing the distance. */}
      <g className="field-cartographer__far">
        <path d="M0 132 C110 108 190 84 292 104 S452 140 548 100 S742 58 856 92 S1042 142 1150 102 S1338 76 1440 112" />
        <path d="M0 168 C150 146 262 154 380 140 S612 146 724 130 S958 146 1082 134 S1322 144 1440 154" />
      </g>

      {/* Mid: the rise with the ranging pole, a second rise to the left, and the line of sight. */}
      <g className="field-cartographer__mid">
        <path d="M724 262 C812 222 904 210 992 212 S1190 228 1316 262" />
        <path d="M800 262 C864 236 928 226 992 228 S1136 240 1232 262" />
        <path d="M872 262 C912 248 954 242 994 243 S1090 250 1150 262" />
        <path d="M36 268 C128 240 232 232 326 238 S470 252 540 268" />
        <path d="M116 268 C186 252 256 246 326 250 S424 258 468 268" />
        {/* The ranging pole: banded, standing on the crown of the rise. */}
        <path d="M986 243 V146 M981 176 h10 M981 208 h10" />
        <path className="field-cartographer__accent" d="M986 146 l22 8 l-22 8 z" />
        {/* Line of sight from the alidade to the pole. */}
        <path d="M698 160 L972 156" strokeDasharray="1 9" />
      </g>

      {/* Near: the ground, the plane table on its tripod, and the cartographer. */}
      <g className="field-cartographer__near">
        <path d="M0 292 C196 282 372 298 556 290 S896 282 1098 294 S1318 298 1440 290" />
        <path d="M0 310 C236 302 420 316 640 308 S1004 300 1440 312" />

        {/* Drawn small and set half again as large, about the point where the tripod meets the ground. */}
        <g transform="translate(620 292) scale(1.45) translate(-620 -292)">
        {/* Tripod and table. */}
        <path d="M640 212 L612 290 M640 212 L642 292 M640 212 L670 290" />
        <path d="M604 206 h74 v6 h-74 z" />
        {/* Alidade with its two sights. */}
        <path d="M618 201 h54 M620 201 v-7 M670 201 v-7" />

        {/* The cartographer: hat, head, coat, legs, the arm reaching to the alidade, a satchel. */}
        <path d="M570 166 h30 M576 166 c2 -12 16 -12 18 0" />
        <path d="M578 167 c-2 8 2 14 8 14 s8 -6 7 -14" />
        <path d="M582 182 c-12 10 -18 30 -17 56 h17 c1 -22 4 -40 10 -54" />
        <path d="M590 190 c10 4 20 9 30 11" />
        <path d="M567 238 l-5 52 h-9 M581 238 l5 52 h10" />
        <path d="M570 200 c-10 2 -15 12 -12 26 l10 2" />
        </g>
      </g>
    </svg>
  );
}
