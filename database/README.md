# Base de datos · PostgreSQL 17

La base **no** se crea con Prisma ni con el backend: se crea con los scripts SQL de la guía
`Guia_Learnity_PostgreSQL_pgAdmin.docx` (pasos 01 a 14), ejecutados en pgAdmin.

| Archivo | Para qué |
|---|---|
| `learnity_esquema.sql` | Las 19 tablas, restricciones e índices del modelo inicial. |
| `015_sesiones_y_recuperacion.sql` | Sprint 1: tablas `sesion` (refresh tokens) y `token_recuperacion` (enlaces de recuperación). |
| `016_limpieza_pdf.sql` | Sprint 2: tabla `archivo_borrado_pendiente` (PDF retirados que el backend borra del disco después). |
| `learnity_modelo.dbml` | El modelo completo (22 tablas) para ver el diagrama en https://dbdiagram.io (Import → DBML). |

## Cuentas de PostgreSQL

| Cuenta | Uso |
|---|---|
| Dueña de las tablas (`learnity_owner` o la que ejecutó el esquema) | Solo para cambios de estructura. |
| `learnity_app` | La usa el backend (`.env`). Lee y modifica datos; no crea tablas. |

## Cambios de estructura

No se vuelven a ejecutar los `CREATE TABLE`. Cada cambio va en un script nuevo y numerado
(por ejemplo `016_agregar_campo.sql`) que se guarda en esta carpeta, sin contraseñas,
y una sola persona lo aplica en la base compartida.

### Aplicar el script 015 (obligatorio para el Sprint 1)

1. En pgAdmin, conéctate con la cuenta **dueña de las tablas** (no con `learnity_app`).
2. Clic derecho en la base de Learnity → **Query Tool**.
3. Abre `015_sesiones_y_recuperacion.sql` (ícono de carpeta) y ejecútalo (F5).
4. Ejecuta la consulta de comprobación que está comentada al final del script: deben salir
   `sesion` y `token_recuperacion` con `DELETE, INSERT, SELECT, UPDATE` para `learnity_app`.

El script se puede repetir sin problema (`IF NOT EXISTS`). Si falta, el backend lo avisa al arrancar
("Falta la tabla sesion") y el inicio de sesión falla.

Las tablas nunca guardan tokens en claro: solo su hash SHA-256. De vez en cuando, al iniciar
sesión, el backend borra las filas vencidas hace más de 30 días.

### Aplicar el script 016 (obligatorio para el Sprint 2)

Igual que el 015: con la cuenta dueña de las tablas, abre `016_limpieza_pdf.sql` en el Query Tool y ejecútalo.
Crea `archivo_borrado_pendiente` y da permisos a `learnity_app`. Sin esta tabla falla eliminar lecciones con PDF.

### Base para las pruebas automáticas (opcional)

`npm test` (backend) necesita una base aparte, por ejemplo `learnity_test`, creada igual que la de
desarrollo (`learnity_esquema.sql` + `015_…` + `016_…`) y con los mismos permisos para `learnity_app`.
Las pruebas solo crean y borran cuentas del dominio `@pruebas.test`. Configúrala en `backend/.env.test`
(ver `backend/.env.test.example`).
