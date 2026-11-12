-- Community-submitted awards for /blog/map-awards.
--
-- Run once in the Supabase SQL editor (Dashboard → SQL → New query → Run).
-- Then set two environment variables on Vercel (Project → Settings →
-- Environment Variables) and in a local .env.local for `npm run dev`:
--
--   VITE_SUPABASE_URL=https://<project-ref>.supabase.co
--   VITE_SUPABASE_ANON_KEY=<the project's publishable / anon key>
--
-- The anon key is meant to be public; this table is protected by row level
-- security below, which is what decides what a visitor can do.
--
-- Entries are published instantly: anyone can read and insert, nobody can
-- update or delete through the API. To take an entry down, set hidden = true
-- in the Table Editor (or delete the row there); hidden rows are not returned.

create table if not exists public.award_submissions (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  name          text not null check (char_length(name) between 3 and 140),
  org           text not null check (char_length(org) between 2 and 140),
  url           text not null check (url ~* '^https?://[^ ]+$' and char_length(url) <= 500),
  register      text check (register is null or (register ~* '^https?://[^ ]+$' and char_length(register) <= 500)),
  kind          text not null check (kind in (
                  'Map design', 'Storytelling', 'Data viz', 'Student', 'Children',
                  'Professional', 'Community', 'Earth observation', 'Showcase', 'Other')),
  aud           text[] not null default '{open}'
                  check (cardinality(aud) between 1 and 6
                         and aud <@ array['open','student','children','industry','national','members']::text[]),
  region        text check (region is null or char_length(region) <= 80),
  deadline      date check (deadline is null or deadline between date '2020-01-01' and date '2035-12-31'),
  firm          boolean not null default false,
  prize         text check (prize is null or char_length(prize) <= 600),
  fee           text check (fee is null or char_length(fee) <= 120),
  elig          text check (elig is null or char_length(elig) <= 600),
  need          text check (need is null or char_length(need) <= 600),
  note          text check (note is null or char_length(note) <= 600),
  place_name    text not null check (char_length(place_name) between 2 and 120),
  lat           double precision not null check (lat between -90 and 90),
  lng           double precision not null check (lng between -180 and 180),
  submitted_by  text check (submitted_by is null or char_length(submitted_by) <= 80),
  hidden        boolean not null default false
);

create index if not exists award_submissions_created_idx on public.award_submissions (created_at desc);

alter table public.award_submissions enable row level security;

drop policy if exists "Anyone can read visible submissions" on public.award_submissions;
create policy "Anyone can read visible submissions"
  on public.award_submissions for select
  to anon, authenticated
  using (hidden = false);

drop policy if exists "Anyone can add a submission" on public.award_submissions;
create policy "Anyone can add a submission"
  on public.award_submissions for insert
  to anon, authenticated
  with check (hidden = false);

-- No update or delete policies: the API cannot change or remove rows.
revoke update, delete, truncate on public.award_submissions from anon, authenticated;
