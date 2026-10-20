-- =====================================================================
-- 022 · Inventario de cursos PUBLICADO sin revisor o sin fecha (up)
--
-- Decisión BD-022 (docs/refactor/ESTADO.md) y D-BD1 de docs/bd/PLAN_BD.md:
-- no se inventa un revisor ni una fecha de revisión. Esta migración NO cambia
-- ninguna fila de curso; solo deja a la vista los cursos que incumplen la
-- regla que añade la 023 (como CHECK NOT VALID):
--   vista curso_publicado_sin_revision, de learnity_owner, con SELECT solo
--   para learnity_lectura.
-- La vista lee curso en vivo: lista exactamente las filas por las que
-- VALIDATE CONSTRAINT curso_publicado_revisado fallaría. Con la 023 aplicada
-- no puede entrar ninguna fila nueva, así que solo quedan las heredadas.
-- Ejecutar con postgres.
-- =====================================================================
SET client_encoding = 'UTF8';

BEGIN;
SET LOCAL lock_timeout = '10s';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM schema_migraciones WHERE version = '022') THEN
    RAISE EXCEPTION 'La migración 022 ya está aplicada en %.', current_database();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM schema_migraciones WHERE version = '019') THEN
    RAISE EXCEPTION 'La 022 necesita la 019 (privilegios mínimos y learnity_lectura).';
  END IF;
END $$;

SET LOCAL ROLE learnity_owner;

CREATE VIEW curso_publicado_sin_revision AS
SELECT c.id_curso,
       c.titulo,
       c.id_docente,
       c.revisado_por,
       c.publicado_en,
       c.creado_en
  FROM curso c
 WHERE c.estado = 'PUBLICADO'
   AND (c.revisado_por IS NULL OR c.publicado_en IS NULL);

COMMENT ON VIEW curso_publicado_sin_revision IS
  'BD-022: cursos PUBLICADO sin revisado_por o sin publicado_en, heredados de antes del CHECK '
  'curso_publicado_revisado (023, NOT VALID). No se les inventa revisor ni fecha. Mientras esta '
  'vista tenga filas, ALTER TABLE curso VALIDATE CONSTRAINT curso_publicado_revisado falla.';

GRANT SELECT ON curso_publicado_sin_revision TO learnity_lectura;

DO $$
DECLARE
  v_ids TEXT;
BEGIN
  SELECT string_agg(id_curso::TEXT, ', ' ORDER BY id_curso) INTO v_ids FROM curso_publicado_sin_revision;
  RAISE NOTICE '022: cursos PUBLICADO sin revisor o sin fecha en %: %. No se modifican.',
               current_database(), COALESCE(v_ids, 'ninguno');
END $$;

INSERT INTO schema_migraciones (version, nombre) VALUES ('022', 'inventario_cursos_publicados');

COMMIT;
