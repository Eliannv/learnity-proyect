-- Sprint 4 · panel de administración: ícono de cada categoría guardado en la base.
--   El administrador lo elige al crear o editar la categoría; el catálogo, las portadas de los cursos y el inicio lo
--   leen de la API en lugar de un mapa fijo en el frontend (ICONO_CATEGORIA, que solo conocía seis nombres).
--   La base solo comprueba el formato (nombre de Lucide en kebab-case); la lista cerrada de íconos permitidos la valida
--   el backend con zod, así que añadir un ícono no exige otra migración.
--   Las vistas del catálogo (026) añaden la columna al final: CREATE OR REPLACE VIEW conserva sus permisos.
-- Sin permisos nuevos: learnity_app ya inserta y actualiza categoria (029).
-- Ejecutar con el mecanismo numerado de migraciones; en una base sin _test, solo con respaldo previo.
SET client_encoding = 'UTF8';
BEGIN;
SET LOCAL lock_timeout = '10s';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM schema_migraciones WHERE version = '035') THEN
    RAISE EXCEPTION 'La migracion 035 ya esta aplicada en %.', current_database();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM schema_migraciones WHERE version = '034') THEN
    RAISE EXCEPTION 'La 035 necesita la 034.';
  END IF;
END $$;

SET LOCAL ROLE learnity_owner;

ALTER TABLE categoria
  ADD COLUMN icono VARCHAR(40) NOT NULL DEFAULT 'tags'
             CONSTRAINT categoria_icono_formato CHECK (icono ~ '^[a-z0-9]+(-[a-z0-9]+)*$');

COMMENT ON COLUMN categoria.icono IS
  'Nombre del ícono de Lucide en kebab-case (p. ej. pen-tool). La lista de permitidos la valida el backend.';

-- Conserva lo que hoy fijaba ICONO_CATEGORIA en el frontend; el resto queda con el genérico «tags».
UPDATE categoria SET icono = CASE nombre
  WHEN 'Programación' THEN 'code'
  WHEN 'Diseño'       THEN 'pen-tool'
  WHEN 'Idiomas'      THEN 'languages'
  WHEN 'Negocios'     THEN 'briefcase'
  WHEN 'Ofimática'    THEN 'monitor'
  WHEN 'Marketing'    THEN 'megaphone'
  ELSE 'tags' END;

CREATE OR REPLACE VIEW catalogo_categoria AS
SELECT cat.id_categoria AS id,
       cat.nombre,
       cat.icono
  FROM categoria cat
 WHERE cat.activa = TRUE;

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

INSERT INTO schema_migraciones (version, nombre)
VALUES ('035', 'icono_categoria');
COMMIT;
