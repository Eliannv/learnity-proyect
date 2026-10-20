-- =====================================================================
-- 025 · Índices de FK consultadas (up)
--
-- Solo las FK que el código consulta o que recorre una cascada de una función
-- actual. La lista de incluidas y descartadas, con su motivo, está en
-- docs/bd/PLAN_BD.md §6.2. Tablas pequeñas y entorno local: CREATE INDEX normal
-- dentro de la transacción (CONCURRENTLY no puede ir en una transacción).
-- Ejecutar con postgres.
-- =====================================================================
SET client_encoding = 'UTF8';

BEGIN;
SET LOCAL lock_timeout = '10s';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM schema_migraciones WHERE version = '025') THEN
    RAISE EXCEPTION 'La migración 025 ya está aplicada en %.', current_database();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM schema_migraciones WHERE version = '018') THEN
    RAISE EXCEPTION 'La 025 necesita la 018 (roles y dueños).';
  END IF;
END $$;

SET LOCAL ROLE learnity_owner;

-- existePendiente, ultimaSolicitud y el join de SELECT_SOLICITUD (administracion.repository.ts).
CREATE INDEX solicitud_docente_persona_idx   ON solicitud_docente (id_persona, enviada_en DESC);
-- listarSolicitudes: filtra por estado y ordena por fecha.
CREATE INDEX solicitud_docente_estado_idx    ON solicitud_docente (estado, enviada_en);
-- cursos-integracion.repository.ts:336,504 y la cascada al borrar una lección.
CREATE INDEX recurso_adjunto_leccion_idx     ON recurso_adjunto (id_leccion);
-- Cascada (progreso_leccion) y SET NULL (inscripcion) al borrar lecciones o módulos.
CREATE INDEX progreso_leccion_leccion_idx    ON progreso_leccion (id_leccion);
CREATE INDEX inscripcion_ultima_leccion_idx  ON inscripcion (id_ultima_leccion);

INSERT INTO schema_migraciones (version, nombre) VALUES ('025', 'indices_fk');

COMMIT;
