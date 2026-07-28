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
