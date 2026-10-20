# Revisión de seguridad y arquitectura: cierre de la Fase 3

> **Actualización de cierre (20-10-2026):** este informe documenta la revisión inicial sobre `b15f308`; sus estados "abierto" y "NO VERIFICADO" describen ese corte. Después se integraron D-01, el actor de auditoría y las correcciones de accesibilidad. S8 quedó cerrado al eliminar la contraseña predeterminada de los scripts de seed y verificación; S9, al exigir certificado válido cuando `DB_SSL=true`. Con `learnity_test` reconstruida incluyendo la 023, backend `npm test` pasó **261/261**, Angular **38/38** y Chromium E2E **21/21**. Las 7 pruebas de `backend/test/seguridad/bloqueo-pdf.test.ts` fijan D-01; `backend/test/database/auditoria-actor.test.ts` comprueba el actor en INSERT y DELETE. La reconstrucción informó ESQUEMA/MATRIZ/PRUEBAS OK y CATALOGO IGUAL. Después de esta revisión se respaldó y migró `Learnity` con aprobación del usuario; el resultado vigente se detalla en `docs/refactor/ESTADO.md`.

- **Autor:** `revisor` (Opus). Rama `refactor/revisor`, worktree `.worktrees/revisor`, base `b15f308` (= `integration/sprint-2`).
- **Fecha:** 20-10-2026.
- **Alcance:** S2–S9 de `AUDITORIA_INICIAL.md` §4.2, H1–H11 y RG-01–RG-60 de `RIESGOS.md`, lista R1–R11 y R9b de `PLANTILLA_MODULO.md` §5, y el contrato (`openapi*.ts` ↔ `openapi.yaml` ↔ 33 rutas). La Fase 2B y el punto 11.4 los integró Antigravity (`7f75337`, `372014d`, `182b4f8`); su autorrevisión no la había contrastado nadie.
- **Método:** lectura del código en `b15f308`, los grep exactos de la plantilla, los scripts de `COMPARACION_RUTAS.md` §1, comprobaciones HTTP sin base de datos (variables ficticias, el pool de `pg` no llega a conectar) y una reproducción contra `learnity_test` con turno del lead (§6, D-01).
- **Lo que no se ejecutó** se marca **NO VERIFICADO**. No se leyó ningún `.env*`, no se tocó `Learnity` y no se cambió el contrato.

## 1. Resumen y recomendación

| Bloque | Resultado |
|---|---|
| R1, R2, R3, R6, R7, R11 | 0 violaciones (confirmado) |
| R4 (SQL solo en repositorios) | 0 violaciones de **ubicación** del SQL. Pero la regla hermana del mismo apartado ("nunca lecturas de disco con filas bloqueadas", REGLAS_EQUIPO y PLANTILLA §2) **no se cumple**: ver D-01. La autorrevisión de Antigravity lo daba por cumplido |
| R5 | Cada `${…}` es una constante, un elemento de `ORDENES` (lista cerrada) o un número de parámetro `$n`. Correcto |
| R8 | `ruta` solo en repositorios, el almacén y los servicios que leen el disco; nunca en un `modelo` ni en una respuesta. Correcto |
| R9 | `openapi.yaml` regenerado = el del repositorio (`git diff --exit-code` → 0). IDÉNTICO, 28 rutas, 33 operaciones y 15 esquemas. 33/33 rutas reales, 0 sobrantes y 0 que falten |
| R9b | `esquema.d.ts` regenerado = el versionado (exit 0) |
| R10 | backend `typecheck` y `build` → exit 0; frontend `ng build` → exit 0 y `ng test` → 11 archivos, 36/36. **Suite backend completa: NO VERIFICADO por el revisor** (la ejecuta el lead) |
| R10b | `test:local` usa el glob `"test/**/*.test.ts"` |
| S2–S9 | S4, S5 y S7 **cerrados** en el código. S3 cerrado por proceso (D10). S2 **abierto en las bases** (la 019 existe y está probada, pero no está aplicada). S6 **abierto y aceptado** (11.9 rechazado). S8 y S9 **abiertos** (baja) |
| Defectos comprobados | **D-01** (lectura de disco con la fila `curso` bloqueada en 6 operaciones; 4 reproducidas con `55P03`; `be-b`). Errores documentales en `ESTADO.md` (los corrige el lead) |

**Recomendación:** no cerrar la Fase 3 hasta corregir D-01. Es un cambio interno: no cambia el contrato ni las pruebas existentes, y además necesita una prueba nueva que lo fije. Lo demás puede cerrarse con las acciones de la §7, que no bloquean.

## 2. Lista R1–R11 (salidas reales, `b15f308`)

```
== R1   grep -rnE "from '\.\./[a-z-]+/[a-zA-Z.-]+\.js'" backend/src/modules | grep -v "/index\.js'"      → (vacío)
== R2   grep -rn "modules/" backend/src/shared                                                         → (vacío)
== R3   grep -nE "modules/[a-z-]+/[a-zA-Z.-]+\.js" backend/src/app.ts backend/src/server.ts | grep -v … → (vacío)
== R4   grep -rnE "consultar[<(]|\.query[<(]" backend/src --include=*.ts | grep -v "\.repository\.ts:"
backend/src/shared/database/pool.ts:51  (consultar)      :52 pool.query      :68 set_config($1)
backend/src/shared/database/pool.ts:94 BEGIN  :97 COMMIT  :101 ROLLBACK
== R6   grep -rnE "\.(safeParse|parse)\(" backend/src/modules/*/*.controller.ts                         → (vacío)
== R7   grep -rn "console\." backend/src --include=*.ts | grep -v seed.ts | grep -v registro.ts:         → (vacío)
== R10b tsx --env-file=.env.test --test --test-concurrency=1 --test-skip-pattern="Have I Been Pwned" "test/**/*.test.ts"
== R11  git ls-files backend/src | grep -iE "integrante|integracion"                                    → (vacío)
```

- **R4:** solo `shared/database/pool.ts`, como pide la regla. Además, `shared/http/salud.repository.ts` y `src/database/semillas.repository.ts` contienen SQL y se llaman `*.repository.ts` (infraestructura y semillas), así que el grep los excluye a propósito. El SQL de arranque de `server.ts` salió a `salud.repository.ts:11-18` (`c9ab86c`).
- **R5** (`grep -rn '\${'` sobre `modules/*/*.repository.ts` y `modules/*/*/*.repository.ts`): `catalogo.repository.ts:133-193` interpola `$${valores.length}` (número de parámetro), `donde` (formado solo con condiciones fijas), `ORDER BY ${orden}` (`ORDENES[f.orden]`, `Record` cerrado y `orden` validado con `z.enum` en `catalogo.esquemas.ts:13`) y `${pre}`/`${CAMPOS_CURSO}` (constantes). `ficha.repository.ts:283` y `temario.repository.ts:388` interpolan `FOR UPDATE` desde un booleano interno. `identidad.repository.ts:70,78` y `usuarios.repository.ts:83,91,101` usan prefijos constantes y un orden con un ternario fijo. `q` va como `$n` con `%`, `_` y `\` escapados (`:133`) y `ESCAPE '\'`. **Correcto.**
- **R8** (`grep -rnw ruta backend/src/modules backend/src/shared`): `ruta` aparece en `contenido.repository.ts`, `temario.repository.ts:28,35,415` (`archivoRuta`), `detalle-privado.service.ts:35-36,178-182` (clave interna para prevalidar el disco), `contenido.service.ts:84,185` y `contenido-limpieza.service.ts:63`. Ningún `*.modelo.ts` la declara y `detallePrivado` construye `archivo` sin ella (`detalle-privado.service.ts:159-166`). La prueba que lo cubre es `seguridad/acceso.test.ts:260` (`sinRutasPrivadas` sobre 7 respuestas).

## 3. Contrato: R9, R9b y las 33 rutas

Scripts de `COMPARACION_RUTAS.md` §1 (en el *scratchpad* de la sesión, fuera del repositorio; no cargan `.env` ni tocan la base):

```
$ npx tsx verificar-openapi.mts <worktree>            # cwd backend/
IDÉNTICO
sha256 a3759da2c9a2930e634c353e2264f8a9b8cac90a3853b631e84270d0fba64580   (copia de trabajo CRLF)
rutas 28 · operaciones 33 · esquemas 15
$ npx tsx serializar-openapi.mts <worktree> && git diff --exit-code docs/api/openapi.yaml   → exit 0
$ git show HEAD:docs/api/openapi.yaml | sha256sum  → c46a9d9549f88fc333a095b24389e291192309e350623bb788561236a5e70914 (blob LF)
$ node comparar-rutas.mjs <worktree>
rutas reales: 33 · operaciones en el spec: 33
en código y no en spec: 0 · en spec y no en código: 0
(las 33 solo anotan "declara 500", intencionado desde C-13)
$ npx openapi-typescript ../docs/api/openapi.yaml -o $TMP/esquema.d.ts && git diff --no-index --exit-code src/app/core/api/generado/esquema.d.ts $TMP/esquema.d.ts   → exit 0
```

Reparto real de las 33 operaciones: identidad 9 (`identidad.routes.ts:23-34`), catálogo 3 (`catalogo.routes.ts:9-17`), cursos 11 (`cursos.routes.ts:15-99`), contenido 2 (`contenido.routes.ts:13,24`), revisión 3 (`revision.routes.ts:9-25`), usuarios 4 (`usuarios.routes.ts:16-35`) y `GET /salud` (`app.ts:53`). El 429 de `POST /lecciones/{id}/archivo` está declarado (`openapi-revision-contenido.ts:140,174`) y coincide con `limitarPorIp('subida-pdf', 30, 15)` (`contenido.routes.ts:15`).

## 4. S2–S9 (y S1, S3, S10 como contexto)

| ID | Estado | Evidencia (archivo:línea, prueba, commit) | Acción |
|---|---|---|---|
| S1 | **Cerrado** (proceso y código) | `test/ayudas/guardia-bd.ts:8-9` (síncrona, antes de `dotenv`) y `guardia-entorno.ts:24-31` (`current_database()` real), llamada en `bd-fixtures.ts:37`; GUA-01..06 en `ayudas/guardia-bd.test.ts`; `f6f5ec3`. Las 21 suites que tocan la base importan la guarda (las 3 que no la importan no abren conexión: `datos.test.ts`, `guardia-bd.test.ts` y `cursos/politica-curso.test.ts`) | Ninguna |
| S2 | **Abierto en las bases; mitigación lista y probada** | `database/migraciones/019_privilegios_minimos.up.sql` y `verificacion/matriz_privilegios.sql:24-42` (48/48 en el ciclo del 19-10, ESTADO "Prueba de migraciones"). El inventario estático del DML del código refactorizado (`INSERT/UPDATE/DELETE` por tabla en `src/**` y `scripts/**`) y de los `FOR UPDATE` cabe en la matriz sin excepciones: `archivo` solo SELECT/INSERT/DELETE, `categoria` INSERT solo en semillas, ningún DELETE de `persona`, `usuario`, `curso`, `usuario_rol` ni `rol`, ninguna tabla del Sprint 3/4. `learnity_test` y `Learnity` siguen sin la 019 (ESTADO, línea 9) | `db`/lead: aplicar 017–026 en la reconstrucción de `learnity_test` y ejecutar la suite completa como `learnity_app` (sin herencia de `learnity_pruebas`). `qa-edge`: `seguridad/privilegios.test.ts` (RG-60), que no existe |
| S3 | **Cerrado** (proceso, D10) | `.claude/settings.local.json`: 30 reglas `deny`, entre ellas 9 de PowerShell para `.env*`, `git push/reset --hard/clean/branch -D` y `Remove-Item -Recurse`. Son por patrón (no infalibles) | Ninguna |
| S4 | **Cerrado** | `/api/salud` → `{estado}` (`app.ts:53-62`; `salud.repository.ts:21-23`, `SELECT 1`); 503 `sin_bd` con la base caída. Swagger solo con `NODE_ENV=development` (`app.ts:65-67`). Pruebas: CAR-GEN-01, 03 y 04 (`caracterizacion/general.test.ts:15,30,49`). Comprobado sin BD con `NODE_ENV=test`: `GET /api/docs/` → 404 `NO_ENCONTRADO`. Commits `9060760`, `17aad12` y `c62a2ea` | Ninguna |
| S5 | **Cerrado** | 11.4: `limitarPorIp('subida-pdf', 30, 15)` antes de `autenticar` (`contenido.routes.ts:15`); SEG-28 (`seguridad/acceso.test.ts:193`): 30 → 200 y la 31.ª → 429 `DEMASIADAS_PETICIONES` con `Retry-After` (`7f75337`). 11.5: multer con almacenamiento en `PDF_DIR/.tmp` (`contenido.multipart.ts:26-79`, `flags: 'wx'`, `0o600`), límites `fileSize` 10 MiB, `files` 1, `fields` 0 y `parts` 2 (`:84-91`), temporal borrado en `close` (`:166-175`) y huérfanos de más de una hora al arrancar (`contenido-limpieza.service.ts:18`); `test/contenido/subida-temporal.test.ts:56-158` (9 casos) (`b91d38f`). Firma `%PDF-x.y` y `%%EOF`, `pdf-lib` sin cifrado y con páginas (`pdf-validacion.ts:47-99`); tamaño comprobado antes de leer (`:106-121`) | Ninguna. Queda el pico de memoria de `pdf-lib` al validar (aceptado en ADR-011 11.5) |
| S6 | **Abierto, aceptado** | `esPortadaValida` (`cursos.esquemas.ts:23-42`) acepta `https://externo`; una sola regla para crear, enviar y aprobar (11.8, `detalle-privado.service.ts:67`; CAR-CUR-07 y SEG-19, `acceso.test.ts:247`). 11.9 **rechazado** por el usuario (P1-3) | Ninguna (decisión del usuario) |
| S7 | **Cerrado en el código; sin prueba específica** | `manejador-errores.ts:60-74`: con `code` solo registra `codigoPg`, `restriccion` y `tabla`; nunca `detail`, `parameters`, `message` de PostgreSQL ni el cuerpo; la pila solo en `development` (`06e3921`). `registro.ts:11` descarta claves sensibles. Prueba general: `identidad.test.ts:516` (logs sin secretos). Nadie fuerza un 500 de PostgreSQL y mira el log (SEG-17) | `qa-edge`: SEG-17 |
| S8 | **Abierto** (baja) | `seed.ts:113` (contraseña por defecto en el código) y `seed.ts:131` (la imprime) | Opcional (`be-b`): no imprimirla. No bloquea (solo es entorno local) |
| S9 | **Abierto** (baja) | `pool.ts:13` y `test/ayudas/bd-fixtures.ts` (`rejectUnauthorized: false` con `DB_SSL=true`) | Ninguna mientras sea solo local (`DB_SSL=false`). Antes de un despliegue real, `ca` configurable |
| S10 | **Abierto, aceptado** (CONGELADO-INSEGURO) | CAR-CUR-04 (`caracterizacion/cursos.test.ts`) fija el 404 frente al 403 | Ninguna |

## 5. Lo que pidió el lead, punto por punto

- **SQL y ruta de respaldo del catálogo.** Todo el SQL de los módulos está en `*.repository.ts`, parametrizado (§2, R4 y R5). `catalogo.repository.ts:108-113` consulta `to_regclass('public.catalogo_curso')` y, si no hay vista, antepone un CTE con el mismo nombre. **Los tres CTE son textualmente iguales a las vistas de la 026** (comparación con comentarios y espacios normalizados: `catalogo_categoria IGUAL · catalogo_curso IGUAL · catalogo_temario IGUAL`). Ninguno expone `ruta` ni `id_archivo`; de `archivo` solo sale `duracion_seg`. Dos observaciones: (a) **no hay caché**: la comprobación se repite en cada petición (`:154, 162, 182, 191`), una ida y vuelta más por llamada. ESTADO.md (línea 43) dice "detecta en caché", y es inexacto. (b) Hasta ahora solo se ejecutó la ruta de respaldo: la de las vistas sigue **NO VERIFICADA** hasta aplicar la 026 en `learnity_test` y pasar `caracterizacion/catalogo.test.ts` (RG-53).
- **Autorización por rol y por propiedad.** Las 23 rutas con `Bearer` llevan `autenticar`; 19 de ellas además `autorizar(...)`, y las 4 restantes (`GET/PUT /perfil`, `PUT /perfil/contrasena` y `GET /solicitudes-docente/mia`) solo actúan sobre la cuenta propia (§3). `autenticar` falla cerrado si no hay verificador (`middlewares.ts:31-34`) y lee los roles de la base en cada petición (11.10; `identidad.repository.ts:245`). En el servicio, `politicaCurso.exigirRol`, `exigirPropietario`, `exigirEditable` y `exigirTransicion` (`politica-curso.ts:51-83`) cubren todas las operaciones de cursos, temario, contenido y revisión; la descarga exige ADMIN o el docente dueño (`:79-83`, `detalle-privado.service.ts:280-293`). IDOR: `seguridad/acceso.test.ts:90` (el docente B recorre cursos, módulos, lecciones y archivos de A y nunca obtiene un 200). **Deuda heredada, no regresión:** `usuarios.service.ts` no vuelve a comprobar el rol en el servicio (ADMIN en `listarSolicitudes`/`decidirSolicitud`, ESTUDIANTE en `solicitarDocencia`); solo lo hace la ruta, igual que `administracion.service.ts` en `baseline-pre-refactor`. La propiedad sí se comprueba (`:41`, no decidir la propia solicitud).
- **Archivos privados.** No hay `express.static` ni `sendFile` en `backend/src`. `almacen.ts:58-86` rechaza un `PDF_DIR` dentro de `frontend/public`. Los nombres internos son UUID (`NOMBRE_PDF_INTERNO`). `leer` comprueba `lstat`, que no sea un enlace simbólico, el tamaño y `realpath` dentro de la raíz (`almacen.ts:171-222`). `backend/uploads/` está ignorado por git (`.gitignore:13`). Ningún `registrarEvento` recibe `ruta` ni el nombre interno (grep de las llamadas); `limpieza` registra `{ archivo: 'pendiente' }`. Descarga: `Cache-Control: private, no-store`, `attachment` y `nosniff` (helmet) (`contenido.controller.ts:41-45`).
- **Límite y validación del PDF.** Ver S5.
- **`/api/salud` y Swagger.** Ver S4.
- **Manejador de errores y logs.** Ver S7. Nota menor: con `NODE_ENV=development`, el 500 devuelve `detalles: error.message` (`manejador-errores.ts:79`, documentado en el contrato, C-08). Un error de `fs` que llegara ahí incluiría una ruta absoluta del temporal. Solo afecta a desarrollo y no es una regresión.
- **Cookies, CSRF y CORS.** `learnity_rt` es HttpOnly, SameSite=Lax y `Path=/api/auth`; `XSRF-TOKEN` es legible y va con `Path=/`; `Secure` según `COOKIE_SECURE`, obligatorio en producción (`cookies-sesion.ts:18-20`; `env.ts:67-69,74`). El doble envío está firmado con HMAC y ligado al refresh (`:22-24, 60-76`), y `verificarOrigen` se aplica a todo `/auth` (`identidad.routes.ts`). Pruebas: CAR-IDE-02 (`caracterizacion/identidad.test.ts:64-68`), SEG-05 y SEG-07. **CORS (SEG-08), comprobado sin BD:** el *preflight* desde `http://localhost:4200` recibe `access-control-allow-origin: http://localhost:4200` y `allow-credentials`; desde `https://malo.example` no recibe `access-control-allow-origin`. `POST /api/auth/login` con `Sec-Fetch-Site: cross-site` → 403 `ORIGEN_NO_PERMITIDO`, y `POST /api/auth/refresh` con `Origin` ajeno → 403. SEG-08/09 no existen como prueba (`qa-edge`).
- **Rol de BD de mínimo privilegio.** Ver S2. Además, **ningún código impide arrancar con `postgres`**: `env.ts:29` solo exige `DB_USER` no vacío, y `server.ts:25-26` registra el usuario conectado. Hoy la garantía depende de `.env` (proceso). La regla "la app nunca como `postgres`" la puede vigilar quien opere (ESTADO); el ADR no es necesario porque no es contrato. Propuesta opcional (`be-a`): al arrancar, `SELECT rolsuper FROM pg_roles WHERE rolname = current_user` y abortar si es superusuario.
- **Auditoría (relacionado con la 020).** Ninguna de las 23 llamadas a `enTransaccion` en `modules/**` pasa `actor` (`pool.ts:55-61, 95`). Con la 020 aplicada, cada fila de `auditoria_cambio` tendrá `id_persona_actor` NULL (el *trigger* lo tolera, `020_auditoria.up.sql:67`). No es un defecto hoy (la 020 no está aplicada y PLANTILLA §2 dice "cuando `db` lo active"), pero hay que asignarlo antes de dar la 020 por útil (`be-a`/`be-b`).
- **`portadaUrl` (S6).** Ver S6.

## 6. Defectos comprobados

### D-01 · Lectura de disco con la fila `curso` bloqueada (`be-b`, interno, sin cambio de contrato)

**Regla:** REGLAS_EQUIPO, *SQL y datos*: "Nunca hay lecturas de disco con filas bloqueadas"; PLANTILLA_MODULO §2 (*service*: "lecturas de disco con filas bloqueadas" en la columna "No"); RG-30 y H3.

**Dónde:** `detallePrivado(cliente, id, prevalidados?)` (`detalle-privado.service.ts:130-183`) lee y valida con `pdf-lib` cada PDF del curso (`almacenLocal.existeYCoincide` → `leer` + `validarBytesPdf`) cuando no recibe `prevalidados`. Se la llama así **después** de bloquear la fila `curso` (`fichaRepository.base(…, true)` → `FOR UPDATE OF c`, `ficha.repository.ts:283`; o `conLeccionEditable` → `FOR UPDATE OF c, l`, `temario.repository.ts:388`) en:

| Operación | Llamada sin `prevalidados` |
|---|---|
| `PUT /modulos/:id` | `temario.service.ts:114` |
| `POST /modulos/:id/lecciones` | `temario.service.ts:158` |
| `PUT /lecciones/:id` | `temario.service.ts:210` |
| `DELETE /lecciones/:id` | `temario.service.ts:247` |
| `DELETE /modulos/:id` | `temario.service.ts:283` |
| `POST /lecciones/:id/archivo` | `contenido.service.ts:113` (dentro de `conLeccionEditable`) |

`crearCurso` (`cursos.service.ts:85`) también la llama sin `prevalidados`, pero el curso es nuevo y no tiene PDF: no lee nada. `obtenerMiCurso`, `actualizarMiCurso`, `enviarCursoARevision`, `crearModulo`, `detalleParaRevision` y `decidirRevision` sí prevalidan fuera del bloqueo. SEG-25 (`seguridad/fallos.test.ts:119`) solo retrasa `guardar`, así que no lo detecta.

**Reproducción:** `repro-bloqueo.test.mts`, fuera del repositorio. Retrasa `almacenLocal.leer` 1,5 s (el *seam* de RG-06) y, mientras tanto, ejecuta `SELECT 1 FROM curso WHERE id_curso = $1 FOR UPDATE NOWAIT` desde el pool de fixtures: `55P03` significa que la fila sigue bloqueada mientras se lee el disco. Comando: `npx tsx --env-file=.env.test --test --test-concurrency=1 repro-bloqueo.test.mts` (cwd `backend/`). Resultado: ver la §6.1.

**Impacto:** mientras se leen y parsean hasta 120 PDF de hasta 10 MiB, las demás escrituras sobre ese curso (otra pestaña del docente o la revisión del administrador) esperan, y la conexión queda ocupada (RG-37, pool de 10). No hay pérdida de datos ni exposición. Severidad media (P2 × I2 = 4, como RG-30).

**Corrección propuesta (`be-b`):** prevalidar fuera de la transacción y pasar `prevalidados`, igual que `crearModulo`:
- en `actualizarModulo`, `crearLeccion`, `actualizarLeccion`, `eliminarLeccion` y `eliminarModulo`, obtener antes el `idCurso` con una lectura sin bloqueo (`buscarModulo` o `buscarLeccionParaEditar` con el pool) y llamar a `prevalidarPdfCurso(idCurso)`. Dentro, comprobar que el `idCurso` bloqueado coincide (si no, 404, como hoy);
- en `subirValidado`, prevalidar el curso antes de `conLeccionEditable` y añadir a `prevalidados` la clave del PDF recién validado (`${archivoId}:${nombre}:${tamano}`, ya comprobado con `validarArchivoPdf`).

Lo que cambia: si entre la prevalidación y el bloqueo otro proceso cambia un PDF, `validacion.problemas` lo marcaría como no válido en esa respuesta. Es el mismo criterio que ya aceptan `enviarCursoARevision` y `decidirRevision`. Prueba que lo fija (`qa-edge`): la misma reproducción como SEG-25b en `seguridad/fallos.test.ts`, con `exigirLlamado()`.

### 6.1 Resultado de la reproducción

Ejecutada el 20-10-2026 con turno del lead (guarda APTO), sobre `b15f308`, cwd `backend/`. Se ejecutó dos veces seguidas (la primera para ver los fallos completos y la segunda para guardar el resumen), con el mismo resultado:

```
CONTROL GET {"codigo":"libre","status":200,"lecturas":1}
REPRO PUT /modulos/:id {"codigo":"55P03","status":200,"lecturas":1}
REPRO POST /modulos/:id/lecciones {"codigo":"55P03","status":201,"lecturas":1}
REPRO PUT /lecciones/:id {"codigo":"55P03","status":200,"lecturas":1}
REPRO POST /lecciones/:id/archivo {"codigo":"55P03","status":200,"lecturas":1}
ℹ tests 5 · pass 1 · fail 4 · duration_ms 19284.9
```

- **El control pasa:** `GET /docente/cursos/:id` prevalida fuera de la transacción y la fila queda libre mientras se lee el disco.
- **4 de 4 operaciones probadas confirman el defecto:** con `leer` dormido 1,5 s, la fila `curso` sigue bloqueada (`55P03 lock_not_available`). `lecturas: 1` muestra que el doble se ejecutó (SEG-27).
- `DELETE /lecciones/:id` y `DELETE /modulos/:id` siguen el mismo patrón (`temario.service.ts:247, 283`), pero no se probaron: al borrar la única lección con PDF no queda nada que leer. **NO VERIFICADO** en ejecución; se da por confirmado por lectura del código.
- **Residuos** tras las dos ejecuciones (consulta de solo lectura con el pool de fixtures): `{"persona":"0","usuario":"0","curso":"0","categoria":"0","archivo_sin_curso":"0","pendiente":"0"}`.

## 7. Riesgos de `RIESGOS.md` (H1–H11 y RG-01–RG-60)

H1 = RG-25, H2 = RG-02, H3 = RG-30, H4 = RG-43, H5 = RG-08, H6 = RG-23, H7 = RG-51, H8 = RG-36, H9 = RG-06, H10 = RG-05 y H11 = RG-24. El estado de `RIESGOS.md` es el de la Fase 1; esta tabla lo actualiza (el documento es de `qa-edge`).

| ID | Estado | Evidencia (archivo:línea, prueba, commit) | Acción |
|---|---|---|---|
| RG-01 | Cerrado | S1; GUA-01..06 | — |
| RG-02 | Cerrado | `env.ts:1` sigue cargando `dotenv`, pero la guarda síncrona va antes y `verificarBaseConectada` comprueba la conexión real (`bd-fixtures.ts:37`); GUA-04/05 | — |
| RG-03 | Mitigado | Las suites de `qa-edge` usan marca propia (`crearMarca`, `limpiarMarca`); `identidad.test.ts:40` sigue borrando por dominio `@pruebas.test`, que ninguna otra suite usa | — |
| RG-04 | Mitigado (proceso) | Turno del lead, `--test-concurrency=1` | — |
| RG-05 | Cerrado | R10b | — |
| RG-06 | Cerrado | Seam `almacenLocal.<método>` (`almacen.ts:30-38`) y `exigirLlamado` (`ayudas/fallos.ts:16-18`); SEG-27 | — |
| RG-07 | Cubierto hasta la 023 | CAR-CAT-15 (`caracterizacion/catalogo.test.ts:91,153-158`) | Ver RG-58 |
| RG-08 | Cerrado (11.10) | `middlewares.ts:31-35`; CAR-SOL-09/12 (`caracterizacion/solicitudes.test.ts:174-185`); `7f75337` | — |
| RG-09 | Cubierto | SEG-05 (`caracterizacion/identidad.test.ts:162`) | — |
| RG-10 | Cubierto | SEG-03 (`acceso.test.ts:80`) | — |
| RG-11 | Cubierto | SEG-01/02 (`acceso.test.ts:60,68`) | — |
| RG-12 | Cubierto | `acceso.test.ts:90` (IDOR de cursos, módulos, lecciones y archivos) y SEG-13 | — |
| RG-13 | Aceptado (CONGELADO) | S10 | — |
| RG-14 | Cubierto | CAR-CUR-05; `usuarios.service.ts:41` | — |
| RG-15 | Cubierto | CAR-GEN-08 (`general.test.ts:57`); `aprendizaje` y `evaluaciones` no se montan (`app.ts:69-78`) | — |
| RG-16 | Cubierto | Sin cambios | — |
| RG-17 | Cubierto | SEG-10 (`acceso.test.ts:165`) | — |
| RG-18 | Cubierto | `usuarios.service.ts:15-20` (bloqueo); CAR-SOL-06 | — |
| RG-19 | Cubierto | SEG-22 (`acceso.test.ts:176`) | — |
| RG-20 | Parcial | No existe SEG-11 (`PUT /cursos/:id` en paralelo con `enviar-revision`) | `qa-edge`: SEG-11 |
| RG-21 | Cubierto | SEG-12 (`acceso.test.ts:152`) | — |
| RG-22 | Cubierto | SEG-06 (`caracterizacion/identidad.test.ts:113`) | — |
| RG-23 | Cerrado (11.11) | `shared/http/esquemas.ts:11` (`idRuta`); paquete ID (`caracterizacion/catalogo.test.ts:256`); `e973995` | — |
| RG-24 | Cerrado (11.7) | `manejador-errores.ts:54-57`; CAR-CUR-08 y CAR-IDE-07; `4239550` | — |
| RG-25 | Cerrado (11.6) | `manejador-errores.ts:33-46`; CAR-GEN-05, 06 y 11; `6b377ee` | — |
| RG-26 | Cubierto | CAR-CAT-08..12; `catalogo.esquemas.ts:9-16` (`strictObject`, máximos) | — |
| RG-27 | Cubierto | Familia V (`caracterizacion/cursos.test.ts:290`, `revision.test.ts:172-174`) | — |
| RG-28 | Cubierto | SEG-23/23b; `subida-temporal.test.ts:88,108` | — |
| RG-29 | Cubierto | SEG-24 (`fallos.test.ts`) | — |
| RG-30 | **Abierto (D-01)** | §6 | `be-b` + `qa-edge` |
| RG-31 | Cubierto | SEG-26/26b (`fallos.test.ts:138,156`) | — |
| RG-32 | Cerrado (11.4 + 11.5) | S5 | — |
| RG-33 | Mitigado; sin prueba | `nombreOriginalPdf` (`pdf-validacion.ts:21-45`: `basename`, NFC, sin caracteres de control, ≤ 200); `res.attachment()` (`contenido.controller.ts:44`). No existen SEG-18 ni SEG-20 | `qa-edge`: SEG-18 y SEG-20 |
| RG-34 | Hueco | No existe SEG-21 (PDF de 5000 páginas) | `qa-edge`: SEG-21 |
| RG-35 | Cerrado | `pool.ts:82-111` (error original, `release(clienteRoto)` y listener); SEG-29a–d y SEG-30; `38ff6ae`, `c4c226b` | — |
| RG-36 | Cerrado (11.2) | S4 | — |
| RG-37 | Abierto (bajo) | `pool.ts:7-15`: `max: 10`, sin `statement_timeout`. D-01 lo agrava | Tras D-01, valorar `statement_timeout` (`be-b`, Fase 3 de carga) |
| RG-38 | Cerrado | `server.ts:25` → `salud.repository.ts:11-18`; `c9ab86c` | — |
| RG-39 | Cubierto | SEG-14 (`acceso.test.ts:116`); R5 | — |
| RG-40 | Mitigado; sin prueba | Igual que RG-33 | `qa-edge`: SEG-20 |
| RG-41 | Mitigado; sin prueba | `identidad.correos.ts:5-6` (`escapar`) en `nombres` y enlaces | `qa-edge`: SEG-16 |
| RG-42 | Cubierto | SEG-15 (`acceso.test.ts:133`); frontend sin `innerHTML` ni `bypassSecurityTrust` (grep de `frontend/src`: 0) | — |
| RG-43 | Parte H4 cerrada (11.8); parte S6 aceptada | S6 | — |
| RG-44 | Cerrado (11.3) | S4 | — |
| RG-45 | Cubierto, salvo CORS | SEG-07; CORS comprobado sin BD (§5) | `qa-edge`: SEG-08/09 |
| RG-46 | Cubierto | CAR-IDE-02 | — |
| RG-47 | Cerrado (11.1) | S4 | — |
| RG-48 | Cerrado en el código; sin prueba específica | S7 | `qa-edge`: SEG-17 |
| RG-49 | Cubierto | `acceso.test.ts:260` (`sinRutasPrivadas`); R8 | — |
| RG-50 | Cubierto | `identidad.test.ts:516`; `acceso.test.ts:260` | — |
| RG-51 | Cubierto | SEG-33 (`acceso.test.ts:227`) | — |
| RG-52 | Cerrado para la subida; el resto, aceptado | `contenido.routes.ts:15`; cursos y revisión siguen sin límite (fuera del ADR-011) | — |
| RG-53 | Cubierto en la ruta de respaldo; vistas NO VERIFICADO | §5, catálogo | Lead: suite completa tras la 026 en `learnity_test` |
| RG-54 | Parcial | Las rutas siguen el orden de PLANTILLA §3 (comprobado en los 6 `*.routes.ts`); `autorizarCarga` va antes de multer (`contenido.routes.ts:19-20`). No hay casos de precedencia explícitos para cada `:id` | `qa-edge` (no bloquea) |
| RG-55 | Cubierto | `validarCuerpo(…, 'Revisa los datos del módulo.')` (`cursos.routes.ts:52,61,78,87`); `caracterizacion/cursos.test.ts` fija los mensajes | — |
| RG-56 | Cerrado | R9 (§3) | — |
| RG-57 | Pendiente de la 024 | CAR-SOL-06 (`caracterizacion/solicitudes.test.ts:120`) seguirá fijando `SOLICITUD_PENDIENTE` porque el bloqueo del servicio se mantiene (`usuarios.service.ts:15`) | — |
| RG-58 | **Abierto** | La 023 sigue en `RETENIDAS.txt`. CAR-CAT-15 inserta un PUBLICADO sin `publicado_en` (`caracterizacion/catalogo.test.ts:91`): con la 023 aplicada, el `INSERT` falla | Lead/`db`: mantener la 023 retenida en la reconstrucción de `learnity_test`, o retirar CAR-CAT-15 en el mismo commit que la aplica |
| RG-59 | Pendiente de la 020 | Ninguna suite cuenta filas globales de auditoría (grep) | Ver *Auditoría* en la §5 (actor) |
| RG-60 | Abierto | `bd-fixtures.ts` hace `SET ROLE learnity_pruebas` si el rol existe; no existe `seguridad/privilegios.test.ts` | `qa-edge` + lead tras la 019 |

## 8. Errores documentales

**En `docs/refactor/ESTADO.md` (los corrige el lead, que es su dueño):**

| Línea | Dice | Debe decir | Evidencia |
|---|---|---|---|
| 22 y 49 | `POST /api/lecciones/:id/pdf` | `POST /api/lecciones/:id/archivo` | `contenido.routes.ts:13-14` |
| 49 | `limitadorSubidaPdf` | `limitarPorIp('subida-pdf', 30, 15)` (no existe ningún `limitadorSubidaPdf`) | `git grep limitadorSubidaPdf` → solo ESTADO.md |
| 49 | "10 subidas / 15 min" | 30 subidas cada 15 min; la 31.ª → 429 | `contenido.routes.ts:15`; ADR-011 §11.4; `openapi-revision-contenido.ts:140` |
| 22 y 49 | Verificado en `SEG-31` | Lo verifica **SEG-28** (`acceso.test.ts:193`). SEG-31 es "ninguna respuesta contiene hash ni ruta" (PLAN_PRUEBAS:501) | `acceso.test.ts:193-207` |
| 43 | "detecta en caché si existen las vistas" | Lo comprueba en **cada** petición, sin caché | `catalogo.repository.ts:108-113, 154, 162, 182, 191` |
| 14 | "se preservaron íntegramente los 4 commits de `refactor/be-a`" | Su contenido se reaplicó dentro de `7f75337`: `3ae193a`, `36ba961`, `ed3e027` y `4e4b8ca` **no** son ancestros de `integration/sprint-2` (`git merge-base --is-ancestor` → no). La rama `refactor/be-a` no está integrada por git | Conviene saberlo antes de borrar o comparar ramas |

**En mis archivos (corregidos en `refactor/revisor`):** `docs/api/COMPARACION_RUTAS.md` §5 seguía diciendo que la subida no tiene `limitarPorIp` y usa `memoryStorage`, y que `server.ts` consulta la base: se marca como superado y se añade la §7 con la verificación de la Fase 3. `README.md`, en las reglas de la subida de PDF, no mencionaba el límite por IP (11.4) ni la recepción en un temporal (11.5).

**En archivos de `qa-edge`:** `RIESGOS.md` conserva los estados de la Fase 1 (la tabla de la §7 los actualiza) y `PLAN_PRUEBAS.md` describe SEG-28 como "caracteriza que hoy no hay 429".

## 9. Otras observaciones (no bloquean)

1. **Propiedad de archivos en `7f75337`:** Antigravity editó pruebas de `qa-edge` (`caracterizacion/*`, `seguridad/*`) y de `be-a`/`be-b`. Revisé las aserciones que cambian: solo cambian las que aprobó el ADR-011 (11.4 → SEG-28, 11.8 → CAR-CUR-07/SEG-19 y 11.10 → CAR-SOL-12). El resto son imports a los `index.ts`. **No se rebajó ninguna expectativa.**
2. `backend/package.json` mantiene el script `test:integrante3` (nombre por persona; R11 solo mira `backend/src`, y `README.md:406,735` lo documenta). No lo cambio: es cosmético y cambiarlo tocaría la documentación del Sprint 2.
3. `pages/admin/usuarios` y las páginas congeladas siguen importando `datos-demo`, pero detrás de `environment.sprint34Habilitado` (`app.routes.ts:103-162`), de acuerdo con D4.

## 10. NO VERIFICADO

- La suite backend completa en `b15f308` (Antigravity informó 252/252; nadie la ha repetido de forma independiente). La ejecuta el lead.
- La ruta de las vistas del catálogo (requiere la 026 en `learnity_test`).
- El comportamiento de la app con la 019 aplicada (mínimo privilegio real) y con la 020 (auditoría sin actor).
- Que `openapi.yaml` se lea con un parser YAML (como en la Fase 1: lo verificado es `JSON.parse` + `deepStrictEqual`).
- Las E2E (son de `qa-edge`).
