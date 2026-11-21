-- KineAid – initial schema
-- Run in Supabase: SQL Editor → paste → Run (or `supabase db push` with the CLI).

-- Note: gen_random_uuid() is built into Postgres 13+, so no extension is needed.
-- (pgcrypto lives in the "extensions" schema on Supabase and is not visible from
-- functions that use `set search_path = public`.)

-- ─────────────────────────────────────────────────────────────
-- Profiles & roles
-- ─────────────────────────────────────────────────────────────
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  role        text not null default 'patient' check (role in ('patient', 'kine')),
  full_name   text,
  locale      text not null default 'nl' check (locale in ('nl', 'en')),
  created_at  timestamptz not null default now()
);

-- Users may only edit their own name/locale; role changes go through become_kine().
revoke update on public.profiles from authenticated;
grant update (full_name, locale) on public.profiles to authenticated;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'));
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─────────────────────────────────────────────────────────────
-- Practices & patient links
-- ─────────────────────────────────────────────────────────────
create table public.practices (
  id           uuid primary key default gen_random_uuid(),
  kine_id      uuid not null unique references public.profiles (id) on delete cascade,
  name         text not null,
  invite_code  text not null unique default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
  created_at   timestamptz not null default now()
);

create table public.patient_links (
  patient_id  uuid not null references public.profiles (id) on delete cascade,
  kine_id     uuid not null references public.profiles (id) on delete cascade,
  status      text not null default 'active' check (status in ('active', 'archived')),
  created_at  timestamptz not null default now(),
  primary key (patient_id, kine_id)
);

-- Helper functions (security definer → no RLS recursion)
create or replace function public.is_kine()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'kine');
$$;

create or replace function public.is_kine_of(p_patient uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from patient_links
    where patient_id = p_patient and kine_id = auth.uid() and status = 'active'
  );
$$;

create or replace function public.is_patient_of(p_kine uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from patient_links
    where kine_id = p_kine and patient_id = auth.uid() and status = 'active'
  );
$$;

-- Become a kine: sets role and creates the practice (with invite code)
create or replace function public.become_kine(p_practice_name text)
returns public.practices language plpgsql security definer set search_path = public as $$
declare
  v_practice practices;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  update profiles set role = 'kine' where id = auth.uid();
  insert into practices (kine_id, name) values (auth.uid(), p_practice_name)
  on conflict (kine_id) do update set name = excluded.name
  returning * into v_practice;
  return v_practice;
end $$;

-- Patient joins a practice via invite code (link / QR)
create or replace function public.join_practice(p_code text)
returns public.practices language plpgsql security definer set search_path = public as $$
declare
  v_practice practices;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select * into v_practice from practices where invite_code = upper(trim(p_code));
  if not found then raise exception 'invalid invite code'; end if;
  if v_practice.kine_id = auth.uid() then raise exception 'cannot join own practice'; end if;
  insert into patient_links (patient_id, kine_id) values (auth.uid(), v_practice.kine_id)
  on conflict (patient_id, kine_id) do update set status = 'active';
  return v_practice;
end $$;

-- Public lookup of a practice name for the join screen (before login)
create or replace function public.practice_by_code(p_code text)
returns table (name text) language sql stable security definer set search_path = public as $$
  select name from practices where invite_code = upper(trim(p_code));
$$;

-- Kine can generate a new invite code (e.g. if the old one leaked)
create or replace function public.regenerate_invite_code()
returns text language sql security definer set search_path = public as $$
  update practices
     set invite_code = upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))
   where kine_id = auth.uid()
  returning invite_code;
$$;

-- ─────────────────────────────────────────────────────────────
-- Exercise library
-- ─────────────────────────────────────────────────────────────
create table public.exercises (
  id                uuid primary key default gen_random_uuid(),
  kind              text not null default 'reps' check (kind in ('reps', 'time')),
  body_parts        text[] not null default '{}',
  muscles           text[] not null default '{}',
  equipment         text,
  level             text check (level in ('beginner', 'intermediate', 'expert')),
  default_sets      int not null default 3,
  default_reps      int,
  default_hold_sec  int,
  default_rest_sec  int not null default 30,
  video_url         text,
  -- provenance / credits
  source            text not null default 'custom',  -- 'kineaid' | 'free-exercise-db' | 'wger' | 'custom'
  source_id         text,
  source_url        text,
  license           text,
  author            text,
  owner_id          uuid references public.profiles (id) on delete cascade, -- null = public library
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (source, source_id)
);
create index exercises_body_parts_idx on public.exercises using gin (body_parts);
create index exercises_owner_idx on public.exercises (owner_id);

create table public.exercise_translations (
  exercise_id       uuid not null references public.exercises (id) on delete cascade,
  locale            text not null check (locale in ('nl', 'en')),
  name              text not null,
  description       text,
  instructions      text[] not null default '{}',
  attention_points  text[] not null default '{}',  -- "Hier moet je op letten"
  primary key (exercise_id, locale)
);
create index exercise_translations_name_idx on public.exercise_translations using gin (to_tsvector('simple', name));

create table public.exercise_images (
  id            uuid primary key default gen_random_uuid(),
  exercise_id   uuid not null references public.exercises (id) on delete cascade,
  url           text not null,           -- external URL or public Storage URL
  storage_path  text,                    -- set when stored in our bucket
  position      int not null default 0,
  license       text,
  author        text
);
create index exercise_images_exercise_idx on public.exercise_images (exercise_id);

create or replace function public.can_read_exercise(p_owner uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select p_owner is null or p_owner = auth.uid() or public.is_patient_of(p_owner);
$$;

-- ─────────────────────────────────────────────────────────────
-- Programs & logs
-- ─────────────────────────────────────────────────────────────
create table public.programs (
  id          uuid primary key default gen_random_uuid(),
  patient_id  uuid not null references public.profiles (id) on delete cascade,
  kine_id     uuid references public.profiles (id) on delete set null, -- null = self-made
  name        text not null,
  active      boolean not null default true,
  start_date  date not null default current_date,
  end_date    date,
  created_at  timestamptz not null default now()
);
create index programs_patient_idx on public.programs (patient_id);

create table public.program_items (
  id             uuid primary key default gen_random_uuid(),
  program_id     uuid not null references public.programs (id) on delete cascade,
  exercise_id    uuid not null references public.exercises (id) on delete restrict,
  position       int not null default 0,
  sets           int not null default 3,
  reps           int,
  hold_sec       int,
  rest_sec       int not null default 30,
  times_per_day  int not null default 1,
  days_per_week  int not null default 7 check (days_per_week between 1 and 7),
  note           text
);
create index program_items_program_idx on public.program_items (program_id);

create table public.session_logs (
  id            uuid primary key default gen_random_uuid(),
  patient_id    uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  program_id    uuid not null references public.programs (id) on delete cascade,
  started_at    timestamptz not null default now(),
  completed_at  timestamptz
);
create index session_logs_patient_idx on public.session_logs (patient_id, started_at desc);

create table public.exercise_logs (
  id               uuid primary key default gen_random_uuid(),
  session_id       uuid not null references public.session_logs (id) on delete cascade,
  program_item_id  uuid not null references public.program_items (id) on delete cascade,
  sets_done        int not null default 0,
  completed        boolean not null default false,
  pain             int check (pain between 0 and 10),
  comment          text,
  created_at       timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────
-- Row Level Security
-- ─────────────────────────────────────────────────────────────
alter table public.profiles              enable row level security;
alter table public.practices             enable row level security;
alter table public.patient_links         enable row level security;
alter table public.exercises             enable row level security;
alter table public.exercise_translations enable row level security;
alter table public.exercise_images       enable row level security;
alter table public.programs              enable row level security;
alter table public.program_items         enable row level security;
alter table public.session_logs          enable row level security;
alter table public.exercise_logs         enable row level security;

-- profiles
create policy "profiles: read own, linked" on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_kine_of(id) or public.is_patient_of(id));
create policy "profiles: update own" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- practices
create policy "practices: read own or my kine's" on public.practices for select to authenticated
  using (kine_id = auth.uid() or public.is_patient_of(kine_id));
create policy "practices: update own" on public.practices for update to authenticated
  using (kine_id = auth.uid()) with check (kine_id = auth.uid());

-- patient_links (inserts only via join_practice)
create policy "links: read own" on public.patient_links for select to authenticated
  using (patient_id = auth.uid() or kine_id = auth.uid());
create policy "links: kine updates status" on public.patient_links for update to authenticated
  using (kine_id = auth.uid()) with check (kine_id = auth.uid());
create policy "links: either side deletes" on public.patient_links for delete to authenticated
  using (patient_id = auth.uid() or kine_id = auth.uid());

-- exercises
create policy "exercises: read" on public.exercises for select to authenticated
  using (public.can_read_exercise(owner_id));
create policy "exercises: kine inserts own" on public.exercises for insert to authenticated
  with check (owner_id = auth.uid() and public.is_kine());
create policy "exercises: kine updates own" on public.exercises for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "exercises: kine deletes own" on public.exercises for delete to authenticated
  using (owner_id = auth.uid());

create policy "translations: read" on public.exercise_translations for select to authenticated
  using (exists (select 1 from exercises e where e.id = exercise_id and public.can_read_exercise(e.owner_id)));
create policy "translations: write own" on public.exercise_translations for all to authenticated
  using (exists (select 1 from exercises e where e.id = exercise_id and e.owner_id = auth.uid()))
  with check (exists (select 1 from exercises e where e.id = exercise_id and e.owner_id = auth.uid()));

create policy "images: read" on public.exercise_images for select to authenticated
  using (exists (select 1 from exercises e where e.id = exercise_id and public.can_read_exercise(e.owner_id)));
create policy "images: write own" on public.exercise_images for all to authenticated
  using (exists (select 1 from exercises e where e.id = exercise_id and e.owner_id = auth.uid()))
  with check (exists (select 1 from exercises e where e.id = exercise_id and e.owner_id = auth.uid()));

-- programs: patient reads own; kine manages for linked patients; patient may make own (kine_id null)
create policy "programs: read" on public.programs for select to authenticated
  using (patient_id = auth.uid() or kine_id = auth.uid());
create policy "programs: insert" on public.programs for insert to authenticated
  with check (
    (kine_id = auth.uid() and public.is_kine_of(patient_id))
    or (patient_id = auth.uid() and kine_id is null)
  );
create policy "programs: update" on public.programs for update to authenticated
  using (kine_id = auth.uid() or (patient_id = auth.uid() and kine_id is null))
  with check (kine_id = auth.uid() or (patient_id = auth.uid() and kine_id is null));
create policy "programs: delete" on public.programs for delete to authenticated
  using (kine_id = auth.uid() or (patient_id = auth.uid() and kine_id is null));

create or replace function public.can_edit_program(p_program uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from programs p where p.id = p_program
      and (p.kine_id = auth.uid() or (p.patient_id = auth.uid() and p.kine_id is null))
  );
$$;

create or replace function public.can_read_program(p_program uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from programs p where p.id = p_program
      and (p.patient_id = auth.uid() or p.kine_id = auth.uid())
  );
$$;

create policy "items: read" on public.program_items for select to authenticated
  using (public.can_read_program(program_id));
create policy "items: write" on public.program_items for all to authenticated
  using (public.can_edit_program(program_id)) with check (public.can_edit_program(program_id));

-- logs: patient writes own; kine reads linked
create policy "sessions: patient all" on public.session_logs for all to authenticated
  using (patient_id = auth.uid()) with check (patient_id = auth.uid());
create policy "sessions: kine reads" on public.session_logs for select to authenticated
  using (public.is_kine_of(patient_id));

create policy "exlogs: patient all" on public.exercise_logs for all to authenticated
  using (exists (select 1 from session_logs s where s.id = session_id and s.patient_id = auth.uid()))
  with check (exists (select 1 from session_logs s where s.id = session_id and s.patient_id = auth.uid()));
create policy "exlogs: kine reads" on public.exercise_logs for select to authenticated
  using (exists (select 1 from session_logs s where s.id = session_id and public.is_kine_of(s.patient_id)));

-- ─────────────────────────────────────────────────────────────
-- Storage: exercise photos uploaded by kines → bucket/<kine uid>/<file>
-- ─────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('exercise-images', 'exercise-images', true)
on conflict (id) do nothing;

create policy "exercise-images: kine uploads to own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'exercise-images' and (storage.foldername(name))[1] = auth.uid()::text and public.is_kine());
create policy "exercise-images: kine updates own" on storage.objects for update to authenticated
  using (bucket_id = 'exercise-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "exercise-images: kine deletes own" on storage.objects for delete to authenticated
  using (bucket_id = 'exercise-images' and (storage.foldername(name))[1] = auth.uid()::text);
