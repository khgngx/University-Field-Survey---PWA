-- Run once in the Supabase SQL editor. Not applied automatically.

create table if not exists public.surveys (
  id           uuid primary key,
  building     text        not null,
  floor        text        not null,
  room         text        not null,
  category     text        not null check (category in ('Hardware', 'Projector', 'AC', 'Electrical', 'Furniture')),
  rating       smallint    not null check (rating between 1 and 5),
  defect_notes text        not null default '',
  gps_lat      double precision,
  gps_lng      double precision,
  gps_accuracy double precision,
  version      integer     not null default 1 check (version >= 1),
  photo_path   text,
  created_at   timestamptz not null,
  synced_at    timestamptz not null default now()
);

create index if not exists surveys_room_idx on public.surveys (building, floor, room, created_at desc);

-- The API writes with the service-role key, which bypasses RLS. Enabling RLS with no policies
-- blocks every other (anon/authenticated) access to the table.
alter table public.surveys enable row level security;

-- Private bucket for photos; the API uploads to surveys/{id}.jpg.
insert into storage.buckets (id, name, public)
values ('survey-photos', 'survey-photos', false)
on conflict (id) do nothing;
