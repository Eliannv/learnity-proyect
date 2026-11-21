BEGIN;
SET LOCAL lock_timeout = '10s';
DO $$ BEGIN
  IF (SELECT version FROM public.schema_migraciones ORDER BY orden DESC LIMIT 1) IS DISTINCT FROM '043' THEN
    RAISE EXCEPTION 'Solo se puede revertir la última migración aplicada.';
  END IF;
END $$;
SET LOCAL ROLE learnity_owner;

DO $$ BEGIN
 IF EXISTS (SELECT FROM grupo_curso) THEN RAISE EXCEPTION 'Conserva o retira los grupos antes de revertir la audiencia de sus lecciones.'; END IF;
END $$;
CREATE OR REPLACE VIEW catalogo_curso AS
SELECT c.id_curso                                  AS id,
       c.titulo,
       c.subtitulo,
       COALESCE(c.descripcion, '')                 AS descripcion,
       cat.id_categoria                            AS categoria_id,
       cat.nombre                                  AS categoria_nombre,
       concat_ws(' ', p.nombres, p.apellidos)      AS docente,
       p.biografia                                 AS docente_bio,
       c.nivel,
       c.portada_url,
       c.objetivos,
       c.requisitos,
       COALESCE(c.publicado_en, c.creado_en)       AS publicado_en,
       c.publicado_en                              AS publicado_en_orden,
       COALESCE(contenido.modulos, 0)::INT         AS modulos,
       COALESCE(contenido.lecciones, 0)::INT       AS lecciones,
       COALESCE(contenido.segundos, 0)::INT        AS segundos,
       COALESCE(popular.inscripciones, 0)::INT     AS inscripciones,
       cat.icono                                   AS categoria_icono
  FROM curso c
  JOIN categoria cat ON cat.id_categoria = c.id_categoria
  JOIN docente d     ON d.id_docente = c.id_docente
  JOIN persona p     ON p.id_persona = d.id_persona
  LEFT JOIN LATERAL (
       SELECT COUNT(DISTINCT m.id_modulo)::INT         AS modulos,
              COUNT(l.id_leccion)::INT                 AS lecciones,
              COALESCE(SUM(a.duracion_seg), 0)::INT    AS segundos
         FROM modulo m
         LEFT JOIN leccion l ON l.id_modulo = m.id_modulo
         LEFT JOIN archivo a ON a.id_archivo = l.id_archivo
        WHERE m.id_curso = c.id_curso
  ) contenido ON TRUE
  LEFT JOIN LATERAL (
       SELECT COUNT(*)::INT AS inscripciones
         FROM inscripcion i
        WHERE i.id_curso = c.id_curso
  ) popular ON TRUE
 WHERE c.estado = 'PUBLICADO';

CREATE OR REPLACE VIEW catalogo_temario AS
SELECT m.id_curso       AS curso_id,
       m.id_modulo      AS modulo_id,
       m.orden          AS modulo_orden,
       m.titulo         AS modulo_titulo,
       l.id_leccion     AS leccion_id,
       l.orden          AS leccion_orden,
       l.titulo         AS leccion_titulo,
       l.tipo           AS leccion_tipo,
       a.duracion_seg   AS segundos
  FROM modulo m
  JOIN curso c        ON c.id_curso = m.id_curso AND c.estado = 'PUBLICADO'
  LEFT JOIN leccion l ON l.id_modulo = m.id_modulo
  LEFT JOIN archivo a ON a.id_archivo = l.id_archivo;
DROP FUNCTION recalcular_avance_curso(integer);
DROP VIEW leccion_asignada;
DROP FUNCTION leccion_disponible(leccion);
DROP TRIGGER leccion_derivar_curso ON leccion;
DROP FUNCTION derivar_curso_leccion();
ALTER TABLE leccion DROP COLUMN id_grupo, DROP COLUMN id_curso_contenido;
DROP TABLE grupo_miembro,grupo_curso;
ALTER TABLE modulo DROP CONSTRAINT modulo_id_modulo_id_curso_key;
ALTER TABLE inscripcion DROP CONSTRAINT inscripcion_id_inscripcion_id_curso_key;

RESET ROLE;
DELETE FROM public.schema_migraciones WHERE version='043';
COMMIT;
