-- Sprint 4 · panel de administración: ocultación de reseñas propia del administrador.
--   Hasta la 035, ocultar una reseña por un reporte marcaba resena.eliminado_en, el mismo campo con que el estudiante
--   borra la suya. Al republicarla (PUT /cursos/:id/resena) el estudiante ponía eliminado_en = NULL y la reseña
--   volvía al curso sin pasar por moderación. Ahora la ocultación tiene columnas propias que el estudiante no toca.
--   1. resena gana ocultada_en, ocultada_por y motivo_ocultacion (CHECK: el motivo es obligatorio al ocultar).
--   2. Las reseñas ocultadas por un reporte pasan a las columnas nuevas. Si eliminado_en lo puso la moderación
--      (misma fecha que la resolución), se limpia: la reseña queda oculta, no borrada por su autor.
--   3. historial_resena() distingue OCULTADA, RESTAURADA y RESPUESTA_RETIRADA (la retira alguien que no es el
--      docente del curso) y devuelve el motivo de la ocultación. Interpreta como OCULTADA el borrado que hizo la moderación antes de esta
--      migración y omite el traspaso del punto 2, que no es una acción de nadie.
-- Sin permisos nuevos: learnity_app ya actualiza resena (030) y ejecuta historial_resena (031).
-- Ejecutar con el mecanismo numerado de migraciones; en una base sin _test, solo con respaldo previo.
SET client_encoding = 'UTF8';
BEGIN;
SET LOCAL lock_timeout = '10s';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM schema_migraciones WHERE version = '036') THEN
    RAISE EXCEPTION 'La migracion 036 ya esta aplicada en %.', current_database();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM schema_migraciones WHERE version = '035') THEN
    RAISE EXCEPTION 'La 036 necesita la 035.';
  END IF;
END $$;

SET LOCAL ROLE learnity_owner;

-- 1. Columnas de ocultación. ocultada_por puede quedar NULL si se borra la persona; el motivo, nunca.
ALTER TABLE resena
  ADD COLUMN ocultada_en        TIMESTAMPTZ,
  ADD COLUMN ocultada_por       INTEGER REFERENCES persona (id_persona) ON DELETE SET NULL,
  ADD COLUMN motivo_ocultacion  VARCHAR(300)
             CHECK (motivo_ocultacion IS NULL OR length(btrim(motivo_ocultacion)) > 0),
  ADD CONSTRAINT resena_ocultacion_completa CHECK (
    (ocultada_en IS NULL) = (motivo_ocultacion IS NULL) AND (ocultada_en IS NOT NULL OR ocultada_por IS NULL));

COMMENT ON COLUMN resena.ocultada_en IS
  'Ocultada por un administrador: no cuenta en promedios públicos y el estudiante no puede republicarla.';
COMMENT ON COLUMN resena.motivo_ocultacion IS 'Motivo interno de la moderación; el estudiante no lo ve.';

CREATE INDEX resena_ocultada_idx ON resena (ocultada_en) WHERE ocultada_en IS NOT NULL;

-- 2. Reseñas ocultadas por un reporte (el último, si hubo varios). El texto del motivo es el mismo que escribe
--    resenas.repository.ts al resolver un reporte, y el que comprueba el down para revertir sin perder datos.
UPDATE resena r
   SET ocultada_en = x.resuelto_en,
       ocultada_por = x.id_persona_resuelve,
       motivo_ocultacion = 'Reporte del docente: ' || CASE x.motivo WHEN 'SPAM' THEN 'spam o publicidad'
                                                                   WHEN 'OFENSIVO' THEN 'lenguaje ofensivo'
                                                                   ELSE 'otro motivo' END,
       eliminado_en = CASE WHEN r.eliminado_en = x.resuelto_en THEN NULL ELSE r.eliminado_en END
  FROM (SELECT DISTINCT ON (id_resena) id_resena, resuelto_en, id_persona_resuelve, motivo
          FROM reporte_resena
         WHERE estado = 'OCULTADA'
         ORDER BY id_resena, resuelto_en DESC, id_reporte DESC) x
 WHERE x.id_resena = r.id_resena;

-- 3. Historial. Cambian las columnas que devuelve: hay que borrar la función y crearla de nuevo.
DROP FUNCTION historial_resena(INTEGER[]);

CREATE FUNCTION historial_resena(p_ids INTEGER[])
RETURNS TABLE (
  id_resena            INTEGER,
  accion               TEXT,
  id_persona_actor     INTEGER,
  fecha                TIMESTAMPTZ,
  estrellas_anterior   SMALLINT,
  estrellas_nueva      SMALLINT,
  comentario_anterior  TEXT,
  comentario_nuevo     TEXT,
  motivo               TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $fn$
  SELECT h.id_resena, h.accion, h.id_persona_actor, h.cambiado_en,
         (h.antes ->> 'estrellas')::SMALLINT, (h.despues ->> 'estrellas')::SMALLINT,
         h.antes ->> 'comentario', h.despues ->> 'comentario',
         CASE WHEN h.accion = 'OCULTADA' THEN h.despues ->> 'motivo_ocultacion' END
    FROM (
      SELECT (COALESCE(a.despues, a.antes) ->> 'id_resena')::INTEGER AS id_resena,
             a.id_auditoria, a.id_persona_actor, a.cambiado_en, a.antes, a.despues,
             CASE
               WHEN a.operacion = 'INSERT' THEN 'CREADA'
               WHEN a.operacion = 'DELETE' THEN 'ELIMINADA'
               -- Traspaso de la 036: la marca pasa de eliminado_en a ocultada_en. No lo hizo nadie.
               WHEN a.antes ->> 'ocultada_en' IS NULL AND a.despues ->> 'ocultada_en' IS NOT NULL
                AND a.antes ->> 'eliminado_en' IS NOT NULL AND a.despues ->> 'eliminado_en' IS NULL THEN NULL
               WHEN a.antes ->> 'ocultada_en' IS NULL AND a.despues ->> 'ocultada_en' IS NOT NULL THEN 'OCULTADA'
               WHEN a.antes ->> 'ocultada_en' IS NOT NULL AND a.despues ->> 'ocultada_en' IS NULL THEN 'RESTAURADA'
               WHEN a.antes ->> 'eliminado_en' IS NULL AND a.despues ->> 'eliminado_en' IS NOT NULL THEN
                 CASE WHEN EXISTS (
                        SELECT 1 FROM public.reporte_resena x
                         WHERE x.id_resena = (a.despues ->> 'id_resena')::INTEGER
                           AND x.estado = 'OCULTADA'
                           AND x.resuelto_en = (a.despues ->> 'eliminado_en')::TIMESTAMPTZ
                           AND x.id_persona_resuelve IS NOT DISTINCT FROM a.id_persona_actor)
                      THEN 'OCULTADA' ELSE 'ELIMINADA' END
               WHEN a.antes ->> 'eliminado_en' IS NOT NULL AND a.despues ->> 'eliminado_en' IS NULL THEN 'REPUBLICADA'
               WHEN a.antes ->> 'respuesta_docente' IS NOT NULL AND a.despues ->> 'respuesta_docente' IS NULL
                AND a.id_persona_actor IS DISTINCT FROM (
                      SELECT d.id_persona
                        FROM public.inscripcion i
                        JOIN public.curso c   ON c.id_curso = i.id_curso
                        JOIN public.docente d ON d.id_docente = c.id_docente
                       WHERE i.id_inscripcion = (a.despues ->> 'id_inscripcion')::INTEGER)
                 THEN 'RESPUESTA_RETIRADA'
               WHEN (a.antes -> 'respuesta_docente') IS DISTINCT FROM (a.despues -> 'respuesta_docente')
                 THEN 'RESPONDIDA_POR_DOCENTE'
               WHEN (a.antes -> 'estrellas') IS DISTINCT FROM (a.despues -> 'estrellas')
                 OR (a.antes -> 'comentario') IS DISTINCT FROM (a.despues -> 'comentario') THEN 'EDITADA'
             END AS accion
        FROM public.auditoria_cambio a
       WHERE a.tabla = 'resena'
         AND (COALESCE(a.despues, a.antes) ->> 'id_resena')::INTEGER = ANY (p_ids)
    ) h
   WHERE h.accion IS NOT NULL
   ORDER BY h.id_resena, h.cambiado_en, h.id_auditoria
$fn$;
REVOKE EXECUTE ON FUNCTION historial_resena(INTEGER[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION historial_resena(INTEGER[]) TO learnity_app;

INSERT INTO schema_migraciones (version, nombre)
VALUES ('036', 'ocultacion_resenas');
COMMIT;
