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
