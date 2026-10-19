-- =====================================================================
-- 017 · Control de migraciones (up)
--
-- Crea schema_migraciones: qué migración está aplicada en esta base, en qué
-- orden, quién la aplicó y qué necesita su down para restaurar el estado.
-- Registra como línea base learnity_esquema.sql, 015 y 016.
--
-- Ejecutar con postgres (ver database/README.md). SQL puro: sirve con psql -f
-- y con el Query Tool de pgAdmin.
-- =====================================================================
SET client_encoding = 'UTF8';

BEGIN;
SET LOCAL lock_timeout = '10s';

DO $$
BEGIN
  IF to_regclass('public.schema_migraciones') IS NOT NULL THEN
    RAISE EXCEPTION 'La migración 017 ya está aplicada en % (existe schema_migraciones).', current_database();
  END IF;
  IF to_regclass('public.persona') IS NULL
     OR to_regclass('public.sesion') IS NULL
     OR to_regclass('public.archivo_borrado_pendiente') IS NULL THEN
    RAISE EXCEPTION 'Faltan learnity_esquema.sql, la 015 o la 016 en %.', current_database();
  END IF;
END $$;

CREATE TABLE schema_migraciones (
    version       VARCHAR(40)  PRIMARY KEY,
    orden         INTEGER      GENERATED ALWAYS AS IDENTITY UNIQUE,  -- orden real de aplicación (lo usa el down)
    nombre        VARCHAR(100) NOT NULL,
    aplicada_en   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    aplicada_por  TEXT         NOT NULL DEFAULT session_user,
    checksum      CHAR(64),                                         -- sha256 del .up.sql (lo rellena aplicar-migraciones.ps1)
    reversion     JSONB                                             -- lo que el down necesita restaurar
);

INSERT INTO schema_migraciones (version, nombre) VALUES
    ('000', 'learnity_esquema (línea base)'),
    ('015', 'sesiones_y_recuperacion (línea base)'),
    ('016', 'limpieza_pdf (línea base)'),
    ('017', 'control_migraciones');

COMMIT;
