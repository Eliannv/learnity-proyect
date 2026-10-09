# Base de datos · PostgreSQL 17

La base **no** se crea con Prisma ni con el backend: se crea con los scripts SQL de la guía
`Guia_Learnity_PostgreSQL_pgAdmin.docx` (pasos 01 a 14), ejecutados en pgAdmin.

| Archivo | Para qué |
|---|---|
| `learnity_esquema.sql` | Las 19 tablas, restricciones e índices (referencia del modelo). |
| `learnity_modelo.dbml` | El mismo modelo para ver el diagrama en https://dbdiagram.io (Import → DBML). |

## Cuentas de PostgreSQL

| Cuenta | Uso |
|---|---|
| `learnity_owner` | Dueña de las tablas. Solo para cambios de estructura. |
| `learnity_app` | La usa el backend (`.env`). Lee y modifica datos; no crea tablas. |

## Cambios de estructura

No se vuelven a ejecutar los `CREATE TABLE`. Cada cambio va en un script nuevo y numerado
(por ejemplo `016_agregar_campo.sql`) que se guarda en esta carpeta, sin contraseñas,
y una sola persona lo aplica en la base compartida.
