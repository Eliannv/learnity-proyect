-- =====================================================================
-- 022 · Corrección de cursos PUBLICADO sin revisor o sin fecha (up)
--
-- Prepara los datos para el CHECK de la 023. Decisión D-BD1 de
-- docs/bd/PLAN_BD.md (Puerta 1):
--   B (propuesta):   revisado_por = ADMIN activo con el menor id_persona y
--                    publicado_en = COALESCE(publicado_en, creado_en). El catálogo
--                    no cambia. Si no hay ningún ADMIN activo, se aplica A.
--   A (alternativa): estado = 'EN_REVISION'. Los cursos desaparecen del catálogo.
--   C (no hacer nada): no se aplican ni esta migración ni la 023.
-- Para pasar de B a A solo hay que cambiar v_estrategia. El down restaura
-- cualquiera de las dos.
--
-- Los valores originales se guardan en schema_migraciones.reversion. Va después
-- de la 020, así que la corrección queda registrada en auditoria_cambio.
-- Ejecutar con postgres.
-- =====================================================================
SET client_encoding = 'UTF8';

BEGIN;
SET LOCAL lock_timeout = '10s';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM schema_migraciones WHERE version = '022') THEN
    RAISE EXCEPTION 'La migración 022 ya está aplicada en %.', current_database();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM schema_migraciones WHERE version = '020') THEN
    RAISE EXCEPTION 'La 022 necesita la 020 (auditoría), para que la corrección quede registrada.';
  END IF;
END $$;

SET LOCAL ROLE learnity_owner;

DO $$
DECLARE
  v_estrategia CONSTANT TEXT := 'B';     -- 'B' (propuesta) o 'A' (alternativa)
  v_aplicada   TEXT := v_estrategia;
  v_admin      INTEGER;
  v_originales JSONB;
  v_filas      INTEGER;
BEGIN
  IF v_estrategia NOT IN ('A', 'B') THEN
    RAISE EXCEPTION 'v_estrategia debe ser A o B (es %).', v_estrategia;
  END IF;

  PERFORM 1 FROM curso
   WHERE estado = 'PUBLICADO' AND (revisado_por IS NULL OR publicado_en IS NULL)
     FOR UPDATE;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'id_curso', id_curso,
           'estado', estado,
           'revisado_por', revisado_por,
           'publicado_en', publicado_en) ORDER BY id_curso), '[]'::JSONB)
    INTO v_originales
    FROM curso
   WHERE estado = 'PUBLICADO' AND (revisado_por IS NULL OR publicado_en IS NULL);

  IF v_estrategia = 'B' THEN
    SELECT min(u.id_persona)
      INTO v_admin
      FROM usuario u
      JOIN usuario_rol ur ON ur.id_usuario = u.id_usuario
      JOIN rol r          ON r.id_rol = ur.id_rol
     WHERE r.nombre = 'ADMIN' AND u.estado = 'ACTIVO';
    IF v_admin IS NULL AND jsonb_array_length(v_originales) > 0 THEN
      v_aplicada := 'A';
      RAISE NOTICE '022: no hay ningún ADMIN activo en %; se aplica la opción A (EN_REVISION).', current_database();
    END IF;
  END IF;

  IF v_aplicada = 'B' THEN
    UPDATE curso
       SET revisado_por = COALESCE(revisado_por, v_admin),
           publicado_en = COALESCE(publicado_en, creado_en)
     WHERE estado = 'PUBLICADO' AND (revisado_por IS NULL OR publicado_en IS NULL);
  ELSE
    UPDATE curso
       SET estado = 'EN_REVISION'
     WHERE estado = 'PUBLICADO' AND (revisado_por IS NULL OR publicado_en IS NULL);
  END IF;
  GET DIAGNOSTICS v_filas = ROW_COUNT;
  RAISE NOTICE '022: % curso(s) corregido(s) con la opción % en %.', v_filas, v_aplicada, current_database();

  INSERT INTO schema_migraciones (version, nombre, reversion)
  VALUES ('022', 'correccion_cursos_publicados',
          jsonb_build_object('estrategia', v_aplicada, 'revisor', v_admin, 'cursos', v_originales));
END $$;

COMMIT;
