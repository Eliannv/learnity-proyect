-- =====================================================================
-- 022 · Inventario de cursos PUBLICADO sin revisor o sin fecha (down)
-- Quita la vista. El up no cambió ningún dato, así que no hay nada que
-- restaurar en curso.
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
  IF v_ultima IS DISTINCT FROM '022' THEN
    RAISE EXCEPTION 'No se puede revertir la 022 en %: la última aplicada es %.', current_database(), v_ultima;
  END IF;
END $$;

SET LOCAL ROLE learnity_owner;

DROP VIEW curso_publicado_sin_revision;

DELETE FROM schema_migraciones WHERE version = '022';

COMMIT;
