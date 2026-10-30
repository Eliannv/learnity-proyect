-- Reversion de la 035. Requiere desplegar antes el backend que no lee categoria.icono.
-- Se pierde el ícono elegido para cada categoría (el frontend anterior lo deduce del nombre).
-- Una vista no puede perder columnas con CREATE OR REPLACE: se borran y se crean otra vez como en la 026,
-- y se les devuelven exactamente los permisos que tenían (app, lectura y, en _test, pruebas).
SET client_encoding = 'UTF8';
BEGIN;
SET LOCAL lock_timeout = '10s';

DO $$
DECLARE v_ultima TEXT;
BEGIN
  SELECT version INTO v_ultima FROM schema_migraciones ORDER BY orden DESC LIMIT 1;
  IF v_ultima IS DISTINCT FROM '035' THEN
    RAISE EXCEPTION 'La 035 no es la ultima migracion en % (ultima: %).', current_database(), v_ultima;
  END IF;
END $$;

-- Permisos actuales de las dos vistas, para devolverlos tal cual.
CREATE TEMP TABLE permisos_vistas_035 ON COMMIT DROP AS
SELECT c.relname AS vista, pg_get_userbyid(a.grantee) AS rol, a.privilege_type AS privilegio
  FROM pg_class c
       CROSS JOIN LATERAL aclexplode(c.relacl) a
 WHERE c.oid IN ('public.catalogo_categoria'::regclass, 'public.catalogo_curso'::regclass)
   AND a.grantee <> c.relowner;
GRANT SELECT ON permisos_vistas_035 TO learnity_owner;

SET LOCAL ROLE learnity_owner;

DROP VIEW catalogo_curso;
DROP VIEW catalogo_categoria;

CREATE VIEW catalogo_categoria AS
SELECT cat.id_categoria AS id,
       cat.nombre
  FROM categoria cat
 WHERE cat.activa = TRUE;

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
       COALESCE(c.publicado_en, c.creado_en)       AS publicado_en,
       c.publicado_en                              AS publicado_en_orden,
       COALESCE(contenido.modulos, 0)::INT         AS modulos,
       COALESCE(contenido.lecciones, 0)::INT       AS lecciones,
       COALESCE(contenido.segundos, 0)::INT        AS segundos,
       COALESCE(popular.inscripciones, 0)::INT     AS inscripciones
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

DO $$
DECLARE p RECORD;
BEGIN
  FOR p IN SELECT vista, rol, privilegio FROM permisos_vistas_035 LOOP
    EXECUTE format('GRANT %s ON %I TO %I', p.privilegio, p.vista, p.rol);
  END LOOP;
END $$;

ALTER TABLE categoria DROP COLUMN icono;

DELETE FROM schema_migraciones WHERE version = '035';
COMMIT;
