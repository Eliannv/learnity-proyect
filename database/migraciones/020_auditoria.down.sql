-- =====================================================================
-- 020 · Auditoría de cambios (down)
-- Borra los triggers, la función y auditoria_cambio (con sus filas).
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
  IF v_ultima IS DISTINCT FROM '020' THEN
    RAISE EXCEPTION 'No se puede revertir la 020 en %: la última aplicada es %.', current_database(), v_ultima;
  END IF;
END $$;

SET LOCAL ROLE learnity_owner;

DROP TRIGGER auditoria ON persona;
DROP TRIGGER auditoria ON usuario;
DROP TRIGGER auditoria ON rol;
DROP TRIGGER auditoria ON usuario_rol;
DROP TRIGGER auditoria ON solicitud_docente;
DROP TRIGGER auditoria ON docente;
DROP TRIGGER auditoria ON categoria;
DROP TRIGGER auditoria ON curso;
DROP TRIGGER auditoria ON modulo;
DROP TRIGGER auditoria ON leccion;
DROP TRIGGER auditoria ON archivo;
DROP TRIGGER auditoria ON recurso_adjunto;

DROP FUNCTION auditoria_registrar();
DROP TABLE auditoria_cambio;

DELETE FROM schema_migraciones WHERE version = '020';

COMMIT;
