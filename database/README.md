# Base de datos · PostgreSQL 17

La base **no** se crea con Prisma ni con el backend. Se crea con los scripts SQL de esta carpeta, ejecutados con `psql` o en pgAdmin.

El diagnóstico, la matriz de privilegios, las decisiones pendientes y los riesgos están en [`docs/bd/PLAN_BD.md`](../docs/bd/PLAN_BD.md). Este documento explica **cómo** reconstruir, aplicar, probar y revertir.

Hay dos caminos al mismo esquema final, con los mismos archivos y en el mismo orden:

- **Reconstruir** una base desde cero (`reconstruir-base.ps1`): borra la base y la crea con la línea base y las migraciones. Es el camino para `learnity_test`, cuyos datos son desechables (decisión del usuario del 20-10-2026). Ver [Reconstruir una base desde cero](#reconstruir-una-base-desde-cero).
- **Migrar** una base existente conservando sus datos (`aplicar-migraciones.ps1`). Ver [Procedimiento](#procedimiento).

## Archivos

| Archivo | Para qué |
|---|---|
| `learnity_esquema.sql` | Las 19 tablas, restricciones e índices del modelo inicial (línea base) |
| `015_sesiones_y_recuperacion.sql` | Sprint 1: `sesion` y `token_recuperacion` (línea base) |
| `016_limpieza_pdf.sql` | Sprint 2: `archivo_borrado_pendiente` (línea base) |
| `linea_base_permisos.sql` | Los `GRANT` de la sección 14 del README principal (`learnity_app` con DML en todo), último paso de la línea base en una base nueva. La 019 los retira |
| `learnity_modelo.dbml` | Modelo para https://dbdiagram.io (Import → DBML) |
| `migraciones/0NN_<nombre>.up.sql` / `.down.sql` | Cambios desde la 017, cada uno con su reversión. Detalle en PLAN_BD §6 |
| `migraciones/RETENIDAS.txt` | Migraciones que todavía no se aplican. Hoy ninguna: la 023 salió el 20-10-2026 (ver *La 023 ya no está retenida*) |
| `migraciones/propuestas/` | Migraciones sin número que esperan un ADR (hoy, `pg_trgm`) |
| `verificacion/huella_esquema.sql` | Huella del esquema (solo lectura): comprueba que un `down` deja la base igual |
| `verificacion/referencias/huella-*.txt` | Huellas de referencia de la prueba del 19-10-2026: línea base (H0), migrada sin la 023 (H4) y con la 023 (H1). Las compara `reconstruir-base.ps1` |
| `verificacion/esquema_final.sql` | Resume y comprueba el esquema final (solo lectura, sirve en cualquier base): tablas, vistas y sus columnas, restricciones, índices, FK sin índice, triggers, funciones, dueños, roles, `CONNECT`, 019b y `schema_migraciones` |
| `verificacion/matriz_privilegios.sql` | Compara los permisos reales de `learnity_app`, `learnity_lectura` y `learnity_pruebas` con los esperados (solo lectura) |
| `verificacion/pruebas_funcionales.sql` | Prueba permisos, auditoría, `actualizado_en`, `CHECK`, índice único y vistas, y lo deshace todo (solo bases `_test`) |
| `verificacion/pruebas_heredadas.sql` | Prueba la decisión BD-022 con cursos `PUBLICADO` heredados sin revisor: aplica 022–026 dentro de una transacción y lo deshace todo. No se ejecuta suelto: lo compone `probar-migraciones.ps1` (solo bases `_test`) |
| `verificacion/comparar_catalogo.sql` | Comprueba que las vistas del catálogo devuelven lo mismo que las consultas actuales, y lo deshace todo (solo bases `_test`) |
| `pruebas/privilegios_pruebas.sql` y `quitar_privilegios_pruebas.sql` | 019b: rol de los fixtures (`learnity_pruebas`), del que `learnity_app` es miembro sin herencia; solo en bases `_test` (decisión D-BD2) |
| `scripts/reconstruir-base.ps1` | Borra y crea una base con el esquema final (línea base, migraciones y, solo en `_test`, la 019b) y la verifica |
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
  4. aplicar a `Learnity` con aprobación del usuario (migrando, o reconstruyendo si el usuario lo aprueba explícitamente: ver [Reconstruir `Learnity`](#reconstruir-learnity-solo-con-aprobación-del-usuario));
  5. cada integrante aplica lo mismo en su base local.
- Los scripts históricos (`learnity_esquema.sql`, 015 y 016) no se vuelven a ejecutar sobre una base que ya los tiene. Solo los ejecuta `reconstruir-base.ps1`, sobre una base recién creada y vacía. La 017 los registra como línea base.
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

En una base cuyo nombre no termina en `_test`, `aplicar-migraciones.ps1` y `revertir-migraciones.ps1` se niegan a correr sin `-ConfirmoRespaldo`, y `reconstruir-base.ps1` sin `-ConfirmoBorrar <nombre exacto de la base>`.

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

## Reconstruir una base desde cero

Deja una base vacía con el esquema final, la verifica y no carga datos (solo las 3 filas de `rol`). La ejecuta el lead con `postgres` y con turno de `learnity_test`. Antes, detén el backend y las pruebas: `WITH (FORCE)` cierra cualquier conexión abierta a esa base.

```powershell
powershell -ExecutionPolicy Bypass -File database\scripts\reconstruir-base.ps1 -Base learnity_test
```

Con `-Simular` muestra el plan sin conectarse.

### Qué hace

| Paso | Qué | Con qué |
|---|---|---|
| 1 | Comprueba, conectado a la base de mantenimiento `postgres`: superusuario, PostgreSQL 16 o superior y que exista `learnity_app`. Informa de los roles `learnity_*` que ya existen, de los logins que no podrán conectarse (R1) y, si la base existe, de sus migraciones, sus filas aproximadas y las conexiones que va a cerrar | Solo lectura |
| 2 | `DROP DATABASE IF EXISTS "<base>" WITH (FORCE)` y `CREATE DATABASE "<base>" TEMPLATE template0 ENCODING 'UTF8'` | `crear-base.sql`, que el script escribe en la carpeta de salidas |
| 3 | Línea base y su huella, que se compara con la de referencia H0 | `learnity_esquema.sql` (en una transacción), `015_…`, `016_…` y `linea_base_permisos.sql` |
| 4 | Migraciones desde la 017, en orden, salvo las de `RETENIDAS.txt` (hoy ninguna), y su huella, que se compara con la de referencia H1 (con la 023) | `migraciones/0NN_*.up.sql`, con la misma función que `aplicar-migraciones.ps1` |
| 5 | Solo si la base termina en `_test`: la 019b | `pruebas/privilegios_pruebas.sql` |
| 6 | Verificación | `esquema_final.sql` y `matriz_privilegios.sql`; en `_test`, además, `pruebas_funcionales.sql` y `comparar_catalogo.sql`, que lo deshacen todo |

Al final imprime un resumen para pegar y deja las salidas completas en `%TEMP%\learnity-reconstruir-<base>-<fecha>`. Termina con código 1 si algo falla, si una verificación no da su resultado esperado o si una huella difiere en algo más que los roles.

**Reglas que cumple:**

- Si el nombre no termina en `_test`, se niega a correr salvo con `-ConfirmoBorrar <nombre exacto>` (por ejemplo `-ConfirmoBorrar Learnity`). Tampoco acepta `postgres`, `template0` ni `template1`, ni nombres con caracteres que no sean letras ASCII, dígitos o `_`.
- La contraseña de `postgres` sale de `PGPASSWORD`, de `pgpass.conf` o de `Read-Host -AsSecureString`, igual que en los demás scripts. Nunca se escribe ni se imprime.
- Los roles son del clúster y `DROP DATABASE` no los borra. La 018 crea solo los que faltan, así que el script se puede repetir.
- **No crea `learnity_app`, no lo modifica y no toca su contraseña.** Si falta, se detiene (ver [Rol `learnity_app`](#rol-learnity_app-en-un-servidor-nuevo)). La 019b sí le concede la pertenencia sin herencia a `learnity_pruebas`, igual que hasta ahora.
- Si falla a mitad de camino, basta con repetirlo: siempre empieza borrando la base.

**Parámetros propios** (los de conexión son los comunes):

| Parámetro | Para qué |
|---|---|
| `-Base` | Por defecto `learnity_test` |
| `-ConfirmoBorrar <nombre>` | Obligatorio si la base no termina en `_test`. Debe ser el nombre exacto |
| `-IncluirRetenidas` | Aplica también las de `RETENIDAS.txt` (hoy ninguna), en orden numérico |
| `-SoloLineaBase` | Se detiene tras la línea base, sin migraciones ni 019b. Sirve para volver a pasar `probar-migraciones.ps1` |
| `-Simular` | Muestra el plan y no se conecta |
| `-SalidaDir` | Carpeta de las salidas |

### Relación con las migraciones

La reconstrucción **no** tiene un esquema propio. Ejecuta los mismos archivos, en el mismo orden en que llegaron a las bases existentes, y registra cada migración en `schema_migraciones` con su sha256 (el `Aplicar-Una` de `comun.ps1`). Una base reconstruida queda en el mismo estado que una base migrada:

- `schema_migraciones`: `000`, `015` y `016` (línea base, sin checksum) y `017`–`026` con checksum.
- `aplicar-migraciones.ps1` sigue funcionando sobre ella: una migración nueva se aplica así, sin reconstruir. Por ejemplo, la `learnity_test` reconstruida el 20-10-2026 sin la 023 la recibe con `aplicar-migraciones.ps1 -Base learnity_test` (queda registrada después de la 026; el esquema es el mismo que reconstruyendo).
- `revertir-migraciones.ps1 -Todas` la devuelve a la línea base (antes, `quitar_privilegios_pruebas.sql`).
- Para repetir la prueba `up → down → up`: `reconstruir-base.ps1 -SoloLineaBase` y después `probar-migraciones.ps1`.

`linea_base_permisos.sql` reproduce los permisos que tenían las bases antes de la 017 (los de la sección 14 del README principal). La 019 los retira. Se conservan para que la base reconstruida pase por el mismo estado que las existentes: así su huella se compara con la de referencia, y la 019 guarda en `reversion` los mismos permisos que su `down` restaura.

### La 023 ya no está retenida (20-10-2026)

La 023 podía salir de `RETENIDAS.txt` cuando ninguna prueba ni ningún fixture creara un curso `PUBLICADO` sin revisor o sin `publicado_en`:

- El último caso era `CAR-CAT-15`: `backend/test/caracterizacion/catalogo.test.ts:91` creaba `c4` "Delta heredado" como `PUBLICADO` con `publicado_en` NULL. `qa-edge` lo retiró en `refactor/qa-edge` `5a853c3`: `c4` pasa a tener revisor y fecha (hace 10 días), sigue el último en `recientes` y el JSON de referencia no cambia.
- Los demás ya ponen revisor y fecha: `cursos-publicos.test.ts:47-53`, `cursos-gestion-http.test.ts:290-297`, `administracion-contenido.test.ts:263-267`, `caracterizacion/cursos.test.ts:81-82`, `caracterizacion/contenido.test.ts:28-29`, `scripts/sembrar-catalogo.ts:20-31` y `semillas.repository.ts`. Los demás `UPDATE curso` de las pruebas solo pasan a `BORRADOR`, `EN_REVISION`, `RECHAZADO` o `ARCHIVADO`. Las E2E no insertan cursos (revisado con `git grep` el 20-10-2026).

**Requisito de orden:** `5a853c3` tiene que estar integrado antes de reconstruir `learnity_test` con la 023. Si no, `caracterizacion/catalogo.test.ts` falla en su `before` con 23514.

El comentario de cabecera de `023_check_curso_publicado.up.sql` todavía dice "RETENIDA". No se cambia: cambiaría su checksum, y la fuente de verdad es `RETENIDAS.txt`.

### Salida esperada en `learnity_test`

Con los roles `learnity_owner`, `learnity_lectura` y `learnity_pruebas` todavía sin crear en el clúster (como al cerrar la prueba del 19-10-2026):

```text
=== reconstruir-base | learnity_test | localhost:5432 | <fecha> ===
  PostgreSQL 170010 | roles learnity_* que ya existen: learnity_app (LOGIN)
  Logins sin CONNECT en la base nueva (riesgo R1; la 018 lo retira a PUBLIC): <normalmente ->
  La base learnity_test existe: migraciones sin schema_migraciones (linea base) | filas aprox.: … | conexiones que se cierran: 0
  Base learnity_test creada vacia (UTF8, <collation del clúster>).
--- Huellas (TOTAL: filas|md5) ---
  Linea base            705|f15432412a68b46b4c6206746a7a31ef  (referencia H0 del 19-10-2026: 705|f15432412a68b46b4c6206746a7a31ef)
  Linea base = H0: IGUAL
--- Migraciones ---
  … NOTICE:  022: cursos PUBLICADO sin revisor o sin fecha en learnity_test: ninguno. No se modifican.
  … NOTICE:  023: CHECK añadido NOT VALID en learnity_test. Filas heredadas sin validar: ninguna.
  Migrada, sin 019b     837|4065121d58902370030826a9460fe375  (referencia H1 del 19-10-2026: 837|4065121d58902370030826a9460fe375)
  Migrada = H1: IGUAL
  schema_migraciones: 000, 015, 016, 017, 018, 019, 020, 021, 022, 023, 024, 025, 026
--- 019b: pruebas\privilegios_pruebas.sql ---
--- Esquema final … ---   RESUMEN | learnity_test | 42 comprobaciones | 0 diferencias, 0 avisos | ESQUEMA OK
--- Matriz de privilegios … ---   RESUMEN | learnity_test | 97 filas | 0 diferencias | MATRIZ OK
--- Pruebas funcionales … ---   999 | RESUMEN | learnity_test | 0 fallas | PRUEBAS OK   (33 pruebas, todas OK: ya ninguna NO APLICA)
--- Catalogo … ---   RESUMEN | learnity_test | - | 0 | CATALOGO IGUAL   (listado con 3 cursos: el "Publicado sin fecha" ya no se puede insertar)
--- Resultado ---
  esquema: ESQUEMA OK
  matriz: MATRIZ OK
  funcionales: PRUEBAS OK
  catalogo: CATALOGO IGUAL
--- Estado final de learnity_test: 000, 015, 016, 017, 018, 019, 020, 021, 022, 023, 024, 025, 026 + 019b ---
```

Si los roles ya existían (por ejemplo, al repetir la reconstrucción), las dos comparaciones de huellas dicen `DISTINTO (roles) - solo difieren los roles del cluster`: es lo esperado y no cuenta como fallo. Cualquier otra categoría distinta sí es un fallo.

La reconstrucción del 20-10-2026 mostró además `DISTINTO (funciones, roles)` en H1 aunque las 42 comprobaciones del esquema pasaron: `pg_get_functiondef` había conservado CRLF de los archivos SQL de Windows, mientras la huella de referencia usaba LF. `verificacion/huella_esquema.sql` normaliza ahora CRLF a LF antes del `md5` de cada función. La huella normalizada de `funciones` es `482af4873fa6648587b1313b42824936`, igual a H1, y las restantes categorías (aparte de `roles` y el total derivado) también coinciden. No cambia ninguna migración, función de la base ni dato; solo evita este falso positivo en la comparación futura.

Después de reconstruir, el lead comprueba `.env.test` y ejecuta `npm test`: es la primera vez que la suite corre con las migraciones aplicadas (pool de fixtures con `SET ROLE learnity_pruebas`, catálogo leyendo las vistas).

### Equivalente con `psql -f`

Mismo orden, desde `database\migraciones`. El modo manual no registra checksums (`esquema_final.sql` lo marca como AVISO, no como diferencia) y no compara huellas.

```powershell
$psql = 'C:\Program Files\PostgreSQL\17\bin\psql.exe'
Set-Location database\migraciones
# Cambia learnity_test por la base. Si el nombre tiene mayúsculas, ponlo entre comillas dobles en el DROP/CREATE.
& $psql -X -h localhost -U postgres -d postgres -v ON_ERROR_STOP=1 -c 'DROP DATABASE IF EXISTS learnity_test WITH (FORCE)'
& $psql -X -h localhost -U postgres -d postgres -v ON_ERROR_STOP=1 -c "CREATE DATABASE learnity_test TEMPLATE template0 ENCODING 'UTF8'"
$cx = @('-X', '-h', 'localhost', '-U', 'postgres', '-d', 'learnity_test', '-v', 'ON_ERROR_STOP=1')
& $psql @cx -1 -f ..\learnity_esquema.sql
& $psql @cx -f ..\015_sesiones_y_recuperacion.sql
& $psql @cx -f ..\016_limpieza_pdf.sql
& $psql @cx -f ..\linea_base_permisos.sql
foreach ($v in '017', '018', '019', '020', '021', '022', '023', '024', '025', '026') {
  & $psql @cx -f (Get-ChildItem "${v}_*.up.sql").Name
  if ($LASTEXITCODE -ne 0) { throw "Fallo la $v" }
}
& $psql @cx -f ..\pruebas\privilegios_pruebas.sql                                  # solo en bases _test
& $psql @cx -q -At -F ' | ' -f ..\verificacion\esquema_final.sql
& $psql @cx -q -At -F ' | ' -f ..\verificacion\matriz_privilegios.sql
& $psql @cx -q -At -F ' | ' -f ..\verificacion\pruebas_funcionales.sql            # solo en bases _test
& $psql @cx -q -At -F ' | ' -f ..\verificacion\comparar_catalogo.sql              # solo en bases _test
```

## Reconstruir `Learnity` (solo con aprobación del usuario)

**No se ejecuta sin una aprobación explícita y única del usuario**, después de haber reconstruido y probado `learnity_test` con este mismo procedimiento. Esto es exactamente lo que se haría.

**1. Respaldo** (con `postgres`, fuera del repositorio; los comandos completos están en el [paso 3](#paso-3-consulta-previa-y-respaldo-de-learnity-lo-ejecuta-el-usuario)):

```powershell
& "$pg\pg_dump.exe" -h localhost -p 5432 -U postgres -d Learnity -F c -f "$dir\Learnity-antes-reconstruir-$fecha.dump"
& "$pg\pg_restore.exe" --list "$dir\Learnity-antes-reconstruir-$fecha.dump" | Select-Object -First 10
```

**2. Detener** el backend de desarrollo y cerrar pgAdmin sobre `Learnity`.

**3. Simular y reconstruir:**

```powershell
powershell -ExecutionPolicy Bypass -File database\scripts\reconstruir-base.ps1 -Base Learnity -Simular
powershell -ExecutionPolicy Bypass -File database\scripts\reconstruir-base.ps1 -Base Learnity -ConfirmoBorrar Learnity
```

**Efectos:**

| Qué | Resultado |
|---|---|
| Datos | **Se pierden todos**: cuentas, docentes, categorías, cursos (los 3 `PUBLICADO` heredados sin revisor incluidos), temarios, sesiones y las 2 filas de `archivo`. Solo quedan las 3 filas de `rol`. El respaldo del paso 1 es la única copia |
| PDF en disco | Los archivos de `backend/uploads/pdf` (o de `PDF_DIR`) quedan huérfanos: ninguna fila los referencia. El script no toca el disco; se pueden borrar a mano o dejar |
| Esquema | El mismo que `learnity_test`: línea base y 017–026, incluido el `CHECK` de la 023 (`NOT VALID`). Al no quedar cursos heredados, la vista `curso_publicado_sin_revision` queda vacía y el `CHECK` se cumple en todas las filas, aunque sigue `NOT VALID`: validarlo sería una migración nueva |
| 019b | **No se aplica**: `Learnity` no termina en `_test`. `learnity_pruebas` no tiene ningún permiso en `Learnity` (lo comprueban `esquema_final.sql`, fila "019b aplicada", y la matriz) |
| Verificación | Solo `esquema_final.sql` y `matriz_privilegios.sql`, que solo leen. `pruebas_funcionales.sql` y `comparar_catalogo.sql` se niegan a correr fuera de `_test` |
| Roles | Se reutilizan los del clúster. `learnity_app` y su contraseña no cambian: `backend/.env` no necesita cambios |
| Conexiones | Se cierran las abiertas a `Learnity`. Los logins que no sean `learnity_app` ni superusuarios pierden `CONNECT` (R1): el script los lista en el paso 1 |
| Otras bases | No cambian: ni `learnity_test` ni ninguna otra |

Salida esperada: como la de `learnity_test`, sin la 019b, sin pruebas funcionales ni comparación del catálogo, y con `esquema: ESQUEMA OK` y `matriz: MATRIZ OK` (la matriz con 48 filas; la fila de la pertenencia de `learnity_app` a `learnity_pruebas` es del clúster y sale `inherit=false,set=true` si `learnity_test` tiene la 019b). Las huellas dicen `DISTINTO (roles)` porque los roles ya existen: no es un fallo.

**4. Datos de desarrollo** (con el backend detenido, desde `backend`, con su `.env`, que ya apunta a `Learnity` y usa `learnity_app`):

```powershell
npm run db:seed            # cuentas de prueba, docente, categorías y solicitud
npm run db:seed-publico    # opcional: 3 cursos [Prueba Sprint 2] publicados con revisor y fecha
```

Las semillas solo hacen `INSERT` en tablas donde la 019 se lo permite a `learnity_app` (persona, usuario, usuario_rol, solicitud_docente, docente, categoria, curso, modulo y leccion), y ponen revisor y fecha a los cursos publicados. **NO VERIFICADO** con la 019 aplicada: `test/database/semillas.test.ts` lo comprobará en `learnity_test` cuando la suite corra sobre la base reconstruida.

**Alternativa sin perder datos:** migrar `Learnity` en su sitio con `aplicar-migraciones.ps1 -Base Learnity -ConfirmoRespaldo` ([paso 4](#paso-4-aplicar-a-learnity-solo-con-aprobación-del-usuario)). Conserva los datos y los 3 cursos heredados (que quedan listados en `curso_publicado_sin_revision`), y deja el mismo esquema. Ese camino no compara huellas: la verificación es `esquema_final.sql` y `matriz_privilegios.sql`, ejecutadas a mano con `psql` como en el equivalente de arriba.

**Volver atrás:** restaurar el respaldo en una base nueva, como en [Revertir](#revertir).

## Procedimiento

Este es el camino para **migrar una base existente** conservando sus datos. Para `learnity_test`, desde el 20-10-2026, lo normal es [reconstruirla](#reconstruir-una-base-desde-cero).

### Paso 1. Probar en `learnity_test` (con turno del lead)

`learnity_test` debe estar en la línea base (sin `schema_migraciones`). Un solo comando hace todo el ciclo:

```powershell
powershell -ExecutionPolicy Bypass -File database\scripts\probar-migraciones.ps1 -Base learnity_test
```

Qué hace:

1. **H0**: huella inicial.
2. `up` de todas, incluidas las retenidas, guardando la huella previa a cada una → **H1**. Justo antes de la 022 ejecuta `pruebas_heredadas.sql` dentro de una transacción que se deshace, y comprueba que la huella no cambia.
3. `down` de todas. Cada `down` debe dejar la huella previa a su `up`. Al final → **H2**, que debe ser igual a H0.
4. `up` de todas otra vez → **H3**, que debe ser igual a H1. Pruebas funcionales con todas aplicadas, incluida la 023.
5. Estado migrado sin las retenidas → **H4**. Desde el 20-10-2026 no hay retenidas, así que H4 = H3 (el 19-10-2026, con la 023 retenida, fue H3 sin la 023).
6. Resultados de las filas heredadas y de las pruebas funcionales en H3; después, sobre H4, matriz de privilegios, pruebas funcionales y comparación del catálogo.
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

El usuario revisa el resumen (H2 = H0, H3 = H1, cada `down` IGUAL, prueba de filas heredadas sin rastro, `MATRIZ OK`, `PRUEBAS OK`, `CATALOGO IGUAL`) y el resultado de `npm test`. Las decisiones D-BD1, D-BD2 y D-BD3 ya se tomaron en la Puerta 1 (PLAN_BD §7 y §11).

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

Para ver antes qué se aplicaría, añade `-Simular`. Desde el 20-10-2026 la 023 ya no está retenida: en `Learnity`, que no tiene ninguna migración, se aplica en orden numérico, entre la 022 y la 024. Con los 3 cursos heredados, el `CHECK NOT VALID` no los revisa ni los cambia (ver *Cursos `PUBLICADO` heredados*); `pruebas_heredadas.sql` probó ese caso el 19-10-2026.

### Paso 5. Cada integrante, en su base local

Cada uno lo hace en su propio PostgreSQL, con su `postgres`:

1. `learnity_app` debe existir (ver arriba).
2. La consulta previa del paso 3, conectado a su base.
3. Su propio respaldo (paso 3, cambiando `-d` por el nombre de su base).
4. `powershell -ExecutionPolicy Bypass -File database\scripts\aplicar-migraciones.ps1 -Base <su base> -ConfirmoRespaldo`.
5. Comprobar el resultado, con la lista que imprime el script o con `SELECT version, aplicada_en FROM schema_migraciones ORDER BY orden;`.

Si la 018 avisa de que `learnity_owner` ya existía con LOGIN (lo mencionaba la versión anterior de este documento), ese integrante decide si ejecuta `ALTER ROLE learnity_owner NOLOGIN;`.

## Cursos `PUBLICADO` heredados (decisión BD-022)

`Learnity` tiene 3 cursos `PUBLICADO` sin revisor. No se les inventa un revisor ni una fecha, y siguen en el catálogo:

- La **022** no cambia ningún dato. Crea la vista `curso_publicado_sin_revision`, que solo puede leer `learnity_lectura` (y `postgres`):

  ```sql
  SELECT * FROM curso_publicado_sin_revision ORDER BY id_curso;
  ```

- La **023** añade el `CHECK curso_publicado_revisado` como `NOT VALID`. PostgreSQL lo exige en todo `INSERT` o `UPDATE` nuevo, pero no revisa las filas que ya existen.
- Efecto: un `UPDATE` de uno de esos cursos que lo deje inválido se rechaza (23514), aunque cambie otra columna. La app nunca actualiza un curso `PUBLICADO` (PLAN_BD §7, D-BD1).
- `ALTER TABLE curso VALIDATE CONSTRAINT curso_publicado_revisado` **falla mientras la vista tenga filas**. Ninguna migración lo ejecuta.

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

Se aplicaron a mano, antes de existir `schema_migraciones`, con la cuenta dueña de las tablas (Query Tool de pgAdmin). La 017 los registra como línea base. Para una base nueva, `reconstruir-base.ps1` hace todo esto en orden:

1. `learnity_esquema.sql`.
2. `015_sesiones_y_recuperacion.sql` (repetible, `IF NOT EXISTS`). Sin la 015, el backend avisa al arrancar ("Falta la tabla sesion").
3. `016_limpieza_pdf.sql`. Sin la 016, falla eliminar lecciones con PDF.
4. `linea_base_permisos.sql` (los `GRANT` de la sección 14 del README principal).
5. Las migraciones desde la 017.

Las tablas nunca guardan tokens en claro, solo su hash SHA-256.
