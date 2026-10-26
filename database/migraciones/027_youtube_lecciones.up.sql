-- Sprint 3: identificador canonico de YouTube
SET client_encoding = 'UTF8';

BEGIN;

SET LOCAL lock_timeout = '10s';

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM schema_migraciones
        WHERE version = '027'
    ) THEN
        RAISE EXCEPTION 'La migracion 027 ya esta aplicada';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM schema_migraciones
        WHERE version = '026'
    ) THEN
        RAISE EXCEPTION 'La migracion 027 requiere 026';
    END IF;
END $$;

SET LOCAL ROLE learnity_owner;

ALTER TABLE leccion
ADD COLUMN youtube_id VARCHAR(11);

ALTER TABLE leccion
ADD CONSTRAINT leccion_youtube_canonico
CHECK (
    (
        tipo = 'VIDEO'
        AND youtube_id ~ '^[A-Za-z0-9_-]{11}$'
        AND id_archivo IS NULL
    )
    OR
    (
        tipo <> 'VIDEO'
        AND youtube_id IS NULL
    )
) NOT VALID;

INSERT INTO schema_migraciones (version, nombre)
VALUES ('027', 'youtube_lecciones');

COMMIT;