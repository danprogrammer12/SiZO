-- SIZO — Migración 002 — H3: proteger columnas sensibles de `usuarios`
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ─────────────────────────────────────────────────────────────
-- Hallazgo H3 (auditoría 2026-06-15):
-- La política "usuarios: el propio puede actualizar perfil" (using id = auth.uid())
-- permite que un usuario cambie su propia fila SIN restricción de columnas, incluyendo
-- rol, tenant_id y empresas_ids. Hoy no escala privilegios porque la autorización vive
-- en el JWT (app_metadata), pero es un escalamiento LATENTE y un riesgo de integridad.
--
-- Las políticas RLS no pueden restringir columnas. La forma quirúrgica es un trigger
-- BEFORE UPDATE que hace inmutables las columnas sensibles para cualquier cliente
-- (rol 'authenticated'). Solo el backend (service_role) — vía el script de provisión o
-- la Edge Function — puede cambiarlas, que es justo el flujo previsto.
-- ─────────────────────────────────────────────────────────────

create or replace function usuarios_proteger_columnas()
returns trigger language plpgsql
as $$
begin
  -- Solo los clientes autenticados quedan restringidos.
  -- service_role / postgres (backend) pueden todo (provisión, edge functions).
  if auth.role() is distinct from 'authenticated' then
    return new;
  end if;

  if new.rol           is distinct from old.rol
     or new.tenant_id    is distinct from old.tenant_id
     or new.empresas_ids is distinct from old.empresas_ids
     or new.id           is distinct from old.id
     or lower(coalesce(new.email,'')) is distinct from lower(coalesce(old.email,'')) then
    raise exception
      'usuarios: rol, tenant_id, empresas_ids, id y email son inmutables desde el cliente; '
      'usar el flujo de provisión (service role)';
  end if;

  return new;
end
$$;

drop trigger if exists trg_usuarios_proteger_columnas on usuarios;

create trigger trg_usuarios_proteger_columnas
  before update on usuarios
  for each row
  execute function usuarios_proteger_columnas();
