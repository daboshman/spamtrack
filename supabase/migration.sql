-- SpamTrack: cases table
-- Run this in: Supabase Dashboard → SQL Editor → New query

create table if not exists cases (
  id                uuid        primary key default gen_random_uuid(),
  case_number       text,
  defendant         text,
  contact_email     text,
  contact_phone     text,
  contact_address   text,
  channel           text,
  violations        jsonb,
  message_count     integer,
  first_message_date date,
  stage             text,
  claim_amount      integer,
  court_costs       integer,
  notes             text,
  timeline          jsonb,
  screenshots       jsonb,
  created_at        timestamptz default now()
);

-- Enable Row Level Security
alter table cases enable row level security;

-- Single open policy: personal single-user app, no auth required
create policy "allow_all"
  on cases
  for all
  using (true)
  with check (true);
