-- =====================================================================
-- 017 · Control de migraciones (down)
-- Solo si la 017 es la última aplicada. Borra schema_migraciones.
-- =====================================================================
SET client_encoding = 'UTF8';

BEGIN;
SET LOCAL lock_timeout = '10s';

DO $$
DECLARE
  v_ultima TEXT;
BEGIN
  SELECT version INTO v_ultima FROM schema_migraciones ORDER BY orden DESC LIMIT 1;
  IF v_ultima IS DISTINCT FROM '017' THEN
    RAISE EXCEPTION 'No se puede revertir la 017 en %: la última aplicada es %.', current_database(), v_ultima;
  END IF;
END $$;

DROP TABLE schema_migraciones;

COMMIT;
