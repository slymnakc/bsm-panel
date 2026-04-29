-- BSM Panel - Tanita BC-418 measurement import table
-- Supabase SQL Editor içinde bir kez çalıştırılabilir.

create extension if not exists "pgcrypto";

create table if not exists public.measurements (
  id uuid primary key default gen_random_uuid(),
  member_id text,
  member_name text,
  measured_at timestamptz,
  source text default 'tanita_bc418_csv',
  raw_payload jsonb,
  weight numeric,
  body_fat_percentage numeric,
  fat_mass numeric,
  muscle_mass numeric,
  body_water numeric,
  bmi numeric,
  bmr numeric,
  metabolic_age numeric,
  visceral_fat numeric,
  bone_mass numeric,
  segmental jsonb,
  impedance jsonb,
  created_at timestamptz default now()
);

create index if not exists measurements_member_id_idx on public.measurements (member_id);
create index if not exists measurements_measured_at_idx on public.measurements (measured_at desc);
