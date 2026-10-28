-- Reversion de la 030. Requiere desplegar antes el backend sin reseñas ni recursos adjuntos.
-- Borra las reseñas. Se niega si quedan archivos ZIP (retíralos antes desde la app).
SET client_encoding = 'UTF8';
BEGIN;
SET LOCAL lock_timeout = '10s';

DO $$
DECLARE v_ultima TEXT;
BEGIN
  SELECT version INTO v_ultima FROM schema_migraciones ORDER BY orden DESC LIMIT 1;
  IF v_ultima IS DISTINCT FROM '030' THEN
    RAISE EXCEPTION 'La 030 no es la ultima migracion en % (ultima: %).', current_database(), v_ultima;
  END IF;
  IF EXISTS (SELECT 1 FROM archivo WHERE tipo = 'ZIP')
     OR EXISTS (SELECT 1 FROM archivo_borrado_pendiente WHERE nombre !~ '\.pdf$') THEN
    RAISE EXCEPTION 'Quedan archivos ZIP o retiros pendientes que no son PDF: retiralos antes de revertir la 030.';
  END IF;
END $$;

SET LOCAL ROLE learnity_owner;

DROP TABLE resena;

REVOKE INSERT, DELETE ON recurso_adjunto FROM learnity_app;
ALTER TABLE archivo_borrado_pendiente DROP CONSTRAINT archivo_borrado_pendiente_nombre_check;
ALTER TABLE archivo_borrado_pendiente ADD CONSTRAINT archivo_borrado_pendiente_nombre_check CHECK (
  nombre ~ '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.pdf$'
);
ALTER TABLE archivo DROP CONSTRAINT archivo_limite_tamano;
ALTER TABLE archivo ADD CONSTRAINT archivo_limite_tamano CHECK (
  (tipo = 'VIDEO' AND tamano_bytes <= 5242880) OR
  (tipo IN ('PDF', 'PPT') AND tamano_bytes <= 10485760)
);
ALTER TABLE archivo DROP CONSTRAINT archivo_tipo_check;
ALTER TABLE archivo ADD CONSTRAINT archivo_tipo_check CHECK (tipo IN ('VIDEO', 'PDF', 'PPT'));

DROP INDEX categoria_nombre_minusculas_uq;

DELETE FROM schema_migraciones WHERE version = '030';
COMMIT;
