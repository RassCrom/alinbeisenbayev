/*
 * Awards added by visitors from the /journal/map-awards form.
 *
 * Shared storage is a Supabase table (supabase/award_submissions.sql), reached
 * through its REST endpoint with plain fetch — no SDK, nothing added to the
 * bundle. Row level security there is what allows read + insert and nothing
 * else. Until VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are set, entries are
 * kept in this visitor's browser instead, and the form says so.
 */
import type { Audience, Award, AwardPlace } from './mapAwards';

const URL_BASE = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.replace(/\/$/, '');
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const TABLE = 'award_submissions';
const LOCAL_KEY = 'map-awards:local-entries';

export const sharedStorage = Boolean(URL_BASE && KEY);

/** One row of public.award_submissions. */
export interface SubmissionRow {
  id: string;
  created_at: string;
  name: string;
  org: string;
  url: string;
  register: string | null;
  kind: string;
  aud: Audience[];
  region: string | null;
  deadline: string | null;
  firm: boolean;
  prize: string | null;
  fee: string | null;
  elig: string | null;
  need: string | null;
  note: string | null;
  place_name: string;
  lat: number;
  lng: number;
  submitted_by: string | null;
}

export type NewSubmission = Omit<SubmissionRow, 'id' | 'created_at'>;

export interface CommunityEntry {
  award: Award;
  placeKey: string;
  place: AwardPlace;
}

export function toEntry(row: SubmissionRow, source: 'community' | 'local'): CommunityEntry {
  const placeKey = `${source}:${row.id}`;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const upcoming = row.deadline ? new Date(`${row.deadline}T00:00:00`) >= today : false;
  const label = row.deadline
    ? new Date(`${row.deadline}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : 'Date not given';
  return {
    placeKey,
    place: {
      name: row.place_name,
      detail: source === 'local' ? 'Added in this browser' : 'Added by a visitor',
      lat: row.lat,
      lng: row.lng,
      role: 'venue',
    },
    award: {
      id: placeKey,
      name: row.name,
      org: row.org,
      kind: row.kind,
      aud: row.aud?.length ? row.aud : ['open'],
      region: row.region || row.place_name,
      place: placeKey,
      when: row.deadline ?? undefined,
      firm: row.firm,
      // A confirmed future date from the submitter reads as "open"; we can't know more.
      open: row.firm && upcoming,
      label: row.firm || !row.deadline ? label : `Expected ${label}`,
      prize: row.prize || 'Not given',
      fee: row.fee || 'Not given',
      elig: row.elig || 'Not given',
      need: row.need || 'Not given',
      note: row.note || '',
      url: row.url,
      register: row.register || undefined,
      source,
      submittedBy: row.submitted_by || undefined,
      createdAt: row.created_at,
    },
  };
}

function headers(extra: Record<string, string> = {}): HeadersInit {
  return { apikey: KEY as string, Authorization: `Bearer ${KEY}`, ...extra };
}

function readLocal(): SubmissionRow[] {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    return raw ? (JSON.parse(raw) as SubmissionRow[]) : [];
  } catch {
    return [];
  }
}

function writeLocal(rows: SubmissionRow[]) {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(rows));
  } catch {
    /* storage blocked: the entry still shows until reload */
  }
}

/** Shared rows (if configured) plus anything saved in this browser. */
export async function loadCommunity(): Promise<CommunityEntry[]> {
  const local = readLocal().map((r) => toEntry(r, 'local'));
  if (!sharedStorage) return local;
  const res = await fetch(
    `${URL_BASE}/rest/v1/${TABLE}?select=*&order=created_at.desc&limit=500`,
    { headers: headers() },
  );
  if (!res.ok) throw new Error(`Could not load community awards (${res.status})`);
  const rows = (await res.json()) as SubmissionRow[];
  return [...rows.map((r) => toEntry(r, 'community')), ...local];
}

/** Insert one entry; returns it ready to show. */
export async function addCommunity(entry: NewSubmission): Promise<CommunityEntry> {
  if (!sharedStorage) {
    const row: SubmissionRow = {
      ...entry,
      id: Math.random().toString(36).slice(2, 10),
      created_at: new Date().toISOString(),
    };
    writeLocal([row, ...readLocal()]);
    return toEntry(row, 'local');
  }
  const res = await fetch(`${URL_BASE}/rest/v1/${TABLE}`, {
    method: 'POST',
    headers: headers({ 'Content-Type': 'application/json', Prefer: 'return=representation' }),
    body: JSON.stringify(entry),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(
      res.status === 400 || res.status === 422
        ? 'One of the fields was rejected. Check the links start with https:// and the texts are not too long.'
        : `The entry could not be saved (${res.status}). ${detail.slice(0, 120)}`,
    );
  }
  const [row] = (await res.json()) as SubmissionRow[];
  return toEntry(row, 'community');
}

/** Removes an entry saved in this browser (shared ones can only be hidden by the site owner). */
export function removeLocal(id: string) {
  writeLocal(readLocal().filter((r) => `local:${r.id}` !== id));
}
