-- Reversion de la 034. Requiere desplegar antes el backend sin suspensión de cursos.
-- Se niega si hay cursos SUSPENDIDO: la 033 no admite ese estado y se perdería quién los suspendió y por qué.
SET client_encoding = 'UTF8';
BEGIN;
SET LOCAL lock_timeout = '10s';

DO $$
DECLARE v_ultima TEXT;
BEGIN
  SELECT version INTO v_ultima FROM schema_migraciones ORDER BY orden DESC LIMIT 1;
  IF v_ultima IS DISTINCT FROM '034' THEN
    RAISE EXCEPTION 'La 034 no es la ultima migracion en % (ultima: %).', current_database(), v_ultima;
  END IF;
  IF EXISTS (SELECT 1 FROM curso WHERE estado = 'SUSPENDIDO') THEN
    RAISE EXCEPTION 'Hay cursos SUSPENDIDO: reactivalos antes de revertir la 034.';
  END IF;
END $$;

SET LOCAL ROLE learnity_owner;

DROP INDEX curso_estado_fecha_idx;

ALTER TABLE curso
  DROP CONSTRAINT curso_suspension_completa,
  DROP COLUMN motivo_suspension,
  DROP COLUMN suspendido_por,
  DROP COLUMN suspendido_en;

ALTER TABLE curso DROP CONSTRAINT curso_estado_check;
ALTER TABLE curso ADD CONSTRAINT curso_estado_check
  CHECK (estado IN ('BORRADOR', 'EN_REVISION', 'PUBLICADO', 'RECHAZADO', 'ARCHIVADO'));

DELETE FROM schema_migraciones WHERE version = '034';
COMMIT;
