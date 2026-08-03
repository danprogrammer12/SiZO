-- SIZO — Migración 014: rol ROOT (administrador de plataforma)
-- Ejecutar en: Supabase Dashboard → SQL Editor
--
-- Diseño:
-- - ROOT no pertenece a ningún tenant. app_metadata = { "role": "ROOT" } — sin tenant_id.
-- - ROOT NO tiene fila en `usuarios` (esa tabla exige tenant_id not null y ROOT no
--   pertenece a ningún tenant). El registro de cuentas ROOT vive únicamente en
--   Supabase Auth (auth.users), listado vía Admin API desde el panel de plataforma.
-- - ROOT reemplaza al flag `app_metadata.superadmin` (booleano) — is_superadmin()
--   se redefine para aceptar ambos durante la transición, ver nota al final.
-- - Alcance de ROOT: LECTURA global en todas las tablas (soporte/auditoría),
--   ESCRITURA global solo en `tenants` (crear/suspender tenants). ROOT nunca
--   opera datos SG-SST de un cliente (no insert/update en tablas operativas) —
--   esas escrituras siguen exigiendo is_admin()/is_asesor() de ese tenant.
-- - Creación/edición/suspensión de usuarios (incluida la promoción a ADMIN o ROOT)
--   sigue centralizada en Edge Functions con service_role — no se abren policies
--   de insert/update de `usuarios` para ROOT vía cliente directo.

-- ─────────────────────────────────────────────────────────────
-- 1. Helper is_root()
-- ─────────────────────────────────────────────────────────────
create or replace function is_root()
returns boolean language sql stable
as $$ select (select user_role()) = 'ROOT' $$;

-- Transición: is_superadmin() acepta tanto el flag viejo (superadmin:true)
-- como el rol nuevo, para no romper cuentas que aún no fueron migradas.
create or replace function is_superadmin()
returns boolean language sql stable as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'superadmin')::boolean, false)
    or (select is_root())
$$;

-- ─────────────────────────────────────────────────────────────
-- 2. usuarios.rol admite ROOT (por si en el futuro se decide auditar
--    cuentas ROOT en esta tabla; hoy no se inserta ninguna fila ROOT)
-- ─────────────────────────────────────────────────────────────
alter table usuarios drop constraint if exists usuarios_rol_check;
alter table usuarios add constraint usuarios_rol_check
  check (rol in ('ADMIN','ASESOR','CONSULTA','ROOT'));

-- ─────────────────────────────────────────────────────────────
-- 3. tenants: ROOT puede crear e inhabilitar tenants desde el front
--    (is_superadmin() ya cubre lectura/actualización, ver 005_billing.sql)
-- ─────────────────────────────────────────────────────────────
create policy "tenants: root crea" on tenants
  for insert with check ((select is_root()));

-- ─────────────────────────────────────────────────────────────
-- 4. Lectura global para ROOT — una policy SELECT adicional por tabla.
--    Postgres combina policies permisivas del mismo comando con OR,
--    así que esto se suma a las políticas existentes sin reemplazarlas
--    ni afectar los permisos de escritura de ADMIN/ASESOR/CONSULTA.
-- ─────────────────────────────────────────────────────────────
create policy "usuarios: root lee todo"        on usuarios        for select using ((select is_root()));
create policy "seguimiento: root lee todo"     on seguimiento     for select using ((select is_root()));
create policy "accidentes: root lee todo"      on accidentes      for select using ((select is_root()));
create policy "ausencias: root lee todo"       on ausencias       for select using ((select is_root()));
create policy "acciones: root lee todo"        on acciones        for select using ((select is_root()));
create policy "inspecciones: root lee todo"    on inspecciones    for select using ((select is_root()));
create policy "capacitaciones: root lee todo"  on capacitaciones  for select using ((select is_root()));
create policy "plan: root lee todo"            on plan_actividades for select using ((select is_root()));
create policy "auditorias: root lee todo"      on auditorias      for select using ((select is_root()));
create policy "casos_medicos: root lee todo"   on casos_medicos   for select using ((select is_root()));
create policy "eval_estructura: root lee todo" on eval_estructura for select using ((select is_root()));
create policy "configuracion: root lee todo"   on configuracion   for select using ((select is_root()));
create policy "obs: root lee todo"             on configuracion_obs for select using ((select is_root()));
create policy "matriz_riesgos: root lee todo"  on matriz_riesgos  for select using ((select is_root()));
create policy "matriz_epp: root lee todo"      on matriz_epp      for select using ((select is_root()));
create policy "entrega_epp: root lee todo"     on entrega_epp     for select using ((select is_root()));
create policy "documentos_sst: root lee todo"  on documentos_sst  for select using ((select is_root()));
create policy "actas: root lee todo"           on actas           for select using ((select is_root()));
create policy "documentos: root lee todo"      on documentos      for select using ((select is_root()));

-- ─────────────────────────────────────────────────────────────
-- 5. Auditoría global de acciones ROOT
--    Solo se escribe desde Edge Functions (service_role, bypassea RLS).
--    El cliente nunca inserta directo — únicamente ROOT puede leer.
-- ─────────────────────────────────────────────────────────────
create table plataforma_auditoria (
  id          uuid primary key default uuid_generate_v4(),
  actor_uid   uuid not null,
  actor_email text not null,
  accion      text not null,
  detalle     jsonb not null default '{}',
  creado_en   timestamptz not null default now()
);

alter table plataforma_auditoria enable row level security;
create policy "plataforma_auditoria: root lee todo" on plataforma_auditoria
  for select using ((select is_root()));
