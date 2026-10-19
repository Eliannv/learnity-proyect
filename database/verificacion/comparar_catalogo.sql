-- =====================================================================
-- Equivalencia de las vistas del catálogo (026) con las consultas actuales
-- de backend/src/modules/cursos/cursos.repository.ts (commit 3c3c159).
--
-- 1. Inserta datos de prueba que cubren los casos límite:
--    - categoría inactiva con un curso publicado;
--    - curso en BORRADOR;
--    - descripción NULL;
--    - módulo sin lecciones;
--    - lección con video (duración) y lección con PDF (sin duración);
--    - inscripciones para el orden "populares";
--    - curso PUBLICADO sin publicado_en, solo si la 023 no está aplicada.
-- 2. Compara A = consulta actual y B = vista con
--    (A EXCEPT ALL B) UNION ALL (B EXCEPT ALL A), que debe dar 0 filas, para
--    categorías, listado y detalle, temario y tres búsquedas filtradas.
--    También compara el orden de ids de recientes, populares y az, y el de las
--    categorías.
-- 3. ROLLBACK: no deja datos.
--
-- Ejecutar con postgres en una base _test con la 026 aplicada.
-- Salida: comparacion | filas_actual | filas_vista | diferencias | resultado.
-- Uso: psql -At -F "|" -v ON_ERROR_STOP=1 -f comparar_catalogo.sql
-- =====================================================================
SET client_encoding = 'UTF8';

BEGIN;

DO $$
BEGIN
  IF current_database() !~ '_test$' THEN
    RAISE EXCEPTION 'comparar_catalogo.sql solo corre en una base _test (conectado a %).', current_database();
  END IF;
  IF to_regclass('public.catalogo_curso') IS NULL THEN
    RAISE EXCEPTION 'comparar_catalogo.sql necesita la 026 (vistas del catálogo) aplicada.';
  END IF;
END $$;

-- ---------------------------------------------------------------- datos de prueba
DO $$
DECLARE
  v_sufijo  TEXT := 'CmpCat' || txid_current();
  v_docp    INTEGER;
  v_adm     INTEGER;
  v_est1    INTEGER;
  v_est2    INTEGER;
  v_doc     INTEGER;
  v_cat_a   INTEGER;
  v_cat_b   INTEGER;
  v_c1      INTEGER;
  v_c4      INTEGER;
  v_m1      INTEGER;
  v_video   INTEGER;
  v_pdf     INTEGER;
BEGIN
  INSERT INTO persona (nombres, apellidos, biografia) VALUES ('Ana', v_sufijo, 'Docente de prueba') RETURNING id_persona INTO v_docp;
  INSERT INTO persona (nombres, apellidos) VALUES ('Admin', v_sufijo) RETURNING id_persona INTO v_adm;
  INSERT INTO persona (nombres, apellidos) VALUES ('Est1', v_sufijo) RETURNING id_persona INTO v_est1;
  INSERT INTO persona (nombres, apellidos) VALUES ('Est2', v_sufijo) RETURNING id_persona INTO v_est2;
  INSERT INTO docente (id_persona, especialidad) VALUES (v_docp, 'Pruebas') RETURNING id_docente INTO v_doc;
  INSERT INTO categoria (nombre, creada_por) VALUES (v_sufijo || ' activa', v_adm) RETURNING id_categoria INTO v_cat_a;
  INSERT INTO categoria (nombre, creada_por, activa) VALUES (v_sufijo || ' inactiva', v_adm, FALSE) RETURNING id_categoria INTO v_cat_b;

  INSERT INTO curso (id_docente, id_categoria, titulo, subtitulo, descripcion, nivel, objetivos, requisitos,
                     estado, revisado_por, publicado_en)
  VALUES (v_doc, v_cat_a, v_sufijo || ' Python', 'Sub', 'Descripción buscable', 'PRINCIPIANTE',
          ARRAY['Objetivo 1'], ARRAY['Requisito 1'], 'PUBLICADO', v_adm, now() - interval '3 days')
  RETURNING id_curso INTO v_c1;
  INSERT INTO curso (id_docente, id_categoria, titulo, nivel, estado, revisado_por, publicado_en)
  VALUES (v_doc, v_cat_b, v_sufijo || ' En categoría inactiva', 'AVANZADO', 'PUBLICADO', v_adm, now() - interval '1 day');
  INSERT INTO curso (id_docente, id_categoria, titulo, estado)
  VALUES (v_doc, v_cat_a, v_sufijo || ' Borrador', 'BORRADOR');
  INSERT INTO curso (id_docente, id_categoria, titulo, descripcion, nivel, estado, revisado_por, publicado_en)
  VALUES (v_doc, v_cat_a, v_sufijo || ' Sin descripción', NULL, 'INTERMEDIO', 'PUBLICADO', v_adm, now() - interval '2 days')
  RETURNING id_curso INTO v_c4;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'curso_publicado_revisado') THEN
    INSERT INTO curso (id_docente, id_categoria, titulo, estado)
    VALUES (v_doc, v_cat_a, v_sufijo || ' Publicado sin fecha', 'PUBLICADO');
  END IF;

  INSERT INTO modulo (id_curso, titulo, orden) VALUES (v_c1, 'Módulo 1', 1) RETURNING id_modulo INTO v_m1;
  INSERT INTO modulo (id_curso, titulo, orden) VALUES (v_c1, 'Módulo vacío', 2);
  INSERT INTO archivo (id_curso, tipo, nombre_original, ruta, tamano_bytes, alto_px, duracion_seg)
  VALUES (v_c1, 'VIDEO', 'clase.mp4', v_sufijo || '-video.mp4', 1000, 480, 120) RETURNING id_archivo INTO v_video;
  INSERT INTO archivo (id_curso, tipo, nombre_original, ruta, tamano_bytes)
  VALUES (v_c1, 'PDF', 'guia.pdf', v_sufijo || '-guia.pdf', 1000) RETURNING id_archivo INTO v_pdf;
  INSERT INTO leccion (id_modulo, id_archivo, titulo, tipo, orden) VALUES (v_m1, v_video, 'Video', 'VIDEO', 1);
  INSERT INTO leccion (id_modulo, id_archivo, titulo, tipo, orden) VALUES (v_m1, v_pdf, 'Guía', 'DOCUMENTO', 2);
  INSERT INTO leccion (id_modulo, titulo, tipo, orden) VALUES (v_m1, 'Evaluación', 'EVALUACION', 3);

  INSERT INTO inscripcion (id_persona, id_curso) VALUES (v_est1, v_c4), (v_est2, v_c4), (v_est1, v_c1);
END $$;

-- ---------------------------------------------------------------- A: consultas actuales
CREATE TEMP TABLE a_curso ON COMMIT DROP AS
SELECT c.id_curso AS id, c.titulo, c.subtitulo, COALESCE(c.descripcion, '') AS descripcion,
       cat.id_categoria AS "categoriaId", cat.nombre AS "categoriaNombre",
       concat_ws(' ', p.nombres, p.apellidos) AS docente, p.biografia AS "docenteBio",
       c.nivel, c.portada_url AS "portadaUrl", c.objetivos, c.requisitos,
       COALESCE(c.publicado_en, c.creado_en) AS "publicadoEn",
       COALESCE(contenido.modulos, 0)::int AS modulos,
       COALESCE(contenido.lecciones, 0)::int AS lecciones,
       COALESCE(contenido.segundos, 0)::int AS segundos
  FROM curso c
  JOIN categoria cat ON cat.id_categoria = c.id_categoria
  JOIN docente d ON d.id_docente = c.id_docente
  JOIN persona p ON p.id_persona = d.id_persona
  LEFT JOIN LATERAL (
    SELECT COUNT(DISTINCT m.id_modulo)::int AS modulos,
           COUNT(l.id_leccion)::int AS lecciones,
           COALESCE(SUM(a.duracion_seg), 0)::int AS segundos
    FROM modulo m
    LEFT JOIN leccion l ON l.id_modulo = m.id_modulo
    LEFT JOIN archivo a ON a.id_archivo = l.id_archivo
    WHERE m.id_curso = c.id_curso
  ) contenido ON TRUE
 WHERE c.estado = 'PUBLICADO';

CREATE TEMP TABLE a_temario ON COMMIT DROP AS
SELECT m.id_curso AS curso_id, m.id_modulo AS "moduloId", m.orden AS "moduloOrden", m.titulo AS "moduloTitulo",
       l.id_leccion AS id, l.orden, l.titulo, l.tipo, a.duracion_seg AS segundos
  FROM modulo m
  JOIN curso c ON c.id_curso = m.id_curso AND c.estado = 'PUBLICADO'
  LEFT JOIN leccion l ON l.id_modulo = m.id_modulo
  LEFT JOIN archivo a ON a.id_archivo = l.id_archivo;

-- ---------------------------------------------------------------- comparación
CREATE TEMP TABLE comparacion (
  n INTEGER, comparacion TEXT, filas_actual BIGINT, filas_vista BIGINT, diferencias BIGINT
) ON COMMIT DROP;

-- Categorías
INSERT INTO comparacion
SELECT 1, 'categorias (filas)',
       (SELECT count(*) FROM categoria WHERE activa = TRUE),
       (SELECT count(*) FROM catalogo_categoria),
       (SELECT count(*) FROM (
          (SELECT id_categoria AS id, nombre FROM categoria WHERE activa = TRUE
           EXCEPT ALL SELECT id, nombre FROM catalogo_categoria)
          UNION ALL
          (SELECT id, nombre FROM catalogo_categoria
           EXCEPT ALL SELECT id_categoria AS id, nombre FROM categoria WHERE activa = TRUE)) x);

INSERT INTO comparacion
SELECT 2, 'categorias (orden nombre, id)', NULL, NULL,
       CASE WHEN (SELECT array_agg(id_categoria ORDER BY nombre ASC, id_categoria ASC) FROM categoria WHERE activa = TRUE)
                 IS NOT DISTINCT FROM
                 (SELECT array_agg(id ORDER BY nombre ASC, id ASC) FROM catalogo_categoria)
            THEN 0 ELSE 1 END;

-- Listado y detalle (mismos campos)
INSERT INTO comparacion
SELECT 3, 'cursos: listado y detalle (filas y valores)',
       (SELECT count(*) FROM a_curso),
       (SELECT count(*) FROM catalogo_curso),
       (SELECT count(*) FROM (
          (SELECT * FROM a_curso
           EXCEPT ALL
           SELECT id, titulo, subtitulo, descripcion, categoria_id, categoria_nombre, docente, docente_bio,
                  nivel, portada_url, objetivos, requisitos, publicado_en, modulos, lecciones, segundos
             FROM catalogo_curso)
          UNION ALL
          (SELECT id, titulo, subtitulo, descripcion, categoria_id, categoria_nombre, docente, docente_bio,
                  nivel, portada_url, objetivos, requisitos, publicado_en, modulos, lecciones, segundos
             FROM catalogo_curso
           EXCEPT ALL
           SELECT * FROM a_curso)) x);

-- Órdenes
INSERT INTO comparacion
SELECT 4, 'orden recientes', NULL, NULL,
       CASE WHEN (SELECT array_agg(c.id_curso ORDER BY c.publicado_en DESC NULLS LAST, c.id_curso DESC)
                    FROM curso c JOIN categoria cat ON cat.id_categoria = c.id_categoria
                   WHERE c.estado = 'PUBLICADO')
                 IS NOT DISTINCT FROM
                 (SELECT array_agg(id ORDER BY publicado_en_orden DESC NULLS LAST, id DESC) FROM catalogo_curso)
            THEN 0 ELSE 1 END;

INSERT INTO comparacion
SELECT 5, 'orden populares', NULL, NULL,
       CASE WHEN (SELECT array_agg(c.id_curso ORDER BY popular.inscripciones DESC, c.id_curso DESC)
                    FROM curso c JOIN categoria cat ON cat.id_categoria = c.id_categoria
                    LEFT JOIN LATERAL (SELECT COUNT(*)::int AS inscripciones FROM inscripcion i
                                        WHERE i.id_curso = c.id_curso) popular ON TRUE
                   WHERE c.estado = 'PUBLICADO')
                 IS NOT DISTINCT FROM
                 (SELECT array_agg(id ORDER BY inscripciones DESC, id DESC) FROM catalogo_curso)
            THEN 0 ELSE 1 END;

INSERT INTO comparacion
SELECT 6, 'orden az', NULL, NULL,
       CASE WHEN (SELECT array_agg(c.id_curso ORDER BY c.titulo ASC, c.id_curso ASC)
                    FROM curso c JOIN categoria cat ON cat.id_categoria = c.id_categoria
                   WHERE c.estado = 'PUBLICADO')
                 IS NOT DISTINCT FROM
                 (SELECT array_agg(id ORDER BY titulo ASC, id ASC) FROM catalogo_curso)
            THEN 0 ELSE 1 END;

-- Búsquedas filtradas (q, categoría y nivel), como las arma consultaFiltrada
INSERT INTO comparacion
SELECT 7, 'filtro q (titulo, subtitulo o descripcion)',
       (SELECT count(*) FROM curso c JOIN categoria cat ON cat.id_categoria = c.id_categoria
         WHERE c.estado = 'PUBLICADO'
           AND (c.titulo ILIKE '%buscable%' ESCAPE '\' OR c.subtitulo ILIKE '%buscable%' ESCAPE '\'
                OR c.descripcion ILIKE '%buscable%' ESCAPE '\')),
       (SELECT count(*) FROM catalogo_curso
         WHERE titulo ILIKE '%buscable%' ESCAPE '\' OR subtitulo ILIKE '%buscable%' ESCAPE '\'
            OR descripcion ILIKE '%buscable%' ESCAPE '\'),
       (SELECT count(*) FROM (
          (SELECT c.id_curso FROM curso c JOIN categoria cat ON cat.id_categoria = c.id_categoria
            WHERE c.estado = 'PUBLICADO'
              AND (c.titulo ILIKE '%buscable%' ESCAPE '\' OR c.subtitulo ILIKE '%buscable%' ESCAPE '\'
                   OR c.descripcion ILIKE '%buscable%' ESCAPE '\')
           EXCEPT ALL
           SELECT id FROM catalogo_curso
            WHERE titulo ILIKE '%buscable%' ESCAPE '\' OR subtitulo ILIKE '%buscable%' ESCAPE '\'
               OR descripcion ILIKE '%buscable%' ESCAPE '\')
          UNION ALL
          (SELECT id FROM catalogo_curso
            WHERE titulo ILIKE '%buscable%' ESCAPE '\' OR subtitulo ILIKE '%buscable%' ESCAPE '\'
               OR descripcion ILIKE '%buscable%' ESCAPE '\'
           EXCEPT ALL
           SELECT c.id_curso FROM curso c JOIN categoria cat ON cat.id_categoria = c.id_categoria
            WHERE c.estado = 'PUBLICADO'
              AND (c.titulo ILIKE '%buscable%' ESCAPE '\' OR c.subtitulo ILIKE '%buscable%' ESCAPE '\'
                   OR c.descripcion ILIKE '%buscable%' ESCAPE '\'))) x);

INSERT INTO comparacion
SELECT 8, 'filtro categorias (por nombre) y niveles', NULL, NULL,
       CASE WHEN (SELECT array_agg(c.id_curso ORDER BY c.id_curso)
                    FROM curso c JOIN categoria cat ON cat.id_categoria = c.id_categoria
                   WHERE c.estado = 'PUBLICADO'
                     AND cat.nombre = ANY (ARRAY(SELECT nombre FROM categoria WHERE nombre LIKE 'CmpCat%'))
                     AND c.nivel = ANY (ARRAY['PRINCIPIANTE', 'AVANZADO']))
                 IS NOT DISTINCT FROM
                 (SELECT array_agg(id ORDER BY id) FROM catalogo_curso
                   WHERE categoria_nombre = ANY (ARRAY(SELECT nombre FROM categoria WHERE nombre LIKE 'CmpCat%'))
                     AND nivel = ANY (ARRAY['PRINCIPIANTE', 'AVANZADO']))
            THEN 0 ELSE 1 END;

-- Temario
INSERT INTO comparacion
SELECT 9, 'temario (filas y valores)',
       (SELECT count(*) FROM a_temario),
       (SELECT count(*) FROM catalogo_temario),
       (SELECT count(*) FROM (
          (SELECT * FROM a_temario
           EXCEPT ALL
           SELECT curso_id, modulo_id, modulo_orden, modulo_titulo, leccion_id, leccion_orden,
                  leccion_titulo, leccion_tipo, segundos FROM catalogo_temario)
          UNION ALL
          (SELECT curso_id, modulo_id, modulo_orden, modulo_titulo, leccion_id, leccion_orden,
                  leccion_titulo, leccion_tipo, segundos FROM catalogo_temario
           EXCEPT ALL
           SELECT * FROM a_temario)) x);

SELECT comparacion, filas_actual, filas_vista, diferencias, resultado
  FROM (
    SELECT n, comparacion,
           COALESCE(filas_actual::TEXT, '-') AS filas_actual,
           COALESCE(filas_vista::TEXT, '-') AS filas_vista,
           diferencias,
           CASE WHEN diferencias = 0 THEN 'IGUAL' ELSE 'DISTINTO' END AS resultado
      FROM comparacion
    UNION ALL
    SELECT 99, 'RESUMEN', current_database(), '-',
           (SELECT sum(diferencias) FROM comparacion)::BIGINT,
           CASE WHEN EXISTS (SELECT 1 FROM comparacion WHERE diferencias <> 0)
                THEN 'CATALOGO DISTINTO' ELSE 'CATALOGO IGUAL' END
  ) t
 ORDER BY n;

ROLLBACK;
