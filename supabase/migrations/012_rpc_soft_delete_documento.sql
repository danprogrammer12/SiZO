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
