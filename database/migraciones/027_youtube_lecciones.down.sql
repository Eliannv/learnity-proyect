SET client_encoding = 'UTF8';

BEGIN;

SET LOCAL lock_timeout = '10s';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM schema_migraciones
        WHERE version = '027'
    ) THEN
        RAISE EXCEPTION 'La migracion 027 no esta aplicada';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM schema_migraciones
        WHERE version > '027'
    ) THEN
        RAISE EXCEPTION 'Primero revierte migraciones posteriores';
    END IF;
END $$;

SET LOCAL ROLE learnity_owner;

ALTER TABLE leccion
DROP CONSTRAINT leccion_youtube_canonico;

ALTER TABLE leccion
DROP COLUMN youtube_id;

DELETE FROM schema_migraciones
WHERE version = '027';

COMMIT;