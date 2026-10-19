-- =====================================================================
-- 026 · Vistas del catálogo público (up) · D8 = A, ADR-002
--
-- El módulo catalogo (be-a) lee solo de estas vistas. Reproducen exactamente
-- lo que hoy leen cursos.repository.ts:47-154 y cursos.service.ts:948-994
-- (commit 3c3c159), sin cambiar el JSON ni las rutas.
--   catalogo_categoria  GET /api/categorias
--   catalogo_curso      GET /api/cursos y GET /api/cursos/:id (mismos campos)
--   catalogo_temario    temario de GET /api/cursos/:id
-- Filtros (q, categorías y niveles), orden (lista cerrada) y paginación quedan
-- en el repositorio. Las vistas no garantizan ningún orden.
--
-- Nunca exponen archivo.ruta, id_archivo, nombre_original ni ninguna columna de
-- archivo salvo duracion_seg. Tampoco correos, hashes ni vista_previa.
-- Dueño learnity_owner, sin security_invoker: quien tiene SELECT sobre la vista
-- no necesita permisos sobre las tablas base.
-- Ejecutar con postgres.
-- =====================================================================
SET client_encoding = 'UTF8';

BEGIN;
SET LOCAL lock_timeout = '10s';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM schema_migraciones WHERE version = '026') THEN
    RAISE EXCEPTION 'La migración 026 ya está aplicada en %.', current_database();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM schema_migraciones WHERE version = '019') THEN
    RAISE EXCEPTION 'La 026 necesita la 019 (privilegios mínimos).';
  END IF;
END $$;

SET LOCAL ROLE learnity_owner;

-- Hoy: SELECT id_categoria AS id, nombre FROM categoria WHERE activa = TRUE
CREATE VIEW catalogo_categoria AS
SELECT cat.id_categoria AS id,
       cat.nombre
  FROM categoria cat
 WHERE cat.activa = TRUE;

-- Hoy: camposCurso + unirContenido + el LATERAL de "populares".
-- Solo PUBLICADO; no filtra por categoria.activa ni por el estado del docente (igual que hoy).
CREATE VIEW catalogo_curso AS
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
       COALESCE(c.publicado_en, c.creado_en)       AS publicado_en,        -- valor que se devuelve
       c.publicado_en                              AS publicado_en_orden,  -- orden "recientes" (NULLS LAST)
       COALESCE(contenido.modulos, 0)::INT         AS modulos,
       COALESCE(contenido.lecciones, 0)::INT       AS lecciones,
       COALESCE(contenido.segundos, 0)::INT        AS segundos,
       COALESCE(popular.inscripciones, 0)::INT     AS inscripciones        -- orden "populares"; no sale en el JSON
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

-- Hoy: temarioPublico. Un módulo sin lecciones sale con las columnas de lección a NULL.
CREATE VIEW catalogo_temario AS
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

GRANT SELECT ON catalogo_categoria, catalogo_curso, catalogo_temario TO learnity_app, learnity_lectura;

INSERT INTO schema_migraciones (version, nombre) VALUES ('026', 'vistas_catalogo');

COMMIT;
