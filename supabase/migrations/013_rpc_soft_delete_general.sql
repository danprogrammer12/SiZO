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
