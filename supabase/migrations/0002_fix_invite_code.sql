-- Fix: gen_random_bytes (pgcrypto) is not visible from functions with search_path = public on Supabase.
-- Only needed if 0001_init.sql was run before this fix. Safe to run more than once.

alter table public.practices
  alter column invite_code set default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

create or replace function public.regenerate_invite_code()
returns text language sql security definer set search_path = public as $$
  update practices
     set invite_code = upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))
   where kine_id = auth.uid()
  returning invite_code;
$$;
