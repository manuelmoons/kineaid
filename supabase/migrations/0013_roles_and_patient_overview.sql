-- Clear split between kine and patient, enforced in the database:
--   1. Only a kine creates and changes programs (for their own linked patients).
--      Patients keep reading and doing their programs (also older self-made ones).
--   2. The exercise library is for kines. A patient only sees the exercises in their own programs.
--   3. kine_patient_overview(): one row per patient with last activity, for a patient list that scales.
-- Safe to run more than once.

-- ── 1. Programs: only the kine ──────────────────────────────────
drop policy if exists "programs: insert" on public.programs;
create policy "programs: insert" on public.programs for insert to authenticated
  with check (kine_id = auth.uid() and public.is_kine_of(patient_id));

drop policy if exists "programs: update" on public.programs;
create policy "programs: update" on public.programs for update to authenticated
  using (kine_id = auth.uid()) with check (kine_id = auth.uid());

drop policy if exists "programs: delete" on public.programs;
create policy "programs: delete" on public.programs for delete to authenticated
  using (kine_id = auth.uid());

-- program_items "write" uses this function
create or replace function public.can_edit_program(p_program uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from programs p where p.id = p_program and p.kine_id = auth.uid());
$$;

-- ── 2. Exercises: library for kines, own program exercises for patients ──
drop policy if exists "exercises: read" on public.exercises;
create policy "exercises: read" on public.exercises for select to authenticated
  using (
    (public.is_kine() and (owner_id is null or owner_id = auth.uid()))
    or exists (
      select 1
        from public.program_items pi
        join public.programs p on p.id = pi.program_id
       where pi.exercise_id = exercises.id
         and p.patient_id = auth.uid()
    )
  );

-- Texts and photos follow the exercise (the subquery is itself filtered by the policy above).
drop policy if exists "translations: read" on public.exercise_translations;
create policy "translations: read" on public.exercise_translations for select to authenticated
  using (exists (select 1 from public.exercises e where e.id = exercise_id));

drop policy if exists "images: read" on public.exercise_images;
create policy "images: read" on public.exercise_images for select to authenticated
  using (exists (select 1 from public.exercises e where e.id = exercise_id));

-- ── 3. Patient overview for the kine ────────────────────────────
create or replace function public.kine_patient_overview()
returns table (
  patient_id uuid,
  full_name text,
  email text,
  linked_at timestamptz,
  last_session_at timestamptz,
  sessions_7d int,
  active_programs int
)
language sql stable security definer set search_path = public as $$
  select
    l.patient_id,
    pr.full_name,
    pr.email,
    l.created_at,
    (select max(s.started_at) from session_logs s
      where s.patient_id = l.patient_id and s.completed_at is not null),
    (select count(*)::int from session_logs s
      where s.patient_id = l.patient_id and s.completed_at is not null
        and s.started_at >= now() - interval '7 days'),
    (select count(*)::int from programs p
      where p.patient_id = l.patient_id and p.kine_id = auth.uid() and p.active)
  from patient_links l
  join profiles pr on pr.id = l.patient_id
  where l.kine_id = auth.uid() and l.status = 'active';
$$;

revoke execute on function public.kine_patient_overview() from public, anon;
grant execute on function public.kine_patient_overview() to authenticated;
