-- =====================================================================
-- 021 · Columna actualizado_en (up)
--
-- Agrega actualizado_en a las tablas del dominio que se modifican. Un trigger
-- BEFORE UPDATE la fija con now() solo si la fila cambió de verdad.
-- Las filas existentes quedan con la hora de esta migración.
-- Ningún repositorio usa SELECT * ni RETURNING *: el JSON de la API no cambia.
-- Ejecutar con postgres.
-- =====================================================================
SET client_encoding = 'UTF8';

BEGIN;
SET LOCAL lock_timeout = '10s';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM schema_migraciones WHERE version = '021') THEN
    RAISE EXCEPTION 'La migración 021 ya está aplicada en %.', current_database();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM schema_migraciones WHERE version = '019') THEN
    RAISE EXCEPTION 'La 021 necesita la 019 (privilegios mínimos).';
  END IF;
END $$;

SET LOCAL ROLE learnity_owner;

ALTER TABLE persona           ADD COLUMN actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE usuario           ADD COLUMN actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE docente           ADD COLUMN actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE solicitud_docente ADD COLUMN actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE categoria         ADD COLUMN actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE curso             ADD COLUMN actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE modulo            ADD COLUMN actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE leccion           ADD COLUMN actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE FUNCTION fijar_actualizado_en() RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, pg_temp
AS $fn$
BEGIN
  NEW.actualizado_en := now();
  RETURN NEW;
END
$fn$;

REVOKE EXECUTE ON FUNCTION fijar_actualizado_en() FROM PUBLIC;

CREATE TRIGGER actualizado_en BEFORE UPDATE ON persona           FOR EACH ROW WHEN (OLD.* IS DISTINCT FROM NEW.*) EXECUTE FUNCTION fijar_actualizado_en();
CREATE TRIGGER actualizado_en BEFORE UPDATE ON usuario           FOR EACH ROW WHEN (OLD.* IS DISTINCT FROM NEW.*) EXECUTE FUNCTION fijar_actualizado_en();
CREATE TRIGGER actualizado_en BEFORE UPDATE ON docente           FOR EACH ROW WHEN (OLD.* IS DISTINCT FROM NEW.*) EXECUTE FUNCTION fijar_actualizado_en();
CREATE TRIGGER actualizado_en BEFORE UPDATE ON solicitud_docente FOR EACH ROW WHEN (OLD.* IS DISTINCT FROM NEW.*) EXECUTE FUNCTION fijar_actualizado_en();
CREATE TRIGGER actualizado_en BEFORE UPDATE ON categoria         FOR EACH ROW WHEN (OLD.* IS DISTINCT FROM NEW.*) EXECUTE FUNCTION fijar_actualizado_en();
CREATE TRIGGER actualizado_en BEFORE UPDATE ON curso             FOR EACH ROW WHEN (OLD.* IS DISTINCT FROM NEW.*) EXECUTE FUNCTION fijar_actualizado_en();
CREATE TRIGGER actualizado_en BEFORE UPDATE ON modulo            FOR EACH ROW WHEN (OLD.* IS DISTINCT FROM NEW.*) EXECUTE FUNCTION fijar_actualizado_en();
CREATE TRIGGER actualizado_en BEFORE UPDATE ON leccion           FOR EACH ROW WHEN (OLD.* IS DISTINCT FROM NEW.*) EXECUTE FUNCTION fijar_actualizado_en();

-- learnity_lectura lee usuario por columnas (sin contrasena_hash): se agrega la nueva.
GRANT SELECT (actualizado_en) ON usuario TO learnity_lectura;

INSERT INTO schema_migraciones (version, nombre) VALUES ('021', 'actualizado_en');

COMMIT;
