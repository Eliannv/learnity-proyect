SET client_encoding = 'UTF8';
BEGIN;
SET LOCAL lock_timeout = '10s';
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.schema_migraciones WHERE version = '042')
     OR EXISTS (SELECT 1 FROM public.schema_migraciones WHERE version = '043') THEN
    RAISE EXCEPTION 'Revisa la secuencia de migraciones antes de aplicar 043.';
  END IF;
END $$;
SET LOCAL ROLE learnity_owner;

CREATE TABLE grupo_curso (
  id_grupo integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_curso integer NOT NULL REFERENCES curso ON DELETE CASCADE,
  revision integer NOT NULL DEFAULT 1,
  nombre varchar(80) NOT NULL CHECK (nombre = btrim(nombre) AND length(nombre) > 0),
  UNIQUE (id_grupo, id_curso)
);
CREATE UNIQUE INDEX grupo_nombre_por_curso ON grupo_curso(id_curso, lower(nombre));
ALTER TABLE inscripcion ADD UNIQUE (id_inscripcion, id_curso);
CREATE TABLE grupo_miembro (
  id_grupo integer NOT NULL, id_curso integer NOT NULL, id_inscripcion integer NOT NULL,
  PRIMARY KEY (id_grupo, id_inscripcion),
  FOREIGN KEY (id_grupo,id_curso) REFERENCES grupo_curso(id_grupo,id_curso) ON DELETE CASCADE,
  FOREIGN KEY (id_inscripcion,id_curso) REFERENCES inscripcion(id_inscripcion,id_curso) ON DELETE CASCADE
);
CREATE INDEX grupo_miembro_inscripcion ON grupo_miembro(id_inscripcion);
ALTER TABLE modulo ADD UNIQUE (id_modulo,id_curso);
ALTER TABLE leccion ADD id_grupo integer, ADD id_curso_contenido integer;
UPDATE leccion l SET id_curso_contenido=m.id_curso FROM modulo m WHERE m.id_modulo=l.id_modulo;
ALTER TABLE leccion ALTER id_curso_contenido SET NOT NULL,
  ADD CONSTRAINT leccion_modulo_curso_fk FOREIGN KEY(id_modulo,id_curso_contenido) REFERENCES modulo(id_modulo,id_curso) ON DELETE CASCADE,
  ADD CONSTRAINT leccion_grupo_curso_fk FOREIGN KEY(id_grupo,id_curso_contenido) REFERENCES grupo_curso(id_grupo,id_curso) DEFERRABLE INITIALLY DEFERRED,
  ADD CONSTRAINT solo_video_con_grupo CHECK (id_grupo IS NULL OR tipo='VIDEO');
CREATE INDEX leccion_por_grupo ON leccion(id_grupo) WHERE id_grupo IS NOT NULL;
CREATE FUNCTION derivar_curso_leccion() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
  SELECT id_curso INTO NEW.id_curso_contenido FROM modulo WHERE id_modulo=NEW.id_modulo;
  RETURN NEW;
END $$;
CREATE TRIGGER leccion_derivar_curso BEFORE INSERT OR UPDATE OF id_modulo ON leccion
FOR EACH ROW EXECUTE FUNCTION derivar_curso_leccion();
GRANT SELECT, INSERT, UPDATE, DELETE ON grupo_curso,grupo_miembro TO learnity_app;
GRANT SELECT ON grupo_curso,grupo_miembro TO learnity_lectura;
CREATE OR REPLACE FUNCTION leccion_disponible(l leccion) RETURNS boolean
LANGUAGE sql STABLE SET search_path = pg_catalog, public AS $$
 SELECT (l.tipo = 'VIDEO' AND l.youtube_video_id IS NOT NULL)
     OR (l.tipo = 'DOCUMENTO' AND l.id_archivo IS NOT NULL)
     OR (l.tipo = 'EVALUACION' AND (SELECT count(*) FROM evaluacion e JOIN pregunta p USING(id_evaluacion)
                                      WHERE e.id_leccion = l.id_leccion) >= 5);
$$;

-- Política común para el aula, los adjuntos, las grabaciones y la escritura de progreso.
CREATE VIEW leccion_asignada AS
 SELECT i.id_inscripcion, l.id_leccion, i.id_curso FROM inscripcion i
 JOIN leccion l ON l.id_curso_contenido=i.id_curso
 WHERE leccion_disponible(l) AND (l.id_grupo IS NULL OR EXISTS (
   SELECT 1 FROM grupo_miembro gm WHERE gm.id_grupo=l.id_grupo AND gm.id_inscripcion=i.id_inscripcion));
GRANT SELECT ON leccion_asignada TO learnity_app;
CREATE FUNCTION recalcular_avance_curso(curso_objetivo integer) RETURNS void
LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
  PERFORM 1 FROM inscripcion WHERE id_curso=curso_objetivo ORDER BY id_inscripcion FOR UPDATE;
  WITH avance AS (
    SELECT i.id_inscripcion,
      COALESCE((100 * count(*) FILTER (WHERE p.completada) / NULLIF(count(a.id_leccion),0))::int,0) AS pct,
      max(a.id_leccion) FILTER (WHERE a.id_leccion=i.id_ultima_leccion) AS ultima
    FROM inscripcion i LEFT JOIN leccion_asignada a USING(id_inscripcion)
    LEFT JOIN progreso_leccion p ON p.id_inscripcion=i.id_inscripcion AND p.id_leccion=a.id_leccion
    WHERE i.id_curso=curso_objetivo GROUP BY i.id_inscripcion
  )
  UPDATE inscripcion i SET progreso_pct=a.pct, id_ultima_leccion=a.ultima,
    estado=CASE WHEN a.pct=100 THEN 'COMPLETADA' ELSE 'ACTIVA' END,
    completado_en=CASE WHEN a.pct=100 THEN coalesce(i.completado_en,now()) END
  FROM avance a WHERE i.id_inscripcion=a.id_inscripcion AND
    (i.progreso_pct IS DISTINCT FROM a.pct OR i.id_ultima_leccion IS DISTINCT FROM a.ultima
     OR (i.estado='COMPLETADA') IS DISTINCT FROM (a.pct=100));
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
         LEFT JOIN leccion l ON l.id_modulo = m.id_modulo AND l.id_grupo IS NULL
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
  LEFT JOIN leccion l ON l.id_modulo = m.id_modulo AND l.id_grupo IS NULL
  LEFT JOIN archivo a ON a.id_archivo = l.id_archivo;
-- Estos objetos se consultan a través de la API autenticada, también con PostgREST habilitado.
REVOKE ALL ON grupo_curso,grupo_miembro,leccion_asignada FROM PUBLIC;
DO $$ DECLARE rol name;
BEGIN
  FOR rol IN SELECT rolname FROM pg_roles WHERE rolname IN ('anon','authenticated') LOOP
    EXECUTE format('REVOKE ALL ON grupo_curso,grupo_miembro,leccion_asignada FROM %I',rol);
  END LOOP;
END $$;
RESET ROLE;
INSERT INTO public.schema_migraciones(version, nombre) VALUES ('043', 'grupos_de_curso');
COMMIT;
