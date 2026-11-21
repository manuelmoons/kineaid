-- Exercises that must be done on the left AND right side (e.g. stretches, lunges).
-- Safe to run more than once.
alter table public.exercises add column if not exists per_side boolean not null default false;
