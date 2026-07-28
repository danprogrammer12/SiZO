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
