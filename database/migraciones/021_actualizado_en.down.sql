-- =====================================================================
-- 021 · Columna actualizado_en (down)
-- Borra los triggers, la función y las columnas (con sus permisos por columna).
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
  IF v_ultima IS DISTINCT FROM '021' THEN
    RAISE EXCEPTION 'No se puede revertir la 021 en %: la última aplicada es %.', current_database(), v_ultima;
  END IF;
END $$;

SET LOCAL ROLE learnity_owner;

DROP TRIGGER actualizado_en ON persona;
DROP TRIGGER actualizado_en ON usuario;
DROP TRIGGER actualizado_en ON docente;
DROP TRIGGER actualizado_en ON solicitud_docente;
DROP TRIGGER actualizado_en ON categoria;
DROP TRIGGER actualizado_en ON curso;
DROP TRIGGER actualizado_en ON modulo;
DROP TRIGGER actualizado_en ON leccion;

DROP FUNCTION fijar_actualizado_en();

ALTER TABLE persona           DROP COLUMN actualizado_en;
ALTER TABLE usuario           DROP COLUMN actualizado_en;
ALTER TABLE docente           DROP COLUMN actualizado_en;
ALTER TABLE solicitud_docente DROP COLUMN actualizado_en;
ALTER TABLE categoria         DROP COLUMN actualizado_en;
ALTER TABLE curso             DROP COLUMN actualizado_en;
ALTER TABLE modulo            DROP COLUMN actualizado_en;
ALTER TABLE leccion           DROP COLUMN actualizado_en;

DELETE FROM schema_migraciones WHERE version = '021';

COMMIT;
