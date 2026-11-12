import { expect, it } from 'vitest';
import { handleContact, type ContactEnv } from './contact';

const ENV: ContactEnv = {
  RESEND_API_KEY: 're_test',
  CONTACT_TO: 'owner@example.com',
  SUPABASE_URL: 'https://proj.supabase.co',
  SUPABASE_ANON_KEY: 'anon',
};
const GOOD = {
  name: 'Dana',
  email: 'dana@example.com',
  offers: ['custom-maps', 'remote-sensing'],
  message: 'I need a map of my city.',
  company: '',
  elapsedMs: 9000,
};

interface Call {
  url: string;
  init: RequestInit;
  body: Record<string, unknown>;
}

/** A fetch that records its calls and answers each host as told. */
function fakeFetch(status: { resend?: number; supabase?: number } = {}) {
  const calls: Call[] = [];
  const impl = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = String(input);
    calls.push({ url, init, body: JSON.parse(String(init.body)) });
    const code = url.includes('resend.com') ? (status.resend ?? 200) : (status.supabase ?? 201);
    return new Response(code < 300 ? '{}' : 'nope', { status: code });
  }) as typeof fetch;
  return { impl, calls };
}

const post = (body: unknown, headers: Record<string, string> = {}) =>
  new Request('https://alinbeisenbayev.com/api/contact', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

it('stores the inquiry and emails it', async () => {
  const { impl, calls } = fakeFetch();
  const response = await handleContact(post(GOOD), ENV, impl);
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ ok: true });

  const store = calls.find((call) => call.url.includes('supabase.co'))!;
  expect(store.url).toBe('https://proj.supabase.co/rest/v1/inquiries');
  expect(store.body).toEqual({ name: 'Dana', email: 'dana@example.com', offers: GOOD.offers, message: GOOD.message });
  expect(new Headers(store.init.headers).get('apikey')).toBe('anon');

  const mail = calls.find((call) => call.url.includes('resend.com'))!;
  expect(mail.url).toBe('https://api.resend.com/emails');
  expect(new Headers(mail.init.headers).get('authorization')).toBe('Bearer re_test');
  expect(mail.body.to).toEqual(['owner@example.com']);
  expect(mail.body.reply_to).toBe('dana@example.com');
  expect(mail.body.subject).toBe('New inquiry from Dana');
  expect(mail.body.text).toContain('I need a map of my city.');
  expect(mail.body.text).toContain('Custom maps, Remote sensing');
});

it('keeps line breaks out of the subject', async () => {
  const { impl, calls } = fakeFetch();
  await handleContact(post({ ...GOOD, name: 'Dana\r\nBcc: x@y.z' }), ENV, impl);
  expect(calls.find((call) => call.url.includes('resend.com'))!.body.subject).toBe('New inquiry from Dana Bcc: x@y.z');
});

it('answers a filled honeypot as if it worked and sends nothing', async () => {
  const { impl, calls } = fakeFetch();
  const response = await handleContact(post({ ...GOOD, company: 'Acme' }), ENV, impl);
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ ok: true });
  expect(calls).toHaveLength(0);
});

it('answers an instant submit as if it worked and sends nothing', async () => {
  for (const elapsedMs of [0, 2499, undefined, 'fast']) {
    const { impl, calls } = fakeFetch();
    const response = await handleContact(post({ ...GOOD, elapsedMs }), ENV, impl);
    expect(response.status, String(elapsedMs)).toBe(200);
    expect(calls, String(elapsedMs)).toHaveLength(0);
  }
});

it('says what is wrong with an invalid inquiry and sends nothing', async () => {
  const { impl, calls } = fakeFetch();
  const response = await handleContact(post({ ...GOOD, email: 'nope', message: '' }), ENV, impl);
  expect(response.status).toBe(400);
  const body = (await response.json()) as { ok: boolean; errors: Record<string, string> };
  expect(body.ok).toBe(false);
  expect(Object.keys(body.errors).sort()).toEqual(['email', 'message']);
  expect(calls).toHaveLength(0);
});

it('never claims success when nothing is configured', async () => {
  const { impl, calls } = fakeFetch();
  const response = await handleContact(post(GOOD), {}, impl);
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({ ok: false, error: 'not-configured' });
  expect(calls).toHaveLength(0);
});

it('needs an address to send to before it will email', async () => {
  const { impl, calls } = fakeFetch();
  const response = await handleContact(post(GOOD), { RESEND_API_KEY: 're_test' }, impl);
  expect(response.status).toBe(503);
  expect(calls).toHaveLength(0);
});

it('counts the inquiry as delivered when only one channel works', async () => {
  const mailDown = fakeFetch({ resend: 500 });
  expect((await handleContact(post(GOOD), ENV, mailDown.impl)).status).toBe(200);
  const storeDown = fakeFetch({ supabase: 500 });
  expect((await handleContact(post(GOOD), ENV, storeDown.impl)).status).toBe(200);
});

it('reports failure when every channel fails', async () => {
  const { impl } = fakeFetch({ resend: 500, supabase: 500 });
  const response = await handleContact(post(GOOD), ENV, impl);
  expect(response.status).toBe(502);
  expect(await response.json()).toEqual({ ok: false, error: 'delivery-failed' });
});

it('reports failure when a channel throws', async () => {
  const throwing = (async () => {
    throw new Error('network down');
  }) as unknown as typeof fetch;
  expect((await handleContact(post(GOOD), ENV, throwing)).status).toBe(502);
});

it('accepts only POST', async () => {
  const { impl } = fakeFetch();
  const response = await handleContact(new Request('https://alinbeisenbayev.com/api/contact'), ENV, impl);
  expect(response.status).toBe(405);
});

it('refuses a post from another site', async () => {
  const { impl, calls } = fakeFetch();
  const response = await handleContact(post(GOOD, { origin: 'https://evil.example' }), ENV, impl);
  expect(response.status).toBe(403);
  expect(calls).toHaveLength(0);
  // A sandboxed page sends the literal string "null".
  expect((await handleContact(post(GOOD, { origin: 'null' }), ENV, impl)).status).toBe(403);
  expect(calls).toHaveLength(0);
  const own = await handleContact(post(GOOD, { origin: 'https://alinbeisenbayev.com' }), ENV, impl);
  expect(own.status).toBe(200);
});

it('refuses an oversized or unreadable body', async () => {
  const { impl, calls } = fakeFetch();
  expect((await handleContact(post({ ...GOOD, message: 'x'.repeat(21_000) }), ENV, impl)).status).toBe(413);
  expect((await handleContact(post('{not json'), ENV, impl)).status).toBe(400);
  expect(calls).toHaveLength(0);
});
