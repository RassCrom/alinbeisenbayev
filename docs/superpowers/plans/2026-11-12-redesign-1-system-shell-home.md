# Redesign Plan 1: Design System, Shell and Home

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put the whole site on the new Lamp design system with the new nav, footer shell and loading states, and replace the atlas/landing home with the flat-with-depth home page.

**Architecture:** New tokens replace `src/styles/tokens.css`; a legacy alias block keeps the not-yet-rebuilt pages running on the new values. New shared components live in `src/components/<Name>/<Name>.tsx` like the existing ones. Depth is CSS 3D transforms driven by two CSS variables that a small pointer hook writes; no WebGL and no animation library.

**Tech Stack:** React 18, React Router 6 (`BrowserRouter`), Tailwind 4 via CSS, Vite 5, TypeScript. Added for tests only: vitest 2, jsdom, @testing-library/react.

**Spec:** `docs/superpowers/specs/2026-11-12-site-redesign-design.md`

**Scope:** This is plan 1 of 5 and covers steps 1 and 2 of the spec's order of work. Later plans: (2) works index and work pages, (3) journal, (4) about and contact form, (5) footer illustration, removals and weight pass.

## Global Constraints

- Colours, exactly: `bg #14110f`, `surface #1c1815`, `raised #26201b`, `line #3a3028`, `text #f3ebdf`, `text-2 #b9ac99`, `text-3 #948672`, `accent #f0823c`, `accent-ink #1d0f06`.
- The solid accent fill is used only by the `Work with me` button (and later the form submit). Everything else uses accent as outline, focus ring or active state.
- Geologica only. In redesigned files: no `italic`, no `uppercase`, no `mono-label`, no `font-mono`, no letter-spaced labels, no old `--color-*` tokens.
- Smallest text is 15 px. Body is 18 px, weight 350, line-height 1.55.
- Radius: inner = outer minus padding. Frame 20 / 8 / 12. Small frame 12 / 4 / 8. Buttons and chips are pills.
- Three depth tiers only: `--shadow-rest`, `--shadow-lift`, `--shadow-overlay`. No glows, no decorative gradients or borders.
- Motion tokens: press 120 ms, hover 200 ms, enter 400 ms, page 600 ms, all with `cubic-bezier(0.2, 0.8, 0.2, 1)`. Tilt is at most 6 degrees, fine pointers only. Under `prefers-reduced-motion`: no tilt, no drift, no growing cover.
- Nothing blocks content for more than 400 ms. No WebGL on the home page.
- No new runtime dependency. Icons are local SVG components: 20 px box, 1.6 stroke, round caps and joins, `currentColor`.
- Every image reserves its aspect ratio from known width and height.
- Copy: headlines say what the thing is; one short line under a title at most; no badges or numbers that are not real data.
- Package manager is pnpm. Commit after every task on branch `redesign`.
- After every task with a visible result, send desktop (1440 px) and phone (375 px) screenshots with SendUserFile.

## Review Focus

1. **Fewer than three featured works.** The hero stack and the selected-work grid render what exists and never throw. Test in Task 7.
2. **Touch and coarse pointers.** A tap never leaves a card or the stack stuck in a tilted transform. Test in Task 6.
3. **`prefers-reduced-motion`.** Tilt, hero drift and the cover transition are all off. Test in Task 6.
4. **A returning visitor with `theme=light` in localStorage.** The page renders the Lamp theme, not a half-themed state. Test in Task 2.
5. **Narrow phones (320 px) and long titles.** The nav fits name, button and menu icon with no horizontal scroll; long work titles wrap instead of overflowing. Check in Task 9.

## File Structure

| File | Responsibility |
|---|---|
| `src/styles/tokens.css` | New tokens, plus a legacy alias block for old pages (rewrite) |
| `src/styles/global.css` | Base styles and restyled legacy primitives (modify) |
| `src/utils/contrast.ts` | WCAG contrast ratio of two hex colours (new) |
| `src/utils/motion.ts` | Pointer and reduced-motion checks (new) |
| `src/utils/tilt.ts` | Pure tilt maths (new) |
| `src/hooks/useTilt.ts` | Writes `--rx` / `--ry` on an element from pointer position (new) |
| `src/data/offers.ts` | The five offers (new) |
| `src/data/featured.ts` | Featured works in running order (new) |
| `src/components/Icon/Icon.tsx` | The icon set (new) |
| `src/components/Button/Button.tsx` | Primary and quiet buttons (new) |
| `src/components/Frame/Frame.tsx` | Padded image holder with reserved ratio and skeleton (new) |
| `src/components/Skeleton/Skeleton.tsx` | Loading placeholder (new) |
| `src/components/Nav/Nav.tsx` | Name, three links, CTA, phone sheet (rewrite) |
| `src/components/WorkCard/WorkCard.tsx` | Cover, title, one type line, tilt, cover transition (rewrite) |
| `src/components/HeroStack/HeroStack.tsx` | Up to three covers in perspective (new) |
| `src/components/JournalCard/JournalCard.tsx` | Cover, title, kind (new) |
| `src/components/ContactBand/ContactBand.tsx` | One line and the CTA above the footer (new) |
| `src/components/Footer/Footer.tsx` | Footer shell without the illustration (rewrite) |
| `src/pages/HomePage.tsx` | The new home (rewrite) |
| `src/App.tsx` | Routes, route skeleton, band and footer placement (modify) |
| `scripts/check-budget.mjs` | Fails the build check when home exceeds its budgets (new) |
| Deleted | `src/pages/LandingPage.tsx`, `src/pages/SkillsPage.tsx`, `src/data/skills.json`, `public/images/skills/`, `src/hooks/useTheme.ts`, `src/components/CustomCursor/` |

Tests sit next to their source as `<name>.test.ts(x)`.

---

### Task 1: Branch and test runner

**Files:**
- Modify: `package.json`, `vite.config.ts`
- Create: `src/test/setup.ts`, `src/utils/contrast.ts`, `src/utils/contrast.test.ts`

**Interfaces:**
- Produces: `contrast(hexA: string, hexB: string): number` (WCAG ratio, 1 to 21); `pnpm test` runs vitest once.

- [ ] **Step 1: Commit the Geologica work in progress and branch.** The working tree on `map-awards` has eight modified files that move the site to Geologica. Confirm with Alikhan, commit them as "Switch the site to Geologica", then `git switch -c redesign`. The Map Awards commit is not on `main`, so `redesign` starts from `map-awards`.
- [ ] **Step 2: Add the test tools.** `pnpm add -D vitest@^2 jsdom @testing-library/react`. In `vite.config.ts` import `defineConfig` from `vitest/config` and add `test: { environment: 'jsdom', setupFiles: 'src/test/setup.ts' }`. Add script `"test": "vitest run"`.
- [ ] **Step 3: Write `src/test/setup.ts`.** It stubs `window.matchMedia` (jsdom has none) with a function whose `matches` is read from a module-level `Set<string>` of queries, and exports `setMedia(queries: string[]): void` to fill that set; reset to empty in `afterEach`.
- [ ] **Step 4: Write the failing test.**

```ts
// src/utils/contrast.test.ts
import { expect, it } from 'vitest';
import { contrast } from './contrast';

it('matches known WCAG ratios', () => {
  expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 1);
  expect(contrast('#f3ebdf', '#14110f')).toBeCloseTo(15.9, 1);
  expect(contrast('#14110f', '#f3ebdf')).toBeCloseTo(15.9, 1);
});
```

- [ ] **Step 5: Run `pnpm test`.** Expected: FAIL, `contrast` not found.
- [ ] **Step 6: Implement `contrast` in `src/utils/contrast.ts`** with the WCAG 2 relative-luminance formula.
- [ ] **Step 7: Run `pnpm test` and `pnpm exec tsc --noEmit`.** Expected: both pass.
- [ ] **Step 8: Commit.** `git commit -m "Add vitest and a contrast helper"`

### Task 2: Tokens and single theme

**Files:**
- Rewrite: `src/styles/tokens.css`
- Modify: `index.html` (remove the theme `<script>`; `color-scheme` meta becomes `dark`)
- Delete: `src/hooks/useTheme.ts` (its only user, `Nav.tsx`, is rewritten in Task 5; until then remove the toggle button and the import from `Nav.tsx`)
- Test: `src/styles/tokens.test.ts`

**Interfaces:**
- Produces these custom properties on `:root`:
  - Colour: `--bg --surface --raised --line --text --text-2 --text-3 --accent --accent-ink`
  - Type: `--font`, `--fs-display: clamp(2.5rem, 5.3vw, 4.75rem)`, `--fs-h2: clamp(1.75rem, 2.8vw, 2.5rem)`, `--fs-h3: clamp(1.375rem, 1.8vw, 1.625rem)`, `--fs-body: 1.125rem`, `--fs-small: 1rem`, `--fs-min: 0.9375rem`
  - Space: `--s-1` to `--s-10` = 4, 8, 12, 16, 24, 32, 48, 72, 96, 140 px
  - Radius: `--r-outer: 20px; --frame-pad: 8px; --r-inner: 12px; --r-outer-sm: 12px; --frame-pad-sm: 4px; --r-inner-sm: 8px; --r-pill: 9999px`
  - Depth: `--shadow-rest: 0 1px 2px rgba(0,0,0,.4); --shadow-lift: 0 24px 60px rgba(0,0,0,.55); --shadow-overlay: 0 40px 80px rgba(0,0,0,.6)`
  - Motion: `--t-press: 120ms; --t-hover: 200ms; --t-enter: 400ms; --t-page: 600ms; --ease: cubic-bezier(0.2, 0.8, 0.2, 1)`
  - Layout: `--gutter: clamp(16px, 6.6vw, 96px); --page-max: 1440px`
- Produces a block headed `/* LEGACY ALIASES: delete in plan 5 */` that defines every old name still referenced in `src` (`--color-bg-base`, `--color-text-primary`, `--space-6`, `--radius-lg`, `--font-mono`, the five `-rgb` triplets, and so on) in terms of the new values. Old accents map to `--accent`, old gold to `--text-2`, `--gradient-card` to `var(--surface)`, `--shadow-glow` to `none`.

- [ ] **Step 1: Write the failing test.**

```ts
// src/styles/tokens.test.ts
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { contrast } from '../utils/contrast';

const css = readFileSync('src/styles/tokens.css', 'utf8');
const hex = (n: string) => css.match(new RegExp(`--${n}:\\s*(#[0-9a-f]{6})`, 'i'))![1];
const px = (n: string) => Number(css.match(new RegExp(`--${n}:\\s*(\\d+)px`))![1]);

it('pins the Lamp palette', () => {
  expect(hex('bg')).toBe('#14110f');
  expect(hex('accent')).toBe('#f0823c');
  expect(hex('accent-ink')).toBe('#1d0f06');
});
it.each(['text', 'text-2', 'text-3', 'accent'])('%s clears 4.5:1 on every background', (t) => {
  for (const b of ['bg', 'surface', 'raised']) expect(contrast(hex(t), hex(b))).toBeGreaterThanOrEqual(4.5);
});
it('accent-ink clears 4.5:1 on accent', () => {
  expect(contrast(hex('accent-ink'), hex('accent'))).toBeGreaterThanOrEqual(4.5);
});
it('inner radius is outer minus padding', () => {
  expect(px('r-outer') - px('frame-pad')).toBe(px('r-inner'));
  expect(px('r-outer-sm') - px('frame-pad-sm')).toBe(px('r-inner-sm'));
});
it('has one theme, so a stored theme=light changes nothing', () => {
  expect(css).not.toMatch(/data-theme/);
  expect(readFileSync('index.html', 'utf8')).not.toMatch(/localStorage/);
});
```

- [ ] **Step 2: Run `pnpm test`.** Expected: FAIL on palette and `data-theme`.
- [ ] **Step 3: Rewrite `tokens.css`** with the properties above and the alias block. Find every old name still in use with `grep -rhoE "var\(--[a-z0-9-]+" src | sort -u`; each must resolve.
- [ ] **Step 4: Remove the theme script, the toggle and `useTheme.ts`.**
- [ ] **Step 5: Run `pnpm test`, `pnpm exec tsc --noEmit`, `pnpm build`.** Expected: all pass.
- [ ] **Step 6: Open `/works` and `/about` in the dev preview.** Expected: both render in the Lamp palette with readable text and no unstyled (transparent or black-on-black) regions.
- [ ] **Step 7: Commit.** `git commit -m "Replace tokens with the Lamp design system"`

### Task 3: Base styles and legacy primitives

**Files:**
- Modify: `src/styles/global.css` (the `@layer base` block and the `@layer components` primitives; the custom-cursor block near line 843)
- Modify: `src/App.tsx` (drop `CustomCursor`)
- Delete: `src/components/CustomCursor/`
- Test: `src/styles/redesigned.test.ts`

**Interfaces:**
- Produces: `REDESIGNED: string[]` in `src/styles/redesigned.test.ts`, the list of files that must follow the copy and type rules. Every later task appends the files it creates or rewrites.
- Produces utility classes in `@layer components`: `.wrap` (max width `--page-max`, inline padding `--gutter`), `.t-display`, `.t-h2`, `.t-h3`, `.t-small`, `.t-meta` (16 px, `--text-2`), `.focus-ring` (2 px `--accent` outline, 2 px offset).

- [ ] **Step 1: Write the test.**

```ts
// src/styles/redesigned.test.ts
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

export const REDESIGNED: string[] = [];
const BANNED = [/\bitalic\b/, /\buppercase\b/, /mono-label/, /font-mono/, /--color-/, /tracking-\[0\.\d/, /coord-label/, /\bpill\b/];

it.each(REDESIGNED.length ? REDESIGNED : ['src/styles/redesigned.test.ts'])('%s follows the type and copy rules', (file) => {
  if (file.endsWith('redesigned.test.ts')) return;
  const source = readFileSync(file, 'utf8');
  for (const rule of BANNED) expect(source, `${file} uses ${rule}`).not.toMatch(rule);
});

it('base styles carry no grain, contour background or custom cursor', () => {
  const css = readFileSync('src/styles/global.css', 'utf8');
  expect(css).not.toMatch(/feTurbulence|astana-contours|has-custom-cursor|cursor-pointer-el/);
});
```

- [ ] **Step 2: Run `pnpm test`.** Expected: FAIL on grain and cursor.
- [ ] **Step 3: Rewrite the base block.** `body`: `background: var(--bg)`, `color: var(--text)`, `font: 350 var(--fs-body)/1.55 var(--font)`. Remove `body::before`, the gallery-page override and the contour image. Headings weight 600, tracking -0.02em. `::selection` uses `--accent` on `--accent-ink`. Add the utility classes above.
- [ ] **Step 4: Neutralise the legacy primitives** so old pages match until they are rebuilt: `.mono-label`, `.coord-label` and `.section-eyebrow` become 16 px `--text-2` with no transform and no tracking; `.pill` loses its border and mono font; `.btn` becomes a pill, `.btn-primary` and `.btn-secondary` both become `--raised` background with `--text` (the solid accent is reserved); `.heading-section` uses `--fs-h2` at 600.
- [ ] **Step 5: Delete the custom cursor** (component, CSS block, the `<CustomCursor />` line).
- [ ] **Step 6: Run `pnpm test`, `pnpm build`.** Expected: pass.
- [ ] **Step 7: Commit.** `git commit -m "Rebase global styles on the new system and drop the custom cursor"`

### Task 4: Icon, Button, Skeleton, Frame

**Files:**
- Create: `src/components/Icon/Icon.tsx`, `src/components/Button/Button.tsx`, `src/components/Skeleton/Skeleton.tsx`, `src/components/Frame/Frame.tsx`
- Test: `src/components/Frame/Frame.test.tsx`, `src/components/Button/Button.test.tsx`
- Modify: `src/styles/redesigned.test.ts` (append the four files)

**Interfaces:**
- Produces:

```ts
export type IconName = 'arrow-right' | 'arrow-down' | 'arrow-up-right' | 'menu' | 'close' | 'play' | 'search' | 'check' | 'mail';
export default function Icon(props: { name: IconName; size?: number }): JSX.Element; // aria-hidden, viewBox 0 0 20 20, stroke-width 1.6

export interface ButtonProps {
  variant?: 'primary' | 'quiet';      // primary = solid accent, quiet = text with icon
  size?: 'md' | 'sm';                 // 52 px and 44 px tall
  to?: string; href?: string;         // Link, anchor, or <button> when neither is set
  type?: 'button' | 'submit';
  icon?: IconName;                    // trailing
  onClick?: () => void;
  children: React.ReactNode;
}
export default function Button(props: ButtonProps): JSX.Element;

export default function Skeleton(props: { className?: string }): JSX.Element; // aria-hidden block, --raised, slow opacity pulse, still under reduced motion

export interface FrameProps {
  src: string; alt: string;
  width: number; height: number;      // intrinsic size, sets aspect-ratio unless `ratio` is given
  ratio?: string;                     // e.g. '16 / 9'; image is object-fit: cover
  sizes?: string;                     // passed with coverSrcSet(src) from src/utils/images
  small?: boolean;                    // 12 / 4 / 8 radius set
  priority?: boolean;                 // eager + fetchpriority high; default lazy
  viewTransitionName?: string;
}
export default function Frame(props: FrameProps): JSX.Element;
```

- `Frame` renders the padded `--surface` holder, a `Skeleton` behind the image, and fades the image in over `--t-enter` on its `load` event (immediately if `img.complete`).
- Only `variant="primary"` may use `background: var(--accent)`.

- [ ] **Step 1: Write the failing tests.**

```tsx
// Frame.test.tsx
it('reserves the image ratio before load', () => {
  const { container } = render(<Frame src="/a.webp" alt="A" width={1200} height={800} />);
  const img = container.querySelector('img')!;
  expect(img.getAttribute('width')).toBe('1200');
  expect(img.getAttribute('height')).toBe('800');
  expect((img.parentElement as HTMLElement).style.aspectRatio).toBe('1200 / 800');
  expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull(); // skeleton
});
it('is lazy unless priority', () => {
  expect(render(<Frame src="/a.webp" alt="" width={1} height={1} />).container.querySelector('img')!.getAttribute('loading')).toBe('lazy');
  expect(render(<Frame src="/a.webp" alt="" width={1} height={1} priority />).container.querySelector('img')!.getAttribute('loading')).toBe('eager');
});

// Button.test.tsx (inside MemoryRouter)
it('renders a router link, an anchor or a button', () => {
  expect(render(<Button to="/contact">Work with me</Button>, { wrapper }).getByRole('link').getAttribute('href')).toBe('/contact');
  expect(render(<Button href="mailto:a@b.c">Mail</Button>, { wrapper }).getByRole('link').getAttribute('href')).toBe('mailto:a@b.c');
  expect(render(<Button type="submit">Send</Button>, { wrapper }).getByRole('button').getAttribute('type')).toBe('submit');
});
```

- [ ] **Step 2: Run `pnpm test`.** Expected: FAIL, modules not found.
- [ ] **Step 3: Implement the four components.**
- [ ] **Step 4: Run `pnpm test`, `pnpm exec tsc --noEmit`.** Expected: pass.
- [ ] **Step 5: Commit.** `git commit -m "Add Icon, Button, Skeleton and Frame"`

### Task 5: Nav, interim routes, Skills removal

**Files:**
- Rewrite: `src/components/Nav/Nav.tsx`
- Modify: `src/App.tsx`, `public/_redirects`, `vercel.json`, `scripts/prerender-routes.mjs`, `src/types/index.ts`, `src/styles/global.css` (the `.legend-*` and `.topo-card` rules)
- Delete: `src/pages/SkillsPage.tsx`, `src/data/skills.json`, `public/images/skills/`
- Test: `src/components/Nav/Nav.test.tsx`

**Interfaces:**
- Produces:

```ts
export const NAV_LINKS = [
  { to: '/works', label: 'Work' },
  { to: '/journal', label: 'Journal' },
  { to: '/about', label: 'About' },
] as const;
export const CTA = { to: '/contact', label: 'Work with me' } as const;
```

- Routes added in `App.tsx`: `/journal` renders the existing `StoriesPage` and `/contact` the existing `ConnectPage` until plans 3 and 4 replace them. `/skills` becomes `<Navigate to="/about" replace />`.
- Host redirects: `/skills /about 301` above the catch-all in `_redirects`, and the same in a `redirects` array in `vercel.json`.

- [ ] **Step 1: Write the failing test.**

```tsx
it('shows the name, three links and one call to action', () => {
  const { getAllByRole, queryByText } = render(<Nav />, { wrapper }); // MemoryRouter
  const links = getAllByRole('link').map((a) => [a.textContent, a.getAttribute('href')]);
  expect(links).toContainEqual(['Alikhan Beisenbayev', '/']);
  expect(links).toContainEqual(['Work', '/works']);
  expect(links).toContainEqual(['Journal', '/journal']);
  expect(links).toContainEqual(['About', '/about']);
  expect(links).toContainEqual(['Work with me', '/contact']);
  for (const gone of ['Gallery', 'Skills', 'Blog', 'Stories', 'Connect']) expect(queryByText(gone)).toBeNull();
});
it('has no theme switch', () => {
  expect(render(<Nav />, { wrapper }).queryByLabelText(/theme/i)).toBeNull();
});
it('opens the phone sheet and closes it on Escape', () => {
  const { getByLabelText, queryByRole } = render(<Nav />, { wrapper });
  fireEvent.click(getByLabelText('Open menu'));
  expect(queryByRole('dialog')).not.toBeNull();
  fireEvent.keyDown(window, { key: 'Escape' });
  expect(queryByRole('dialog')).toBeNull();
});
```

- [ ] **Step 2: Run `pnpm test`.** Expected: FAIL.
- [ ] **Step 3: Rewrite `Nav`.** Fixed bar, 72 px tall, `--bg` at 80% through `color-mix` with backdrop blur, no bottom border. At 768 px and up: name, three links, small primary `Button`. Below: name, the button, a 44 px menu icon button; the links open in a full-width sheet (`role="dialog"`, `aria-modal`). Keep the existing focus handling: focus moves into the sheet, Escape closes, focus returns to the toggle, a route change closes it. Active link is `--text`; others `--text-2`.
- [ ] **Step 4: Add the interim routes and remove Skills** (page, data, images, types, legend CSS, its `SECTIONS` entry in the prerender script, the redirects). `grep -rn "skills" src scripts` must return nothing but the redirect.
- [ ] **Step 5: Append `src/components/Nav/Nav.tsx` to `REDESIGNED`.**
- [ ] **Step 6: Run `pnpm test`, `pnpm exec tsc --noEmit`, `pnpm build`.** Expected: pass.
- [ ] **Step 7: Send screenshots** of the nav at 1440 and 375 px, sheet open and closed.
- [ ] **Step 8: Commit.** `git commit -m "Rebuild the nav and remove the Skills page"`

### Task 6: Tilt and the work card

**Files:**
- Create: `src/utils/motion.ts`, `src/utils/tilt.ts`, `src/hooks/useTilt.ts`
- Rewrite: `src/components/WorkCard/WorkCard.tsx`
- Modify: `src/pages/WorksPage.tsx` and any other caller of the old `index` / `large` props
- Test: `src/utils/tilt.test.ts`, `src/hooks/useTilt.test.tsx`, `src/components/WorkCard/WorkCard.test.tsx`

**Interfaces:**
- Produces:

```ts
// motion.ts
export function prefersReducedMotion(): boolean;  // (prefers-reduced-motion: reduce)
export function hasFinePointer(): boolean;        // (pointer: fine)

// tilt.ts
export const MAX_TILT_DEG = 6;
/** px, py are the pointer position inside the element, 0 to 1; values outside are clamped. */
export function tiltFor(px: number, py: number, max?: number): { rx: number; ry: number };

// useTilt.ts
export function useTilt<T extends HTMLElement>(max?: number): {
  ref: React.RefObject<T>;
  onPointerMove: (e: React.PointerEvent<T>) => void;
  onPointerLeave: () => void;
};

// WorkCard.tsx
export interface WorkCardProps { project: Project; size?: 'lead' | 'half' }
```

- `tiltFor`: `rx = (0.5 - py) * 2 * max`, `ry = (px - 0.5) * 2 * max`.
- `useTilt` sets `--rx` and `--ry` (in `deg`) on the element and removes both on leave. It does nothing when the event's `pointerType` is not `mouse`, when `hasFinePointer()` is false, or when `prefersReducedMotion()` is true. The card's CSS applies `transform: perspective(1000px) rotateX(var(--rx, 0deg)) rotateY(var(--ry, 0deg))` with `transition: transform var(--t-hover) var(--ease)` and lifts from `--shadow-rest` to `--shadow-lift` on hover and focus.
- `WorkCard` shows a `Frame` (ratio `16 / 9` for `lead`, `4 / 3` for `half`; `viewTransitionName` `cover-<slug>`), the title (`.t-h2` for `lead`, `.t-h3` otherwise) and one `.t-meta` line: the project's `category`, sentence-cased. Nothing else: no index number, award star, status, "Published" tag, year, tagline or "View case study". Keep the existing route warm-up on hover and the `startViewTransition` click handler unchanged in behaviour.

- [ ] **Step 1: Write the failing tests.**

```ts
// tilt.test.ts
it('is flat at the centre', () => expect(tiltFor(0.5, 0.5)).toEqual({ rx: 0, ry: 0 }));
it('reaches the maximum at the corners', () => expect(tiltFor(1, 0)).toEqual({ rx: 6, ry: 6 }));
it('clamps positions outside the element', () => expect(tiltFor(5, -3)).toEqual(tiltFor(1, 0)));
```

```tsx
// useTilt.test.tsx — a <div> using the hook, 200 x 100 at 0,0
it('tilts under a mouse on a fine pointer', () => {
  setMedia(['(pointer: fine)']);
  fireEvent.pointerMove(el, { clientX: 200, clientY: 0, pointerType: 'mouse' });
  expect(el.style.getPropertyValue('--ry')).toBe('6deg');
  fireEvent.pointerLeave(el);
  expect(el.style.getPropertyValue('--ry')).toBe('');
});
it('never tilts on touch', () => {
  setMedia(['(pointer: fine)']);
  fireEvent.pointerMove(el, { clientX: 200, clientY: 0, pointerType: 'touch' });
  expect(el.style.getPropertyValue('--ry')).toBe('');
});
it('never tilts on a coarse pointer or with reduced motion', () => {
  setMedia([]); fireEvent.pointerMove(el, { clientX: 200, clientY: 0, pointerType: 'mouse' });
  expect(el.style.getPropertyValue('--ry')).toBe('');
  setMedia(['(pointer: fine)', '(prefers-reduced-motion: reduce)']);
  fireEvent.pointerMove(el, { clientX: 200, clientY: 0, pointerType: 'mouse' });
  expect(el.style.getPropertyValue('--ry')).toBe('');
});
```

```tsx
// WorkCard.test.tsx — project fixture: slug 'silk-road', category 'print', awards ['x'], status 'in-progress'
it('shows the cover, the title and one type line, nothing else', () => {
  const { getByRole, queryByText, container } = render(<WorkCard project={p} />, { wrapper });
  expect(getByRole('link').getAttribute('href')).toBe('/works/silk-road');
  expect(getByRole('heading').textContent).toBe(p.title);
  expect(queryByText('Print')).not.toBeNull();
  for (const gone of ['★', 'In Progress', 'View case study', p.tagline]) expect(queryByText(gone, { exact: false })).toBeNull();
  expect(container.querySelector('img')!.style.viewTransitionName).toBe('cover-silk-road');
});
it('does not start a view transition with reduced motion', () => {
  setMedia(['(prefers-reduced-motion: reduce)']);
  const start = vi.fn(); (document as any).startViewTransition = start;
  fireEvent.click(render(<WorkCard project={p} />, { wrapper }).getByRole('link'));
  expect(start).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run `pnpm test`.** Expected: FAIL.
- [ ] **Step 3: Implement `motion.ts`, `tilt.ts`, `useTilt.ts`, then rewrite `WorkCard`.** Update callers of the removed props.
- [ ] **Step 4: Update the view-transition timings in `global.css`** to `--t-enter` for the root cross-fade and `--t-page` for the cover group, both with `--ease`.
- [ ] **Step 5: Append the new files to `REDESIGNED`. Run `pnpm test`, `pnpm exec tsc --noEmit`.** Expected: pass.
- [ ] **Step 6: Commit.** `git commit -m "Rebuild the work card with pointer tilt"`

### Task 7: Home page

**Files:**
- Create: `src/data/offers.ts`, `src/data/featured.ts`, `src/components/HeroStack/HeroStack.tsx`, `src/components/JournalCard/JournalCard.tsx`
- Rewrite: `src/pages/HomePage.tsx`
- Delete: `src/pages/LandingPage.tsx`
- Modify: `src/App.tsx` (`AppFooter` no longer imports `useViewMode` from `src/atlas`)
- Test: `src/data/featured.test.ts`, `src/data/offers.test.ts`, `src/components/HeroStack/HeroStack.test.tsx`, `src/pages/HomePage.test.tsx`

**Interfaces:**
- Consumes: `Frame`, `Button`, `Icon`, `WorkCard`, `useTilt`, `projects` from `src/data/projects`, `stories` from `src/data/stories`.
- Produces:

```ts
// offers.ts
export type OfferSlug = 'custom-maps' | 'spatial-analysis' | 'data-visualization' | 'data-journalism' | 'remote-sensing';
export interface Offer { slug: OfferSlug; label: string }
export const OFFERS: readonly Offer[]; // labels: Custom maps, Spatial analysis, Data visualization, Data journalism, Remote sensing
export function offerHref(slug: OfferSlug): string; // `/works?offer=${slug}`

// featured.ts
export function featuredWorks(list: Project[]): Project[]; // featured only, by featuredOrder ascending, missing order last

// HeroStack.tsx
export default function HeroStack(props: { works: Project[] }): JSX.Element | null; // first three; null when empty

// JournalCard.tsx
export interface JournalCardProps { title: string; href: string; cover: string; kind: 'Story' | 'Note' | 'Tool'; external?: boolean }
```

- Home copy, exact:
  - h1: `Maps that show what data alone cannot.`
  - lede: `Custom maps, spatial analysis, data visualization, data journalism and remote sensing. Open for commissions and collaboration.`
  - Buttons: primary `Work with me` to `/contact`; quiet `See the work` with `arrow-down`, scrolling to the selected-work section.
  - Section headings, in order: `Selected work` (link `All works` to `/works`), `What I can make for you`, `Journal` (link `All entries` to `/journal`).
- Layout:
  - Hero is 100vh minus the nav, capped at 860 px. Text left, stack right at 768 px and up; stack under the text below that.
  - `HeroStack`: sheets are `Frame`s inside one `transform-style: preserve-3d` element at `rotateY(-22deg) rotateX(7deg)`; depths `translateZ(120px)`, `-60px`, `-240px`; opacities 1, .9, .7; `--shadow-lift` on each. Below 768 px: `rotateY(-10deg) rotateX(4deg)`. The front sheet's image is `priority`. `useTilt(3)` on the container adds the pointer shift. Where `animation-timeline: scroll()` is supported and motion is allowed, the tilt eases to flat over the first 60vh of scroll.
  - Selected work: `featuredWorks(projects)`; the first as `WorkCard size="lead"` full width, the rest two per row from 768 px, gap `--s-6`, sections `--s-10` apart.
  - Offers: one row of five links from 1024 px, two columns below; each is the label (`.t-h3`) and an `arrow-right`, separated by `--line` rules, linking to `offerHref`.
  - Journal: the three newest `stories` as `JournalCard kind="Story"`, href `/stories/<slug>` (plan 3 moves them to `/journal`).
- No atlas import anywhere in `HomePage.tsx` or `App.tsx`. The `src/atlas` folder stays untouched and unreferenced until plan 5.

- [ ] **Step 1: Write the failing tests.**

```ts
// featured.test.ts
it('orders by featuredOrder and drops the rest', () => {
  const list = [w('c', true, 3), w('x', false), w('a', true, 1), w('z', true)];
  expect(featuredWorks(list).map((p) => p.slug)).toEqual(['a', 'c', 'z']);
});

// offers.test.ts
it('lists the five approved offers', () => {
  expect(OFFERS.map((o) => o.slug)).toEqual(['custom-maps', 'spatial-analysis', 'data-visualization', 'data-journalism', 'remote-sensing']);
  expect(offerHref('remote-sensing')).toBe('/works?offer=remote-sensing');
});
```

```tsx
// HeroStack.test.tsx
it('shows at most three covers', () => expect(render(<HeroStack works={five} />).container.querySelectorAll('img')).toHaveLength(3));
it('renders one work without failing', () => expect(render(<HeroStack works={five.slice(0, 1)} />).container.querySelectorAll('img')).toHaveLength(1));
it('renders nothing with no works', () => expect(render(<HeroStack works={[]} />).container.firstChild).toBeNull());

// HomePage.test.tsx (MemoryRouter)
it('leads with the headline and one primary action', () => {
  const { getByRole, getAllByRole } = render(<HomePage />, { wrapper });
  expect(getByRole('heading', { level: 1 }).textContent).toBe('Maps that show what data alone cannot.');
  expect(getAllByRole('link', { name: 'Work with me' })[0].getAttribute('href')).toBe('/contact');
});
it('orders the sections', () => {
  const h2 = render(<HomePage />, { wrapper }).getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
  expect(h2.filter((t) => ['Selected work', 'What I can make for you', 'Journal'].includes(t!))).toEqual(['Selected work', 'What I can make for you', 'Journal']);
});
it('links each offer to the filtered works index', () => {
  const { getByRole } = render(<HomePage />, { wrapper });
  for (const o of OFFERS) expect(getByRole('link', { name: o.label }).getAttribute('href')).toBe(offerHref(o.slug));
});
```

- [ ] **Step 2: Run `pnpm test`.** Expected: FAIL.
- [ ] **Step 3: Implement the data modules, `HeroStack`, `JournalCard`, then `HomePage`.** Delete `LandingPage.tsx` and the atlas imports in `App.tsx`.
- [ ] **Step 4: Append the new and rewritten files to `REDESIGNED`. Run `pnpm test`, `pnpm exec tsc --noEmit`, `pnpm build`.** Expected: pass.
- [ ] **Step 5: Check in the dev preview at 1440, 768 and 375 px.** Expected: no horizontal scroll; no layout shift as covers load; console has no errors; with reduced motion emulated the stack and cards are still.
- [ ] **Step 6: Send screenshots** of the full home page at 1440 and 375 px.
- [ ] **Step 7: Commit.** `git commit -m "Replace the atlas home with the flat-with-depth home page"`

### Task 8: Footer shell, contact band, route skeleton

**Files:**
- Create: `src/components/ContactBand/ContactBand.tsx`
- Rewrite: `src/components/Footer/Footer.tsx`
- Modify: `src/App.tsx`
- Test: `src/components/ContactBand/ContactBand.test.tsx`, `src/components/Footer/Footer.test.tsx`, `src/App.test.tsx`

**Interfaces:**
- Consumes: `NAV_LINKS`, `CTA` from `Nav.tsx`; `featuredSocials` from `src/data/socials`; `Button`, `Skeleton`.
- Produces:

```ts
// ContactBand.tsx
export function showContactBand(pathname: string): boolean; // false for /contact, /connect, /journal/map-awards, /blog/map-awards
export default function ContactBand(): JSX.Element;
```

- Band copy, exact: h2 `Start a project`; line `Tell me what you need and I will reply by email.`; primary button `Work with me`.
- Footer: name; `NAV_LINKS`; socials as text links (the single-colour glyphs come with the illustration in plan 5); `© <year>`. Two interim links, `Gallery` to `/gallery` and `Blog` to `/blog`, marked `// INTERIM: remove in plans 2 and 3`. No "Legend", "Sources", "Cartographer", "Edition" labels, no tagline, no diamonds. A top margin of `--s-10` leaves room for the illustration.
- `App.tsx`: the Suspense fallback is a route skeleton (`role="status"`, `aria-label="Loading page"`): one `Skeleton` at 40% width for the title and one 16:9 `Skeleton`, inside `.wrap`. No visible text. `main` top padding matches the 72 px nav.

- [ ] **Step 1: Write the failing tests.**

```tsx
it('hides the band where it would repeat the page', () => {
  for (const p of ['/contact', '/connect', '/journal/map-awards', '/blog/map-awards']) expect(showContactBand(p)).toBe(false);
  for (const p of ['/', '/works', '/works/silk-road', '/about']) expect(showContactBand(p)).toBe(true);
});
it('footer carries the nav links and the year, and no legacy labels', () => {
  const { getByText, queryByText } = render(<Footer />, { wrapper });
  for (const l of NAV_LINKS) expect(getByText(l.label).getAttribute('href')).toBe(l.to);
  expect(getByText(new RegExp(String(new Date().getFullYear())))).not.toBeNull();
  for (const gone of ['Legend', 'Sources', 'Cartographer', 'Edition']) expect(queryByText(gone)).toBeNull();
});
it('route fallback is a labelled skeleton with no text', () => {
  const { getByRole } = render(<PageFallback />);
  expect(getByRole('status').getAttribute('aria-label')).toBe('Loading page');
  expect(getByRole('status').textContent).toBe('');
});
```

`PageFallback` is exported from `App.tsx` for this test.

- [ ] **Step 2: Run `pnpm test`.** Expected: FAIL.
- [ ] **Step 3: Implement the band, the footer and the fallback; place `<ContactBand />` above `<Footer />` when `showContactBand(pathname)`.**
- [ ] **Step 4: Append the files to `REDESIGNED`. Run `pnpm test`, `pnpm exec tsc --noEmit`, `pnpm build`.** Expected: pass.
- [ ] **Step 5: Send screenshots** of the band and footer at 1440 and 375 px.
- [ ] **Step 6: Commit.** `git commit -m "Add the contact band, footer shell and route skeleton"`

### Task 9: Budget check and walkthrough

**Files:**
- Create: `scripts/check-budget.mjs`
- Modify: `package.json` (script `"budget": "node scripts/check-budget.mjs"`)

**Interfaces:**
- Produces: `pnpm budget`, run after `pnpm build`. It reads `dist/index.html`, gzips the entry script, every `modulepreload` and the `HomePage-*.js` chunk, and the entry stylesheet; prints each size; exits 1 when script exceeds 90 KB or styles exceed 20 KB.

- [ ] **Step 1: Write `check-budget.mjs`** with `node:zlib`'s `gzipSync`; budgets as named constants `HOME_JS_GZIP = 90 * 1024` and `HOME_CSS_GZIP = 20 * 1024`.
- [ ] **Step 2: Run `pnpm build && pnpm budget`.** Expected: both sizes printed and under budget; no `AtlasView` or `maplibre` file among the measured ones. If a budget fails, find what pulled the weight into the home graph and fix it; do not raise the budget.
- [ ] **Step 3: Walk every route in the built preview** (`/`, `/works`, one work page, `/journal`, one story, `/blog`, `/blog/map-awards`, `/gallery`, `/about`, `/contact`, a 404) at 1440 and 375 px. Expected: readable text everywhere, no console errors, no horizontal scroll at 320 px on `/`, long work titles wrap.
- [ ] **Step 4: Run the home page through Lighthouse (phone).** Record performance, largest contentful paint and layout shift in the commit message. Targets from the spec: 90 or more, under 2.5 s, under 0.05. A miss here is reported to Alikhan, not hidden; the full weight pass is plan 5.
- [ ] **Step 5: Send a screenshot set** (home, works, one work page, about at both widths) with a one-line note of anything that looks off on the not-yet-rebuilt pages.
- [ ] **Step 6: Commit.** `git commit -m "Add a home page weight budget check"`
