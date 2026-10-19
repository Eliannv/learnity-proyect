-- =====================================================================
-- 024 · Una sola solicitud PENDIENTE por persona (up)
--
-- Hoy lo garantiza el FOR UPDATE del servicio (administracionRepository.
-- bloquearUsuario). El índice lo garantiza también en la base. En el caso normal
-- el contrato no cambia. En una carrera que el servicio no frene, el 23505 se
-- responde como 409 CONFLICTO genérico (manejador-errores.ts:34), no con el
-- código de negocio. Es el riesgo R6 de docs/bd/PLAN_BD.md.
-- Ejecutar con postgres.
-- =====================================================================
SET client_encoding = 'UTF8';

BEGIN;
SET LOCAL lock_timeout = '10s';

DO $$
DECLARE
  v_duplicados TEXT;
BEGIN
  IF EXISTS (SELECT 1 FROM schema_migraciones WHERE version = '024') THEN
    RAISE EXCEPTION 'La migración 024 ya está aplicada en %.', current_database();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM schema_migraciones WHERE version = '018') THEN
    RAISE EXCEPTION 'La 024 necesita la 018 (roles y dueños).';
  END IF;
  SELECT string_agg(id_persona::TEXT, ', ' ORDER BY id_persona)
    INTO v_duplicados
    FROM (SELECT id_persona FROM solicitud_docente
           WHERE estado = 'PENDIENTE'
           GROUP BY id_persona HAVING count(*) > 1) d;
  IF v_duplicados IS NOT NULL THEN
    RAISE EXCEPTION 'Hay personas con más de una solicitud PENDIENTE en % (id_persona: %). Hay que resolverlas antes.',
                    current_database(), v_duplicados;
  END IF;
END $$;

SET LOCAL ROLE learnity_owner;

CREATE UNIQUE INDEX solicitud_docente_pendiente_uq
    ON solicitud_docente (id_persona)
 WHERE estado = 'PENDIENTE';

INSERT INTO schema_migraciones (version, nombre) VALUES ('024', 'solicitud_pendiente_unica');

COMMIT;
