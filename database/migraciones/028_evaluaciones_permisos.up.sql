-- Sprint 3: acceso de la app a las evaluaciones (preguntas, opciones e intentos).
-- Solo privilegios: las tablas ya existen desde learnity_esquema.sql y no cambian.
-- Ejecutar con el mecanismo numerado de migraciones; nunca manualmente en Learnity.
SET client_encoding = 'UTF8';
BEGIN;
SET LOCAL lock_timeout = '10s';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM schema_migraciones WHERE version = '028') THEN
    RAISE EXCEPTION 'La migracion 028 ya esta aplicada en %.', current_database();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM schema_migraciones WHERE version = '027') THEN
    RAISE EXCEPTION 'La 028 necesita la 027.';
  END IF;
END $$;

SET LOCAL ROLE learnity_owner;

-- El docente reemplaza el cuestionario completo: borra y vuelve a insertar.
GRANT SELECT, INSERT, UPDATE, DELETE ON evaluacion, pregunta, opcion TO learnity_app;
-- Los intentos son historial: nunca se editan ni se borran desde la app.
GRANT SELECT, INSERT ON intento_evaluacion, respuesta TO learnity_app;

INSERT INTO schema_migraciones (version, nombre)
VALUES ('028', 'evaluaciones_permisos');
COMMIT;
