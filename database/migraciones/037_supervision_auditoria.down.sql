-- Reversion de la 037. Requiere desplegar antes el backend sin visor de auditoría ni estado de la base.
-- No se pierde ningún dato: solo se borran funciones y un índice.
SET client_encoding = 'UTF8';
BEGIN;
SET LOCAL lock_timeout = '10s';

DO $$
DECLARE v_ultima TEXT;
BEGIN
  SELECT version INTO v_ultima FROM schema_migraciones ORDER BY orden DESC LIMIT 1;
  IF v_ultima IS DISTINCT FROM '037' THEN
    RAISE EXCEPTION 'La 037 no es la ultima migracion en % (ultima: %).', current_database(), v_ultima;
  END IF;
END $$;

SET LOCAL ROLE learnity_owner;

DROP FUNCTION estado_base_datos();
DROP FUNCTION auditoria_opciones();
DROP FUNCTION auditoria_detalle(BIGINT);
DROP FUNCTION auditoria_listar(TEXT, TEXT, TEXT, INTEGER, TIMESTAMPTZ, TIMESTAMPTZ, INTEGER, INTEGER);
DROP FUNCTION auditoria_registro(TEXT, JSONB);
DROP INDEX auditoria_cambio_fecha_idx;

DELETE FROM schema_migraciones WHERE version = '037';
COMMIT;
