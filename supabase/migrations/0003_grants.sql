-- New Supabase projects no longer grant table privileges to the API roles automatically.
-- Grant what the app needs; Row Level Security (0001) still decides which ROWS each user sees.
-- Safe to run more than once.

grant usage on schema public to anon, authenticated, service_role;

-- Import script (secret key) needs full access to everything
grant all on all tables in schema public to service_role;

-- Logged-in users (patients and kines)
grant select on public.profiles to authenticated;
grant update (full_name, locale) on public.profiles to authenticated;

grant select, update on public.practices to authenticated;
grant select, update, delete on public.patient_links to authenticated;   -- inserts only via join_practice()

grant select, insert, update, delete on
  public.exercises,
  public.exercise_translations,
  public.exercise_images,
  public.programs,
  public.program_items,
  public.session_logs,
  public.exercise_logs
to authenticated;

-- Functions: only logged-in users may call the RPCs; practice_by_code is used on the join screen before login.
revoke execute on function public.become_kine(text), public.join_practice(text), public.regenerate_invite_code() from public, anon;
grant execute on function public.become_kine(text), public.join_practice(text), public.regenerate_invite_code() to authenticated;
grant execute on function public.practice_by_code(text) to anon, authenticated;
