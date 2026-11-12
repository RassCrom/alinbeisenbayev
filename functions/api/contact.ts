/*
 * Cloudflare Pages Function: POST /api/contact.
 *
 * Pages turns this file's path into the route. Everything it does is in
 * src/server/contact.ts, where it is type-checked and tested with the rest of
 * the site; this file only hands the request and the environment over.
 *
 * Set these under Pages > Settings > Variables and Secrets (see .env.example):
 * RESEND_API_KEY, CONTACT_TO, and optionally CONTACT_FROM, SUPABASE_URL,
 * SUPABASE_ANON_KEY.
 */
import { handleContact, type ContactEnv } from '../../src/server/contact';

export const onRequest = ({ request, env }: { request: Request; env: ContactEnv }): Promise<Response> =>
  handleContact(request, env);
