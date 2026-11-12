import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  AUDIENCES,
  KIND_OPTIONS,
  STATUS_LABEL,
  awards as CURATED,
  awardsData,
  compareAwards,
  day,
  daysLeft,
  places as CURATED_PLACES,
  startOfToday,
  statusOf,
} from '../data/mapAwards';
import type { Audience, Award, AwardPlace, StatusKey } from '../data/mapAwards';
import { addCommunity, loadCommunity, removeLocal, sharedStorage } from '../data/communityAwards';
import type { CommunityEntry, NewSubmission } from '../data/communityAwards';
import { SUBSCRIBE, AWARDS_FEED_URL, buildIcs, calendarAwards, googleEventUrl } from '../utils/ics';
import { formatDay } from '../utils/date';
import { usePageMeta } from '../hooks/usePageMeta';

const AwardsMap = lazy(() => import('../components/AwardsMap/AwardsMap'));

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** Pill colours by status: semantic, separate from the site accent. Text uses tokens. */
const STATUS_DOT: Record<StatusKey, string> = {
  open: '#3fae6d',
  running: '#3fae6d',
  firm: '#4f86c6',
  expected: '#d29a3e',
  tba: '#a88a58',
  closed: '#7d879c',
};

const label = 'font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.1em] text-[var(--color-text-muted)]';
const input =
  'w-full rounded-[var(--radius-md)] border border-[var(--color-border-default)] bg-[var(--color-bg-elevated)] px-3 py-2 text-[13px] text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-accent)]';

function useIsDesktop() {
  const query = '(min-width: 1024px)';
  const [match, setMatch] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setMatch(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return match;
}

function downloadIcs(list: Award[], filename: string, placeOf: (a: Award) => string) {
  const blob = new Blob([buildIcs(list, awardsData.checked, placeOf)], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function StatusPill({ status }: { status: StatusKey }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-[var(--radius-full)] border border-[var(--color-border-default)] bg-[var(--color-bg-elevated)] px-2 py-0.5 font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.08em] text-[var(--color-text-secondary)]">
      <span className="h-2 w-2 rounded-full" style={{ background: STATUS_DOT[status] }} />
      {STATUS_LABEL[status]}
    </span>
  );
}

function CommunityTag({ a }: { a: Award }) {
  if (!a.source) return null;
  return (
    <span className="rounded-[var(--radius-full)] border border-[var(--color-accent-gold)] px-2 py-0.5 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.08em] text-[var(--color-accent-gold)]">
      {a.source === 'local' ? 'Your entry' : 'Added by a visitor'}
    </span>
  );
}

/* ---------------- Calendar menu ---------------- */

function CalendarMenu({ visible, placeOf }: { visible: Award[]; placeOf: (a: Award) => string }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const today = startOfToday();
  const upcoming = calendarAwards(visible).filter((a) => day(a.when as string) >= today);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(AWARDS_FEED_URL);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt('Copy the calendar link', AWARDS_FEED_URL);
    }
  };

  const item =
    'flex w-full flex-col items-start gap-0.5 rounded-[var(--radius-sm)] px-3 py-2 text-left text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-accent-glow)] focus-visible:bg-[var(--color-accent-glow)] focus-visible:outline-none';
  const sub = 'font-[family-name:var(--font-mono)] text-[11px] text-[var(--color-text-muted)]';

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        className="btn btn-primary shadow-[var(--shadow-elevated)]"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M16 3v4M8 3v4M3 10h18M12 14v4M10 16h4" />
        </svg>
        <span className="hidden sm:inline">Add deadlines to calendar</span>
        <span className="sm:hidden">Calendar</span>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-2 w-[min(340px,calc(100vw-32px))] rounded-[var(--radius-md)] border border-[var(--color-border-default)] bg-[var(--color-bg-overlay)] p-2 shadow-[var(--shadow-elevated)]"
        >
          <p className={`${label} px-3 pb-1 pt-1`}>Subscribe · stays up to date</p>
          <a role="menuitem" className={item} href={SUBSCRIBE.google} target="_blank" rel="noreferrer">
            <span>Google Calendar</span>
            <span className={sub}>Adds every deadline as a separate calendar</span>
          </a>
          <a role="menuitem" className={item} href={SUBSCRIBE.apple}>
            <span>Apple Calendar (iPhone, Mac)</span>
            <span className={sub}>Opens Calendar with the subscription</span>
          </a>
          <a role="menuitem" className={item} href={SUBSCRIBE.outlook} target="_blank" rel="noreferrer">
            <span>Outlook</span>
            <span className={sub}>Outlook.com and Microsoft 365</span>
          </a>
          <div className="my-1 border-t border-[var(--color-border-subtle)]" />
          <p className={`${label} px-3 pb-1 pt-1`}>One-time import</p>
          <button
            role="menuitem"
            type="button"
            className={item}
            disabled={upcoming.length === 0}
            onClick={() => {
              downloadIcs(upcoming, 'map-awards-deadlines.ics', placeOf);
              setOpen(false);
            }}
          >
            <span>Download .ics ({upcoming.length} upcoming)</span>
            <span className={sub}>What the filters show, visitor entries included</span>
          </button>
          <button role="menuitem" type="button" className={item} onClick={copy}>
            <span>{copied ? 'Link copied' : 'Copy calendar link'}</span>
            <span className={`${sub} break-all`}>{AWARDS_FEED_URL}</span>
          </button>
          <p className="px-3 pb-2 pt-2 text-[12px] leading-snug text-[var(--color-text-muted)]">
            Each deadline is an all-day event with a reminder one week before. Estimated dates are titled “Expected deadline”.
            Subscriptions carry the curated list; entries added by visitors are in the download.
          </p>
        </div>
      )}
    </div>
  );
}

/* ---------------- List, detail, timeline ---------------- */

function AwardRow({ a, placeName, onOpen }: { a: Award; placeName: string; onOpen: () => void }) {
  const status = statusOf(a);
  const left = daysLeft(a);
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="grid w-full gap-1.5 border-b border-[var(--color-border-subtle)] px-4 py-3 text-left transition-colors hover:bg-[var(--color-accent-glow)] focus-visible:bg-[var(--color-accent-glow)] focus-visible:outline-none"
      >
        <span className="flex flex-wrap items-center gap-2">
          <StatusPill status={status} />
          <span className="font-[family-name:var(--font-mono)] text-[12px] tabular-nums text-[var(--color-text-secondary)]">{a.label}</span>
          {left !== null && (
            <span className="font-[family-name:var(--font-mono)] text-[11px] text-[var(--color-text-muted)]">
              · {left === 0 ? 'today' : `${left} days left`}
            </span>
          )}
        </span>
        <span className="font-[family-name:var(--font-heading)] text-[15px] font-bold leading-snug text-[var(--color-text-primary)]">
          {a.name}
        </span>
        <span className="flex flex-wrap items-center gap-2 text-[12.5px] text-[var(--color-text-muted)]">
          <span>
            {a.org} · {placeName}
          </span>
          <CommunityTag a={a} />
        </span>
      </button>
    </li>
  );
}

function Field({ name, children }: { name: string; children: ReactNode }) {
  return (
    <div className="grid gap-1">
      <dt className={label}>{name}</dt>
      <dd className="m-0 text-[14px] leading-relaxed text-[var(--color-text-secondary)]">{children}</dd>
    </div>
  );
}

function AwardDetail({
  a,
  place,
  placeOf,
  onBack,
  onRemoveLocal,
}: {
  a: Award;
  place?: AwardPlace;
  placeOf: (a: Award) => string;
  onBack: () => void;
  onRemoveLocal: (id: string) => void;
}) {
  const status = statusOf(a);
  const left = daysLeft(a);
  const google = googleEventUrl(a, placeOf(a));
  return (
    <div className="grid gap-5 p-5">
      <button
        type="button"
        onClick={onBack}
        className="justify-self-start font-[family-name:var(--font-mono)] text-[12px] text-[var(--color-accent-light)] hover:text-[var(--color-text-primary)]"
      >
        ← All programs
      </button>
      <header className="grid gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill status={status} />
          <span className="meta-pill">{a.kind}</span>
          <span className="meta-pill">{a.region}</span>
          <CommunityTag a={a} />
        </div>
        <h2 className="font-[family-name:var(--font-heading)] text-[22px] font-extrabold leading-tight">{a.name}</h2>
        <p className="text-[14px] text-[var(--color-text-muted)]">{a.org}</p>
      </header>

      <div className="rounded-[var(--radius-md)] border border-[var(--color-border-default)] bg-[var(--color-bg-elevated)] p-4">
        <p className={label}>{a.rolling ? 'Deadline' : a.firm ? 'Deadline (confirmed)' : 'Deadline (estimated)'}</p>
        <p className="mt-1 font-[family-name:var(--font-heading)] text-[18px] font-bold tabular-nums">{a.label}</p>
        {left !== null && (
          <p className="text-[13px] text-[var(--color-text-secondary)]">{left === 0 ? 'Closes today' : `${left} days left`}</p>
        )}
        {!a.firm && !a.rolling && a.when && (
          <p className="mt-1 text-[12.5px] text-[var(--color-text-muted)]">
            Estimated, not announced. Check the official page before you plan around it.
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <a className="btn btn-primary" href={a.url} target="_blank" rel="noreferrer nofollow">
          Official page ↗
        </a>
        {a.register && a.register !== a.url && (
          <a className="btn btn-secondary" href={a.register} target="_blank" rel="noreferrer nofollow">
            Register / submit ↗
          </a>
        )}
        {google && (
          <a className="btn btn-secondary" href={google} target="_blank" rel="noreferrer">
            + Google Calendar
          </a>
        )}
        {a.when && !a.rolling && (
          <button type="button" className="btn btn-secondary" onClick={() => downloadIcs([a], `${a.id.replace(/\W/g, '-')}.ics`, placeOf)}>
            + Apple / .ics
          </button>
        )}
      </div>

      <dl className="grid gap-4">
        <Field name="Prize">{a.prize}</Field>
        <Field name="What you need">{a.need}</Field>
        <Field name="Who can enter">{a.elig}</Field>
        <Field name="Entry fee">{a.fee}</Field>
        {a.note && <Field name="Notes">{a.note}</Field>}
        {place && (
          <Field name={place.role === 'venue' ? 'Where it happens' : 'Where the organizer is'}>
            {place.name}, {place.detail}
            {place.approx && <span className="text-[var(--color-text-muted)]"> (approximate pin)</span>}
          </Field>
        )}
        {a.source && (
          <Field name="Source">
            Added {a.submittedBy ? `by ${a.submittedBy} ` : 'by a visitor '}
            {a.createdAt ? `on ${formatDay(a.createdAt.slice(0, 10))}` : ''}. Not checked by Alikhan; verify on the official page.
          </Field>
        )}
      </dl>
      {a.source === 'local' && (
        <button
          type="button"
          className="justify-self-start text-[12.5px] text-[var(--color-text-muted)] underline hover:text-[var(--color-text-primary)]"
          onClick={() => onRemoveLocal(a.id)}
        >
          Remove this entry from my browser
        </button>
      )}
    </div>
  );
}

function Timeline({ list, onOpen }: { list: Award[]; onOpen: (id: string) => void }) {
  const today = startOfToday();
  const months = Array.from({ length: 14 }, (_, i) => new Date(today.getFullYear(), today.getMonth() + i, 1));
  return (
    <ol className="m-0 list-none p-0">
      {months.map((m) => {
        const items = list
          .filter((a) => a.when && !a.rolling)
          .filter((a) => {
            const d = day(a.when as string);
            return d.getFullYear() === m.getFullYear() && d.getMonth() === m.getMonth();
          })
          .sort((x, y) => compareAwards(x, y));
        return (
          <li key={m.toISOString()} className="border-b border-[var(--color-border-subtle)] px-4 py-3">
            <p className={`${label} mb-2`}>
              {MONTHS_LONG[m.getMonth()]} {m.getFullYear()}
              <span className="ml-2 normal-case tracking-normal">{items.length ? `· ${items.length}` : '· none'}</span>
            </p>
            <div className="grid gap-1.5">
              {items.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => onOpen(a.id)}
                  className="grid grid-cols-[52px_1fr] items-baseline gap-2 rounded-[var(--radius-sm)] border-l-[3px] bg-[var(--color-bg-elevated)] px-2 py-1.5 text-left text-[13px] leading-tight text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                  style={{ borderLeftColor: STATUS_DOT[statusOf(a)], borderLeftStyle: a.firm ? 'solid' : 'dashed' }}
                >
                  <span className="font-[family-name:var(--font-mono)] text-[11px] tabular-nums text-[var(--color-text-muted)]">
                    {a.firm ? `${day(a.when as string).getDate()} ${MONTHS[m.getMonth()]}` : `≈ ${MONTHS[m.getMonth()]}`}
                  </span>
                  <span>{a.name}</span>
                </button>
              ))}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/* ---------------- Add-an-award form ---------------- */

const EMPTY = {
  name: '',
  org: '',
  url: '',
  register: '',
  kind: 'Map design',
  aud: ['open'] as Audience[],
  region: '',
  deadline: '',
  firm: true,
  prize: '',
  fee: '',
  elig: '',
  need: '',
  note: '',
  place_name: '',
  submitted_by: '',
  website: '', // honeypot: real people never see or fill it
};

const isHttp = (v: string) => /^https?:\/\/\S+$/i.test(v.trim());

function AddAwardForm({
  picked,
  onCancel,
  onAdded,
}: {
  picked: { lng: number; lat: number } | null;
  onCancel: () => void;
  onAdded: (entry: CommunityEntry) => void;
}) {
  const [f, setF] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof typeof EMPTY>(k: K, v: (typeof EMPTY)[K]) => setF((s) => ({ ...s, [k]: v }));
  const opt = (v: string) => (v.trim() ? v.trim() : null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (f.website) return; // bot
    if (f.name.trim().length < 3) return setError('Give the award a name (at least 3 characters).');
    if (f.org.trim().length < 2) return setError('Who runs it? Add the organizer.');
    if (!isHttp(f.url)) return setError('The official link must start with https://');
    if (f.register.trim() && !isHttp(f.register)) return setError('The registration link must start with https://');
    if (!picked) return setError('Click the map to place the award where it is judged, presented or run.');
    if (f.place_name.trim().length < 2) return setError('Name the place, for example “Almaty” or “Online, run from Berlin”.');
    if (f.aud.length === 0) return setError('Pick at least one “who can enter” option.');
    const row: NewSubmission = {
      name: f.name.trim(),
      org: f.org.trim(),
      url: f.url.trim(),
      register: opt(f.register),
      kind: f.kind,
      aud: f.aud,
      region: opt(f.region),
      deadline: f.deadline || null,
      firm: Boolean(f.deadline) && f.firm,
      prize: opt(f.prize),
      fee: opt(f.fee),
      elig: opt(f.elig),
      need: opt(f.need),
      note: opt(f.note),
      place_name: f.place_name.trim(),
      lat: picked.lat,
      lng: picked.lng,
      submitted_by: opt(f.submitted_by),
    };
    setBusy(true);
    try {
      onAdded(await addCommunity(row));
      setF(EMPTY);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The entry could not be saved.');
    } finally {
      setBusy(false);
    }
  };

  const area = `${input} min-h-[64px] resize-y`;
  return (
    <form className="grid gap-4 p-5" onSubmit={submit} noValidate>
      <div className="grid gap-1">
        <h2 className="font-[family-name:var(--font-heading)] text-[20px] font-extrabold">Add an award</h2>
        <p className="text-[13px] leading-relaxed text-[var(--color-text-secondary)]">
          Know a competition that's missing? Add it and it appears on the map for everyone, marked as added by a visitor.
        </p>
        {!sharedStorage && (
          <p className="rounded-[var(--radius-sm)] border border-[var(--color-accent-gold)] px-3 py-2 text-[12px] text-[var(--color-accent-gold)]">
            Shared submissions are not connected on this copy of the site, so your entry is saved only in this browser.
          </p>
        )}
      </div>

      <div className={`grid gap-1 rounded-[var(--radius-md)] border p-3 ${picked ? 'border-[var(--color-border-default)]' : 'border-dashed border-[var(--color-accent)]'}`}>
        <span className={label}>1 · Location</span>
        <p className="text-[13px] text-[var(--color-text-secondary)]">
          {picked
            ? `Pinned at ${picked.lat.toFixed(3)}, ${picked.lng.toFixed(3)}. Drag the pin or click elsewhere to move it.`
            : 'Click the map where the award is judged or presented (or where the organizer is, if it runs online).'}
        </p>
        <input
          id="aw-place"
          className={input}
          value={f.place_name}
          onChange={(e) => set('place_name', e.target.value)}
          placeholder="Place name, e.g. Almaty, Satbayev University"
          maxLength={120}
          aria-label="Place name"
        />
      </div>

      <span className={label}>2 · The award</span>
      <input id="aw-name" className={input} value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="Award or competition name *" maxLength={140} aria-label="Award name" />
      <input id="aw-org" className={input} value={f.org} onChange={(e) => set('org', e.target.value)} placeholder="Organizer *" maxLength={140} aria-label="Organizer" />
      <input id="aw-url" className={input} value={f.url} onChange={(e) => set('url', e.target.value)} placeholder="Official page, https:// *" maxLength={500} inputMode="url" aria-label="Official page" />
      <input id="aw-register" className={input} value={f.register} onChange={(e) => set('register', e.target.value)} placeholder="Registration or submission link (optional)" maxLength={500} inputMode="url" aria-label="Registration link" />
      <div className="grid grid-cols-2 gap-2">
        <select id="aw-kind" className={input} value={f.kind} onChange={(e) => set('kind', e.target.value)} aria-label="Type">
          {KIND_OPTIONS.map((k) => (
            <option key={k}>{k}</option>
          ))}
        </select>
        <input id="aw-region" className={input} value={f.region} onChange={(e) => set('region', e.target.value)} placeholder="Region, e.g. Worldwide" maxLength={80} aria-label="Region" />
      </div>

      <span className={label}>3 · Deadline</span>
      <div className="grid grid-cols-[1fr_auto] items-center gap-3">
        <input id="aw-deadline" type="date" className={input} value={f.deadline} onChange={(e) => set('deadline', e.target.value)} min="2020-01-01" max="2035-12-31" aria-label="Deadline" />
        <label className="flex items-center gap-2 text-[13px] text-[var(--color-text-secondary)]">
          <input id="aw-firm" type="checkbox" checked={f.firm} onChange={(e) => set('firm', e.target.checked)} />
          Officially announced
        </label>
      </div>

      <span className={label}>4 · Who can enter</span>
      <div className="flex flex-wrap gap-2">
        {AUDIENCES.filter((x) => x.id !== 'all').map((x) => {
          const id = x.id as Audience;
          const on = f.aud.includes(id);
          return (
            <button
              key={id}
              type="button"
              aria-pressed={on}
              onClick={() => set('aud', on ? f.aud.filter((v) => v !== id) : [...f.aud, id])}
              className={`pill pill-sm cursor-pointer ${on ? 'pill-active' : ''}`}
            >
              {x.label}
            </button>
          );
        })}
      </div>

      <span className={label}>5 · Details (optional)</span>
      <textarea id="aw-prize" className={area} value={f.prize} onChange={(e) => set('prize', e.target.value)} placeholder="Prize, e.g. $500 and a trophy" maxLength={600} aria-label="Prize" />
      <textarea id="aw-need" className={area} value={f.need} onChange={(e) => set('need', e.target.value)} placeholder="What entrants need to send" maxLength={600} aria-label="What you need" />
      <textarea id="aw-elig" className={area} value={f.elig} onChange={(e) => set('elig', e.target.value)} placeholder="Eligibility" maxLength={600} aria-label="Eligibility" />
      <input id="aw-fee" className={input} value={f.fee} onChange={(e) => set('fee', e.target.value)} placeholder="Entry fee, e.g. Free" maxLength={120} aria-label="Entry fee" />
      <textarea id="aw-note" className={area} value={f.note} onChange={(e) => set('note', e.target.value)} placeholder="Anything else worth knowing" maxLength={600} aria-label="Notes" />
      <input id="aw-by" className={input} value={f.submitted_by} onChange={(e) => set('submitted_by', e.target.value)} placeholder="Your name or handle (optional, shown publicly)" maxLength={80} aria-label="Your name" />
      <input
        id="aw-website"
        className="absolute left-[-9999px] h-px w-px opacity-0"
        tabIndex={-1}
        autoComplete="off"
        value={f.website}
        onChange={(e) => set('website', e.target.value)}
        aria-hidden="true"
      />

      {error && (
        <p role="alert" className="rounded-[var(--radius-sm)] border border-[#c0605a] px-3 py-2 text-[13px] text-[var(--color-text-primary)]">
          {error}
        </p>
      )}
      <p className="text-[12px] leading-snug text-[var(--color-text-muted)]">
        Entries are public as soon as you add them and cannot be edited afterwards. Don't include personal contact details.
      </p>
      <div className="flex gap-2">
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? 'Adding…' : 'Add to the map'}
        </button>
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

/* ---------------- Page ---------------- */

type Tab = 'list' | 'timeline' | 'add';

export default function MapAwardsPage() {
  usePageMeta(
    'Map Awards Calendar',
    'Every cartography, GIS and data visualization award on one map: deadlines, prizes, what to submit, and a calendar feed for Google, Apple and Outlook.',
  );
  const isDesktop = useIsDesktop();
  const [params, setParams] = useSearchParams();
  const selectedId = params.get('award');
  const [tab, setTab] = useState<Tab>('list');
  const [panelOpen, setPanelOpen] = useState(true);
  const [aud, setAud] = useState<Audience | 'all'>('all');
  const [kind, setKind] = useState('All types');
  const [q, setQ] = useState('');
  const [hideClosed, setHideClosed] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [placeKey, setPlaceKey] = useState<string | null>(null);
  const [community, setCommunity] = useState<CommunityEntry[]>([]);
  const [communityError, setCommunityError] = useState<string | null>(null);
  const [picked, setPicked] = useState<{ lng: number; lat: number } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadCommunity()
      .then(setCommunity)
      .catch((e: unknown) => setCommunityError(e instanceof Error ? e.message : 'Could not load visitor entries.'));
  }, []);

  const ALL = useMemo(() => [...CURATED, ...community.map((c) => c.award)], [community]);
  const PLACES = useMemo(() => {
    const merged: Record<string, AwardPlace> = { ...CURATED_PLACES };
    for (const c of community) merged[c.placeKey] = c.place;
    return merged;
  }, [community]);
  const placeOf = useCallback(
    (a: Award) => {
      const p = PLACES[a.place];
      return p ? `${p.name} (${p.detail})` : '';
    },
    [PLACES],
  );
  const kinds = useMemo(() => ['All types', ...Array.from(new Set(ALL.map((a) => a.kind))).sort()], [ALL]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return ALL.filter((a) => {
      if (aud !== 'all' && !a.aud.includes(aud)) return false;
      if (kind !== 'All types' && a.kind !== kind) return false;
      if (hideClosed && statusOf(a) === 'closed') return false;
      if (needle && !`${a.name} ${a.org} ${a.region} ${a.kind} ${PLACES[a.place]?.name}`.toLowerCase().includes(needle)) return false;
      return true;
    }).sort((x, y) => compareAwards(x, y));
  }, [ALL, PLACES, aud, kind, q, hideClosed]);

  const shown = placeKey ? filtered.filter((a) => a.place === placeKey) : filtered;
  const selected = selectedId ? ALL.find((a) => a.id === selectedId) : undefined;
  const adding = tab === 'add';
  const mapPlace = adding ? null : selected ? selected.place : placeKey;

  const open = (id: string) => {
    setTab('list');
    setPanelOpen(true);
    setParams({ award: id });
    bodyRef.current?.scrollTo({ top: 0 });
  };
  const close = () => setParams({});

  const today = startOfToday();
  const openNow = ALL.filter((a) => ['open', 'running'].includes(statusOf(a, today))).length;
  const filtersActive = aud !== 'all' || kind !== 'All types' || hideClosed || q.trim() !== '';

  const leftInset = isDesktop && panelOpen ? 452 : 0;
  const bottomInset = !isDesktop && panelOpen ? Math.round(window.innerHeight * 0.5) : 0;

  const tabBtn = (id: Tab, text: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={tab === id}
      onClick={() => {
        setTab(id);
        if (id !== 'list') close();
        if (id !== 'add') setPicked(null);
        setPanelOpen(true);
      }}
      className={`rounded-[var(--radius-sm)] px-3 py-1.5 text-[13px] transition-colors ${
        tab === id
          ? 'bg-[var(--color-bg-elevated)] text-[var(--color-text-primary)]'
          : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
      }`}
    >
      {text}
    </button>
  );

  return (
    <div className="relative h-[calc(100dvh-4rem)] w-full overflow-hidden bg-[#0d1320]">
      {/* The map is the page. */}
      <div className="absolute inset-0">
        <Suspense fallback={<div className="flex h-full items-center justify-center"><span className="mono-label">Loading map…</span></div>}>
          <AwardsMap
            awards={adding ? ALL : filtered}
            places={PLACES}
            selectedPlace={mapPlace}
            leftInset={leftInset}
            bottomInset={bottomInset}
            pickMode={adding}
            picked={picked}
            onPick={setPicked}
            onSelectPlace={(key) => {
              const here = filtered.filter((a) => a.place === key);
              setPanelOpen(true);
              setTab('list');
              if (here.length === 1) {
                setPlaceKey(null);
                open(here[0].id);
              } else {
                setPlaceKey(key);
                if (selected) close();
              }
            }}
          />
        </Suspense>
      </div>

      {/* Top-right actions. */}
      <div className="absolute right-3 top-3 z-20 flex flex-wrap items-start justify-end gap-2">
        <button
          type="button"
          className="btn btn-secondary bg-[var(--color-bg-overlay)] shadow-[var(--shadow-elevated)]"
          onClick={() => {
            setTab('add');
            setPanelOpen(true);
            close();
          }}
        >
          + Add an award
        </button>
        <CalendarMenu visible={filtered} placeOf={placeOf} />
      </div>

      {adding && (
        <div className="pointer-events-none absolute left-1/2 top-16 z-10 -translate-x-1/2 rounded-[var(--radius-full)] bg-[rgba(13,19,32,0.88)] px-4 py-2 text-[13px] text-[#dce3ef] shadow-[var(--shadow-elevated)] lg:left-[calc(50%+226px)]">
          {picked ? 'Pin placed. Drag it or click again to move.' : 'Click the map to place the new award'}
        </div>
      )}

      {toast && (
        <div role="status" className="absolute bottom-16 left-1/2 z-30 -translate-x-1/2 rounded-[var(--radius-md)] bg-[var(--color-bg-overlay)] px-4 py-2 text-[13px] shadow-[var(--shadow-elevated)] lg:left-[calc(50%+226px)]">
          {toast}
        </div>
      )}

      {/* Floating panel: a column on desktop, a bottom sheet on phones. */}
      {!panelOpen && isDesktop && (
        <button
          type="button"
          onClick={() => setPanelOpen(true)}
          className="absolute left-3 top-3 z-20 rounded-[var(--radius-md)] border border-[var(--color-border-default)] bg-[var(--color-bg-overlay)] px-4 py-2 text-[13px] shadow-[var(--shadow-elevated)]"
        >
          ☰ Map Awards · {filtered.length}
        </button>
      )}
      <aside
        aria-label="Awards list"
        className={`absolute z-20 flex flex-col overflow-hidden border border-[var(--color-border-default)] bg-[rgba(var(--color-chrome-rgb),0.95)] shadow-[var(--shadow-elevated)] backdrop-blur-md ${
          isDesktop
            ? `bottom-3 left-3 top-3 w-[436px] rounded-[var(--radius-lg)] ${panelOpen ? '' : 'hidden'}`
            : `inset-x-0 bottom-0 rounded-t-[var(--radius-lg)] ${panelOpen ? 'h-[50%]' : 'h-auto'}`
        }`}
      >
        <header className="grid gap-2 border-b border-[var(--color-border-subtle)] px-4 pb-3 pt-3">
          <div className="flex items-center justify-between gap-2">
            <Link to="/journal" className="font-[family-name:var(--font-mono)] text-[12px] text-[var(--color-accent-light)] hover:text-[var(--color-text-primary)]">
              ← Blog
            </Link>
            <button
              type="button"
              onClick={() => setPanelOpen((v) => !v)}
              aria-expanded={panelOpen}
              className="font-[family-name:var(--font-mono)] text-[12px] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
            >
              {isDesktop ? 'Hide panel ⟨' : panelOpen ? 'Collapse ▾' : 'Expand ▴'}
            </button>
          </div>
          <h1 className="font-[family-name:var(--font-heading)] text-[22px] font-extrabold leading-tight">Map Awards Calendar</h1>
          <p className="flex flex-wrap gap-x-4 gap-y-0.5 font-[family-name:var(--font-mono)] text-[11.5px] text-[var(--color-text-muted)]">
            <span>
              <b className="text-[var(--color-text-primary)]">{ALL.length}</b> programs
            </span>
            <span>
              <b className="text-[var(--color-text-primary)]">{openNow}</b> open now
            </span>
            {community.length > 0 && (
              <span>
                <b className="text-[var(--color-text-primary)]">{community.length}</b> from visitors
              </span>
            )}
            <span>checked {formatDay(awardsData.checked)}</span>
          </p>
          {(panelOpen || isDesktop) && (
            <div role="tablist" className="flex gap-1 rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] p-1">
              {tabBtn('list', 'List')}
              {tabBtn('timeline', 'By month')}
              {tabBtn('add', '+ Add')}
            </div>
          )}
        </header>

        {(panelOpen || isDesktop) && tab !== 'add' && !selected && (
          <div className="grid gap-2 border-b border-[var(--color-border-subtle)] px-4 py-3">
            <div className="flex gap-2">
              <input
                id="aw-search"
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search name, organizer, city"
                aria-label="Search awards"
                className={input}
              />
              <button
                type="button"
                aria-expanded={showFilters}
                onClick={() => setShowFilters((v) => !v)}
                className={`shrink-0 rounded-[var(--radius-md)] border px-3 text-[12.5px] ${filtersActive ? 'border-[var(--color-accent)] text-[var(--color-accent-light)]' : 'border-[var(--color-border-default)] text-[var(--color-text-secondary)]'}`}
              >
                Filters{filtersActive ? ' •' : ''}
              </button>
            </div>
            {showFilters && (
              <div className="grid gap-2">
                <div className="flex flex-wrap gap-1.5" role="group" aria-label="Who can enter">
                  {AUDIENCES.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      aria-pressed={aud === t.id}
                      onClick={() => setAud(t.id)}
                      className={`pill pill-sm cursor-pointer hover:border-[var(--color-accent)] ${aud === t.id ? 'pill-active' : ''}`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-3">
                  <select id="aw-kind-filter" value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Type of program" className={`${input} w-auto`}>
                    {kinds.map((k) => (
                      <option key={k}>{k}</option>
                    ))}
                  </select>
                  <label className="flex items-center gap-2 text-[13px] text-[var(--color-text-secondary)]">
                    <input id="aw-hide-closed" type="checkbox" checked={hideClosed} onChange={(e) => setHideClosed(e.target.checked)} />
                    Hide closed
                  </label>
                </div>
              </div>
            )}
          </div>
        )}

        {(panelOpen || isDesktop) && (
          <div ref={bodyRef} className="min-h-0 flex-1 overflow-y-auto">
            {tab === 'add' ? (
              <AddAwardForm
                picked={picked}
                onCancel={() => {
                  setTab('list');
                  setPicked(null);
                }}
                onAdded={(entry) => {
                  setCommunity((c) => [entry, ...c]);
                  setPicked(null);
                  setTab('list');
                  setParams({ award: entry.award.id });
                  bodyRef.current?.scrollTo({ top: 0 });
                  setToast('Added. Thanks! It is on the map now.');
                  setTimeout(() => setToast(null), 3500);
                }}
              />
            ) : selected ? (
              <AwardDetail
                a={selected}
                place={PLACES[selected.place]}
                placeOf={placeOf}
                onBack={close}
                onRemoveLocal={(id) => {
                  removeLocal(id);
                  setCommunity((c) => c.filter((x) => x.award.id !== id));
                  close();
                }}
              />
            ) : tab === 'timeline' ? (
              <Timeline list={filtered} onOpen={open} />
            ) : (
              <>
                <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-[var(--color-border-subtle)] bg-[rgba(var(--color-chrome-rgb),0.97)] px-4 py-2 font-[family-name:var(--font-mono)] text-[12px] text-[var(--color-text-muted)]">
                  {placeKey ? (
                    <>
                      <span>
                        {shown.length} at {PLACES[placeKey]?.name}
                      </span>
                      <button type="button" className="text-[var(--color-accent-light)] hover:text-[var(--color-text-primary)]" onClick={() => setPlaceKey(null)}>
                        Show all ✕
                      </button>
                    </>
                  ) : (
                    <span>
                      {shown.length} of {ALL.length} · sorted by deadline
                    </span>
                  )}
                </div>
                {communityError && <p className="px-4 py-2 text-[12px] text-[var(--color-text-muted)]">{communityError}</p>}
                {shown.length ? (
                  <ul className="m-0 list-none p-0">
                    {shown.map((a) => (
                      <AwardRow key={a.id} a={a} placeName={PLACES[a.place]?.name ?? ''} onOpen={() => open(a.id)} />
                    ))}
                  </ul>
                ) : (
                  <p className="p-6 text-[14px] text-[var(--color-text-muted)]">No programs match these filters.</p>
                )}
                <p className="px-4 py-4 text-[12px] leading-relaxed text-[var(--color-text-muted)]">
                  Pins mark where a program is judged or presented, or the organizer's base when there is no venue. Faded pins are a
                  country, not an address. Entries marked “added by a visitor” are not checked; confirm on the official page.
                </p>
              </>
            )}
          </div>
        )}
      </aside>
    </div>
  );
}
