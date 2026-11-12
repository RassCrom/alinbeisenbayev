import raw from './map-awards.json';

/** Who can enter. `national` = only through a national body (ICA member, Esri office). */
export type Audience = 'open' | 'student' | 'children' | 'industry' | 'national' | 'members';

export interface AwardPlace {
  name: string;
  detail: string;
  lat: number;
  lng: number;
  /** `venue`: where it is judged or presented. `organizer`: where the organizer is based. */
  role: 'venue' | 'organizer';
  /** True when the pin is a country or region, not an exact address. */
  approx?: boolean;
}

export interface Award {
  id: string;
  name: string;
  org: string;
  kind: string;
  aud: Audience[];
  region: string;
  place: string;
  /** ISO day of the next deadline (or the event day). Missing = not known. */
  when?: string;
  /** True when `when` is published by the organizer; false when it is inferred from past cycles. */
  firm: boolean;
  /** Submissions are open right now. */
  open?: boolean;
  /** A running challenge that ends on `when`. */
  ongoing?: boolean;
  /** No deadline: entries are taken any time. */
  rolling?: boolean;
  label: string;
  prize: string;
  fee: string;
  elig: string;
  /** What an entrant has to prepare and send. */
  need: string;
  note: string;
  url: string;
  /** Direct registration or submission link, when it differs from `url`. */
  register?: string;
  /** Set on entries added by visitors through the map's form. */
  source?: 'community' | 'local';
  submittedBy?: string;
  createdAt?: string;
}

export interface AwardsData {
  checked: string;
  places: Record<string, AwardPlace>;
  awards: Award[];
}

export const awardsData = raw as AwardsData;
export const { awards, places } = awardsData;

export const AUDIENCES: { id: Audience | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'open', label: 'Open to anyone' },
  { id: 'student', label: 'Students' },
  { id: 'children', label: 'Children' },
  { id: 'industry', label: 'Industry' },
  { id: 'national', label: 'Via national body' },
  { id: 'members', label: 'Members only' },
];

/** Programme types a visitor can pick when adding an entry (mirrors the SQL check). */
export const KIND_OPTIONS = [
  'Map design',
  'Storytelling',
  'Data viz',
  'Student',
  'Children',
  'Professional',
  'Community',
  'Earth observation',
  'Showcase',
  'Other',
] as const;

export type StatusKey = 'open' | 'firm' | 'expected' | 'closed' | 'running' | 'tba';

export const STATUS_LABEL: Record<StatusKey, string> = {
  open: 'Open now',
  firm: 'Date confirmed',
  expected: 'Expected',
  closed: 'Closed',
  running: 'Running now',
  tba: 'Date TBA',
};

/** Parse "2027-01-31" as a local calendar day (not UTC midnight). */
export function day(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function startOfToday(): Date {
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  return t;
}

export function statusOf(a: Award, today = startOfToday()): StatusKey {
  if (a.rolling) return 'running';
  if (!a.when) return 'tba';
  const past = day(a.when) < today;
  if (a.ongoing) return past ? 'closed' : 'running';
  if (a.firm) return past ? 'closed' : a.open ? 'open' : 'firm';
  return past ? 'tba' : 'expected';
}

export function daysLeft(a: Award, today = startOfToday()): number | null {
  if (!a.when || !a.firm || a.rolling) return null;
  const n = Math.round((day(a.when).getTime() - today.getTime()) / 864e5);
  return n < 0 ? null : n;
}

/** Deadline order; undated and closed entries sink to the end. */
export function compareAwards(a: Award, b: Award, today = startOfToday()): number {
  const ca = statusOf(a, today) === 'closed';
  const cb = statusOf(b, today) === 'closed';
  if (ca !== cb) return ca ? 1 : -1;
  const ta = a.when ? day(a.when).getTime() : Number.MAX_SAFE_INTEGER;
  const tb = b.when ? day(b.when).getTime() : Number.MAX_SAFE_INTEGER;
  return ta - tb;
}
