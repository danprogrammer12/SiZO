-- ─────────────────────────────────────────────────────────────
-- SIZO — Migración 010: Simplifica RLS de `documentos`
-- El soft-delete seguía fallando con "new row violates row-level
-- security policy" para ADMIN incluso con la política 009 (USING y
-- WITH CHECK idénticos, todos los booleanos evaluados por separado
-- daban true). Se descartaron: tabla duplicada, trigger, rule.
--
-- El patrón `(select can_write_empresa(empresa_id))` — subconsulta
-- correlacionada por fila envuelta en SELECT — solo tiene sentido de
-- optimización (InitPlan) para funciones SIN argumento de fila como
-- is_admin()/tenant_id() (ver H10 en CLAUDE.md). Envolver una función
-- que sí depende de una columna de la fila (can_write_empresa(empresa_id))
-- no aporta nada y es la única pieza no verificada individualmente antes.
-- Se quita esa indirección y se llama la función directo.
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
    tenant_id = tenant_id()::uuid and activo = true and
    (
      is_admin() or
      (empresa_id is not null and can_read_empresa(empresa_id))
    )
  );

create policy "documentos_insert" on documentos
  for insert with check (
    tenant_id = tenant_id()::uuid and
    user_role() <> 'CONSULTA' and
    (
      is_admin() or
      (empresa_id is not null and can_write_empresa(empresa_id))
    )
  );

create policy "documentos_update" on documentos
  for update
  using (
    tenant_id = tenant_id()::uuid and
    user_role() <> 'CONSULTA' and
    (
      is_admin() or
      (empresa_id is not null and can_write_empresa(empresa_id))
    )
  )
  with check (
    tenant_id = tenant_id()::uuid and
    user_role() <> 'CONSULTA' and
    (
      is_admin() or
      (empresa_id is not null and can_write_empresa(empresa_id))
    )
  );

create policy "documentos_delete" on documentos
  for delete using (
    tenant_id = tenant_id()::uuid and is_admin()
  );

-- Verificación: debe listar 4 filas
select policyname, cmd, permissive from pg_policies where tablename = 'documentos' order by cmd;
