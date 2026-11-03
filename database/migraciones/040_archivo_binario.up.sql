-- =====================================================================
-- 040 · Respaldo binario de archivos y fotos en PostgreSQL (up)
--
-- Permite recuperar automáticamente archivos PDF y fotos de perfil cuando el
-- contenedor del backend utiliza un sistema de archivos efímero (Render).
-- =====================================================================
SET client_encoding = 'UTF8';

BEGIN;
SET LOCAL lock_timeout = '5s';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.schema_migraciones WHERE version = '040') THEN
    RAISE EXCEPTION 'La migración 040 ya está aplicada en %.', current_database();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.schema_migraciones WHERE version = '039') THEN
    RAISE EXCEPTION 'La 040 necesita la 039.';
  END IF;
END $$;

SET LOCAL ROLE learnity_owner;

CREATE TABLE public.archivo_binario (
  nombre    VARCHAR(120) PRIMARY KEY,
  bytes     BYTEA        NOT NULL,
  creado_en TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT archivo_binario_nombre_no_vacio CHECK (btrim(nombre) <> ''),
  CONSTRAINT archivo_binario_bytes_no_vacios CHECK (octet_length(bytes) > 0)
);

ALTER TABLE public.archivo_binario DISABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.archivo_binario TO learnity_app;
GRANT SELECT ON public.archivo_binario TO learnity_lectura;

RESET ROLE;

INSERT INTO public.schema_migraciones (version, nombre)
VALUES ('040', 'archivo_binario');

COMMIT;
