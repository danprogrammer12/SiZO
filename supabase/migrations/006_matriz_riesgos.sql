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
