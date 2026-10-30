-- Sprint 4 · panel de administración: suspensión de cursos publicados.
--   Un administrador puede pasar un curso PUBLICADO a SUSPENDIDO (con motivo) y reactivarlo después.
--   Mientras está suspendido sale del catálogo (catalogo_curso solo muestra PUBLICADO) y sus inscritos no pueden
--   abrirlo, pero conservan su progreso (D2). Quién, cuándo y por qué quedan en el curso mientras dure la suspensión;
--   al reactivarlo se vacían y el historial queda en auditoria_cambio.
--   Al reactivarlo conserva revisado_por y publicado_en, así que sigue cumpliendo curso_publicado_revisado (023).
--   No se reutiliza ARCHIVADO: queda para cuando el docente retire su propio curso.
-- Sin permisos nuevos: learnity_app ya actualiza curso.
-- Ejecutar con el mecanismo numerado de migraciones; en una base sin _test, solo con respaldo previo.
SET client_encoding = 'UTF8';
BEGIN;
SET LOCAL lock_timeout = '10s';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM schema_migraciones WHERE version = '034') THEN
    RAISE EXCEPTION 'La migracion 034 ya esta aplicada en %.', current_database();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM schema_migraciones WHERE version = '033') THEN
    RAISE EXCEPTION 'La 034 necesita la 033.';
  END IF;
END $$;

SET LOCAL ROLE learnity_owner;

ALTER TABLE curso DROP CONSTRAINT curso_estado_check;
ALTER TABLE curso ADD CONSTRAINT curso_estado_check
  CHECK (estado IN ('BORRADOR', 'EN_REVISION', 'PUBLICADO', 'RECHAZADO', 'ARCHIVADO', 'SUSPENDIDO'));

ALTER TABLE curso
  ADD COLUMN suspendido_en      TIMESTAMPTZ,
  ADD COLUMN suspendido_por     INTEGER REFERENCES persona (id_persona),
  ADD COLUMN motivo_suspension  VARCHAR(300) CHECK (motivo_suspension IS NULL OR length(btrim(motivo_suspension)) > 0),
  ADD CONSTRAINT curso_suspension_completa CHECK (
    (estado = 'SUSPENDIDO') = (suspendido_en IS NOT NULL AND suspendido_por IS NOT NULL AND motivo_suspension IS NOT NULL));

COMMENT ON COLUMN curso.motivo_suspension IS
  'Por qué un administrador suspendió el curso publicado. Lo ven el docente (correo y panel) y los inscritos (aviso).';

-- Pestañas de Revisión: cursos de un estado, los modificados más recientemente primero.
CREATE INDEX curso_estado_fecha_idx ON curso (estado, actualizado_en DESC);

INSERT INTO schema_migraciones (version, nombre)
VALUES ('034', 'suspension_cursos');
COMMIT;
