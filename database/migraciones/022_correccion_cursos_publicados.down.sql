-- =====================================================================
-- 022 · Corrección de cursos PUBLICADO sin revisor o sin fecha (down)
-- Restaura estado, revisado_por y publicado_en exactamente como estaban
-- (schema_migraciones.reversion). actualizado_en y auditoria_cambio registran
-- esta restauración como un cambio más.
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
  IF v_ultima IS DISTINCT FROM '022' THEN
    RAISE EXCEPTION 'No se puede revertir la 022 en %: la última aplicada es %.', current_database(), v_ultima;
  END IF;
END $$;

SET LOCAL ROLE learnity_owner;

UPDATE curso c
   SET estado       = o.estado,
       revisado_por = o.revisado_por,
       publicado_en = o.publicado_en
  FROM jsonb_to_recordset((SELECT reversion -> 'cursos' FROM schema_migraciones WHERE version = '022'))
       AS o(id_curso INTEGER, estado VARCHAR(12), revisado_por INTEGER, publicado_en TIMESTAMPTZ)
 WHERE c.id_curso = o.id_curso;

DELETE FROM schema_migraciones WHERE version = '022';

COMMIT;
