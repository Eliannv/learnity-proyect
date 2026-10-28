-- Sprint 4 · cierre del MVP.
--   1. Categorías (ADR-012, D1-B): nombre único sin distinguir mayúsculas.
--   2. Recursos adjuntos de una lección: PDF, PPT o ZIP descargables (la app los crea y retira).
--   3. Reseñas: una por inscripción, de 1 a 5 estrellas y un comentario opcional.
-- Ejecutar con el mecanismo numerado de migraciones; en una base sin _test, solo con respaldo previo.
SET client_encoding = 'UTF8';
BEGIN;
SET LOCAL lock_timeout = '10s';

DO $$
DECLARE v_dup TEXT;
BEGIN
  IF EXISTS (SELECT 1 FROM schema_migraciones WHERE version = '030') THEN
    RAISE EXCEPTION 'La migracion 030 ya esta aplicada en %.', current_database();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM schema_migraciones WHERE version = '029') THEN
    RAISE EXCEPTION 'La 030 necesita la 029.';
  END IF;
  SELECT string_agg(n, ', ') INTO v_dup
    FROM (SELECT lower(nombre) AS n FROM categoria GROUP BY 1 HAVING count(*) > 1) d;
  IF v_dup IS NOT NULL THEN
    RAISE EXCEPTION 'Categorias repetidas sin distinguir mayusculas: %. Renombralas antes de la 030.', v_dup;
  END IF;
END $$;

SET LOCAL ROLE learnity_owner;

-- 1. Categorías
CREATE UNIQUE INDEX categoria_nombre_minusculas_uq ON categoria (lower(nombre));

-- 2. Recursos adjuntos: el ZIP (código, plantillas) se suma a PDF y PPT, con el mismo límite de 10 MiB.
ALTER TABLE archivo DROP CONSTRAINT archivo_tipo_check;
ALTER TABLE archivo ADD CONSTRAINT archivo_tipo_check
  CHECK (tipo IN ('VIDEO', 'PDF', 'PPT', 'ZIP'));
ALTER TABLE archivo DROP CONSTRAINT archivo_limite_tamano;
ALTER TABLE archivo ADD CONSTRAINT archivo_limite_tamano CHECK (
  (tipo = 'VIDEO' AND tamano_bytes <= 5242880) OR
  (tipo IN ('PDF', 'PPT', 'ZIP') AND tamano_bytes <= 10485760)
);
-- La cola de borrado del almacén acepta las extensiones de los recursos además de .pdf.
ALTER TABLE archivo_borrado_pendiente DROP CONSTRAINT archivo_borrado_pendiente_nombre_check;
ALTER TABLE archivo_borrado_pendiente ADD CONSTRAINT archivo_borrado_pendiente_nombre_check CHECK (
  nombre ~ '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(pdf|ppt|pptx|zip)$'
);
GRANT SELECT, INSERT, DELETE ON recurso_adjunto TO learnity_app;

-- 3. Reseñas
CREATE TABLE resena (
    id_resena       INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_inscripcion  INTEGER       NOT NULL UNIQUE REFERENCES inscripcion (id_inscripcion) ON DELETE CASCADE,
    estrellas       SMALLINT      NOT NULL CHECK (estrellas BETWEEN 1 AND 5),
    comentario      VARCHAR(1000) CHECK (comentario IS NULL OR length(btrim(comentario)) > 0),
    creado_en       TIMESTAMPTZ   NOT NULL DEFAULT now(),
    actualizado_en  TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE TRIGGER actualizado_en BEFORE UPDATE ON resena
  FOR EACH ROW WHEN (OLD.* IS DISTINCT FROM NEW.*) EXECUTE FUNCTION fijar_actualizado_en();
CREATE TRIGGER auditoria AFTER INSERT OR UPDATE OR DELETE ON resena
  FOR EACH ROW EXECUTE FUNCTION auditoria_registrar();

GRANT SELECT, INSERT, UPDATE, DELETE ON resena TO learnity_app;
GRANT SELECT ON resena TO learnity_lectura;

INSERT INTO schema_migraciones (version, nombre)
VALUES ('030', 'cierre_mvp');
COMMIT;
