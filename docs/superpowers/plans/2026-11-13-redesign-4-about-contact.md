# Redesign Plan 4: Contact Form and About

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A "Work with me" page whose four-field form reaches Alikhan by email, and an About page rebuilt on the new system.

**Architecture:** The site is hosted on Cloudflare Pages, so the form posts to a Pages Function at `/api/contact`. The function is a thin wrapper around one handler in `src/server/contact.ts`, which validates, stores the inquiry in Supabase and emails it through Resend. Validation rules live in one shared module used by the form and the handler. The About page keeps its globe story and its data.

**Tech Stack:** as before, plus Cloudflare Pages Functions (no new dependency: the handler uses `fetch`).

**Spec:** `docs/superpowers/specs/2026-11-12-site-redesign-design.md` (sections "About", "Work with me", answers 2 and 4)

## Global Constraints

All earlier constraints apply. In addition:

- Form fields: name, email, what you need (the five offers as chips, optional, several allowed), message. Four fields, no more.
- Limits: name 2 to 80 characters, email up to 120 and shaped like an address, message 10 to 4000, offers only from the five slugs.
- Form states: idle, sending, sent (the form is replaced by a confirmation that repeats what was sent), failed (input kept, direct email shown).
- Spam: a hidden honeypot field (`company`) and a minimum fill time of 2500 ms. A request that trips either is answered as if it had worked and nothing is sent.
- The solid accent fill is allowed on the form's submit button.
- Secrets (`RESEND_API_KEY`, `CONTACT_TO`) never reach the browser bundle. No email address is hard-coded in the handler.
- No address, count or date on the About page is invented: everything comes from the data files.

## Review Focus

1. **The function is not configured** (no Resend key, no Supabase). The visitor is told it did not send and is given the direct email, never a false "sent". Test in Task 1 and Task 2.
2. **Email fails but storage works, or the reverse.** The inquiry counts as delivered; the visitor sees "sent". Both fail: "failed". Test in Task 1.
3. **A bot fills the honeypot or submits instantly.** Answered 200, nothing stored, nothing sent. Test in Task 1.
4. **A visitor double-clicks Send or presses Enter twice.** One request. Test in Task 2.
5. **A cross-site page posts to the endpoint.** Refused. Test in Task 1.

## File Structure

| File | Responsibility |
|---|---|
| `src/shared/inquiry.ts` | the inquiry type, limits and `validateInquiry` (new) |
| `src/server/contact.ts` | `handleContact(request, env, fetch)` (new) |
| `functions/api/contact.ts` | the Pages Function: one line into the handler (new) |
| `supabase/inquiries.sql` | the insert-only table (new) |
| `src/components/Field/Field.tsx` | a labelled input or textarea with its error (new) |
| `src/components/ContactForm/ContactForm.tsx` | the form and its four states (new) |
| `src/pages/ContactPage.tsx` | heading, what happens next, the form (new) |
| `src/pages/AboutPage.tsx` | head, recognition, audience, profiles, the route on the globe (rewrite) |
| `src/data/proof.ts` | awards and audience numbers derived from the data (new) |
| `src/components/GlobeStory/GlobeStory.tsx` | reads the new colour tokens (modify) |
| Deleted | `src/pages/ConnectPage.tsx` |

---

### Task 1: Shared rules and the server handler

**Interfaces:**

```ts
// src/shared/inquiry.ts
export interface Inquiry { name: string; email: string; offers: OfferSlug[]; message: string }
export type InquiryErrors = Partial<Record<'name' | 'email' | 'message', string>>;
export const LIMITS: { name: [2, 80]; email: 120; message: [10, 4000] };
export const MIN_FILL_MS = 2500;
/** Trims, drops unknown offers, and reports what is wrong. `errors` is empty when the inquiry is good. */
export function validateInquiry(input: unknown): { inquiry: Inquiry; errors: InquiryErrors };

// src/server/contact.ts
export interface ContactEnv {
  RESEND_API_KEY?: string; CONTACT_TO?: string; CONTACT_FROM?: string;
  SUPABASE_URL?: string; SUPABASE_ANON_KEY?: string;
}
export function handleContact(request: Request, env: ContactEnv, fetchImpl?: typeof fetch): Promise<Response>;
```

- Error copy: `Please enter your name.`, `Please enter an email address I can reply to.`, `Please write a few words about what you need.`
- Responses are JSON. `405` for anything but POST. `403` when an `Origin` header names another host. `413` for a body over 20 000 characters. `400 { ok: false, errors }` when invalid. `200 { ok: true }` for a honeypot or too-fast request, with no outbound call. `503 { ok: false, error: 'not-configured' }` when neither delivery is configured. `502` when every configured delivery failed. `200 { ok: true }` when at least one worked.
- Storage: `POST ${SUPABASE_URL}/rest/v1/inquiries` with `apikey` and `Authorization: Bearer`, `Prefer: return=minimal`, body `{ name, email, offers, message }`.
- Email: `POST https://api.resend.com/emails`, body `{ from: CONTACT_FROM ?? 'Portfolio <onboarding@resend.dev>', to: [CONTACT_TO], reply_to: email, subject: 'New inquiry from <name>', text }`. Line breaks are stripped from the name before it goes into the subject.
- `supabase/inquiries.sql`: table `inquiries` with the same length checks, row level security on, an insert policy for `anon`, and no select, update or delete.

- [ ] **Step 1: Write the failing tests** (`src/shared/inquiry.test.ts`, `src/server/contact.test.ts`) for every rule above, with a recording fake `fetch`.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement the two modules, the function wrapper and the SQL file.**
- [ ] **Step 4: Run tests and type check.** Expected: pass.
- [ ] **Step 5: Commit.** "Add the contact form's shared rules and server handler"

### Task 2: The form and the page

**Behaviour:**
- `ContactPage`: h1 `Work with me`; three plain lines: `Send a few lines about what you need.` / `I reply by email to talk through scope and timing.` / `Prefer email? <address>` (the address from `socials.json`); the form beside it from 1024 px.
- `ContactForm({ initialOffer })`: labelled fields `Name`, `Email`, `What you need` (chips, `aria-pressed`), `Message`; the honeypot is visually hidden, `tabindex="-1"`, `autocomplete="off"`. Errors appear under their field after a failed submit, tied with `aria-describedby`, and focus moves to the first invalid field. Submit reads `Send`, then `Sending` while disabled.
- It posts `{ ...inquiry, company, elapsedMs }` as JSON to `/api/contact`.
- Sent: an h2 `Sent`, the line `Thanks, <name>. I will reply to <email>.`, the offers and message that were sent, and a quiet `Send another`.
- Failed: the form stays as filled, with `This did not send. Email me directly:` and a `mailto:` link that carries the message.
- `/contact?offer=<slug>` starts with that chip pressed.

- [ ] **Step 1: Write the failing tests:** fields and chips render; `initialOffer` presses its chip; an empty submit shows the three errors and makes no request; a valid submit posts the right JSON once even when submitted twice, shows `Sending`, then the confirmation with name, email and message; a `503` shows the failed state with the mailto link and keeps the inputs; `Send another` returns to an empty form.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement `Field`, `ContactForm`, `ContactPage`.** In dev, a small middleware in `vite.config.ts` serves `/api/contact` through the same handler with the process environment.
- [ ] **Step 4: Run tests and type check.** Expected: pass.
- [ ] **Step 5: Commit.** "Build the Work with me page and its form"

### Task 3: About

**Behaviour, top to bottom:**
1. Head: the photo in a `Frame`, h1 `Alikhan Beisenbayev`, the title line, the bio, a quiet `Download CV`.
2. `Recognition`: one row per award from the listed projects (`awards`), each naming the work and linking to it.
3. `Audience`: the profiles that carry a follower count, each as a fact, and one line with the date the counts were taken.
4. `Find me elsewhere`: every profile in `socials` except the CV, as a row linking out (new tab), with its one-line description.
5. `The route so far`: the existing scroll story on the globe, panels restyled: date and place as one line, title, text, images in small `Frame`s. No coordinates.

`src/data/proof.ts`: `awards: { award: string; work: string; slug: string }[]`, `audience: { platform: string; count: string }[]`, `audienceDate: string | null` (the shared `follower_date`, as `19 September 2026`).

`GlobeStory` reads `--surface`, `--accent` and `--text-2` and builds its translucent colours from them, so it no longer depends on the legacy `-rgb` tokens.

- [ ] **Step 1: Write the failing tests:** `proof.ts` lists every award of every listed project and none from hidden ones; audience has only profiles with counts; the date parses `(09.19.26)` to `19 September 2026`. The page (with `GlobeStory` mocked) renders the h1, the four h2s in order, a link per award to its work, a link per profile with `target="_blank"`, the CV link, and no coordinate text.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run tests and type check.** Expected: pass.
- [ ] **Step 5: Commit.** "Rebuild the About page"

### Task 4: Routes and walkthrough

- `/contact` renders `ContactPage`; `/connect` redirects to it (router, `_redirects`, `vercel.json`); `ConnectPage` is deleted; the prerender script gets `/contact` and the new About description; `.env.example` documents the five function variables.
- [ ] **Step 1:** Tests: `LegacyRedirect` sends `/connect?offer=x` to `/contact?offer=x`.
- [ ] **Step 2:** Implement; `pnpm test`, `pnpm exec tsc --noEmit`, `pnpm build`, `pnpm budget`.
- [ ] **Step 3:** Screenshots of `/contact` (idle, errors, sent, failed) and `/about` at 1440 and 375; every route clean at 375; no browser process left. Send them.
- [ ] **Step 4:** Commit. "Route /contact to the new page and retire Connect"
