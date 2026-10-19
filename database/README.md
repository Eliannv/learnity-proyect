# Base de datos · PostgreSQL 17

La base **no** se crea con Prisma ni con el backend. Se crea con los scripts SQL de esta carpeta, ejecutados con `psql` o en pgAdmin.

El diagnóstico, la matriz de privilegios, las decisiones pendientes y los riesgos están en [`docs/bd/PLAN_BD.md`](../docs/bd/PLAN_BD.md). Este documento explica **cómo** aplicar, probar y revertir.

## Archivos

| Archivo | Para qué |
|---|---|
| `learnity_esquema.sql` | Las 19 tablas, restricciones e índices del modelo inicial (línea base) |
| `015_sesiones_y_recuperacion.sql` | Sprint 1: `sesion` y `token_recuperacion` (línea base) |
| `016_limpieza_pdf.sql` | Sprint 2: `archivo_borrado_pendiente` (línea base) |
| `learnity_modelo.dbml` | Modelo para https://dbdiagram.io (Import → DBML) |
| `migraciones/0NN_<nombre>.up.sql` / `.down.sql` | Cambios desde la 017, cada uno con su reversión. Detalle en PLAN_BD §6 |
| `migraciones/RETENIDAS.txt` | Migraciones que todavía no se aplican (hoy, la 023) |
| `migraciones/propuestas/` | Migraciones sin número que esperan un ADR (hoy, `pg_trgm`) |
| `verificacion/huella_esquema.sql` | Huella del esquema (solo lectura): comprueba que un `down` deja la base igual |
| `verificacion/matriz_privilegios.sql` | Compara los permisos reales de `learnity_app` y `learnity_lectura` con los esperados (solo lectura) |
| `verificacion/pruebas_funcionales.sql` | Prueba permisos, auditoría, `actualizado_en`, `CHECK`, índice único y vistas, y lo deshace todo (solo bases `_test`) |
| `verificacion/comparar_catalogo.sql` | Comprueba que las vistas del catálogo devuelven lo mismo que las consultas actuales, y lo deshace todo (solo bases `_test`) |
| `pruebas/privilegios_pruebas.sql` y `quitar_privilegios_pruebas.sql` | 019b: rol de los fixtures (`learnity_pruebas`), del que `learnity_app` es miembro sin herencia; solo en bases `_test` (decisión D-BD2) |
| `scripts/aplicar-migraciones.ps1` | Aplica las pendientes en orden y registra su checksum |
| `scripts/revertir-migraciones.ps1` | Revierte desde la última hacia atrás |
| `scripts/probar-migraciones.ps1` | Ciclo completo `up → down → up` con huellas y verificaciones, solo en bases `_test` |

## Cuentas de PostgreSQL

| Rol | Tipo | Uso |
|---|---|---|
| `postgres` | Superusuario | Lo usa **solo el usuario** (D7) para crear bases, roles, respaldos y aplicar migraciones |
| `learnity_owner` | NOLOGIN | Dueño de tablas, vistas y funciones desde la 018. Las migraciones lo usan con `SET LOCAL ROLE` |
| `learnity_app` | LOGIN | Backend (`.env` / `.env.test`). Desde la 019 tiene solo el DML que usa el código |
| `learnity_lectura` | NOLOGIN | Solo lectura sin datos sensibles. Se concede a un login con `GRANT learnity_lectura TO <login>;` |
| `learnity_pruebas` | NOLOGIN | Rol de los fixtures, solo con permisos en bases `_test` (019b). Los fixtures lo usan con `SET ROLE`; `learnity_app` no hereda sus permisos |

### Rol `learnity_app` en un servidor nuevo

Si tu PostgreSQL no tiene `learnity_app` (la 018 se detiene si falta), créalo una vez con `postgres` en `psql`. La contraseña la escribes tú y no va a ningún archivo del repositorio:

```sql
CREATE ROLE learnity_app LOGIN;
\password learnity_app
```

## Reglas

- **Ningún DDL ni DML directo sobre `Learnity`.** Solo migraciones de esta carpeta, en este orden:
  1. prueba `up → down → up` en `learnity_test`;
  2. Puerta DB;
  3. respaldo con `pg_dump`;
  4. aplicar a `Learnity` con aprobación del usuario;
  5. cada integrante aplica lo mismo en su base local.
- Los scripts históricos (`learnity_esquema.sql`, 015 y 016) no se vuelven a ejecutar. La 017 los registra como línea base.
- Nada de contraseñas en archivos, scripts ni commits.

## Cómo ejecutar los scripts

### PowerShell (.ps1)

Los `.ps1` se ejecutan desde la raíz del repositorio. Si la política de ejecución de PowerShell los bloquea, usa siempre esta forma (no cambia la política del sistema):

```powershell
powershell -ExecutionPolicy Bypass -File database\scripts\aplicar-migraciones.ps1 -Base learnity_test
```

Parámetros comunes:

| Parámetro | Para qué |
|---|---|
| `-Base` | Base de destino |
| `-Servidor`, `-Puerto`, `-Usuario` | Conexión (por defecto `localhost`, `5432` y `postgres`) |
| `-PsqlRuta` | Ruta de `psql.exe` si no está en `C:\Program Files\PostgreSQL\17\bin\`. También se puede fijar con la variable `LEARNITY_PSQL` |

**Contraseña.** Ningún script la guarda ni la imprime. Se resuelve así:

- si `PGPASSWORD` ya está definida en tu sesión, o existe `%APPDATA%\postgresql\pgpass.conf`, `psql` la usa;
- si no, el script la pide **una vez**, sin eco, y la deja solo en `PGPASSWORD` de ese proceso. Al terminar restaura el valor anterior;
- con `-PedirEnCadaPaso` el script no la pide y es `psql` quien la pide en cada llamada.

En una base cuyo nombre no termina en `_test`, `aplicar-migraciones.ps1` y `revertir-migraciones.ps1` se niegan a correr sin `-ConfirmoRespaldo`.

### Equivalente con `psql -f`

Todos los `.sql` son SQL puro: también se pueden abrir en el Query Tool de pgAdmin, conectado como `postgres`. Con `psql`, desde la carpeta `database\migraciones`:

```powershell
$psql = 'C:\Program Files\PostgreSQL\17\bin\psql.exe'
Set-Location database\migraciones
& $psql -X -h localhost -U postgres -d learnity_test -v ON_ERROR_STOP=1 -f 017_control_migraciones.up.sql
```

Así se aplica cada `up` en orden numérico (017, 018…) y cada `down` en orden inverso. El modo manual no registra el checksum; `aplicar-migraciones.ps1` sí. Cada archivo comprueba por sí mismo que no esté aplicado, que tenga sus dependencias y, en un `down`, que sea la última aplicada.

Huella, matriz y pruebas con `psql`:

```powershell
& $psql -X -h localhost -U postgres -d learnity_test -At -F "|" -f ..\verificacion\huella_esquema.sql > H0.txt
& $psql -X -h localhost -U postgres -d learnity_test -At -F " | " -v ON_ERROR_STOP=1 -f ..\verificacion\matriz_privilegios.sql
& $psql -X -h localhost -U postgres -d learnity_test -At -F " | " -v ON_ERROR_STOP=1 -f ..\verificacion\pruebas_funcionales.sql
& $psql -X -h localhost -U postgres -d learnity_test -At -F " | " -v ON_ERROR_STOP=1 -f ..\verificacion\comparar_catalogo.sql
Compare-Object (Get-Content H0.txt) (Get-Content H2.txt)     # vacío = huellas iguales
```

Guarda los archivos de huella fuera del repositorio (por ejemplo en `%TEMP%`).

## Procedimiento

### Paso 1. Probar en `learnity_test` (con turno del lead)

`learnity_test` debe estar en la línea base (sin `schema_migraciones`). Un solo comando hace todo el ciclo:

```powershell
powershell -ExecutionPolicy Bypass -File database\scripts\probar-migraciones.ps1 -Base learnity_test
```

Qué hace:

1. **H0**: huella inicial.
2. `up` de todas, incluidas las retenidas, guardando la huella previa a cada una → **H1**.
3. `down` de todas. Cada `down` debe dejar la huella previa a su `up`. Al final → **H2**, que debe ser igual a H0.
4. `up` de todas otra vez → **H3**, que debe ser igual a H1.
5. Estado migrado, con la 023 (retenida) sin aplicar → **H4**.
6. Matriz de privilegios, pruebas funcionales y comparación del catálogo.
7. Aplica la 019b y repite la matriz y las pruebas funcionales.
8. Estado final, según `-EstadoFinal`:
   - **`LineaBase`** (por defecto): quita la 019b, revierte todo y comprueba que la huella final es igual a H0.
   - **`Migrada`**: deja H4 con la 019b aplicada.

Al final imprime un resumen para pegar y deja las salidas completas en `%TEMP%\learnity-probar-…`.

**Por qué el estado final por defecto es la línea base:**
- Con la 019, `learnity_app` ya no puede limpiar los datos de los fixtures.
- La 019b no se los devuelve: la pertenencia es **sin herencia** (D-BD2, opción 3). Los fixtures tendrán que usar el pool de `backend/test/ayudas/`, que hace `SET ROLE learnity_pruebas`.
- Hasta que las suites usen ese pool (Fase 2A), `npm test` solo sigue en verde si `learnity_test` está en la línea base.

Equivalente manual de la 019b (requiere PostgreSQL 16 o superior):

```powershell
& $psql -X -h localhost -U postgres -d learnity_test -v ON_ERROR_STOP=1 -f ..\pruebas\privilegios_pruebas.sql
```

Si algo falla, el script dice en qué estado quedó la base. Para volver a la línea base:

```powershell
powershell -ExecutionPolicy Bypass -File database\scripts\revertir-migraciones.ps1 -Base learnity_test -Todas
```

Si estaba aplicada la 019b, primero hay que quitarla con `quitar_privilegios_pruebas.sql`. No es imprescindible, porque el `down` de la 019 también revoca esos permisos.

### Paso 2. Puerta DB

El usuario revisa el resumen (H2 = H0, H3 = H1, cada `down` IGUAL, `MATRIZ OK`, `PRUEBAS OK`, `CATALOGO IGUAL`) y el resultado de `npm test`. También decide D-BD1, D-BD2 y D-BD3 (PLAN_BD §7) en la Puerta 1.

### Paso 3. Consulta previa y respaldo de `Learnity` (lo ejecuta el usuario)

**Consulta previa (riesgo R1).** Lista los logins que perderían el acceso con el `REVOKE CONNECT … FROM PUBLIC` de la 018. Ejecútala conectado a `Learnity`; solo lee:

```sql
WITH conceden AS (
  SELECT a.grantee
    FROM pg_database d, aclexplode(COALESCE(d.datacl, acldefault('d', d.datdba))) a
   WHERE d.datname = current_database() AND a.privilege_type = 'CONNECT' AND a.grantee <> 0
)
SELECT r.rolname AS login_que_hoy_depende_de_public
  FROM pg_roles r
 WHERE r.rolcanlogin AND NOT r.rolsuper AND r.rolname NOT IN ('learnity_app')
   AND NOT EXISTS (SELECT 1 FROM conceden c WHERE pg_has_role(r.oid, c.grantee, 'MEMBER'))
 ORDER BY 1;
```

Cada login que aparezca necesita, después de la 018, `GRANT CONNECT ON DATABASE "Learnity" TO <login>;` o `GRANT learnity_lectura TO <login>;`.

**Respaldo**, fuera del repositorio:

```powershell
$pg  = 'C:\Program Files\PostgreSQL\17\bin'
$dir = Join-Path $env:USERPROFILE 'respaldos-learnity'
New-Item -ItemType Directory -Force -Path $dir | Out-Null
$fecha = Get-Date -Format 'yyyyMMdd-HHmm'

# Base completa, formato custom (se restaura con pg_restore)
& "$pg\pg_dump.exe" -h localhost -p 5432 -U postgres -d Learnity -F c -f "$dir\Learnity-antes-017-$fecha.dump"

# Comprobar que el respaldo se puede leer (debe listar el contenido sin errores)
& "$pg\pg_restore.exe" --list "$dir\Learnity-antes-017-$fecha.dump" | Select-Object -First 10

# Roles del servidor (la 018 crea roles). CONTIENE HASHES DE CONTRASEÑAS: no lo compartas ni lo subas a git.
& "$pg\pg_dumpall.exe" -h localhost -p 5432 -U postgres --roles-only -f "$dir\roles-antes-017-$fecha.sql"
```

### Paso 4. Aplicar a `Learnity` (solo con aprobación del usuario)

```powershell
powershell -ExecutionPolicy Bypass -File database\scripts\aplicar-migraciones.ps1 -Base Learnity -ConfirmoRespaldo
```

Para ver antes qué se aplicaría, añade `-Simular`. Con la opción C de D-BD1, añade `-Omitir 022,023`.

### Paso 5. Cada integrante, en su base local

Cada uno lo hace en su propio PostgreSQL, con su `postgres`:

1. `learnity_app` debe existir (ver arriba).
2. La consulta previa del paso 3, conectado a su base.
3. Su propio respaldo (paso 3, cambiando `-d` por el nombre de su base).
4. `powershell -ExecutionPolicy Bypass -File database\scripts\aplicar-migraciones.ps1 -Base <su base> -ConfirmoRespaldo`.
5. Comprobar el resultado, con la lista que imprime el script o con `SELECT version, aplicada_en FROM schema_migraciones ORDER BY orden;`.

Si la 018 avisa de que `learnity_owner` ya existía con LOGIN (lo mencionaba la versión anterior de este documento), ese integrante decide si ejecuta `ALTER ROLE learnity_owner NOLOGIN;`.

## Revertir

- La última migración:

  ```powershell
  powershell -ExecutionPolicy Bypass -File database\scripts\revertir-migraciones.ps1 -Base <base> [-ConfirmoRespaldo]
  ```

- Hasta que la última aplicada sea la 0NN: `-Hasta 0NN`.
- Todas, incluida la 017: `-Todas`.

Lo que un `down` no devuelve, por definición: las filas de `auditoria_cambio` y los valores de `actualizado_en`. Si otra base del servidor usa los roles, el `down` de la 018 los conserva y lo avisa.

**Restaurar el respaldo** (solo si el usuario lo decide). Se restaura en una base nueva, se comprueba y después se intercambian los nombres con el backend detenido:

```powershell
& "$pg\createdb.exe"   -h localhost -U postgres Learnity_restaurada
& "$pg\pg_restore.exe" -h localhost -U postgres -d Learnity_restaurada "$dir\Learnity-antes-017-<fecha>.dump"
```

## Historial: scripts 015 y 016

Se aplicaron a mano, antes de existir `schema_migraciones`, con la cuenta dueña de las tablas (Query Tool de pgAdmin). La 017 los registra como línea base. Para una base nueva:

1. `learnity_esquema.sql`.
2. `015_sesiones_y_recuperacion.sql` (repetible, `IF NOT EXISTS`). Sin la 015, el backend avisa al arrancar ("Falta la tabla sesion").
3. `016_limpieza_pdf.sql`. Sin la 016, falla eliminar lecciones con PDF.
4. Los `GRANT` de la sección 14 del README principal.
5. Las migraciones desde la 017 (`aplicar-migraciones.ps1`).

Las tablas nunca guardan tokens en claro, solo su hash SHA-256.
