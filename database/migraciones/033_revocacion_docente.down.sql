-- Reversion de la 033. Requiere desplegar antes el backend sin revocación del rol docente.
-- Se niega si hay solicitudes REVOCADA: la 032 no admite ese estado y se perdería quién revocó y por qué.
SET client_encoding = 'UTF8';
BEGIN;
SET LOCAL lock_timeout = '10s';

DO $$
DECLARE v_ultima TEXT;
BEGIN
  SELECT version INTO v_ultima FROM schema_migraciones ORDER BY orden DESC LIMIT 1;
  IF v_ultima IS DISTINCT FROM '033' THEN
    RAISE EXCEPTION 'La 033 no es la ultima migracion en % (ultima: %).', current_database(), v_ultima;
  END IF;
  IF EXISTS (SELECT 1 FROM solicitud_docente WHERE estado = 'REVOCADA') THEN
    RAISE EXCEPTION 'Hay solicitudes REVOCADA: revertir la 033 perderia quien las revoco y por que.';
  END IF;
END $$;

SET LOCAL ROLE learnity_owner;

ALTER TABLE solicitud_docente
  DROP CONSTRAINT solicitud_revocada_completa,
  DROP COLUMN motivo_revocacion,
  DROP COLUMN revocada_por,
  DROP COLUMN revocada_en;

ALTER TABLE solicitud_docente DROP CONSTRAINT solicitud_docente_estado_check;
ALTER TABLE solicitud_docente ADD CONSTRAINT solicitud_docente_estado_check
  CHECK (estado IN ('PENDIENTE', 'APROBADA', 'RECHAZADA'));

DELETE FROM schema_migraciones WHERE version = '033';
COMMIT;
