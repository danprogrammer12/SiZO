-- SIZO — Migración 003 — H10: optimizar funciones RLS (evaluar como InitPlan)
-- Las funciones que leen auth.jwt() se evaluaban por fila. Al envolverlas en
-- (select ...) el planificador las trata como subconsulta constante por query.
-- Impacto: mejora lineal con el volumen de filas por tabla.
-- Ejecutar en: Supabase Dashboard → SQL Editor

-- ─────────────────────────────────────────────────────────────
-- 1. Reescribir helpers para que sus llamadas internas sean InitPlan
-- ─────────────────────────────────────────────────────────────
create or replace function can_read_empresa(emp_id uuid)
returns boolean language sql stable
as $$ select (select is_admin()) or (emp_id::text = any((select user_empresas()))) $$;

create or replace function can_write_empresa(emp_id uuid)
returns boolean language sql stable
as $$ select (select is_admin()) or ((select is_asesor()) and emp_id::text = any((select user_empresas()))) $$;

-- ─────────────────────────────────────────────────────────────
-- 2. Reemplazar políticas que llaman tenant_id() / is_admin() por fila
--    (las que usan can_read/write_empresa ya quedan cubiertas por el paso 1)
-- ─────────────────────────────────────────────────────────────

-- tenants
drop policy if exists "tenant: leer propio" on tenants;
create policy "tenant: leer propio" on tenants
  for select using (id::text = (select tenant_id()));

-- usuarios
drop policy if exists "usuarios: leer del mismo tenant" on usuarios;
create policy "usuarios: leer del mismo tenant" on usuarios
  for select using (tenant_id::text = (select tenant_id()));

drop policy if exists "usuarios: ADMIN puede crear" on usuarios;
create policy "usuarios: ADMIN puede crear" on usuarios
  for insert with check (tenant_id::text = (select tenant_id()) and (select is_admin()));

drop policy if exists "usuarios: ADMIN puede actualizar" on usuarios;
create policy "usuarios: ADMIN puede actualizar" on usuarios
  for update using (tenant_id::text = (select tenant_id()) and (select is_admin()));

-- empresas
drop policy if exists "empresas: leer según rol" on empresas;
create policy "empresas: leer según rol" on empresas
  for select using (tenant_id::text = (select tenant_id()) and can_read_empresa(id));

drop policy if exists "empresas: ADMIN puede crear" on empresas;
create policy "empresas: ADMIN puede crear" on empresas
  for insert with check (tenant_id::text = (select tenant_id()) and (select is_admin()));

drop policy if exists "empresas: ADMIN puede actualizar" on empresas;
create policy "empresas: ADMIN puede actualizar" on empresas
  for update using (tenant_id::text = (select tenant_id()) and (select is_admin()));

-- seguimiento
drop policy if exists "seguimiento: leer según rol" on seguimiento;
create policy "seguimiento: leer según rol" on seguimiento
  for select using (tenant_id::text = (select tenant_id()) and can_read_empresa(empresa_id));

drop policy if exists "seguimiento: escribir según rol" on seguimiento;
create policy "seguimiento: escribir según rol" on seguimiento
  for insert with check (tenant_id::text = (select tenant_id()) and can_write_empresa(empresa_id));

drop policy if exists "seguimiento: actualizar según rol" on seguimiento;
create policy "seguimiento: actualizar según rol" on seguimiento
  for update using (tenant_id::text = (select tenant_id()) and can_write_empresa(empresa_id));

-- accidentes
drop policy if exists "accidentes: leer" on accidentes;
create policy "accidentes: leer" on accidentes
  for select using (tenant_id::text = (select tenant_id()) and can_read_empresa(empresa_id));

drop policy if exists "accidentes: crear" on accidentes;
create policy "accidentes: crear" on accidentes
  for insert with check (tenant_id::text = (select tenant_id()) and can_write_empresa(empresa_id));

drop policy if exists "accidentes: actualizar" on accidentes;
create policy "accidentes: actualizar" on accidentes
  for update using (tenant_id::text = (select tenant_id()) and can_write_empresa(empresa_id));

-- ausencias
drop policy if exists "ausencias: leer" on ausencias;
create policy "ausencias: leer" on ausencias
  for select using (tenant_id::text = (select tenant_id()) and can_read_empresa(empresa_id));

drop policy if exists "ausencias: crear" on ausencias;
create policy "ausencias: crear" on ausencias
  for insert with check (tenant_id::text = (select tenant_id()) and can_write_empresa(empresa_id));

drop policy if exists "ausencias: actualizar" on ausencias;
create policy "ausencias: actualizar" on ausencias
  for update using (tenant_id::text = (select tenant_id()) and can_write_empresa(empresa_id));

-- acciones
drop policy if exists "acciones: leer" on acciones;
create policy "acciones: leer" on acciones
  for select using (tenant_id::text = (select tenant_id()) and can_read_empresa(empresa_id));

drop policy if exists "acciones: crear (no CONSULTA)" on acciones;
create policy "acciones: crear (no CONSULTA)" on acciones
  for insert with check (tenant_id::text = (select tenant_id()) and can_write_empresa(empresa_id) and (select user_role()) != 'CONSULTA');

drop policy if exists "acciones: actualizar (no CONSULTA)" on acciones;
create policy "acciones: actualizar (no CONSULTA)" on acciones
  for update using (tenant_id::text = (select tenant_id()) and can_write_empresa(empresa_id) and (select user_role()) != 'CONSULTA');

-- inspecciones
drop policy if exists "inspecciones: leer" on inspecciones;
create policy "inspecciones: leer" on inspecciones
  for select using (tenant_id::text = (select tenant_id()) and can_read_empresa(empresa_id));

drop policy if exists "inspecciones: crear" on inspecciones;
create policy "inspecciones: crear" on inspecciones
  for insert with check (tenant_id::text = (select tenant_id()) and can_write_empresa(empresa_id));

drop policy if exists "inspecciones: actualizar" on inspecciones;
create policy "inspecciones: actualizar" on inspecciones
  for update using (tenant_id::text = (select tenant_id()) and can_write_empresa(empresa_id));

-- capacitaciones
drop policy if exists "capacitaciones: leer" on capacitaciones;
create policy "capacitaciones: leer" on capacitaciones
  for select using (tenant_id::text = (select tenant_id()) and can_read_empresa(empresa_id));

drop policy if exists "capacitaciones: crear" on capacitaciones;
create policy "capacitaciones: crear" on capacitaciones
  for insert with check (tenant_id::text = (select tenant_id()) and can_write_empresa(empresa_id));

drop policy if exists "capacitaciones: actualizar" on capacitaciones;
create policy "capacitaciones: actualizar" on capacitaciones
  for update using (tenant_id::text = (select tenant_id()) and can_write_empresa(empresa_id));

-- plan_actividades
drop policy if exists "plan: leer" on plan_actividades;
create policy "plan: leer" on plan_actividades
  for select using (tenant_id::text = (select tenant_id()) and can_read_empresa(empresa_id));

drop policy if exists "plan: crear" on plan_actividades;
create policy "plan: crear" on plan_actividades
  for insert with check (tenant_id::text = (select tenant_id()) and can_write_empresa(empresa_id));

drop policy if exists "plan: actualizar" on plan_actividades;
create policy "plan: actualizar" on plan_actividades
  for update using (tenant_id::text = (select tenant_id()) and can_write_empresa(empresa_id));

-- auditorias
drop policy if exists "auditorias: leer" on auditorias;
create policy "auditorias: leer" on auditorias
  for select using (tenant_id::text = (select tenant_id()) and can_read_empresa(empresa_id));

drop policy if exists "auditorias: crear" on auditorias;
create policy "auditorias: crear" on auditorias
  for insert with check (tenant_id::text = (select tenant_id()) and can_write_empresa(empresa_id));

drop policy if exists "auditorias: actualizar" on auditorias;
create policy "auditorias: actualizar" on auditorias
  for update using (tenant_id::text = (select tenant_id()) and can_write_empresa(empresa_id));

-- casos_medicos
drop policy if exists "casos_medicos: solo ADMIN" on casos_medicos;
create policy "casos_medicos: solo ADMIN" on casos_medicos
  for all using (tenant_id::text = (select tenant_id()) and (select is_admin()));

-- eval_estructura
drop policy if exists "eval_estructura: leer" on eval_estructura;
create policy "eval_estructura: leer" on eval_estructura
  for select using (tenant_id::text = (select tenant_id()) and can_read_empresa(empresa_id));

drop policy if exists "eval_estructura: solo ADMIN escribe" on eval_estructura;
create policy "eval_estructura: solo ADMIN escribe" on eval_estructura
  for insert with check (tenant_id::text = (select tenant_id()) and (select is_admin()));

drop policy if exists "eval_estructura: solo ADMIN actualiza" on eval_estructura;
create policy "eval_estructura: solo ADMIN actualiza" on eval_estructura
  for update using (tenant_id::text = (select tenant_id()) and (select is_admin()));

-- configuracion
drop policy if exists "configuracion: leer" on configuracion;
create policy "configuracion: leer" on configuracion
  for select using (tenant_id::text = (select tenant_id()) and can_read_empresa(empresa_id));

drop policy if exists "configuracion: solo ADMIN escribe" on configuracion;
create policy "configuracion: solo ADMIN escribe" on configuracion
  for insert with check (tenant_id::text = (select tenant_id()) and (select is_admin()));

drop policy if exists "configuracion: solo ADMIN actualiza" on configuracion;
create policy "configuracion: solo ADMIN actualiza" on configuracion
  for update using (tenant_id::text = (select tenant_id()) and (select is_admin()));

-- configuracion_obs
drop policy if exists "obs: leer" on configuracion_obs;
create policy "obs: leer" on configuracion_obs
  for select using (tenant_id::text = (select tenant_id()) and can_read_empresa(empresa_id));

drop policy if exists "obs: crear" on configuracion_obs;
create policy "obs: crear" on configuracion_obs
  for insert with check (tenant_id::text = (select tenant_id()) and can_write_empresa(empresa_id));

drop policy if exists "obs: actualizar" on configuracion_obs;
create policy "obs: actualizar" on configuracion_obs
  for update using (tenant_id::text = (select tenant_id()) and can_write_empresa(empresa_id));
