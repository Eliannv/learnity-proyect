-- =====================================================================
-- 023 · CHECK de curso PUBLICADO (up) · RETENIDA (ver RETENIDAS.txt)
--
-- Un curso PUBLICADO debe tener revisor y fecha de publicación.
-- Decisión BD-022: el CHECK se añade NOT VALID. PostgreSQL lo exige en todo
-- INSERT y UPDATE nuevo, pero no revisa ni reescribe las filas que ya
-- existen: los cursos heredados que la incumplen (vista
-- curso_publicado_sin_revision, de la 022) siguen igual y siguen en el
-- catálogo. Efectos:
--   * Un UPDATE de una fila heredada que la deje inválida se rechaza (23514).
--     La app nunca actualiza un curso PUBLICADO: sus tres UPDATE curso
--     (cursos-integracion.repository.ts:184, 537 y 747) exigen
--     BORRADOR/RECHAZADO o EN_REVISION.
--   * ALTER TABLE curso VALIDATE CONSTRAINT curso_publicado_revisado falla
--     mientras la vista tenga filas. No se valida en esta migración.
-- Sigue retenida hasta que los fixtures que crean cursos PUBLICADO sin revisor
-- (cursos-publicos.test.ts:46, cursos-gestion-http.test.ts:285,
-- administracion-contenido.test.ts:209 y scripts/sembrar-catalogo.ts:42) se
-- ajusten en la Fase 2A.
-- Ejecutar con postgres.
-- =====================================================================
SET client_encoding = 'UTF8';

BEGIN;
SET LOCAL lock_timeout = '10s';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM schema_migraciones WHERE version = '023') THEN
    RAISE EXCEPTION 'La migración 023 ya está aplicada en %.', current_database();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM schema_migraciones WHERE version = '022') THEN
    RAISE EXCEPTION 'La 023 necesita la 022 (vista curso_publicado_sin_revision con las filas heredadas).';
  END IF;
END $$;

SET LOCAL ROLE learnity_owner;

ALTER TABLE curso
  ADD CONSTRAINT curso_publicado_revisado
  CHECK (estado <> 'PUBLICADO' OR (revisado_por IS NOT NULL AND publicado_en IS NOT NULL))
  NOT VALID;

COMMENT ON CONSTRAINT curso_publicado_revisado ON curso IS
  'BD-022: NOT VALID a propósito. Se exige en todo INSERT y UPDATE nuevo; las filas heredadas que '
  'lo incumplen están en la vista curso_publicado_sin_revision y no se les inventa revisor ni fecha. '
  'Un UPDATE que deje una de ellas inválida se rechaza. VALIDATE CONSTRAINT falla mientras existan.';

DO $$
DECLARE
  v_ids TEXT;
BEGIN
  SELECT string_agg(id_curso::TEXT, ', ' ORDER BY id_curso) INTO v_ids FROM curso_publicado_sin_revision;
  RAISE NOTICE '023: CHECK añadido NOT VALID en %. Filas heredadas sin validar: %.',
               current_database(), COALESCE(v_ids, 'ninguna');
END $$;

INSERT INTO schema_migraciones (version, nombre) VALUES ('023', 'check_curso_publicado');

COMMIT;
