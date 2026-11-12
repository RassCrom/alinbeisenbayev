import { offerLabel } from '../data/offers';
import { MIN_FILL_MS, validateInquiry, type Inquiry } from '../shared/inquiry';

/*
 * The server side of the "Work with me" form.
 *
 * Runs as a Cloudflare Pages Function (functions/api/contact.ts) in
 * production and as a dev-server middleware locally (vite.config.ts). It
 * checks the inquiry again (the browser's checks are a courtesy, not a
 * guarantee), stores it in Supabase and emails it through Resend. Either
 * delivery working is enough for the visitor to be told it was sent; neither
 * working is always reported as a failure, never as success.
 */

export interface ContactEnv {
  /** Resend API key. Without it (or CONTACT_TO) no email is sent. */
  RESEND_API_KEY?: string;
  /** Where inquiries are emailed. Never hard-coded here. */
  CONTACT_TO?: string;
  /** The sender. Resend's test sender works until a domain is verified. */
  CONTACT_FROM?: string;
  /** Supabase project URL and public key. Without them nothing is stored. */
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
}

const DEFAULT_FROM = 'Portfolio <onboarding@resend.dev>';
/** Far above the longest valid inquiry; anything bigger is not one. */
const MAX_BODY_CHARS = 20_000;

const json = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });

/** A header value on one line: an injected line break would start a new header. */
const oneLine = (value: string): string => value.replace(/[\r\n]+/g, ' ').trim();

async function store(inquiry: Inquiry, env: ContactEnv, fetchImpl: typeof fetch): Promise<boolean> {
  const response = await fetchImpl(`${env.SUPABASE_URL}/rest/v1/inquiries`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      apikey: env.SUPABASE_ANON_KEY!,
      authorization: `Bearer ${env.SUPABASE_ANON_KEY}`,
      prefer: 'return=minimal',
    },
    body: JSON.stringify(inquiry),
  });
  return response.ok;
}

async function email(inquiry: Inquiry, env: ContactEnv, fetchImpl: typeof fetch): Promise<boolean> {
  const offers = inquiry.offers.map(offerLabel).join(', ') || 'Not specified';
  const response = await fetchImpl('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${env.RESEND_API_KEY}` },
    body: JSON.stringify({
      from: env.CONTACT_FROM || DEFAULT_FROM,
      to: [env.CONTACT_TO],
      // Replying to the notification answers the visitor.
      reply_to: inquiry.email,
      subject: `New inquiry from ${oneLine(inquiry.name)}`,
      text: `From: ${oneLine(inquiry.name)} <${inquiry.email}>\nNeeds: ${offers}\n\n${inquiry.message}\n`,
    }),
  });
  return response.ok;
}

/** Whether an Origin header names the host the request was sent to. An unparseable one ("null") does not. */
function sameHost(origin: string, url: string): boolean {
  try {
    return new URL(origin).host === new URL(url).host;
  } catch {
    return false;
  }
}

/** A delivery that throws has failed; it must not take the other one down with it. */
const attempt = (delivery: Promise<boolean>): Promise<boolean> => delivery.catch(() => false);

export async function handleContact(
  request: Request,
  env: ContactEnv,
  fetchImpl: typeof fetch = fetch,
): Promise<Response> {
  if (request.method !== 'POST') return json(405, { ok: false, error: 'method-not-allowed' });

  // Browsers send Origin on cross-site posts. Another site's page has no
  // business submitting this form.
  const origin = request.headers.get('origin');
  if (origin && !sameHost(origin, request.url)) return json(403, { ok: false, error: 'forbidden' });

  const raw = await request.text();
  if (raw.length > MAX_BODY_CHARS) return json(413, { ok: false, error: 'too-large' });

  let body: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) throw new Error('not an object');
    body = parsed as Record<string, unknown>;
  } catch {
    return json(400, { ok: false, error: 'bad-request' });
  }

  // A filled honeypot or an instant submit is a bot. It is told it worked, so
  // it learns nothing, and nothing is stored or sent.
  const tooFast = typeof body.elapsedMs !== 'number' || body.elapsedMs < MIN_FILL_MS;
  if (body.company || tooFast) return json(200, { ok: true });

  const { inquiry, errors } = validateInquiry(body);
  if (Object.keys(errors).length > 0) return json(400, { ok: false, errors });

  const deliveries: Promise<boolean>[] = [];
  if (env.SUPABASE_URL && env.SUPABASE_ANON_KEY) deliveries.push(attempt(store(inquiry, env, fetchImpl)));
  if (env.RESEND_API_KEY && env.CONTACT_TO) deliveries.push(attempt(email(inquiry, env, fetchImpl)));
  if (deliveries.length === 0) return json(503, { ok: false, error: 'not-configured' });

  const delivered = (await Promise.all(deliveries)).some(Boolean);
  return delivered ? json(200, { ok: true }) : json(502, { ok: false, error: 'delivery-failed' });
}
