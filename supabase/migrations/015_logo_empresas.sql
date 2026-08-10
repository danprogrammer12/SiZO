-- SIZO — Migración 015: logo de empresa
-- Ejecutar en: Supabase Dashboard → SQL Editor
--
-- Agrega logo_path a empresas. El archivo se sube al bucket privado
-- "documentos" ya existente (mismas políticas de storage de 004_archivos.sql),
-- bajo el path {tenant_id}/logos/{empresa_id}.{ext} — se sirve con signed URL.

alter table empresas add column if not exists logo_path text;
