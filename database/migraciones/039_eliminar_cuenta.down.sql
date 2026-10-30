-- Reversion de la 039. Requiere desplegar antes el backend sin «Eliminar usuario».
-- Las cuentas ya borradas no vuelven (quedan en auditoria_cambio): solo se retira la función.
SET client_encoding = 'UTF8';
BEGIN;
SET LOCAL lock_timeout = '10s';

DO $$
DECLARE v_ultima TEXT;
BEGIN
  SELECT version INTO v_ultima FROM schema_migraciones ORDER BY orden DESC LIMIT 1;
  IF v_ultima IS DISTINCT FROM '039' THEN
    RAISE EXCEPTION 'La 039 no es la ultima migracion en % (ultima: %).', current_database(), v_ultima;
  END IF;
END $$;

SET LOCAL ROLE learnity_owner;

DROP FUNCTION admin_eliminar_cuenta(INTEGER);

DELETE FROM schema_migraciones WHERE version = '039';
COMMIT;
