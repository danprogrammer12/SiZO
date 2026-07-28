-- ═════════════════════════════════════════════════════════════
-- SIZO — Script de reconstrucción completa de la base de datos
-- Generado 2026-07-27 tras la eliminación del proyecto Supabase
-- por inactividad.
--
-- Concatena las migraciones 001-013 EN EL ORDEN CORRECTO DE
-- APLICACIÓN, omitiendo 009 y 010 (intentos de fix de RLS sobre
-- `documentos` que quedaron superados por 011 — ver notas
-- 2026-07-16 en CLAUDE.md). Aplicarlas habría sido inofensivo
-- (son DROP+CREATE idempotentes) pero no aportan nada.
--
-- Uso: pegar completo en Supabase Dashboard → SQL Editor → Run.
-- Es un proyecto NUEVO, así que se ejecuta de una sola vez.
--
-- Después de correr esto, falta (fuera de este script):
--   1. Crear el bucket 'documentos' si el INSERT de 004 no corrió
--      por falta de permisos (normalmente sí funciona desde el
--      SQL Editor con rol postgres).
--   2. Recrear el tenant + usuario ADMIN de pruebas
--      (danias12.dpa@gmail.com) vía Edge Function o Auth manual,
--      ya que app_metadata (tenant_id/role) vive en Supabase Auth,
--      no en estas tablas.
--   3. Desplegar/reconfigurar las Edge Functions:
--      supabase/functions/crear-usuario, registrar-tenant.
--   4. catalogo_indicadores queda vacía a propósito — el catálogo
--      real de KPIs vive en catalogo.js (client-side), la tabla
--      SQL no la lee ningún módulo.
-- ═════════════════════════════════════════════════════════════


-- ═════════════════════════════════════════════════════════════
-- 001 — Schema inicial (multitenant + RLS)
-- ═════════════════════════════════════════════════════════════

-- SIZO — Esquema PostgreSQL inicial
-- Migración 001 — Schema multitenant con RLS
-- Ejecutar en: Supabase Dashboard → SQL Editor

-- ─────────────────────────────────────────────────────────────
-- EXTENSIONES
-- ─────────────────────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ─────────────────────────────────────────────────────────────
-- HELPERS RLS
-- Leen app_metadata del JWT de Supabase Auth
-- ─────────────────────────────────────────────────────────────
create or replace function tenant_id()
returns text language sql stable
as $$ select auth.jwt() -> 'app_metadata' ->> 'tenant_id' $$;

create or replace function user_role()
returns text language sql stable
as $$ select auth.jwt() -> 'app_metadata' ->> 'role' $$;

create or replace function user_empresas()
returns text[] language sql stable
as $$ select array(
  select jsonb_array_elements_text(
    coalesce(auth.jwt() -> 'app_metadata' -> 'empresas_ids', '[]')
  )
) $$;

create or replace function is_admin()
returns boolean language sql stable
as $$ select user_role() = 'ADMIN' $$;

create or replace function is_asesor()
returns boolean language sql stable
as $$ select user_role() = 'ASESOR' $$;

create or replace function can_read_empresa(emp_id uuid)
returns boolean language sql stable
as $$ select is_admin() or (emp_id::text = any(user_empresas())) $$;

create or replace function can_write_empresa(emp_id uuid)
returns boolean language sql stable
as $$ select is_admin() or (is_asesor() and emp_id::text = any(user_empresas())) $$;

-- ─────────────────────────────────────────────────────────────
-- TENANTS
-- ─────────────────────────────────────────────────────────────
create table tenants (
  id              uuid primary key default uuid_generate_v4(),
  nombre          text not null,
  nombre_corto    text,
  tipo            text not null check (tipo in ('consultora','empresa')) default 'consultora',
  plan            text not null check (plan in ('starter','pro','enterprise')) default 'starter',
  activo          boolean not null default true,
  trial_ends      timestamptz,
  logo_path       text,
  color_primario  text,
  email           text not null,
  tel             text,
  ciudad          text,
  admin_uid       uuid not null,
  creado_en       timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  updated_by      uuid not null
);

alter table tenants enable row level security;
create policy "tenant: leer propio" on tenants
  for select using (id::text = tenant_id());
create policy "tenant: sin escritura desde cliente" on tenants
  for all using (false);

-- ─────────────────────────────────────────────────────────────
-- USUARIOS
-- ─────────────────────────────────────────────────────────────
create table usuarios (
  id              uuid primary key,  -- igual al auth.users.id
  tenant_id       uuid not null references tenants(id),
  nombre          text not null,
  email           text not null,
  rol             text not null check (rol in ('ADMIN','ASESOR','CONSULTA')),
  activo          boolean not null default true,
  empresas_ids    uuid[] not null default '{}',
  tel             text,
  tel2            text,
  bday            date,
  linkedin        text,
  ciudad          text,
  ultimo_acceso   timestamptz,
  creado_en       timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  updated_by      uuid not null,
  creado_por      uuid not null,
  deleted_at      timestamptz
);

alter table usuarios enable row level security;
create policy "usuarios: leer del mismo tenant" on usuarios
  for select using (tenant_id::text = tenant_id());
create policy "usuarios: el propio puede actualizar perfil" on usuarios
  for update using (id = auth.uid());
create policy "usuarios: ADMIN puede crear" on usuarios
  for insert with check (tenant_id::text = tenant_id() and is_admin());
create policy "usuarios: ADMIN puede actualizar" on usuarios
  for update using (tenant_id::text = tenant_id() and is_admin());
create policy "usuarios: sin delete físico" on usuarios
  for delete using (false);

-- ─────────────────────────────────────────────────────────────
-- EMPRESAS
-- ─────────────────────────────────────────────────────────────
create table empresas (
  id              uuid primary key default uuid_generate_v4(),
  tenant_id       uuid not null references tenants(id),
  nombre          text not null,
  nombre_com      text,
  nit             text,
  ciiu            text,
  actividad       text,
  ciudad          text not null,
  dpto            text,
  direccion       text,
  tel1            text,
  tel2            text,
  email1          text,
  email2          text,
  rep_legal       text,
  bday_rep        date,
  resp_sst        text,
  bday_sst        date,
  resp_admin      text,
  obs             text,
  trab            integer not null default 0,
  nivel_riesgo    text check (nivel_riesgo in ('I','II','III','IV','V')),
  clase_riesgo    text check (clase_riesgo in ('I','II','III','IV','V')),
  cod_arl         text,
  desc_arl        text,
  arl             text,
  copasst         text check (copasst in ('vigia','copasst')),
  asesor_id       uuid references usuarios(id),
  tipo_contrato   text check (tipo_contrato in ('mensual','trimestral','semestral','anual','proyecto','indefinido')),
  frecuencia      text check (frecuencia in ('semanal','quincenal','mensual','bimestral','trimestral','semestral')),
  fecha_inicio_sst date,
  contrato_inicio  date,
  contrato_fin     date,
  centros         jsonb not null default '[]',
  activa          boolean not null default true,
  creado_en       timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  updated_by      uuid not null,
  creado_por      uuid not null,
  deleted_at      timestamptz
);

alter table empresas enable row level security;
create policy "empresas: leer según rol" on empresas
  for select using (tenant_id::text = tenant_id() and can_read_empresa(id));
create policy "empresas: ADMIN puede crear" on empresas
  for insert with check (tenant_id::text = tenant_id() and is_admin());
create policy "empresas: ADMIN puede actualizar" on empresas
  for update using (tenant_id::text = tenant_id() and is_admin());
create policy "empresas: sin delete físico" on empresas
  for delete using (false);

-- ─────────────────────────────────────────────────────────────
-- SEGUIMIENTO MENSUAL
-- ─────────────────────────────────────────────────────────────
create table seguimiento (
  id              text primary key,  -- '{empresa_id}_{yyyy}_{mm}'
  tenant_id       uuid not null references tenants(id),
  empresa_id      uuid not null references empresas(id),
  year            integer not null,
  mes             integer not null check (mes between 1 and 12),
  -- accidentalidad
  trab            integer not null default 0,
  at_oc           integer not null default 0,
  at_inv          integer not null default 0,
  at_mort         integer not null default 0,
  dias_incap      integer not null default 0,
  dias_carg       integer not null default 0,
  dias_incap_at   integer not null default 0,
  casos_el        integer not null default 0,
  fecha_ultimo_at date,
  -- ausentismo
  dias_aus        integer not null default 0,
  dias_trab       integer not null default 22,
  -- plan de trabajo
  act_prog        integer not null default 0,
  act_ejec        integer not null default 0,
  ctrl_def        integer not null default 0,
  ctrl_impl       integer not null default 0,
  -- capacitación
  cap_prog        integer not null default 0,
  cap_ejec        integer not null default 0,
  cap_asist       integer not null default 0,
  -- inspecciones
  insp_prog       integer not null default 0,
  insp_ejec       integer not null default 0,
  -- evaluaciones médicas
  ev_med_prog     integer not null default 0,
  ev_med_ejec     integer not null default 0,
  -- seguimiento SG-SST
  acc_gen         integer not null default 0,
  acc_cerr        integer not null default 0,
  acc_venc        integer not null default 0,
  casos_ab        integer not null default 0,
  req_aplic       integer not null default 0,
  req_cumpl       integer not null default 0,
  obj_def         integer not null default 0,
  obj_cumpl       integer not null default 0,
  -- COPASST / Vigía
  cop_prog        integer not null default 0,
  cop_ejec        integer not null default 0,
  -- Cocolab
  col_prog        integer not null default 0,
  col_ejec        integer not null default 0,
  -- visitas
  vis_prog        integer not null default 0,
  vis_ejec        integer not null default 0,
  -- emergencias
  em_prog         integer not null default 0,
  em_ejec         integer not null default 0,
  -- observaciones
  obs             text not null default '',
  completado      boolean not null default false,
  creado_en       timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  updated_by      uuid not null,
  creado_por      uuid not null
);

alter table seguimiento enable row level security;
create policy "seguimiento: leer según rol" on seguimiento
  for select using (tenant_id::text = tenant_id() and can_read_empresa(empresa_id));
create policy "seguimiento: escribir según rol" on seguimiento
  for insert with check (tenant_id::text = tenant_id() and can_write_empresa(empresa_id));
create policy "seguimiento: actualizar según rol" on seguimiento
  for update using (tenant_id::text = tenant_id() and can_write_empresa(empresa_id));
create policy "seguimiento: sin delete" on seguimiento
  for delete using (false);

-- ─────────────────────────────────────────────────────────────
-- ACCIDENTES
-- ─────────────────────────────────────────────────────────────
create table accidentes (
  id                  uuid primary key default uuid_generate_v4(),
  tenant_id           uuid not null references tenants(id),
  empresa_id          uuid not null references empresas(id),
  trabajador          text not null,
  cargo               text,
  area                text,
  tipo_vinculacion    text check (tipo_vinculacion in ('directa','contratista','temporal')),
  fecha               timestamptz not null,
  hora                text,
  lugar               text,
  descripcion         text not null,
  tipo_lesion         text,
  parte_afectada      text,
  dias_incapacidad    integer not null default 0,
  es_grave            boolean not null default false,
  es_mortal           boolean not null default false,
  investigado         boolean not null default false,
  fecha_investigacion timestamptz,
  causas_inmediatas   text,
  causas_basicas      text,
  factores_personales text,
  factores_trabajo    text,
  activo              boolean not null default true,
  creado_en           timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  updated_by          uuid not null,
  creado_por          uuid not null,
  deleted_at          timestamptz
);

alter table accidentes enable row level security;
create policy "accidentes: leer" on accidentes
  for select using (tenant_id::text = tenant_id() and can_read_empresa(empresa_id));
create policy "accidentes: crear" on accidentes
  for insert with check (tenant_id::text = tenant_id() and can_write_empresa(empresa_id));
create policy "accidentes: actualizar" on accidentes
  for update using (tenant_id::text = tenant_id() and can_write_empresa(empresa_id));
create policy "accidentes: sin delete" on accidentes
  for delete using (false);

-- ─────────────────────────────────────────────────────────────
-- AUSENCIAS
-- ─────────────────────────────────────────────────────────────
create table ausencias (
  id            uuid primary key default uuid_generate_v4(),
  tenant_id     uuid not null references tenants(id),
  empresa_id    uuid not null references empresas(id),
  trabajador    text not null,
  cargo         text,
  causa         text not null check (causa in ('AT','EL','EG','licencia_maternidad','licencia_paternidad','licencia_luto','licencia_remunerada','otra')),
  diagnostico   text,
  certificado   boolean not null default false,
  fecha_inicio  timestamptz not null,
  fecha_fin     timestamptz,
  dias          integer not null default 0,
  obs           text,
  activo        boolean not null default true,
  creado_en     timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  updated_by    uuid not null,
  creado_por    uuid not null,
  deleted_at    timestamptz
);

alter table ausencias enable row level security;
create policy "ausencias: leer" on ausencias
  for select using (tenant_id::text = tenant_id() and can_read_empresa(empresa_id));
create policy "ausencias: crear" on ausencias
  for insert with check (tenant_id::text = tenant_id() and can_write_empresa(empresa_id));
create policy "ausencias: actualizar" on ausencias
  for update using (tenant_id::text = tenant_id() and can_write_empresa(empresa_id));
create policy "ausencias: sin delete" on ausencias
  for delete using (false);

-- ─────────────────────────────────────────────────────────────
-- ACCIONES (ACPM)
-- ─────────────────────────────────────────────────────────────
create table acciones (
  id                uuid primary key default uuid_generate_v4(),
  tenant_id         uuid not null references tenants(id),
  empresa_id        uuid not null references empresas(id),
  tipo              text not null check (tipo in ('correctiva','preventiva','mejora')),
  origen            text not null check (origen in ('inspeccion','accidente','auditoria','seguimiento','revision_direccion','otro')),
  origen_id         uuid,
  descripcion       text not null,
  responsable       text not null,
  fecha_limite      timestamptz not null,
  prioridad         text not null check (prioridad in ('alta','media','baja')),
  estado            text not null check (estado in ('abierta','en_progreso','cerrada','vencida')) default 'abierta',
  fecha_cierre      timestamptz,
  evidencia_path    text,
  evidencia_nombre  text,
  evidencia_tamano  integer,
  obs               text,
  activo            boolean not null default true,
  creado_en         timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  updated_by        uuid not null,
  creado_por        uuid not null,
  deleted_at        timestamptz
);

alter table acciones enable row level security;
create policy "acciones: leer" on acciones
  for select using (tenant_id::text = tenant_id() and can_read_empresa(empresa_id));
create policy "acciones: crear (no CONSULTA)" on acciones
  for insert with check (tenant_id::text = tenant_id() and can_write_empresa(empresa_id) and user_role() != 'CONSULTA');
create policy "acciones: actualizar (no CONSULTA)" on acciones
  for update using (tenant_id::text = tenant_id() and can_write_empresa(empresa_id) and user_role() != 'CONSULTA');
create policy "acciones: sin delete" on acciones
  for delete using (false);

-- ─────────────────────────────────────────────────────────────
-- INSPECCIONES
-- ─────────────────────────────────────────────────────────────
create table inspecciones (
  id           uuid primary key default uuid_generate_v4(),
  tenant_id    uuid not null references tenants(id),
  empresa_id   uuid not null references empresas(id),
  fecha        timestamptz not null,
  area         text not null,
  inspector    text not null,
  tipo         text not null check (tipo in ('planeada','no_planeada')),
  hallazgos    jsonb not null default '[]',
  calificacion integer check (calificacion between 0 and 100),
  obs          text,
  activo       boolean not null default true,
  creado_en    timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  updated_by   uuid not null,
  creado_por   uuid not null,
  deleted_at   timestamptz
);

alter table inspecciones enable row level security;
create policy "inspecciones: leer" on inspecciones
  for select using (tenant_id::text = tenant_id() and can_read_empresa(empresa_id));
create policy "inspecciones: crear" on inspecciones
  for insert with check (tenant_id::text = tenant_id() and can_write_empresa(empresa_id));
create policy "inspecciones: actualizar" on inspecciones
  for update using (tenant_id::text = tenant_id() and can_write_empresa(empresa_id));
create policy "inspecciones: sin delete" on inspecciones
  for delete using (false);

-- ─────────────────────────────────────────────────────────────
-- CAPACITACIONES
-- ─────────────────────────────────────────────────────────────
create table capacitaciones (
  id            uuid primary key default uuid_generate_v4(),
  tenant_id     uuid not null references tenants(id),
  empresa_id    uuid not null references empresas(id),
  tema          text not null,
  fecha         timestamptz not null,
  duracion      numeric not null default 0,
  instructor    text not null,
  modalidad     text not null check (modalidad in ('presencial','virtual','mixta')),
  asistentes    integer not null default 0,
  metodologia   text,
  evaluada      boolean not null default false,
  nota_promedio numeric check (nota_promedio between 0 and 5),
  obs           text,
  activo        boolean not null default true,
  creado_en     timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  updated_by    uuid not null,
  creado_por    uuid not null,
  deleted_at    timestamptz
);

alter table capacitaciones enable row level security;
create policy "capacitaciones: leer" on capacitaciones
  for select using (tenant_id::text = tenant_id() and can_read_empresa(empresa_id));
create policy "capacitaciones: crear" on capacitaciones
  for insert with check (tenant_id::text = tenant_id() and can_write_empresa(empresa_id));
create policy "capacitaciones: actualizar" on capacitaciones
  for update using (tenant_id::text = tenant_id() and can_write_empresa(empresa_id));
create policy "capacitaciones: sin delete" on capacitaciones
  for delete using (false);

-- ─────────────────────────────────────────────────────────────
-- PLAN DE ACTIVIDADES
-- ─────────────────────────────────────────────────────────────
create table plan_actividades (
  id            uuid primary key default uuid_generate_v4(),
  tenant_id     uuid not null references tenants(id),
  empresa_id    uuid not null references empresas(id),
  year          integer not null,
  actividad     text not null,
  componente    text not null check (componente in ('politica','planificacion','implementacion','verificacion','mejora')),
  mes           integer not null check (mes between 1 and 12),
  responsable   text not null,
  presupuesto   numeric,
  estado        text not null check (estado in ('pendiente','en_progreso','completada','cancelada')) default 'pendiente',
  obs           text,
  activo        boolean not null default true,
  creado_en     timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  updated_by    uuid not null,
  creado_por    uuid not null,
  deleted_at    timestamptz
);

alter table plan_actividades enable row level security;
create policy "plan: leer" on plan_actividades
  for select using (tenant_id::text = tenant_id() and can_read_empresa(empresa_id));
create policy "plan: crear" on plan_actividades
  for insert with check (tenant_id::text = tenant_id() and can_write_empresa(empresa_id));
create policy "plan: actualizar" on plan_actividades
  for update using (tenant_id::text = tenant_id() and can_write_empresa(empresa_id));
create policy "plan: sin delete" on plan_actividades
  for delete using (false);

-- ─────────────────────────────────────────────────────────────
-- AUDITORÍAS
-- ─────────────────────────────────────────────────────────────
create table auditorias (
  id             uuid primary key default uuid_generate_v4(),
  tenant_id      uuid not null references tenants(id),
  empresa_id     uuid not null references empresas(id),
  year           integer not null,
  tipo           text not null check (tipo in ('interna','externa')),
  fecha          timestamptz not null,
  auditor        text not null,
  alcance        text,
  evaluaciones   jsonb not null default '{}',
  puntaje_global numeric check (puntaje_global between 0 and 100),
  hallazgos      text,
  compromisos    text,
  estado         text not null check (estado in ('pendiente','en_proceso','completada')) default 'pendiente',
  obs            text,
  activo         boolean not null default true,
  creado_en      timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  updated_by     uuid not null,
  creado_por     uuid not null,
  deleted_at     timestamptz
);

alter table auditorias enable row level security;
create policy "auditorias: leer" on auditorias
  for select using (tenant_id::text = tenant_id() and can_read_empresa(empresa_id));
create policy "auditorias: crear" on auditorias
  for insert with check (tenant_id::text = tenant_id() and can_write_empresa(empresa_id));
create policy "auditorias: actualizar" on auditorias
  for update using (tenant_id::text = tenant_id() and can_write_empresa(empresa_id));
create policy "auditorias: sin delete" on auditorias
  for delete using (false);

-- ─────────────────────────────────────────────────────────────
-- CASOS MÉDICOS (ADMIN only)
-- ─────────────────────────────────────────────────────────────
create table casos_medicos (
  id             uuid primary key default uuid_generate_v4(),
  tenant_id      uuid not null references tenants(id),
  empresa_id     uuid not null references empresas(id),
  trabajador     text not null,
  cargo          text,
  tipo           text not null check (tipo in ('AT','EL','EG')),
  diagnostico    text not null,
  cie10          text,
  fecha_apertura timestamptz not null,
  fecha_cierre   timestamptz,
  estado         text not null check (estado in ('abierto','en_seguimiento','cerrado')) default 'abierto',
  restricciones  text,
  reubicacion    boolean not null default false,
  obs            text,
  activo         boolean not null default true,
  creado_en      timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  updated_by     uuid not null,
  creado_por     uuid not null,
  deleted_at     timestamptz
);

alter table casos_medicos enable row level security;
create policy "casos_medicos: solo ADMIN" on casos_medicos
  for all using (tenant_id::text = tenant_id() and is_admin());

-- ─────────────────────────────────────────────────────────────
-- EVALUACIÓN DE ESTRUCTURA
-- ─────────────────────────────────────────────────────────────
create table eval_estructura (
  id             text primary key,  -- '{empresa_id}_{yyyy}'
  tenant_id      uuid not null references tenants(id),
  empresa_id     uuid not null references empresas(id),
  year           integer not null,
  evaluaciones   jsonb not null default '{}',
  puntaje_global numeric check (puntaje_global between 0 and 100),
  activo         boolean not null default true,
  creado_en      timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  updated_by     uuid not null,
  creado_por     uuid not null
);

alter table eval_estructura enable row level security;
create policy "eval_estructura: leer" on eval_estructura
  for select using (tenant_id::text = tenant_id() and can_read_empresa(empresa_id));
create policy "eval_estructura: solo ADMIN escribe" on eval_estructura
  for insert with check (tenant_id::text = tenant_id() and is_admin());
create policy "eval_estructura: solo ADMIN actualiza" on eval_estructura
  for update using (tenant_id::text = tenant_id() and is_admin());
create policy "eval_estructura: sin delete" on eval_estructura
  for delete using (false);

-- ─────────────────────────────────────────────────────────────
-- CONFIGURACIÓN POR EMPRESA
-- ─────────────────────────────────────────────────────────────
create table configuracion (
  empresa_id      uuid primary key references empresas(id),
  tenant_id       uuid not null references tenants(id),
  metas_custom    jsonb not null default '{}',
  ficha_custom    jsonb not null default '{}',
  res_anteriores  jsonb not null default '{}',
  updated_at      timestamptz not null default now(),
  updated_by      uuid not null
);

alter table configuracion enable row level security;
create policy "configuracion: leer" on configuracion
  for select using (tenant_id::text = tenant_id() and can_read_empresa(empresa_id));
create policy "configuracion: solo ADMIN escribe" on configuracion
  for insert with check (tenant_id::text = tenant_id() and is_admin());
create policy "configuracion: solo ADMIN actualiza" on configuracion
  for update using (tenant_id::text = tenant_id() and is_admin());
create policy "configuracion: sin delete" on configuracion
  for delete using (false);

-- ─────────────────────────────────────────────────────────────
-- OBSERVACIONES POR AÑO (equivalente a subcolección obs/{year})
-- ─────────────────────────────────────────────────────────────
create table configuracion_obs (
  id          uuid primary key default uuid_generate_v4(),
  tenant_id   uuid not null references tenants(id),
  empresa_id  uuid not null references empresas(id),
  year        integer not null,
  obs         jsonb not null default '{}',
  updated_at  timestamptz not null default now(),
  updated_by  uuid not null,
  unique (empresa_id, year)
);

alter table configuracion_obs enable row level security;
create policy "obs: leer" on configuracion_obs
  for select using (tenant_id::text = tenant_id() and can_read_empresa(empresa_id));
create policy "obs: crear" on configuracion_obs
  for insert with check (tenant_id::text = tenant_id() and can_write_empresa(empresa_id));
create policy "obs: actualizar" on configuracion_obs
  for update using (tenant_id::text = tenant_id() and can_write_empresa(empresa_id));
create policy "obs: sin delete" on configuracion_obs
  for delete using (false);

-- ─────────────────────────────────────────────────────────────
-- CATÁLOGO GLOBAL DE INDICADORES (read-only para usuarios)
-- ─────────────────────────────────────────────────────────────
create table catalogo_indicadores (
  ind_key       text primary key,
  nom           text not null,
  tipo          text not null check (tipo in ('Resultado','Proceso','Base')),
  normativa     text,
  periodicidad  text check (periodicidad in ('Mensual','Trimestral','Semestral','Anual')),
  formula       text,
  meta          text,
  meta_num      numeric,
  inv           boolean not null default false,
  fuente        text,
  umbral        text,
  responsable   text,
  evidencia     text,
  interp        text,
  orden         integer not null default 0
);

alter table catalogo_indicadores enable row level security;
create policy "catalogo: leer (autenticados)" on catalogo_indicadores
  for select using (auth.role() = 'authenticated');
create policy "catalogo: sin escritura desde cliente" on catalogo_indicadores
  for all using (false);

-- ─────────────────────────────────────────────────────────────
-- ÍNDICES DE PERFORMANCE
-- ─────────────────────────────────────────────────────────────
create index on seguimiento (tenant_id, empresa_id, year, mes);
create index on seguimiento (tenant_id, empresa_id, year, completado);
create index on accidentes  (tenant_id, empresa_id, activo, fecha desc);
create index on accidentes  (tenant_id, empresa_id, activo, investigado, fecha);
create index on acciones    (tenant_id, empresa_id, activo, estado);
create index on acciones    (tenant_id, empresa_id, activo, fecha_limite, estado);
create index on acciones    (tenant_id, empresa_id, activo, estado, prioridad);
create index on ausencias   (tenant_id, empresa_id, activo, fecha_inicio desc);
create index on ausencias   (tenant_id, empresa_id, activo, causa, fecha_inicio desc);
create index on inspecciones(tenant_id, empresa_id, activo, fecha desc);
create index on capacitaciones(tenant_id, empresa_id, activo, fecha desc);
create index on plan_actividades(tenant_id, empresa_id, year, mes);
create index on auditorias  (tenant_id, empresa_id, activo, fecha desc);
create index on casos_medicos(tenant_id, empresa_id, activo, estado, fecha_apertura desc);
create index on empresas    (tenant_id, asesor_id, activa);
create index on empresas    (tenant_id, activa, contrato_fin);


-- ═════════════════════════════════════════════════════════════
-- 002 — 002_h3_proteger_usuarios.sql
-- ═════════════════════════════════════════════════════════════

-- SIZO — Migración 002 — H3: proteger columnas sensibles de `usuarios`
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ─────────────────────────────────────────────────────────────
-- Hallazgo H3 (auditoría 2026-06-15):
-- La política "usuarios: el propio puede actualizar perfil" (using id = auth.uid())
-- permite que un usuario cambie su propia fila SIN restricción de columnas, incluyendo
-- rol, tenant_id y empresas_ids. Hoy no escala privilegios porque la autorización vive
-- en el JWT (app_metadata), pero es un escalamiento LATENTE y un riesgo de integridad.
--
-- Las políticas RLS no pueden restringir columnas. La forma quirúrgica es un trigger
-- BEFORE UPDATE que hace inmutables las columnas sensibles para cualquier cliente
-- (rol 'authenticated'). Solo el backend (service_role) — vía el script de provisión o
-- la Edge Function — puede cambiarlas, que es justo el flujo previsto.
-- ─────────────────────────────────────────────────────────────

create or replace function usuarios_proteger_columnas()
returns trigger language plpgsql
as $$
begin
  -- Solo los clientes autenticados quedan restringidos.
  -- service_role / postgres (backend) pueden todo (provisión, edge functions).
  if auth.role() is distinct from 'authenticated' then
    return new;
  end if;

  if new.rol           is distinct from old.rol
     or new.tenant_id    is distinct from old.tenant_id
     or new.empresas_ids is distinct from old.empresas_ids
     or new.id           is distinct from old.id
     or lower(coalesce(new.email,'')) is distinct from lower(coalesce(old.email,'')) then
    raise exception
      'usuarios: rol, tenant_id, empresas_ids, id y email son inmutables desde el cliente; '
      'usar el flujo de provisión (service role)';
  end if;

  return new;
end
$$;

drop trigger if exists trg_usuarios_proteger_columnas on usuarios;

create trigger trg_usuarios_proteger_columnas
  before update on usuarios
  for each row
  execute function usuarios_proteger_columnas();


-- ═════════════════════════════════════════════════════════════
-- 003 — 003_h10_optimizar_rls.sql
-- ═════════════════════════════════════════════════════════════

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
as $$ select (select is_admin()) or emp_id::text = any(user_empresas()) $$;

create or replace function can_write_empresa(emp_id uuid)
returns boolean language sql stable
as $$ select (select is_admin()) or ((select is_asesor()) and emp_id::text = any(user_empresas())) $$;

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


-- ═════════════════════════════════════════════════════════════
-- 004 — 004_archivos.sql
-- ═════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────
-- SIZO — Migración 004: Gestor de archivos PDF
-- Tabla archivos + RLS multitenant + bucket Storage
-- Aplicar manualmente en Supabase Dashboard → SQL Editor
-- ─────────────────────────────────────────────────────────────

-- ── Tabla ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS archivos (
  id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id    uuid        NOT NULL REFERENCES tenants(id),
  empresa_id   uuid        REFERENCES empresas(id),
  nombre       text        NOT NULL,
  descripcion  text,
  storage_path text        NOT NULL,
  tipo_mime    text        DEFAULT 'application/pdf',
  tamanio      bigint,
  firmado      boolean     DEFAULT false,
  firmado_por  uuid        REFERENCES usuarios(id),
  firmado_en   timestamptz,
  notas        text,
  activo       boolean     DEFAULT true,
  creado_en    timestamptz DEFAULT now(),
  creado_por   uuid        REFERENCES usuarios(id),
  updated_at   timestamptz DEFAULT now(),
  updated_by   uuid        REFERENCES usuarios(id),
  deleted_at   timestamptz
);

ALTER TABLE archivos ENABLE ROW LEVEL SECURITY;

-- ── Índices ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS archivos_tenant_idx    ON archivos (tenant_id);
CREATE INDEX IF NOT EXISTS archivos_empresa_idx   ON archivos (empresa_id);
CREATE INDEX IF NOT EXISTS archivos_activo_idx    ON archivos (activo);

-- ── Políticas RLS ─────────────────────────────────────────────
-- Usan las funciones helper definidas en 001_schema_inicial.sql:
--   tenant_id(), is_admin(), user_role(), can_read_empresa(), can_write_empresa()

CREATE POLICY "archivos_select" ON archivos
  FOR SELECT USING (
    tenant_id = tenant_id()::uuid AND activo = true AND
    (
      is_admin() OR
      (empresa_id IS NOT NULL AND (select can_read_empresa(empresa_id)))
    )
  );

CREATE POLICY "archivos_insert" ON archivos
  FOR INSERT WITH CHECK (
    tenant_id = tenant_id()::uuid AND
    user_role() <> 'CONSULTA' AND
    (
      is_admin() OR
      (empresa_id IS NOT NULL AND (select can_write_empresa(empresa_id)))
    )
  );

CREATE POLICY "archivos_update" ON archivos
  FOR UPDATE USING (
    tenant_id = tenant_id()::uuid AND
    user_role() <> 'CONSULTA' AND
    (
      is_admin() OR
      (empresa_id IS NOT NULL AND (select can_write_empresa(empresa_id)))
    )
  );

CREATE POLICY "archivos_delete" ON archivos
  FOR DELETE USING (
    tenant_id = tenant_id()::uuid AND is_admin()
  );

-- ── Bucket Storage ────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documentos',
  'documentos',
  false,
  52428800,  -- 50 MB
  ARRAY['application/pdf', 'image/png', 'image/jpeg', 'image/jpg', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Políticas de Storage
-- Path esperado: {tenant_id}/{empresa_id|'general'}/{uuid}.pdf
-- El primer segmento del path debe coincidir con el tenant_id del JWT

CREATE POLICY "documentos_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'documentos' AND
    (storage.foldername(name))[1] = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')
  );

CREATE POLICY "documentos_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'documentos' AND
    (storage.foldername(name))[1] = (auth.jwt() -> 'app_metadata' ->> 'tenant_id') AND
    (auth.jwt() -> 'app_metadata' ->> 'role') <> 'CONSULTA'
  );

CREATE POLICY "documentos_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'documentos' AND
    (storage.foldername(name))[1] = (auth.jwt() -> 'app_metadata' ->> 'tenant_id') AND
    (auth.jwt() -> 'app_metadata' ->> 'role') <> 'CONSULTA'
  );

CREATE POLICY "documentos_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'documentos' AND
    (storage.foldername(name))[1] = (auth.jwt() -> 'app_metadata' ->> 'tenant_id') AND
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'ADMIN'
  );


-- ═════════════════════════════════════════════════════════════
-- 005 — 005_billing.sql
-- ═════════════════════════════════════════════════════════════

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


-- ═════════════════════════════════════════════════════════════
-- 006 — 006_matriz_riesgos.sql
-- ═════════════════════════════════════════════════════════════

-- SIZO — Migración 006: Matriz de Identificación de Peligros y Valoración de Riesgos (GTC 45)
-- Ejecutar en: Supabase Dashboard → SQL Editor

create table matriz_riesgos (
  id                    uuid primary key default uuid_generate_v4(),
  tenant_id             uuid not null references tenants(id),
  empresa_id            uuid not null references empresas(id),

  -- Proceso, lugar y tarea evaluada
  proceso               text not null,
  zona_lugar            text,
  actividad             text not null,
  rutinaria             boolean not null default true,
  tarea                 text,

  -- Peligro identificado (clasificación GTC 45)
  peligro_categoria     text not null check (peligro_categoria in
    ('fisico','quimico','biologico','biomecanico','condiciones_seguridad','fenomenos_naturales','psicosocial')),
  peligro_descripcion   text not null,
  fuente                text,
  efectos_posibles      text,
  num_expuestos         integer not null default 1,
  peor_consecuencia     text,

  -- Controles existentes (jerarquía de controles)
  controles_fuente      text,
  controles_medio       text,
  controles_individuo   text,

  -- Valoración del riesgo (GTC 45): entradas del usuario
  nivel_deficiencia     integer not null check (nivel_deficiencia in (0,2,6,10)),
  nivel_exposicion      integer not null check (nivel_exposicion in (1,2,3,4)),
  nivel_consecuencia    integer not null check (nivel_consecuencia in (10,25,60,100)),

  -- Valoración del riesgo: calculados en el frontend (calcular-riesgo-gtc45.js), guardados ya resueltos
  nivel_probabilidad         integer,
  interpretacion_probabilidad text,
  nivel_riesgo                integer,
  interpretacion_riesgo       text,
  aceptabilidad                text,

  controles_propuestos  text,

  activo                boolean not null default true,
  creado_en             timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  updated_by            uuid not null,
  creado_por            uuid not null,
  deleted_at            timestamptz
);

alter table matriz_riesgos enable row level security;

create policy "matriz_riesgos: leer" on matriz_riesgos
  for select using (tenant_id::text = (select tenant_id()) and can_read_empresa(empresa_id));
create policy "matriz_riesgos: crear" on matriz_riesgos
  for insert with check (tenant_id::text = (select tenant_id()) and can_write_empresa(empresa_id));
create policy "matriz_riesgos: actualizar" on matriz_riesgos
  for update using (tenant_id::text = (select tenant_id()) and can_write_empresa(empresa_id));


-- ═════════════════════════════════════════════════════════════
-- 007 — 007_epp_documentos_actas.sql
-- ═════════════════════════════════════════════════════════════

-- SIZO — Migración 007: Matriz de EPP, Documentación general del SG-SST y Actas COPASST/Convivencia
-- Ejecutar en: Supabase Dashboard → SQL Editor

-- ─────────────────────────────────────────────────────────────
-- 1. Matriz de EPP — cruza cargo/tarea con el EPP requerido
--    (Dec. 1072/2015 Art. 2.2.4.6.24). Puede referenciar el peligro
--    de matriz_riesgos que origina la necesidad del EPP.
-- ─────────────────────────────────────────────────────────────
create table matriz_epp (
  id                  uuid primary key default uuid_generate_v4(),
  tenant_id           uuid not null references tenants(id),
  empresa_id          uuid not null references empresas(id),
  cargo               text not null,
  peligro_id          uuid references matriz_riesgos(id) on delete set null,
  peligro_asociado     text,
  epp_requerido        text not null,
  zona_cuerpo          text check (zona_cuerpo in
    ('cabeza','ojos_cara','oidos','manos','pies','cuerpo','vias_respiratorias','altura')),
  norma_tecnica        text,
  frecuencia_reposicion text,
  activo               boolean not null default true,
  creado_en            timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  updated_by           uuid not null,
  creado_por           uuid not null,
  deleted_at           timestamptz
);

alter table matriz_epp enable row level security;
create policy "matriz_epp: leer" on matriz_epp
  for select using (tenant_id::text = (select tenant_id()) and can_read_empresa(empresa_id));
create policy "matriz_epp: crear" on matriz_epp
  for insert with check (tenant_id::text = (select tenant_id()) and can_write_empresa(empresa_id));
create policy "matriz_epp: actualizar" on matriz_epp
  for update using (tenant_id::text = (select tenant_id()) and can_write_empresa(empresa_id));

-- ─────────────────────────────────────────────────────────────
-- 2. Entrega individual de EPP — evidencia firmada de entrega
--    (Dec. 1072/2015 Art. 2.2.4.6.24)
-- ─────────────────────────────────────────────────────────────
create table entrega_epp (
  id                     uuid primary key default uuid_generate_v4(),
  tenant_id              uuid not null references tenants(id),
  empresa_id             uuid not null references empresas(id),
  trabajador             text not null,
  cargo                  text,
  epp_entregado           text not null,
  cantidad               integer not null default 1,
  talla                  text,
  fecha_entrega          date not null,
  fecha_proxima_reposicion date,
  firmado                boolean not null default false,
  observaciones          text,
  activo                 boolean not null default true,
  creado_en              timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  updated_by             uuid not null,
  creado_por             uuid not null,
  deleted_at             timestamptz
);

alter table entrega_epp enable row level security;
create policy "entrega_epp: leer" on entrega_epp
  for select using (tenant_id::text = (select tenant_id()) and can_read_empresa(empresa_id));
create policy "entrega_epp: crear" on entrega_epp
  for insert with check (tenant_id::text = (select tenant_id()) and can_write_empresa(empresa_id));
create policy "entrega_epp: actualizar" on entrega_epp
  for update using (tenant_id::text = (select tenant_id()) and can_write_empresa(empresa_id));

-- ─────────────────────────────────────────────────────────────
-- 3. Documentación general del SG-SST — política, objetivos,
--    matriz de requisitos legales, manual del sistema
--    (Dec. 1072/2015 Art. 2.2.4.6.5, 2.2.4.6.8, 2.2.4.6.16)
-- ─────────────────────────────────────────────────────────────
create table documentos_sst (
  id              uuid primary key default uuid_generate_v4(),
  tenant_id       uuid not null references tenants(id),
  empresa_id      uuid not null references empresas(id),
  tipo            text not null check (tipo in
    ('politica','objetivos','requisitos_legales','manual_sgsst')),
  nombre          text not null,
  version         text,
  responsable     text,
  fecha_aprobacion date,
  fecha_vigencia  date,
  contenido       text,
  archivo_id      uuid references archivos(id) on delete set null,
  activo          boolean not null default true,
  creado_en       timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  updated_by      uuid not null,
  creado_por      uuid not null,
  deleted_at      timestamptz
);

alter table documentos_sst enable row level security;
create policy "documentos_sst: leer" on documentos_sst
  for select using (tenant_id::text = (select tenant_id()) and can_read_empresa(empresa_id));
create policy "documentos_sst: crear" on documentos_sst
  for insert with check (tenant_id::text = (select tenant_id()) and can_write_empresa(empresa_id));
create policy "documentos_sst: actualizar" on documentos_sst
  for update using (tenant_id::text = (select tenant_id()) and can_write_empresa(empresa_id));

-- ─────────────────────────────────────────────────────────────
-- 4. Actas COPASST / Comité de Convivencia Laboral
--    (Res. 2013/1986, Dec. 1072/2015; Res. 652/2012 y 1356/2012)
-- ─────────────────────────────────────────────────────────────
create table actas (
  id              uuid primary key default uuid_generate_v4(),
  tenant_id       uuid not null references tenants(id),
  empresa_id      uuid not null references empresas(id),
  tipo            text not null check (tipo in ('copasst','convivencia')),
  fecha           date not null,
  asistentes      jsonb not null default '[]',
  orden_dia       text,
  desarrollo      text,
  compromisos     text,
  responsable     text,
  fecha_proxima_reunion date,
  activo          boolean not null default true,
  creado_en       timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  updated_by      uuid not null,
  creado_por      uuid not null,
  deleted_at      timestamptz
);

alter table actas enable row level security;
create policy "actas: leer" on actas
  for select using (tenant_id::text = (select tenant_id()) and can_read_empresa(empresa_id));
create policy "actas: crear" on actas
  for insert with check (tenant_id::text = (select tenant_id()) and can_write_empresa(empresa_id));
create policy "actas: actualizar" on actas
  for update using (tenant_id::text = (select tenant_id()) and can_write_empresa(empresa_id));


-- ═════════════════════════════════════════════════════════════
-- 008 — 008_gestor_documental.sql
-- ═════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────
-- SIZO — Migración 008: Gestor Documental unificado
-- Fusiona `archivos` (storage/firma) y `documentos_sst` (taxonomía/
-- vigencia) en una sola tabla `documentos`, con historial de
-- versiones. Aplicar manualmente en Supabase Dashboard → SQL Editor.
--
-- IMPORTANTE: esta migración NO elimina `archivos` ni `documentos_sst`.
-- Se copian los datos (mismo id) a la tabla nueva; las tablas viejas
-- quedan intactas como respaldo y pueden eliminarse en una migración
-- futura una vez validado el nuevo módulo en producción.
-- ─────────────────────────────────────────────────────────────

-- ── Tabla ────────────────────────────────────────────────────
create table documentos (
  id                  uuid primary key default uuid_generate_v4(),
  tenant_id           uuid not null references tenants(id),
  empresa_id          uuid references empresas(id),
  categoria           text not null check (categoria in
    ('politica','objetivos','requisitos_legales','manual_sgsst','matriz','acta','registro','certificado','informe','otro')),
  nombre              text not null,
  descripcion         text,
  contenido           text,
  responsable         text,
  fecha_aprobacion    date,
  fecha_vigencia      date,
  storage_path        text,
  tipo_mime           text default 'application/pdf',
  tamanio             bigint,
  firmado             boolean not null default false,
  firmado_por         uuid references usuarios(id),
  firmado_en          timestamptz,
  notas               text,
  version             integer not null default 1,
  version_anterior_id uuid references documentos(id) on delete set null,
  raiz_id             uuid references documentos(id) on delete set null,
  es_actual           boolean not null default true,
  activo              boolean not null default true,
  creado_en           timestamptz not null default now(),
  creado_por          uuid references usuarios(id),
  updated_at          timestamptz not null default now(),
  updated_by          uuid references usuarios(id),
  deleted_at          timestamptz
);

-- storage_path es nullable a nivel de BD para no romper la migración de
-- filas históricas de documentos_sst sin PDF adjunto (metadata-only).
-- El módulo exige el PDF al crear un documento nuevo desde la UI.

alter table documentos enable row level security;

-- ── Índices ───────────────────────────────────────────────────
create index documentos_tenant_idx    on documentos (tenant_id);
create index documentos_empresa_idx   on documentos (empresa_id);
create index documentos_activo_idx    on documentos (activo);
create index documentos_raiz_idx      on documentos (raiz_id);
create index documentos_categoria_idx on documentos (categoria);
create index documentos_actual_idx    on documentos (es_actual);

-- ── Políticas RLS ─────────────────────────────────────────────
-- Mismo patrón que `archivos`: ADMIN ve todo el tenant; ASESOR/CONSULTA
-- solo empresas asignadas (empresa_id NULL = documento general, solo ADMIN).

create policy "documentos_select" on documentos
  for select using (
    tenant_id = tenant_id()::uuid and activo = true and
    (
      is_admin() or
      (empresa_id is not null and (select can_read_empresa(empresa_id)))
    )
  );

create policy "documentos_insert" on documentos
  for insert with check (
    tenant_id = tenant_id()::uuid and
    user_role() <> 'CONSULTA' and
    (
      is_admin() or
      (empresa_id is not null and (select can_write_empresa(empresa_id)))
    )
  );

create policy "documentos_update" on documentos
  for update using (
    tenant_id = tenant_id()::uuid and
    user_role() <> 'CONSULTA' and
    (
      is_admin() or
      (empresa_id is not null and (select can_write_empresa(empresa_id)))
    )
  );

create policy "documentos_delete" on documentos
  for delete using (
    tenant_id = tenant_id()::uuid and is_admin()
  );

-- ── Migración de datos: archivos → documentos ───────────────────
-- Categoría por defecto 'otro' (archivos.js no tenía taxonomía).
-- version = 1 y raiz_id = id propio: cada archivo migrado es su propia
-- raíz de historial de versiones.
insert into documentos (
  id, tenant_id, empresa_id, categoria, nombre, descripcion,
  storage_path, tipo_mime, tamanio,
  firmado, firmado_por, firmado_en, notas,
  version, raiz_id, es_actual, activo,
  creado_en, creado_por, updated_at, updated_by, deleted_at
)
select
  id, tenant_id, empresa_id, 'otro', nombre, descripcion,
  storage_path, tipo_mime, tamanio,
  firmado, firmado_por, firmado_en, notas,
  1, id, true, activo,
  creado_en, creado_por, updated_at, updated_by, deleted_at
from archivos;

-- ── Migración de datos: documentos_sst → documentos ─────────────
-- Si el documento tenía un archivo_id enlazado, se copia el storage_path
-- del PDF asociado (queda referenciado en dos filas: la de `archivos`
-- original y esta nueva — no se mueve, se copia).
insert into documentos (
  id, tenant_id, empresa_id, categoria, nombre,
  contenido, responsable, fecha_aprobacion, fecha_vigencia,
  storage_path, tipo_mime, tamanio,
  version, raiz_id, es_actual, activo,
  creado_en, creado_por, updated_at, updated_by, deleted_at
)
select
  d.id, d.tenant_id, d.empresa_id, d.tipo, d.nombre,
  d.contenido, d.responsable, d.fecha_aprobacion, d.fecha_vigencia,
  a.storage_path, a.tipo_mime, a.tamanio,
  1, d.id, true, d.activo,
  d.creado_en, d.creado_por, d.updated_at, d.updated_by, d.deleted_at
from documentos_sst d
left join archivos a on a.id = d.archivo_id;


-- ═════════════════════════════════════════════════════════════
-- 011 — 011_fix_cache_rls_documentos.sql
-- ═════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────
-- SIZO — Migración 011: Corrige caché de plan en RLS de `documentos`
--
-- Diagnóstico confirmado con pruebas en la misma transacción: la
-- expresión de `documentos_update` evaluaba `true` justo antes del
-- UPDATE (comprobado con un SELECT idéntico inmediato) y aun así
-- Postgres rechazaba la fila con 42501. Se descartaron: tabla
-- duplicada, trigger, rule, FK autorreferenciada, RETURNING.
--
-- Causa real: is_admin()/tenant_id()/user_role() se llamaban SIN
-- envolver en (select ...), a diferencia de can_read_empresa()/
-- can_write_empresa() que sí estaban envueltas. Sin el envoltorio,
-- Postgres puede reusar un plan genérico cacheado (frecuente con el
-- pooling de conexiones de Supabase) que "congela" el resultado de
-- estas funciones de una ejecución anterior con OTRO rol/JWT — este
-- es precisamente el motivo documentado en H10 (CLAUDE.md) para usar
-- (select tenant_id()) en vez de tenant_id() directo. Se aplicó esa
-- envoltura a TODAS las funciones, no solo a las que dependen de
-- una columna de la fila.
--
-- Idempotente: DROP + CREATE. No toca datos.
-- Aplicar manualmente en Supabase Dashboard → SQL Editor.
-- ─────────────────────────────────────────────────────────────

drop policy if exists "documentos_select" on documentos;
drop policy if exists "documentos_insert" on documentos;
drop policy if exists "documentos_update" on documentos;
drop policy if exists "documentos_delete" on documentos;

create policy "documentos_select" on documentos
  for select using (
    tenant_id = (select tenant_id())::uuid and activo = true and
    (
      (select is_admin()) or
      (empresa_id is not null and (select can_read_empresa(empresa_id)))
    )
  );

create policy "documentos_insert" on documentos
  for insert with check (
    tenant_id = (select tenant_id())::uuid and
    (select user_role()) <> 'CONSULTA' and
    (
      (select is_admin()) or
      (empresa_id is not null and (select can_write_empresa(empresa_id)))
    )
  );

create policy "documentos_update" on documentos
  for update
  using (
    tenant_id = (select tenant_id())::uuid and
    (select user_role()) <> 'CONSULTA' and
    (
      (select is_admin()) or
      (empresa_id is not null and (select can_write_empresa(empresa_id)))
    )
  )
  with check (
    tenant_id = (select tenant_id())::uuid and
    (select user_role()) <> 'CONSULTA' and
    (
      (select is_admin()) or
      (empresa_id is not null and (select can_write_empresa(empresa_id)))
    )
  );

create policy "documentos_delete" on documentos
  for delete using (
    tenant_id = (select tenant_id())::uuid and (select is_admin())
  );

-- Verificación: debe listar 4 filas
select policyname, cmd, permissive from pg_policies where tablename = 'documentos' order by cmd;


-- ═════════════════════════════════════════════════════════════
-- 012 — 012_rpc_soft_delete_documento.sql
-- ═════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────
-- SIZO — Migración 012: RPC para soft-delete de `documentos`
--
-- Después de diagnóstico exhaustivo (ver 009/010/011), el UPDATE
-- directo vía PostgREST sigue rechazado por RLS con 42501 al poner
-- activo=false, incluso habiendo probado en la misma transacción que
-- la expresión de la política evalúa `true` justo antes del UPDATE.
-- Se descartaron: tabla duplicada, trigger, rule, FK autorreferenciada,
-- RETURNING, caché de plan genérico (H10). La causa exacta queda sin
-- resolver a nivel de RLS declarativa — probablemente algo en cómo
-- Supabase/PgBouncer reconcilia el WITH CHECK con el pooling de
-- conexiones para esta combinación específica de policies.
--
-- Workaround robusto: función SECURITY DEFINER que valida permisos
-- explícitamente en PL/pgSQL y actualiza como dueño de la tabla,
-- evitando por completo el mecanismo de RLS para este UPDATE puntual.
-- Aplicar manualmente en Supabase Dashboard → SQL Editor.
-- ─────────────────────────────────────────────────────────────

create or replace function soft_delete_documento(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id  uuid;
  v_empresa_id uuid;
  v_storage_path text;
begin
  select tenant_id, empresa_id, storage_path
  into v_tenant_id, v_empresa_id, v_storage_path
  from documentos
  where id = p_id and activo = true;

  if not found then
    raise exception 'Documento no encontrado';
  end if;

  if v_tenant_id <> (select tenant_id())::uuid then
    raise exception 'No autorizado';
  end if;

  if (select user_role()) = 'CONSULTA' then
    raise exception 'No autorizado';
  end if;

  if not (
    (select is_admin())
    or (v_empresa_id is not null and (select can_write_empresa(v_empresa_id)))
  ) then
    raise exception 'No autorizado';
  end if;

  update documentos
  set activo = false,
      deleted_at = now(),
      updated_by = auth.uid(),
      updated_at = now()
  where id = p_id;
end;
$$;

revoke all on function soft_delete_documento(uuid) from public;
grant execute on function soft_delete_documento(uuid) to authenticated;


-- ═════════════════════════════════════════════════════════════
-- 013 — 013_rpc_soft_delete_general.sql
-- ═════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────
-- SIZO — Migración 013: RPC de soft-delete para matriz_riesgos y actas
--
-- Replica el workaround de 012_rpc_soft_delete_documento.sql: el UPDATE
-- directo vía PostgREST para poner activo=false queda sujeto al mismo
-- bloqueo RLS sin explicación raíz (ver notas 2026-07-16 en CLAUDE.md).
-- En vez de seguir depurando la policy tabla por tabla, se aplica el
-- mismo patrón ya validado: función SECURITY DEFINER que valida permisos
-- explícitamente en PL/pgSQL y actualiza como dueño de la tabla.
-- Aplicar manualmente en Supabase Dashboard → SQL Editor.
-- ─────────────────────────────────────────────────────────────

create or replace function soft_delete_matriz_riesgos(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id  uuid;
  v_empresa_id uuid;
begin
  select tenant_id, empresa_id
  into v_tenant_id, v_empresa_id
  from matriz_riesgos
  where id = p_id and activo = true;

  if not found then
    raise exception 'Registro no encontrado';
  end if;

  if v_tenant_id <> (select tenant_id())::uuid then
    raise exception 'No autorizado';
  end if;

  if (select user_role()) = 'CONSULTA' then
    raise exception 'No autorizado';
  end if;

  if not (
    (select is_admin())
    or (select can_write_empresa(v_empresa_id))
  ) then
    raise exception 'No autorizado';
  end if;

  update matriz_riesgos
  set activo = false,
      deleted_at = now(),
      updated_by = auth.uid(),
      updated_at = now()
  where id = p_id;
end;
$$;

revoke all on function soft_delete_matriz_riesgos(uuid) from public;
grant execute on function soft_delete_matriz_riesgos(uuid) to authenticated;


create or replace function soft_delete_acta(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id  uuid;
  v_empresa_id uuid;
begin
  select tenant_id, empresa_id
  into v_tenant_id, v_empresa_id
  from actas
  where id = p_id and activo = true;

  if not found then
    raise exception 'Registro no encontrado';
  end if;

  if v_tenant_id <> (select tenant_id())::uuid then
    raise exception 'No autorizado';
  end if;

  if (select user_role()) = 'CONSULTA' then
    raise exception 'No autorizado';
  end if;

  if not (
    (select is_admin())
    or (select can_write_empresa(v_empresa_id))
  ) then
    raise exception 'No autorizado';
  end if;

  update actas
  set activo = false,
      deleted_at = now(),
      updated_by = auth.uid(),
      updated_at = now()
  where id = p_id;
end;
$$;

revoke all on function soft_delete_acta(uuid) from public;
grant execute on function soft_delete_acta(uuid) to authenticated;
