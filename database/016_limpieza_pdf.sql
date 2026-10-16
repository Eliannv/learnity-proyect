-- Ejecutar con la cuenta dueña de las tablas.
BEGIN;

CREATE TABLE IF NOT EXISTS archivo_borrado_pendiente (
  nombre VARCHAR(40) PRIMARY KEY
    CHECK (
      nombre ~ '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.pdf$'
    ),
  disponible_desde TIMESTAMPTZ NOT NULL DEFAULT now(),
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE
ON archivo_borrado_pendiente
TO learnity_app;

COMMIT;