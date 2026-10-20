-- =====================================================================
-- Permisos de la línea base (los de la sección 14 del README principal).
--
-- Es el último paso de la línea base de una base nueva, después de
-- learnity_esquema.sql, 015 y 016, y antes de la 017. Reproduce los permisos
-- que tenían Learnity y learnity_test antes de las migraciones (huella H0 del
-- 19-10-2026): learnity_app con CONNECT, USAGE en public, DML en todas las
-- tablas y USAGE, SELECT en todas las secuencias.
--
-- Por qué se conservan aunque la 019 los retire: así la base reconstruida pasa
-- por el mismo estado que las bases existentes, su huella se puede comparar con
-- la de referencia y la 019 guarda en schema_migraciones.reversion los mismos
-- permisos que su down restaura.
--
-- No es una migración: no se registra en schema_migraciones (la 017 registra
-- la línea base como 000, 015 y 016). Es repetible. Lo usa
-- scripts/reconstruir-base.ps1. Ejecutar con postgres, conectado a la base
-- nueva, antes de la 017.
-- =====================================================================
SET client_encoding = 'UTF8';

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.schema_migraciones') IS NOT NULL THEN
    RAISE EXCEPTION 'linea_base_permisos.sql es de la línea base y % ya tiene schema_migraciones (017).', current_database();
  END IF;
  IF to_regclass('public.persona') IS NULL
     OR to_regclass('public.sesion') IS NULL
     OR to_regclass('public.archivo_borrado_pendiente') IS NULL THEN
    RAISE EXCEPTION 'Faltan learnity_esquema.sql, la 015 o la 016 en %.', current_database();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'learnity_app') THEN
    RAISE EXCEPTION 'Falta el rol learnity_app en este servidor. Créalo primero (database/README.md, "Rol learnity_app").';
  END IF;
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO learnity_app', current_database());
END $$;

GRANT USAGE ON SCHEMA public TO learnity_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO learnity_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO learnity_app;

COMMIT;
