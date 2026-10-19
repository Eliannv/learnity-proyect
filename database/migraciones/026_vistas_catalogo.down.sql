-- =====================================================================
-- 026 · Vistas del catálogo público (down)
-- Si el módulo catalogo ya lee de estas vistas, primero hay que volver el
-- backend a la versión anterior.
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
  IF v_ultima IS DISTINCT FROM '026' THEN
    RAISE EXCEPTION 'No se puede revertir la 026 en %: la última aplicada es %.', current_database(), v_ultima;
  END IF;
END $$;

SET LOCAL ROLE learnity_owner;

DROP VIEW catalogo_temario;
DROP VIEW catalogo_curso;
DROP VIEW catalogo_categoria;

DELETE FROM schema_migraciones WHERE version = '026';

COMMIT;
