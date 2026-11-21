BEGIN;
SET LOCAL lock_timeout = '10s';
DO $$ BEGIN
  IF (SELECT version FROM public.schema_migraciones ORDER BY orden DESC LIMIT 1) IS DISTINCT FROM '044' THEN
    RAISE EXCEPTION 'Solo se puede revertir la última migración aplicada.';
  END IF;
END $$;
SET LOCAL ROLE learnity_owner;

DO $$ BEGIN
 IF EXISTS (SELECT FROM grabacion) OR EXISTS (SELECT FROM grabacion_retirada) THEN RAISE EXCEPTION 'Conserva o retira las grabaciones antes de revertir el almacén.'; END IF;
END $$;
CREATE OR REPLACE FUNCTION leccion_disponible(l leccion) RETURNS boolean
LANGUAGE sql STABLE SET search_path = pg_catalog, public AS $$
 SELECT (l.tipo = 'VIDEO' AND l.youtube_video_id IS NOT NULL)
     OR (l.tipo = 'DOCUMENTO' AND l.id_archivo IS NOT NULL)
     OR (l.tipo = 'EVALUACION' AND (SELECT count(*) FROM evaluacion e JOIN pregunta p USING(id_evaluacion)
                                      WHERE e.id_leccion = l.id_leccion) >= 5);
$$;

DROP TRIGGER leccion_liberar_grabacion ON leccion;
DROP TRIGGER validar_grabacion_lista ON leccion;
DROP FUNCTION retirar_grabacion_anterior(), grabacion_lista_leccion();
ALTER TABLE leccion DROP COLUMN id_grabacion;
DROP TRIGGER grabacion_reservar_limpieza ON grabacion;
DROP FUNCTION reservar_limpieza_grabacion();
DROP TABLE grabacion_parte,grabacion,grabacion_retirada;

RESET ROLE;
DELETE FROM public.schema_migraciones WHERE version='044';
COMMIT;
