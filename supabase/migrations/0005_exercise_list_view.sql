-- Flat, searchable list of exercises for the library screen.
-- security_invoker → the RLS policies of the underlying tables still apply.
-- Safe to run more than once.

create or replace view public.exercise_list with (security_invoker = on) as
select
  e.id,
  e.kind,
  e.body_parts,
  e.equipment,
  e.level,
  e.source,
  e.owner_id,
  case
    when e.owner_id is not null then 0   -- kine's own exercises first
    when e.source = 'kineaid' then 1
    when e.source = 'free-exercise-db' then 2
    else 3
  end as priority,
  en.name as name_en,
  nl.name as name_nl,
  coalesce(nl.name, en.name) as display_nl,
  coalesce(en.name, nl.name) as display_en,
  (select i.url from public.exercise_images i where i.exercise_id = e.id order by i.position limit 1) as image_url
from public.exercises e
left join public.exercise_translations en on en.exercise_id = e.id and en.locale = 'en'
left join public.exercise_translations nl on nl.exercise_id = e.id and nl.locale = 'nl';

grant select on public.exercise_list to authenticated, service_role;
