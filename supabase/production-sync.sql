-- BSM Panel - Supabase-first production sync schema
-- Supabase SQL Editor icinde bir kez calistirin.
-- Not: Uygulamada kullanici girisi olmadigi icin anon read/write politikalari aciktir.
-- Gercek kapali devre salon kullanimi icin sonraki adim: trainer login + RLS kuralini kullanici bazli daraltmak.

create extension if not exists "pgcrypto";

create table if not exists public.members (
  id uuid primary key default gen_random_uuid(),
  app_member_id text,
  name text,
  program text,
  email text,
  member_code text,
  profile jsonb default '{}'::jsonb,
  measurements jsonb default '[]'::jsonb,
  programs jsonb default '[]'::jsonb,
  nutrition_plan jsonb,
  nutrition_plans jsonb default '[]'::jsonb,
  raw_payload jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.members add column if not exists app_member_id text;
alter table public.members add column if not exists name text;
alter table public.members add column if not exists program text;
alter table public.members add column if not exists email text;
alter table public.members add column if not exists member_code text;
alter table public.members add column if not exists profile jsonb default '{}'::jsonb;
alter table public.members add column if not exists measurements jsonb default '[]'::jsonb;
alter table public.members add column if not exists programs jsonb default '[]'::jsonb;
alter table public.members add column if not exists nutrition_plan jsonb;
alter table public.members add column if not exists nutrition_plans jsonb default '[]'::jsonb;
alter table public.members add column if not exists raw_payload jsonb default '{}'::jsonb;
alter table public.members add column if not exists created_at timestamptz default now();
alter table public.members add column if not exists updated_at timestamptz default now();

create unique index if not exists members_app_member_id_uidx on public.members (app_member_id);
create index if not exists members_updated_at_idx on public.members (updated_at desc);

create table if not exists public.measurements (
  id uuid primary key default gen_random_uuid(),
  app_measurement_id text,
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
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.measurements add column if not exists app_measurement_id text;
alter table public.measurements add column if not exists member_id text;
alter table public.measurements add column if not exists member_name text;
alter table public.measurements add column if not exists measured_at timestamptz;
alter table public.measurements add column if not exists source text default 'tanita_bc418_csv';
alter table public.measurements add column if not exists raw_payload jsonb;
alter table public.measurements add column if not exists weight numeric;
alter table public.measurements add column if not exists body_fat_percentage numeric;
alter table public.measurements add column if not exists fat_mass numeric;
alter table public.measurements add column if not exists muscle_mass numeric;
alter table public.measurements add column if not exists body_water numeric;
alter table public.measurements add column if not exists bmi numeric;
alter table public.measurements add column if not exists bmr numeric;
alter table public.measurements add column if not exists metabolic_age numeric;
alter table public.measurements add column if not exists visceral_fat numeric;
alter table public.measurements add column if not exists bone_mass numeric;
alter table public.measurements add column if not exists segmental jsonb;
alter table public.measurements add column if not exists impedance jsonb;
alter table public.measurements add column if not exists created_at timestamptz default now();
alter table public.measurements add column if not exists updated_at timestamptz default now();

create unique index if not exists measurements_app_measurement_id_uidx on public.measurements (app_measurement_id);
create index if not exists measurements_member_id_idx on public.measurements (member_id);
create index if not exists measurements_measured_at_idx on public.measurements (measured_at desc);

create table if not exists public.programs (
  id uuid primary key default gen_random_uuid(),
  app_program_id text,
  member_id text,
  member_name text,
  title text,
  saved_at timestamptz,
  program jsonb default '{}'::jsonb,
  raw_payload jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create unique index if not exists programs_app_program_id_uidx on public.programs (app_program_id);
create index if not exists programs_member_id_idx on public.programs (member_id);
create index if not exists programs_saved_at_idx on public.programs (saved_at desc);

create table if not exists public.nutrition_plans (
  id uuid primary key default gen_random_uuid(),
  app_nutrition_id text,
  member_id text,
  member_name text,
  goal text,
  payload jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create unique index if not exists nutrition_plans_app_nutrition_id_uidx on public.nutrition_plans (app_nutrition_id);
create index if not exists nutrition_plans_member_id_idx on public.nutrition_plans (member_id);

create table if not exists public.app_settings (
  id uuid primary key default gen_random_uuid(),
  setting_key text,
  payload jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create unique index if not exists app_settings_setting_key_uidx on public.app_settings (setting_key);
create index if not exists app_settings_updated_at_idx on public.app_settings (updated_at desc);

alter table public.members replica identity full;
alter table public.measurements replica identity full;
alter table public.programs replica identity full;
alter table public.nutrition_plans replica identity full;
alter table public.app_settings replica identity full;

alter table public.members enable row level security;
alter table public.measurements enable row level security;
alter table public.programs enable row level security;
alter table public.nutrition_plans enable row level security;
alter table public.app_settings enable row level security;

drop policy if exists "bsm panel read members" on public.members;
drop policy if exists "bsm panel insert members" on public.members;
drop policy if exists "bsm panel update members" on public.members;
drop policy if exists "bsm panel delete members" on public.members;
create policy "bsm panel read members" on public.members for select to anon, authenticated using (true);
create policy "bsm panel insert members" on public.members for insert to anon, authenticated with check (true);
create policy "bsm panel update members" on public.members for update to anon, authenticated using (true) with check (true);
create policy "bsm panel delete members" on public.members for delete to anon, authenticated using (true);

drop policy if exists "bsm panel read measurements" on public.measurements;
drop policy if exists "bsm panel insert measurements" on public.measurements;
drop policy if exists "bsm panel update measurements" on public.measurements;
drop policy if exists "bsm panel delete measurements" on public.measurements;
create policy "bsm panel read measurements" on public.measurements for select to anon, authenticated using (true);
create policy "bsm panel insert measurements" on public.measurements for insert to anon, authenticated with check (true);
create policy "bsm panel update measurements" on public.measurements for update to anon, authenticated using (true) with check (true);
create policy "bsm panel delete measurements" on public.measurements for delete to anon, authenticated using (true);

drop policy if exists "bsm panel read programs" on public.programs;
drop policy if exists "bsm panel insert programs" on public.programs;
drop policy if exists "bsm panel update programs" on public.programs;
drop policy if exists "bsm panel delete programs" on public.programs;
create policy "bsm panel read programs" on public.programs for select to anon, authenticated using (true);
create policy "bsm panel insert programs" on public.programs for insert to anon, authenticated with check (true);
create policy "bsm panel update programs" on public.programs for update to anon, authenticated using (true) with check (true);
create policy "bsm panel delete programs" on public.programs for delete to anon, authenticated using (true);

drop policy if exists "bsm panel read nutrition" on public.nutrition_plans;
drop policy if exists "bsm panel insert nutrition" on public.nutrition_plans;
drop policy if exists "bsm panel update nutrition" on public.nutrition_plans;
drop policy if exists "bsm panel delete nutrition" on public.nutrition_plans;
create policy "bsm panel read nutrition" on public.nutrition_plans for select to anon, authenticated using (true);
create policy "bsm panel insert nutrition" on public.nutrition_plans for insert to anon, authenticated with check (true);
create policy "bsm panel update nutrition" on public.nutrition_plans for update to anon, authenticated using (true) with check (true);
create policy "bsm panel delete nutrition" on public.nutrition_plans for delete to anon, authenticated using (true);

drop policy if exists "bsm panel read settings" on public.app_settings;
drop policy if exists "bsm panel insert settings" on public.app_settings;
drop policy if exists "bsm panel update settings" on public.app_settings;
drop policy if exists "bsm panel delete settings" on public.app_settings;
create policy "bsm panel read settings" on public.app_settings for select to anon, authenticated using (true);
create policy "bsm panel insert settings" on public.app_settings for insert to anon, authenticated with check (true);
create policy "bsm panel update settings" on public.app_settings for update to anon, authenticated using (true) with check (true);
create policy "bsm panel delete settings" on public.app_settings for delete to anon, authenticated using (true);

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'members') then
      alter publication supabase_realtime add table public.members;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'measurements') then
      alter publication supabase_realtime add table public.measurements;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'programs') then
      alter publication supabase_realtime add table public.programs;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'nutrition_plans') then
      alter publication supabase_realtime add table public.nutrition_plans;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'app_settings') then
      alter publication supabase_realtime add table public.app_settings;
    end if;
  end if;
end $$;
