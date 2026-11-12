-- Inquiries sent through the "Work with me" form (/contact).
--
-- Run once in the Supabase SQL editor (Dashboard > SQL > New query > Run).
-- Then set SUPABASE_URL and SUPABASE_ANON_KEY for the Pages Function
-- (Cloudflare > Pages > the project > Settings > Variables and Secrets).
--
-- The public key can add a row and do nothing else: it cannot read, change
-- or delete inquiries. Read them in the Table Editor, signed in to Supabase.
--
-- The length checks mirror src/shared/inquiry.ts. Keep the two in step.

create table if not exists public.inquiries (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  name        text not null check (char_length(name) between 2 and 80),
  email       text not null check (char_length(email) <= 120 and email ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$'),
  offers      text[] not null default '{}'
                check (cardinality(offers) <= 5
                       and offers <@ array['custom-maps','spatial-analysis','data-visualization',
                                           'data-journalism','remote-sensing']::text[]),
  message     text not null check (char_length(message) between 10 and 4000)
);

create index if not exists inquiries_created_idx on public.inquiries (created_at desc);

alter table public.inquiries enable row level security;

drop policy if exists "Anyone can send an inquiry" on public.inquiries;
create policy "Anyone can send an inquiry"
  on public.inquiries for insert
  to anon, authenticated
  with check (true);

-- No select, update or delete policy: with row level security on, the API
-- can do none of those. The revoke makes the same thing explicit.
revoke select, update, delete, truncate on public.inquiries from anon, authenticated;
