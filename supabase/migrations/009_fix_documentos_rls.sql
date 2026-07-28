-- ─────────────────────────────────────────────────────────────
-- SIZO — Migración 009: Corrige RLS de `documentos` (soft-delete
-- fallaba con "new row violates row-level security policy" incluso
-- para ADMIN). Idempotente: DROP + CREATE, no depende de qué
-- políticas hayan quedado a medio crear en 008. No toca datos.
-- Aplicar manualmente en Supabase Dashboard → SQL Editor.
-- ─────────────────────────────────────────────────────────────

drop policy if exists "documentos_select" on documentos;
drop policy if exists "documentos_insert" on documentos;
drop policy if exists "documentos_update" on documentos;
drop policy if exists "documentos_delete" on documentos;

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
  for update
  using (
    tenant_id = tenant_id()::uuid and
    user_role() <> 'CONSULTA' and
    (
      is_admin() or
      (empresa_id is not null and (select can_write_empresa(empresa_id)))
    )
  )
  with check (
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

-- Verificación: debe listar 4 filas (select, insert, update, delete)
select policyname, cmd, permissive from pg_policies where tablename = 'documentos' order by cmd;
