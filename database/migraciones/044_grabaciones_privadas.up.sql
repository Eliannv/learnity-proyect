SET client_encoding = 'UTF8';
BEGIN;
SET LOCAL lock_timeout = '10s';
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.schema_migraciones WHERE version = '043')
     OR EXISTS (SELECT 1 FROM public.schema_migraciones WHERE version = '044') THEN
    RAISE EXCEPTION 'Revisa la secuencia de migraciones antes de aplicar 044.';
  END IF;
END $$;
SET LOCAL ROLE learnity_owner;

CREATE TABLE grabacion (
  id uuid PRIMARY KEY, id_curso integer NOT NULL REFERENCES curso ON DELETE CASCADE,
  id_persona integer NOT NULL REFERENCES persona ON DELETE CASCADE,
  tamano integer NOT NULL CHECK (tamano BETWEEN 1 AND 104857600),
  -- NULL almacena los bloques en PostgreSQL. Un nombre identifica el bucket privado de Supabase.
  bucket varchar(63), clave uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  lista boolean NOT NULL DEFAULT false, creada_en timestamptz NOT NULL DEFAULT now(),
  UNIQUE(id,id_curso)
);
CREATE TABLE grabacion_parte (
  id_grabacion uuid NOT NULL REFERENCES grabacion ON DELETE CASCADE,
  numero integer NOT NULL CHECK(numero BETWEEN 0 AND 99),
  bytes bytea CHECK(octet_length(bytes) BETWEEN 1 AND 1048576),
  huella bytea NOT NULL CHECK(octet_length(huella) = 32),
  PRIMARY KEY(id_grabacion,numero)
);
-- La limpieza de Storage se confirma después del commit. Sobrevive a fallos y reinicios.
CREATE TABLE grabacion_retirada (
  clave uuid PRIMARY KEY, bucket varchar(63) NOT NULL, partes integer NOT NULL CHECK(partes BETWEEN 1 AND 100)
);
CREATE FUNCTION reservar_limpieza_grabacion() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
  INSERT INTO grabacion_retirada(clave,bucket,partes) VALUES(OLD.clave,OLD.bucket,(OLD.tamano+1048575)/1048576);
  RETURN NULL;
END $$;
CREATE TRIGGER grabacion_reservar_limpieza AFTER DELETE ON grabacion FOR EACH ROW
WHEN (OLD.bucket IS NOT NULL) EXECUTE FUNCTION reservar_limpieza_grabacion();
GRANT SELECT,INSERT,DELETE ON grabacion_retirada TO learnity_app;
CREATE INDEX grabacion_curso ON grabacion(id_curso);
ALTER TABLE leccion ADD id_grabacion uuid UNIQUE,
  ADD CONSTRAINT leccion_grabacion_curso_fk FOREIGN KEY(id_grabacion,id_curso_contenido) REFERENCES grabacion(id,id_curso) DEFERRABLE INITIALLY DEFERRED,
  ADD CONSTRAINT leccion_fuente_video CHECK (id_grabacion IS NULL OR (tipo='VIDEO' AND youtube_video_id IS NULL));
CREATE FUNCTION grabacion_lista_leccion() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
  IF NEW.id_grabacion IS NOT NULL AND NOT EXISTS (SELECT 1 FROM grabacion WHERE id=NEW.id_grabacion AND lista AND id_curso=NEW.id_curso_contenido) THEN
    RAISE EXCEPTION 'Grabación sin confirmar o de otro curso.' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
-- El disparador leccion_derivar_curso se ejecuta antes, por orden alfabético.
CREATE TRIGGER validar_grabacion_lista BEFORE INSERT OR UPDATE OF id_grabacion ON leccion
FOR EACH ROW EXECUTE FUNCTION grabacion_lista_leccion();
CREATE FUNCTION retirar_grabacion_anterior() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
  IF TG_OP='DELETE' OR OLD.id_grabacion IS DISTINCT FROM NEW.id_grabacion THEN
    DELETE FROM grabacion WHERE id=OLD.id_grabacion;
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER leccion_liberar_grabacion AFTER DELETE OR UPDATE OF id_grabacion ON leccion
FOR EACH ROW WHEN (OLD.id_grabacion IS NOT NULL) EXECUTE FUNCTION retirar_grabacion_anterior();
GRANT SELECT, INSERT, UPDATE, DELETE ON grabacion, grabacion_parte TO learnity_app;
CREATE OR REPLACE FUNCTION leccion_disponible(l leccion) RETURNS boolean
LANGUAGE sql STABLE SET search_path = pg_catalog, public AS $$
 SELECT (l.tipo = 'VIDEO' AND (l.youtube_video_id IS NOT NULL OR l.id_grabacion IS NOT NULL))
     OR (l.tipo = 'DOCUMENTO' AND l.id_archivo IS NOT NULL)
     OR (l.tipo = 'EVALUACION' AND (SELECT count(*) FROM evaluacion e JOIN pregunta p USING(id_evaluacion)
                                      WHERE e.id_leccion = l.id_leccion) >= 5);
$$;

-- Estos objetos se consultan a través de la API autenticada, también con PostgREST habilitado.
REVOKE ALL ON grabacion,grabacion_parte,grabacion_retirada FROM PUBLIC;
DO $$ DECLARE rol name;
BEGIN
  FOR rol IN SELECT rolname FROM pg_roles WHERE rolname IN ('anon','authenticated') LOOP
    EXECUTE format('REVOKE ALL ON grabacion,grabacion_parte,grabacion_retirada FROM %I',rol);
  END LOOP;
END $$;
RESET ROLE;
INSERT INTO public.schema_migraciones(version, nombre) VALUES ('044', 'grabaciones_privadas');
COMMIT;
