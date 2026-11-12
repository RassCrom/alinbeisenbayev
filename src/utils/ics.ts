/*
 * iCalendar (RFC 5545) for the map awards deadlines.
 *
 * Pure string building with no DOM, so the same code runs in the browser (the
 * "Download .ics" button) and in vite.config.ts, which writes the subscribable
 * feed to /calendars/map-awards.ics at build time.
 */
import type { Award } from '../data/mapAwards';

export const SITE_ORIGIN = 'https://alinbeisenbayev.com';
export const AWARDS_FEED_PATH = '/calendars/map-awards.ics';
export const AWARDS_PAGE_PATH = '/blog/map-awards';
export const AWARDS_FEED_URL = `${SITE_ORIGIN}${AWARDS_FEED_PATH}`;

const CALENDAR_NAME = 'Map awards & deadlines';

/** "2027-01-31" → "20270131". */
const compact = (iso: string) => iso.replace(/-/g, '');

/** The day after an ISO date, as "YYYYMMDD" (all-day events end exclusively). */
function nextDay(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + 1));
  return t.toISOString().slice(0, 10).replace(/-/g, '');
}

function escapeText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

/** Fold lines longer than 75 octets, as the spec requires. */
function fold(line: string): string {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const out: string[] = [];
  let current = '';
  let size = 0;
  for (const ch of line) {
    const n = new TextEncoder().encode(ch).length;
    const limit = out.length === 0 ? 75 : 74;
    if (size + n > limit) {
      out.push(current);
      current = '';
      size = 0;
    }
    current += ch;
    size += n;
  }
  out.push(current);
  return out.join('\r\n ');
}

export function eventTitle(a: Award): string {
  // A running challenge ends on its date; an event-only entry (GIS Day) happens on it.
  const prefix = a.ongoing ? 'Ends' : a.label.startsWith('Event') ? 'Event' : a.firm ? 'Deadline' : 'Expected deadline';
  return `${prefix}: ${a.name}`;
}

export function eventDetails(a: Award): string {
  return [
    a.firm ? a.label : `${a.label}. The date is estimated from past cycles; check the official page.`,
    `Organizer: ${a.org}`,
    `Prize: ${a.prize}`,
    `What you need: ${a.need}`,
    `Who can enter: ${a.elig}`,
    `Official page: ${a.url}`,
    a.register && a.register !== a.url ? `Register: ${a.register}` : '',
    `All awards: ${SITE_ORIGIN}${AWARDS_PAGE_PATH}`,
  ]
    .filter(Boolean)
    .join('\n');
}

/** Only entries with a day on the calendar; rolling submissions have none. */
export function calendarAwards(list: Award[]): Award[] {
  return list.filter((a) => a.when && !a.rolling);
}

/**
 * @param stamp ISO date the data was checked; used as DTSTAMP so the feed is
 *              byte-identical between builds when nothing changed.
 * @param location Place name per award id, for the LOCATION field.
 */
export function buildIcs(list: Award[], stamp: string, location: (a: Award) => string = () => ''): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//alinbeisenbayev.com//Map awards//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${CALENDAR_NAME}`,
    'X-WR-CALDESC:Deadlines of cartography\\, GIS and data visualization awards',
    'REFRESH-INTERVAL;VALUE=DURATION:P1D',
    'X-PUBLISHED-TTL:P1D',
  ];
  for (const a of calendarAwards(list)) {
    const when = a.when as string;
    lines.push(
      'BEGIN:VEVENT',
      `UID:${a.id}-${compact(when)}@alinbeisenbayev.com`,
      `DTSTAMP:${compact(stamp)}T000000Z`,
      `DTSTART;VALUE=DATE:${compact(when)}`,
      `DTEND;VALUE=DATE:${nextDay(when)}`,
      `SUMMARY:${escapeText(eventTitle(a))}`,
      `DESCRIPTION:${escapeText(eventDetails(a))}`,
      `URL:${a.url}`,
      `LOCATION:${escapeText(location(a))}`,
      `CATEGORIES:${escapeText(a.kind)}`,
      'TRANSP:TRANSPARENT',
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${escapeText(`One week left: ${a.name}`)}`,
      'TRIGGER:-P7D',
      'END:VALARM',
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}

/** A one-event "Add to Google Calendar" link (no sign-in to this site needed). */
export function googleEventUrl(a: Award, location = ''): string | null {
  if (!a.when || a.rolling) return null;
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: eventTitle(a),
    dates: `${compact(a.when)}/${nextDay(a.when)}`,
    details: eventDetails(a),
    location,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/** Subscribe links: the calendar app keeps the feed in sync when the list changes. */
export const SUBSCRIBE = {
  google: `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(AWARDS_FEED_URL.replace(/^https:/, 'webcal:'))}`,
  apple: AWARDS_FEED_URL.replace(/^https:/, 'webcal:'),
  outlook: `https://outlook.live.com/calendar/0/addfromweb?url=${encodeURIComponent(AWARDS_FEED_URL)}&name=${encodeURIComponent(CALENDAR_NAME)}`,
};
