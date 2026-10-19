-- =====================================================================
-- 025 · Índices de FK consultadas (down)
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
  IF v_ultima IS DISTINCT FROM '025' THEN
    RAISE EXCEPTION 'No se puede revertir la 025 en %: la última aplicada es %.', current_database(), v_ultima;
  END IF;
END $$;

SET LOCAL ROLE learnity_owner;

DROP INDEX solicitud_docente_persona_idx;
DROP INDEX solicitud_docente_estado_idx;
DROP INDEX recurso_adjunto_leccion_idx;
DROP INDEX progreso_leccion_leccion_idx;
DROP INDEX inscripcion_ultima_leccion_idx;

DELETE FROM schema_migraciones WHERE version = '025';

COMMIT;
