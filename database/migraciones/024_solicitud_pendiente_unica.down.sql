-- =====================================================================
-- 024 · Una sola solicitud PENDIENTE por persona (down)
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
  IF v_ultima IS DISTINCT FROM '024' THEN
    RAISE EXCEPTION 'No se puede revertir la 024 en %: la última aplicada es %.', current_database(), v_ultima;
  END IF;
END $$;

SET LOCAL ROLE learnity_owner;

DROP INDEX solicitud_docente_pendiente_uq;

DELETE FROM schema_migraciones WHERE version = '024';

COMMIT;
