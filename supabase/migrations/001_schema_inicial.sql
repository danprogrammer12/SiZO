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
