-- Sprint 4 · panel de administración: eliminar una cuenta creada por error.
--   admin_eliminar_cuenta(p_id_usuario): SECURITY DEFINER de learnity_owner. learnity_app no tiene DELETE sobre
--   persona, usuario, docente ni solicitud_docente (019/029) y lo sigue sin tener: solo puede borrar a través de
--   esta función, que acota qué se borra y cuándo.
--   · Solo cuentas sin actividad propia: si la persona tiene cursos creados (como docente) o inscripciones (y con
--     ellas progreso, intentos o reseñas), no borra nada y devuelve TIENE_CURSOS o TIENE_INSCRIPCIONES: esa cuenta
--     se desactiva o se reasignan sus cursos primero.
--   · Si puede, borra en este orden sesiones, enlaces de recuperación o invitación, roles, solicitudes de docente,
--     perfil docente, usuario y persona. Devuelve OK, o NO_EXISTE si la cuenta no existe.
--   · Cualquier otro registro a nombre de la persona (p. ej. una categoría que creó o una solicitud que revisó)
--     lo impide su clave foránea: la función falla con foreign_key_violation y la transacción no borra nada.
--   · Los borrados pasan por los triggers de auditoría (020) con el actor de la transacción del backend.
--   La comprobación de «no es tu propia cuenta» y «no es el último administrador» la hace el backend antes de llamar.
-- Ejecutar con el mecanismo numerado de migraciones; en una base sin _test, solo con respaldo previo.
SET client_encoding = 'UTF8';
BEGIN;
SET LOCAL lock_timeout = '10s';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM schema_migraciones WHERE version = '039') THEN
    RAISE EXCEPTION 'La migracion 039 ya esta aplicada en %.', current_database();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM schema_migraciones WHERE version = '038') THEN
    RAISE EXCEPTION 'La 039 necesita la 038.';
  END IF;
END $$;

SET LOCAL ROLE learnity_owner;

CREATE FUNCTION admin_eliminar_cuenta(p_id_usuario INTEGER)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $fn$
DECLARE
  v_persona INTEGER;
BEGIN
  SELECT u.id_persona INTO v_persona FROM public.usuario u WHERE u.id_usuario = p_id_usuario FOR UPDATE;
  IF NOT FOUND THEN
    RETURN 'NO_EXISTE';
  END IF;
  IF EXISTS (SELECT 1 FROM public.curso c JOIN public.docente d ON d.id_docente = c.id_docente WHERE d.id_persona = v_persona) THEN
    RETURN 'TIENE_CURSOS';
  END IF;
  IF EXISTS (SELECT 1 FROM public.inscripcion i WHERE i.id_persona = v_persona) THEN
    RETURN 'TIENE_INSCRIPCIONES';
  END IF;

  DELETE FROM public.sesion WHERE id_usuario = p_id_usuario;
  DELETE FROM public.token_recuperacion WHERE id_usuario = p_id_usuario;
  DELETE FROM public.usuario_rol WHERE id_usuario = p_id_usuario;
  DELETE FROM public.solicitud_docente WHERE id_persona = v_persona;
  DELETE FROM public.docente WHERE id_persona = v_persona;
  DELETE FROM public.usuario WHERE id_usuario = p_id_usuario;
  DELETE FROM public.persona WHERE id_persona = v_persona;
  RETURN 'OK';
END
$fn$;

COMMENT ON FUNCTION admin_eliminar_cuenta(INTEGER) IS
  'Borra una cuenta sin cursos ni inscripciones (OK, NO_EXISTE, TIENE_CURSOS, TIENE_INSCRIPCIONES).';

REVOKE EXECUTE ON FUNCTION admin_eliminar_cuenta(INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_eliminar_cuenta(INTEGER) TO learnity_app;

INSERT INTO schema_migraciones (version, nombre)
VALUES ('039', 'eliminar_cuenta');
COMMIT;
