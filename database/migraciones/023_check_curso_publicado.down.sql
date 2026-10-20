-- =====================================================================
-- 023 · CHECK de curso PUBLICADO (down)
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
  IF v_ultima IS DISTINCT FROM '023' THEN
    RAISE EXCEPTION 'No se puede revertir la 023 en %: la última aplicada es %.', current_database(), v_ultima;
  END IF;
END $$;

SET LOCAL ROLE learnity_owner;

ALTER TABLE curso DROP CONSTRAINT curso_publicado_revisado;

DELETE FROM schema_migraciones WHERE version = '023';

COMMIT;
