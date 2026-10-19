-- =====================================================================
-- 019 · Privilegios mínimos (down)
--
-- Quita los permisos de learnity_app, learnity_lectura y learnity_pruebas en
-- tablas y secuencias, y vuelve a conceder a learnity_app exactamente lo que
-- tenía antes de la 019 (schema_migraciones.reversion).
-- Ejecutar con postgres.
-- =====================================================================
SET client_encoding = 'UTF8';

BEGIN;
SET LOCAL lock_timeout = '10s';

DO $$
DECLARE
  v_ultima TEXT;
BEGIN
  SELECT version INTO v_ultima FROM schema_migraciones ORDER BY orden DESC LIMIT 1;
  IF v_ultima IS DISTINCT FROM '019' THEN
    RAISE EXCEPTION 'No se puede revertir la 019 en %: la última aplicada es %.', current_database(), v_ultima;
  END IF;
END $$;

SET LOCAL ROLE learnity_owner;

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM learnity_app, learnity_lectura, learnity_pruebas;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM learnity_app, learnity_lectura, learnity_pruebas;

DO $$
DECLARE
  p JSONB;
BEGIN
  FOR p IN
    SELECT jsonb_array_elements(reversion -> 'learnity_app')
      FROM schema_migraciones WHERE version = '019'
  LOOP
    EXECUTE format('GRANT %s ON %s public.%I TO learnity_app%s',
                   p ->> 'privilegio',
                   CASE WHEN p ->> 'tipo' = 'S' THEN 'SEQUENCE' ELSE 'TABLE' END,
                   p ->> 'relacion',
                   CASE WHEN (p ->> 'con_grant')::BOOLEAN THEN ' WITH GRANT OPTION' ELSE '' END);
  END LOOP;
END $$;

DELETE FROM schema_migraciones WHERE version = '019';

COMMIT;
