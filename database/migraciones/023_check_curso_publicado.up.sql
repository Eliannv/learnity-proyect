-- =====================================================================
-- 023 · CHECK de curso PUBLICADO (up) · RETENIDA (ver RETENIDAS.txt)
--
-- Un curso PUBLICADO debe tener revisor y fecha de publicación.
-- No se aplica hasta que los fixtures que crean cursos PUBLICADO sin revisor
-- (cursos-publicos.test.ts:46, cursos-gestion-http.test.ts:285,
-- administracion-contenido.test.ts:209 y scripts/sembrar-catalogo.ts:42) se
-- ajusten en la Fase 2A. Antes, los datos existentes se corrigen con la 022.
-- Ejecutar con postgres.
-- =====================================================================
SET client_encoding = 'UTF8';

BEGIN;
SET LOCAL lock_timeout = '10s';

DO $$
DECLARE
  v_invalidos TEXT;
BEGIN
  IF EXISTS (SELECT 1 FROM schema_migraciones WHERE version = '023') THEN
    RAISE EXCEPTION 'La migración 023 ya está aplicada en %.', current_database();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM schema_migraciones WHERE version = '018') THEN
    RAISE EXCEPTION 'La 023 necesita la 018 (roles y dueños).';
  END IF;
  SELECT string_agg(id_curso::TEXT, ', ' ORDER BY id_curso)
    INTO v_invalidos
    FROM curso
   WHERE estado = 'PUBLICADO' AND (revisado_por IS NULL OR publicado_en IS NULL);
  IF v_invalidos IS NOT NULL THEN
    RAISE EXCEPTION 'Hay cursos PUBLICADO sin revisor o sin fecha en % (id_curso: %). Aplica antes la 022.',
                    current_database(), v_invalidos;
  END IF;
END $$;

SET LOCAL ROLE learnity_owner;

ALTER TABLE curso
  ADD CONSTRAINT curso_publicado_revisado
  CHECK (estado <> 'PUBLICADO' OR (revisado_por IS NOT NULL AND publicado_en IS NOT NULL));

INSERT INTO schema_migraciones (version, nombre) VALUES ('023', 'check_curso_publicado');

COMMIT;
