-- ─────────────────────────────────────────────────────────────────────────────
-- BSM Panel — Auth-Required RLS Policies (Faza 2)
-- Supabase SQL Editor'de bir kez çalıştırın.
--
-- Değişiklik: production-sync.sql'deki "to anon, authenticated" politikaları
-- "to authenticated" olarak daraltıldı.
--
-- Ön koşul: Bu politikaları aktive etmeden önce app.js'nin bsm:auth:ready
-- sonrası Supabase sync yaptığından emin olun (auth-ready listener eklendi).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── members ──────────────────────────────────────────────────────────────────
drop policy if exists "bsm panel read members"   on public.members;
drop policy if exists "bsm panel insert members" on public.members;
drop policy if exists "bsm panel update members" on public.members;
drop policy if exists "bsm panel delete members" on public.members;

create policy "bsm panel read members"
  on public.members for select
  to authenticated
  using (true);

create policy "bsm panel insert members"
  on public.members for insert
  to authenticated
  with check (true);

create policy "bsm panel update members"
  on public.members for update
  to authenticated
  using (true) with check (true);

create policy "bsm panel delete members"
  on public.members for delete
  to authenticated
  using (true);

-- ── measurements ─────────────────────────────────────────────────────────────
drop policy if exists "bsm panel read measurements"   on public.measurements;
drop policy if exists "bsm panel insert measurements" on public.measurements;
drop policy if exists "bsm panel update measurements" on public.measurements;
drop policy if exists "bsm panel delete measurements" on public.measurements;

create policy "bsm panel read measurements"
  on public.measurements for select
  to authenticated
  using (true);

create policy "bsm panel insert measurements"
  on public.measurements for insert
  to authenticated
  with check (true);

create policy "bsm panel update measurements"
  on public.measurements for update
  to authenticated
  using (true) with check (true);

create policy "bsm panel delete measurements"
  on public.measurements for delete
  to authenticated
  using (true);

-- ── programs ─────────────────────────────────────────────────────────────────
drop policy if exists "bsm panel read programs"   on public.programs;
drop policy if exists "bsm panel insert programs" on public.programs;
drop policy if exists "bsm panel update programs" on public.programs;
drop policy if exists "bsm panel delete programs" on public.programs;

create policy "bsm panel read programs"
  on public.programs for select
  to authenticated
  using (true);

create policy "bsm panel insert programs"
  on public.programs for insert
  to authenticated
  with check (true);

create policy "bsm panel update programs"
  on public.programs for update
  to authenticated
  using (true) with check (true);

create policy "bsm panel delete programs"
  on public.programs for delete
  to authenticated
  using (true);

-- ── nutrition_plans ──────────────────────────────────────────────────────────
drop policy if exists "bsm panel read nutrition"   on public.nutrition_plans;
drop policy if exists "bsm panel insert nutrition" on public.nutrition_plans;
drop policy if exists "bsm panel update nutrition" on public.nutrition_plans;
drop policy if exists "bsm panel delete nutrition" on public.nutrition_plans;

create policy "bsm panel read nutrition"
  on public.nutrition_plans for select
  to authenticated
  using (true);

create policy "bsm panel insert nutrition"
  on public.nutrition_plans for insert
  to authenticated
  with check (true);

create policy "bsm panel update nutrition"
  on public.nutrition_plans for update
  to authenticated
  using (true) with check (true);

create policy "bsm panel delete nutrition"
  on public.nutrition_plans for delete
  to authenticated
  using (true);

-- ── app_settings ─────────────────────────────────────────────────────────────
drop policy if exists "bsm panel read settings"   on public.app_settings;
drop policy if exists "bsm panel insert settings" on public.app_settings;
drop policy if exists "bsm panel update settings" on public.app_settings;
drop policy if exists "bsm panel delete settings" on public.app_settings;

create policy "bsm panel read settings"
  on public.app_settings for select
  to authenticated
  using (true);

create policy "bsm panel insert settings"
  on public.app_settings for insert
  to authenticated
  with check (true);

create policy "bsm panel update settings"
  on public.app_settings for update
  to authenticated
  using (true) with check (true);

create policy "bsm panel delete settings"
  on public.app_settings for delete
  to authenticated
  using (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- Doğrulama: Tüm tablolarda mevcut politikaları listele
-- select schemaname, tablename, policyname, roles, cmd
-- from pg_policies
-- where schemaname = 'public'
-- order by tablename, cmd;
-- ─────────────────────────────────────────────────────────────────────────────
