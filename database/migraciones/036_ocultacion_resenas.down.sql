-- Reversion de la 036. Requiere desplegar antes el backend que no usa resena.ocultada_*.
-- La 035 representa una reseña ocultada con eliminado_en y el reporte resuelto como OCULTADA. Solo se revierte si
-- cada reseña ocultada cabe en esa forma sin perder nada: que la ocultara un reporte, con su misma fecha, su mismo
-- administrador y el motivo que se genera de él. Si hay alguna ocultada directamente por un administrador (motivo
-- escrito a mano), se niega: restaurarla o volver a ocultarla desde un reporte antes de revertir.
-- La respuesta retirada por un administrador no necesita nada: la 035 no tiene columnas para ello.
SET client_encoding = 'UTF8';
BEGIN;
SET LOCAL lock_timeout = '10s';

DO $$
DECLARE v_ultima TEXT;
BEGIN
  SELECT version INTO v_ultima FROM schema_migraciones ORDER BY orden DESC LIMIT 1;
  IF v_ultima IS DISTINCT FROM '036' THEN
    RAISE EXCEPTION 'La 036 no es la ultima migracion en % (ultima: %).', current_database(), v_ultima;
  END IF;
  IF EXISTS (
    SELECT 1 FROM resena r
     WHERE r.ocultada_en IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM reporte_resena x
          WHERE x.id_resena = r.id_resena
            AND x.estado = 'OCULTADA'
            AND x.resuelto_en = r.ocultada_en
            AND x.id_persona_resuelve IS NOT DISTINCT FROM r.ocultada_por
            AND r.motivo_ocultacion = 'Reporte del docente: ' || CASE x.motivo WHEN 'SPAM' THEN 'spam o publicidad'
                                                                              WHEN 'OFENSIVO' THEN 'lenguaje ofensivo'
                                                                              ELSE 'otro motivo' END)) THEN
    RAISE EXCEPTION 'Hay resenas ocultadas por un administrador sin reporte: restauralas antes de revertir la 036.';
  END IF;
END $$;

SET LOCAL ROLE learnity_owner;

-- Vuelve a la forma de la 035: oculta = eliminado_en (si su autor no la había borrado ya).
UPDATE resena SET eliminado_en = COALESCE(eliminado_en, ocultada_en)
 WHERE ocultada_en IS NOT NULL;

DROP FUNCTION historial_resena(INTEGER[]);

-- Igual que en la 031.
CREATE FUNCTION historial_resena(p_ids INTEGER[])
RETURNS TABLE (
  id_resena            INTEGER,
  accion               TEXT,
  id_persona_actor     INTEGER,
  fecha                TIMESTAMPTZ,
  estrellas_anterior   SMALLINT,
  estrellas_nueva      SMALLINT,
  comentario_anterior  TEXT,
  comentario_nuevo     TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $fn$
  SELECT h.id_resena, h.accion, h.id_persona_actor, h.cambiado_en,
         (h.antes ->> 'estrellas')::SMALLINT, (h.despues ->> 'estrellas')::SMALLINT,
         h.antes ->> 'comentario', h.despues ->> 'comentario'
    FROM (
      SELECT (COALESCE(a.despues, a.antes) ->> 'id_resena')::INTEGER AS id_resena,
             a.id_auditoria, a.id_persona_actor, a.cambiado_en, a.antes, a.despues,
             CASE
               WHEN a.operacion = 'INSERT' THEN 'CREADA'
               WHEN a.operacion = 'DELETE' THEN 'ELIMINADA'
               WHEN a.antes ->> 'eliminado_en' IS NULL AND a.despues ->> 'eliminado_en' IS NOT NULL THEN 'ELIMINADA'
               WHEN a.antes ->> 'eliminado_en' IS NOT NULL AND a.despues ->> 'eliminado_en' IS NULL THEN 'REPUBLICADA'
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

DROP INDEX resena_ocultada_idx;

ALTER TABLE resena
  DROP CONSTRAINT resena_ocultacion_completa,
  DROP COLUMN motivo_ocultacion,
  DROP COLUMN ocultada_por,
  DROP COLUMN ocultada_en;

DELETE FROM schema_migraciones WHERE version = '036';
COMMIT;
