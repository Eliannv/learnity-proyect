-- =====================================================================
-- 020 · Auditoría de cambios (up)
--
-- auditoria_cambio guarda quién, cuándo, la operación y la fila antes y después
-- (jsonb) de cada INSERT, UPDATE o DELETE en las tablas del dominio.
--
-- * Actor: current_setting('learnity.id_persona', true). El backend lo fija con
--   set_config('learnity.id_persona', $1, true) dentro de la transacción. Si no
--   llega o no es un número, queda NULL y la operación de la app sigue.
-- * Nunca se guardan contrasena_hash ni token_hash. Cada trigger puede excluir
--   más columnas con sus argumentos (archivo excluye ruta). columnas_cambiadas
--   nombra lo que cambió, incluidas las columnas excluidas, pero nunca su valor.
-- * Un UPDATE sin cambios reales no se registra.
-- * La función es SECURITY DEFINER (dueño learnity_owner): la app no tiene
--   ningún permiso sobre auditoria_cambio y no puede leerla ni falsificarla.
-- * id_persona_actor no tiene FK, para que nunca impida borrar una persona.
-- Ejecutar con postgres.
-- =====================================================================
SET client_encoding = 'UTF8';

BEGIN;
SET LOCAL lock_timeout = '10s';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM schema_migraciones WHERE version = '020') THEN
    RAISE EXCEPTION 'La migración 020 ya está aplicada en %.', current_database();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM schema_migraciones WHERE version = '019') THEN
    RAISE EXCEPTION 'La 020 necesita la 019 (privilegios mínimos).';
  END IF;
END $$;

SET LOCAL ROLE learnity_owner;

CREATE TABLE auditoria_cambio (
    id_auditoria        BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tabla               VARCHAR(63) NOT NULL,
    operacion           VARCHAR(6)  NOT NULL CHECK (operacion IN ('INSERT', 'UPDATE', 'DELETE')),
    id_persona_actor    INTEGER,                                   -- sin FK a propósito
    usuario_bd          TEXT        NOT NULL DEFAULT session_user,
    cambiado_en         TIMESTAMPTZ NOT NULL DEFAULT now(),
    id_transaccion      BIGINT      NOT NULL DEFAULT txid_current(),
    columnas_cambiadas  TEXT[],
    antes               JSONB,
    despues             JSONB,
    CONSTRAINT auditoria_cambio_filas CHECK (
        (operacion = 'INSERT' AND antes IS NULL     AND despues IS NOT NULL) OR
        (operacion = 'UPDATE' AND antes IS NOT NULL AND despues IS NOT NULL) OR
        (operacion = 'DELETE' AND antes IS NOT NULL AND despues IS NULL)
    )
);

CREATE INDEX auditoria_cambio_tabla_idx ON auditoria_cambio (tabla, cambiado_en);
CREATE INDEX auditoria_cambio_actor_idx ON auditoria_cambio (id_persona_actor);

CREATE FUNCTION auditoria_registrar() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $fn$
DECLARE
  v_excluir  TEXT[] := ARRAY['contrasena_hash', 'token_hash'] || TG_ARGV;
  v_viejo    JSONB;
  v_nuevo    JSONB;
  v_columnas TEXT[];
  v_actor    TEXT := current_setting('learnity.id_persona', true);
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    v_viejo := to_jsonb(OLD);
  END IF;
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    v_nuevo := to_jsonb(NEW);
  END IF;

  IF TG_OP = 'UPDATE' THEN
    SELECT array_agg(n.key ORDER BY n.key)
      INTO v_columnas
      FROM jsonb_each(v_nuevo) n
     WHERE n.value IS DISTINCT FROM v_viejo -> n.key;
    IF v_columnas IS NULL THEN
      RETURN NULL;                                   -- UPDATE sin cambios reales
    END IF;
  END IF;

  INSERT INTO public.auditoria_cambio (tabla, operacion, id_persona_actor, columnas_cambiadas, antes, despues)
  VALUES (TG_TABLE_NAME,
          TG_OP,
          CASE WHEN v_actor ~ '^[0-9]{1,9}$' THEN v_actor::INTEGER END,
          v_columnas,
          v_viejo - v_excluir,
          v_nuevo - v_excluir);
  RETURN NULL;
END
$fn$;

REVOKE EXECUTE ON FUNCTION auditoria_registrar() FROM PUBLIC;

CREATE TRIGGER auditoria AFTER INSERT OR UPDATE OR DELETE ON persona           FOR EACH ROW EXECUTE FUNCTION auditoria_registrar();
CREATE TRIGGER auditoria AFTER INSERT OR UPDATE OR DELETE ON usuario           FOR EACH ROW EXECUTE FUNCTION auditoria_registrar();
CREATE TRIGGER auditoria AFTER INSERT OR UPDATE OR DELETE ON rol               FOR EACH ROW EXECUTE FUNCTION auditoria_registrar();
CREATE TRIGGER auditoria AFTER INSERT OR UPDATE OR DELETE ON usuario_rol       FOR EACH ROW EXECUTE FUNCTION auditoria_registrar();
CREATE TRIGGER auditoria AFTER INSERT OR UPDATE OR DELETE ON solicitud_docente FOR EACH ROW EXECUTE FUNCTION auditoria_registrar();
CREATE TRIGGER auditoria AFTER INSERT OR UPDATE OR DELETE ON docente           FOR EACH ROW EXECUTE FUNCTION auditoria_registrar();
CREATE TRIGGER auditoria AFTER INSERT OR UPDATE OR DELETE ON categoria         FOR EACH ROW EXECUTE FUNCTION auditoria_registrar();
CREATE TRIGGER auditoria AFTER INSERT OR UPDATE OR DELETE ON curso             FOR EACH ROW EXECUTE FUNCTION auditoria_registrar();
CREATE TRIGGER auditoria AFTER INSERT OR UPDATE OR DELETE ON modulo            FOR EACH ROW EXECUTE FUNCTION auditoria_registrar();
CREATE TRIGGER auditoria AFTER INSERT OR UPDATE OR DELETE ON leccion           FOR EACH ROW EXECUTE FUNCTION auditoria_registrar();
CREATE TRIGGER auditoria AFTER INSERT OR UPDATE OR DELETE ON archivo           FOR EACH ROW EXECUTE FUNCTION auditoria_registrar('ruta');
CREATE TRIGGER auditoria AFTER INSERT OR UPDATE OR DELETE ON recurso_adjunto   FOR EACH ROW EXECUTE FUNCTION auditoria_registrar();

GRANT SELECT ON auditoria_cambio TO learnity_lectura;

INSERT INTO schema_migraciones (version, nombre) VALUES ('020', 'auditoria');

COMMIT;
