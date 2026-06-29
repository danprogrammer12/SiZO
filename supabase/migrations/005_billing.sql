-- SIZO — Migración 005: modelo de billing
-- Ejecutar en: Supabase Dashboard → SQL Editor

-- ─────────────────────────────────────────────────────────────
-- 1. Columnas de billing en tenants
-- ─────────────────────────────────────────────────────────────
alter table tenants
  add column if not exists estado text not null default 'trial'
    check (estado in ('trial', 'activo', 'suspendido')),
  add column if not exists empresas_limite integer not null default 3;

-- 2. Actualizar constraint de plan (enterprise → agencia)
alter table tenants drop constraint if exists tenants_plan_check;
alter table tenants add constraint tenants_plan_check
  check (plan in ('starter', 'pro', 'agencia'));

-- 3. Sincronizar empresas_limite según plan actual
update tenants set empresas_limite = case plan
  when 'starter' then 3
  when 'pro'     then 10
  when 'agencia' then 25
  else 3
end;

-- 4. trial_ends por defecto en tenants existentes sin fecha
update tenants
  set trial_ends = now() + interval '14 days'
  where trial_ends is null;

-- ─────────────────────────────────────────────────────────────
-- 5. Helpers
-- ─────────────────────────────────────────────────────────────
create or replace function is_superadmin()
returns boolean language sql stable as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'superadmin')::boolean, false)
$$;

create or replace function plan_empresas_limite(p text)
returns integer language sql immutable as $$
  select case p
    when 'starter' then 3
    when 'pro'     then 10
    when 'agencia' then 25
    else 3
  end
$$;

-- ─────────────────────────────────────────────────────────────
-- 6. RLS: SUPERADMIN puede leer y actualizar todos los tenants
-- ─────────────────────────────────────────────────────────────
create policy "tenants: superadmin lee todo" on tenants
  for select using ((select is_superadmin()));

create policy "tenants: superadmin actualiza" on tenants
  for update using ((select is_superadmin()));

-- 7. RLS: SUPERADMIN puede leer todas las empresas (para conteos)
create policy "empresas: superadmin lee todo" on empresas
  for select using ((select is_superadmin()));
