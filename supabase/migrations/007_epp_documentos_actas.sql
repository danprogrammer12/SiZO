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
