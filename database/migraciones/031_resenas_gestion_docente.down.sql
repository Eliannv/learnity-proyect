-- Reversion de la 031. Requiere desplegar antes el backend sin gestión de reseñas del docente.
-- Se niega si hay reseñas borradas, respondidas o reportadas: revertir perdería esa información
-- (o devolvería al promedio público reseñas que su autor borró). El historial en auditoria_cambio se conserva.
SET client_encoding = 'UTF8';
BEGIN;
SET LOCAL lock_timeout = '10s';

DO $$
DECLARE v_ultima TEXT;
BEGIN
  SELECT version INTO v_ultima FROM schema_migraciones ORDER BY orden DESC LIMIT 1;
  IF v_ultima IS DISTINCT FROM '031' THEN
    RAISE EXCEPTION 'La 031 no es la ultima migracion en % (ultima: %).', current_database(), v_ultima;
  END IF;
  IF EXISTS (SELECT 1 FROM resena WHERE eliminado_en IS NOT NULL OR respuesta_docente IS NOT NULL)
     OR EXISTS (SELECT 1 FROM reporte_resena) THEN
    RAISE EXCEPTION 'Hay reseñas borradas, respondidas o reportadas: revertir la 031 perderia esa informacion.';
  END IF;
END $$;

SET LOCAL ROLE learnity_owner;

DROP TABLE visita_curso_dia;
DROP TABLE reporte_resena;

DROP FUNCTION historial_resena(INTEGER[]);
DROP INDEX auditoria_cambio_resena_idx;

GRANT DELETE ON resena TO learnity_app;
DROP TRIGGER marcar_edicion ON resena;
DROP FUNCTION resena_marcar_edicion();
ALTER TABLE resena
  DROP CONSTRAINT resena_respuesta_fecha,
  DROP COLUMN respondida_en,
  DROP COLUMN respuesta_docente,
  DROP COLUMN eliminado_en,
  DROP COLUMN editado,
  DROP COLUMN editado_en,
  DROP COLUMN progreso_al_resenar;

DELETE FROM schema_migraciones WHERE version = '031';
COMMIT;
