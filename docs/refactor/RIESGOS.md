# Riesgos: cómo se rompe Learnity

- **Autor:** `qa-edge` (Fase 1). Rama `refactor/qa-edge`, base `3c3c159`.
- **Modo:** solo lectura del código. No se ejecutó ninguna prueba ni se tocó ninguna base. Lo que sale de leer el código sin ejecutarlo se marca **NO VERIFICADO** y se confirma en la Fase 2A con la prueba indicada.
- **Fuentes:** `docs/refactor/AUDITORIA_INICIAL.md` (§2, §4, §6 y §8), `docs/refactor/VERIFICACION_AUDITORIA.md`, `backend/src/**` y `backend/test/**`.
- **Casos:** los IDs (`GUA-`, `CAR-`, `REC-`, `SEG-`) están en `docs/refactor/PLAN_PRUEBAS.md`.

## 1. Cómo se prioriza

| Valor | Probabilidad (P) | Impacto (I) |
|---|---|---|
| 1 | Requiere un error poco común o una configuración atípica | Molestia, sin pérdida de datos ni exposición |
| 2 | Puede pasar en el uso normal o en un refactor razonable | Funcionalidad rota, dato incorrecto o fuga menor |
| 3 | Pasará si nadie lo vigila | Pérdida o borrado de datos, acceso indebido o fuga de datos privados |

**Puntuación = P × I.**

| Puntuación | Prioridad | Cuándo se prueba |
|---|---|---|
| 6–9 | **Alta** | Fase 2A, antes de refactorizar el módulo afectado |
| 3–4 | Media | Fase 2A si da tiempo; si no, en la 2B junto con su módulo |
| 1–2 | Baja | Fase 3 |

**Estado:**
- **Cubierto:** la suite actual lo prueba (se cita `archivo:línea`).
- **Hueco:** no hay prueba.
- **CONGELADO-INSEGURO:** el comportamiento actual es inseguro o erróneo, pero la caracterización lo fija tal cual (decisión del lead, 19-10-2026). La expectativa solo cambia en el mismo commit que aplica el ADR aprobado que lo corrige. No se dejan pruebas en rojo a propósito.

**¿Cambia el contrato?** "Sí" significa que cerrar el riesgo cambia rutas, códigos HTTP, cuerpos JSON o códigos de error: necesita un ADR (el lead lo reenvía al `arquitecto` para el ADR-011) y la aprobación del usuario. "No" significa un cambio interno.

## 2. Hallazgos nuevos de la Fase 1 (H1–H11)

Salen de leer el código en `3c3c159`. Ninguno se ha ejecutado: **NO VERIFICADO** hasta su caso de la Fase 2A.

| ID | Hallazgo | Evidencia | Riesgo | ¿Cerrarlo cambia el contrato? | Caso que lo confirma |
|---|---|---|---|---|---|
| H1 | Un JSON mal formado o un cuerpo de más de 1 MB devuelve **500 `ERROR_INTERNO`** (más `console.error`) en vez de 400/413: `manejadorErrores` no mira el `status` ni el `type` de los errores de `express.json` | `app.ts:28`; `manejador-errores.ts:16-50` | RG-25 | **Sí** (500 → 400/413) | CAR-GEN-05, CAR-GEN-06 |
| H2 | `env.ts:1` hace `import 'dotenv/config'`, que carga `backend/.env` como **respaldo**: cualquier clave que falte en `.env.test` (por ejemplo `DB_NAME`) toma el valor de `.env` (`Learnity`) | `shared/config/env.ts:1`; `--env-file=.env.test` en `package.json` (`test:local`) | RG-02 | No (interno) | GUA-04, GUA-05 |
| H3 | La subida **escribe el PDF en disco con filas bloqueadas**: `almacenPdf.guardar` se ejecuta dentro de `conLeccionEditable` (amplía A5/R4, que solo hablaba de lecturas) | `contenido.service.ts:89-138`; `cursos-integracion.service.ts:450` | RG-30 | No (interno) | SEG-25 |
| H4 | Hay **dos validaciones de portada distintas**: el esquema zod rechaza `..`, `?`, `#` y credenciales en la URL; `portadaValida` (revalidación al enviar y al aprobar) acepta cualquier ruta `/…` sin `//` ni `\` y cualquier URL `http(s)` | `cursos-gestion.esquemas.ts:12-31`; `cursos-integracion.service.ts:66-82` | RG-43 | **Sí** si se unifica la regla (se rechazarían cursos que hoy pasan) | CAR-CUR-07, SEG-19 |
| H5 | Los **roles viajan en el JWT**: tras aprobar una solicitud, el rol DOCENTE solo aparece después de un `refresh`. `sesionVigente` comprueba la sesión y `usuario.estado`, pero no los roles | `shared/auth/middlewares.ts:41-47`; `identidad.repository.ts:242-252` | RG-08 | **Sí** (hoy el token viejo recibe 403) | CAR-SOL-12 |
| H6 | Los IDs con `z.coerce.number()` **aceptan `1e3`, `0x10`, ` 7 ` y `7.0`** como números válidos | `cursos.controller.ts:23`; `contenido.controller.ts:19-23`; `administracion.esquemas.ts:3-7` | RG-23 | **Sí** (pasarían a 400) | paquete ID (PLAN §2.2) |
| H7 | `limitarPorIp` usa `req.ip` como clave: con `TRUST_PROXY=true`, la cabecera `X-Forwarded-For` se puede falsear y saltarse el límite. El contador vive en memoria (A12) | `limite-peticiones.ts:24`; `app.ts:23`; `env.ts:75` | RG-51 | No (configuración) | SEG-33 |
| H8 | `/api/salud` con la BD caída lanza un error no controlado: **500 genérico**, sin un estado "degradado" (además de S4) | `app.ts:35-40` | RG-36 | **Sí** (cambia el JSON o el código de `/salud`) | CAR-GEN-03 |
| H9 | Las pruebas actuales inyectan fallos **sustituyendo funciones de objetos internos** (`cursosService.asociarPdfPrincipal`, `almacenPdf.guardar` y `almacenPdf.eliminar`). Si el refactor convierte esos objetos en clases o inyecta dependencias, la sustitución deja de surtir efecto y la prueba puede **pasar sin inyectar el fallo** (falso verde) | `administracion-contenido.test.ts:888, 939-951, 960-974` | RG-06 | No (interno) | SEG-27 |
| H10 | `test:local` **enumera los archivos uno a uno**: las suites nuevas de `test/caracterizacion/**` y `test/seguridad/**` no se ejecutarían con `npm test` | `backend/package.json` (`test:local`) | RG-05 | No (interno; `package.json` es del `arquitecto`) | GUA-07 |
| H11 | Un texto con el carácter `\u0000` (NUL) pasa zod y PostgreSQL lo rechaza (`22021`, *invalid byte sequence*). Ese código no está mapeado en el manejador: **500** | `manejador-errores.ts:33-44`; esquemas zod sin filtro de NUL | RG-24 | **Sí** (500 → 400) | CAR-CUR-08, CAR-IDE-07 |

**Resumen para el ADR-011** (cambian el contrato): H1, H4, H5, H6, H8 y H11, más S4 (`/api/salud` y `/api/docs`), S5 (un 429 en la subida) y S6 (portada externa). **Internos:** H2, H3, H7, H9, H10, S7 y SQL-2 (`server.ts:36-47`).

## 3. Registro de riesgos

### 3.1 Entorno y datos de prueba

| ID | Riesgo | Evidencia | P | I | Pts | Mitigación y casos | ¿Contrato? | Estado | Dueño |
|---|---|---|---|---|---|---|---|---|---|
| RG-01 | **S1 agravado.** Dos suites corren sin la guarda `_test`: `identidad.test.ts` solo exige `NODE_ENV=test` y **borra todas las cuentas `@pruebas.test`**; `cursos-publicos.test.ts` admite `Learnity` con `LEARNITY_PRUEBA_LOCAL=true` | `identidad.test.ts:11-13, 113-120`; `cursos-publicos.test.ts:5-8` | 2 | 3 | **6** | `backend/test/ayudas/guardia-bd.ts`: `NODE_ENV=test`, `DB_NAME` terminado en `_test` y distinto de `Learnity`, **sin excepciones**. `be-a` y `be-b` la importan en sus suites. GUA-01 a GUA-06 | No | Hueco (mitigado hoy por el chequeo del lead antes de cada `npm test`) | `qa-edge` (guarda); `be-a`/`be-b` (importarla) |
| RG-02 | **H2.** `dotenv` completa con `.env` las claves que faltan en `.env.test`: si falta `DB_NAME`, la suite apuntaría a `Learnity` aunque la guarda de `process.env` se haya escrito bien | `env.ts:1` | 2 | 3 | **6** | La guarda tiene dos partes: (a) una comprobación síncrona de `process.env` **antes** de importar la app; (b) `verificarBaseConectada(pool)`, que hace `SELECT current_database()` sobre la conexión real y aborta si no termina en `_test` o si es `learnity` (sin distinguir mayúsculas). La (b) es la defensa definitiva. GUA-04, GUA-05 | No | Hueco | `qa-edge` |
| RG-03 | **Dominios compartidos entre suites.** `identidad.test.ts` borra **todo** `%@pruebas.test` (`usuario_rol`, `usuario` y `persona`). Una suite que use ese dominio perdería sus datos a mitad de ejecución, o se los borraría a otra | `identidad.test.ts:113-120` | 2 | 2 | 4 | **Las suites nunca comparten dominio.** Las de `qa-edge` usan `@caracterizacion.test`, con una marca única por suite (`<suite>_<timestamp>_<aleatorio>`), y borran solo las filas de su marca. Nunca borran por dominio completo. GUA-06 | No | Hueco | `qa-edge` |
| RG-04 | **Base compartida.** `learnity_test` es única para todo el equipo: dos ejecuciones a la vez se pisan datos y contadores | `REGLAS_EQUIPO.md` (Pruebas) | 2 | 2 | 4 | Turno del lead y `--test-concurrency=1`. Las ayudas no dependen de conteos globales (filtran por marca) | No | Mitigado por proceso | lead |
| RG-05 | **H10.** Las suites nuevas no entran en `npm test`: la red de seguridad existiría, pero nadie la ejecutaría | `package.json` (`test:local`) | 3 | 2 | **6** | El `arquitecto` añade `test/caracterizacion/**/*.test.ts` y `test/seguridad/**/*.test.ts` a `test:local` en la 2A. GUA-07 comprueba que el conteo de pruebas sube | No | Hueco | `arquitecto` |
| RG-06 | **H9.** Seams acoplados a internos: el refactor de `be-b` puede romper las pruebas de fallo o, peor, dejarlas en verde sin inyectar nada | `administracion-contenido.test.ts:888, 939-974` | 3 | 2 | **6** | La caracterización es **caja negra por HTTP**. Las pruebas de fallo comprueban que el fallo **se inyectó** (contador de llamadas > 0). Hay que acordar con `be-b` un seam estable para el disco y la BD. SEG-27 | No | Hueco | `qa-edge` + `be-b` |
| RG-07 | **Datos heredados que rompen reglas.** En `Learnity` hay 3 cursos `PUBLICADO` sin `revisado_por` ni `publicado_en`, y 3 lecciones `DOCUMENTO` sin PDF. Las suites crean datos propios y no ven estos casos, pero las restricciones nuevas de `db` y las vistas de D8 sí los afectan | Auditoría §6 (BD-4, BD-5); `cursos.repository.ts:74, 104` (`COALESCE(publicado_en, creado_en)` y `publicado_en DESC NULLS LAST`) | 2 | 2 | 4 | CAR-CAT-15 crea un curso publicado sin `publicado_en` y fija `publicadoEn` (= `creado_en`) y su posición en `orden=recientes` | No | Hueco | `qa-edge`; `db` |

### 3.2 Autenticación y sesión

| ID | Riesgo | Evidencia | P | I | Pts | Mitigación y casos | ¿Contrato? | Estado | Dueño |
|---|---|---|---|---|---|---|---|---|---|
| RG-08 | **H5.** Roles obsoletos en el JWT: un estudiante aprobado como docente recibe 403 en `/docente/*` hasta que hace `refresh`. Si algún día se revoca un rol, el token viejo lo conservaría hasta que caduque (`ACCESS_MINUTOS` ≤ 60) | `middlewares.ts:41-47`; `jwt.ts:12` | 2 | 1 | 2 | CAR-SOL-12 fija el 403 con el token viejo y el 200 tras el `refresh` | Sí | Hueco | `be-a` |
| RG-09 | **Refresh reutilizado o concurrente.** Reusar un refresh viejo revoca toda la familia; dos pestañas a la vez provocan `REFRESCO_CONCURRENTE` (409) | `openapi.ts:242-255`; `identidad.test.ts:348` | 2 | 2 | 4 | Reutilización: cubierta. SEG-05 añade dos `refresh` simultáneos con la misma cookie | No | Parcial | `be-a` |
| RG-10 | **Cuenta desactivada con un token vigente.** `sesionVigente` exige `u.estado = 'ACTIVO'`, así que la siguiente petición recibe 401 `SESION_REVOCADA` | `identidad.repository.ts:242-252`; `middlewares.ts:31-33` | 1 | 2 | 2 | SEG-03 | No | Hueco (el login inactivo está cubierto en `identidad.test.ts:254`) | `be-a` |
| RG-11 | **Token alterado, con otro algoritmo o caducado.** El algoritmo está fijado en `jwt.ts:19` | `jwt.ts:19`; `middlewares.ts:24-29` | 1 | 3 | 3 | Alterado: cubierto (`identidad.test.ts:284`). SEG-01 (`alg: none`, firma con otro secreto) y SEG-02 (caducado) | No | Parcial | `be-a` |

### 3.3 Autorización e IDOR

| ID | Riesgo | Evidencia | P | I | Pts | Mitigación y casos | ¿Contrato? | Estado | Dueño |
|---|---|---|---|---|---|---|---|---|---|
| RG-12 | **IDOR en las rutas con `:id`** (cursos, módulos, lecciones, archivos, revisión y solicitudes): un docente ajeno, un ESTUDIANTE o IDs enumerados. Al dividir Cursos (R2) es fácil perder una comprobación de propiedad | `cursos.service.ts:108-946` (A1: la cadena de guardas repetida 8 veces); `cursos-integracion.service.ts:430-529` | 2 | 3 | **6** | Paquetes AUT (PLAN §2.1) e IDOR (PLAN §2.3) sobre **cada** ruta con `:id`. Ya cubiertos: `cursos-gestion-http.test.ts:253, 267`; `administracion-contenido.test.ts:467, 680`. **Huecos:** PUT y DELETE de lección ajena, POST de lección en un módulo ajeno, `enviar-revision` de un curso ajeno, DELETE de módulo ajeno | No | Parcial | `qa-edge` |
| RG-13 | **S10.** Que el detalle privado distinga 404 de 403 permite saber si un ID existe. Lo acepta el plan ("403 o 404 coherente") | `cursos.service.ts:133-146` | 2 | 1 | 2 | CAR-CUR-04 fija 404 (no existe) y 403 (ajeno) | Sí, si se unifica | **CONGELADO-INSEGURO** (aceptado) | `be-b` |
| RG-14 | **Roles múltiples.** Un administrador no puede decidir su propia solicitud; un docente aprobado conserva ESTUDIANTE; un docente inactivo no consulta sus cursos | `solicitudes-docente.test.ts:178, 215`; `cursos.service.ts:140-146` (`docenteActivo`) | 1 | 2 | 2 | Cubierto en parte. CAR-CUR-05 (docente inactivo) | No | Parcial | — |
| RG-15 | **Rutas futuras expuestas por accidente.** Aprendizaje y Evaluaciones están congelados y sin rutas | `aprendizaje.routes.ts`; `evaluaciones.routes.ts` | 1 | 2 | 2 | CAR-GEN-08: las rutas previstas responden 404 `NO_ENCONTRADO` | No | Hueco | — |

### 3.4 Concurrencia

| ID | Riesgo | Evidencia | P | I | Pts | Mitigación y casos | ¿Contrato? | Estado | Dueño |
|---|---|---|---|---|---|---|---|---|---|
| RG-16 | **Dos administradores deciden lo mismo** (un curso o una solicitud) | `administracion-contenido.test.ts:1202`; `solicitudes-docente.test.ts:203` | 2 | 3 | 6 | Cubierto. La caracterización lo conserva | No | **Cubierto** | — |
| RG-17 | **Doble `enviar-revision` simultáneo.** Hay `FOR UPDATE`, pero ninguna prueba | `cursos-integracion.repository.ts:531-549, 623` | 2 | 2 | 4 | SEG-10: un 200 y un error (fijar el código observado) | No | Hueco | `qa-edge` |
| RG-18 | **Doble solicitud de docente.** Hoy la evita un bloqueo en el servicio; falta un índice único parcial en la BD | `administracion.service.ts:57-60`; auditoría §6 | 2 | 2 | 4 | Cubierto (`solicitudes-docente.test.ts:122`). La prueba debe seguir en verde si `db` añade el índice | No | **Cubierto** | `db` (índice) |
| RG-19 | **Dos subidas simultáneas a la misma lección.** Riesgo de dejar la lección con un PDF, un huérfano en disco o filas `archivo` de más | `contenido.service.ts:55-203` | 2 | 3 | **6** | SEG-22: dos POST a la vez; al final la lección tiene un solo archivo y se cumple el invariante filas = ficheros (§4) | No | Hueco | `qa-edge` |
| RG-20 | **El docente edita o sube mientras se envía o se revisa** | `administracion-contenido.test.ts:1235` (vuelve a comprobar el estado al subir) | 2 | 2 | 4 | SEG-11: PUT del curso en paralelo con `enviar-revision` | No | Parcial | `qa-edge` |
| RG-21 | **Orden duplicado en paralelo** (módulos o lecciones): el UNIQUE devuelve 409 vía `23505` | `manejador-errores.ts:28-31`; BD `UNIQUE (id_curso, orden)` | 2 | 2 | 4 | SEG-12: dos POST con el mismo `orden` dan 201 + 409 `CONFLICTO` | No | Hueco (el duplicado secuencial está cubierto en `cursos-gestion-http.test.ts:302`) | `qa-edge` |
| RG-22 | **Dos registros simultáneos con el mismo correo** | `identidad.test.ts:179` (secuencial) | 2 | 2 | 4 | SEG-06: 201 + 409 (fijar el código observado) | No | Hueco | `qa-edge` |

### 3.5 Entradas extremas

| ID | Riesgo | Evidencia | P | I | Pts | Mitigación y casos | ¿Contrato? | Estado | Dueño |
|---|---|---|---|---|---|---|---|---|---|
| RG-23 | **H6.** IDs aceptados con `coerce` | ver H6 | 2 | 1 | 2 | Paquete ID: `abc`, `0`, `-1`, `1.5`, `2147483648` → 400; `2147483647` → 404; `1e3`, `0x10`, ` 7 ` y `7.0` → se tratan como número | Sí | **CONGELADO-INSEGURO** | `be-a`/`be-b` |
| RG-24 | **Límites y unicode.** Título 150, descripción 10 000, listas 10 × 200, motivo 50–2000, observación y motivo de rechazo 300, `q` 100, `categoria` repetible ≤ 20. Emoji, NFC/NFD, RTL, caracteres de ancho cero y **NUL (H11)** | `cursos-gestion.esquemas.ts`; `administracion.esquemas.ts`; `cursos.controller.ts:11-21` | 2 | 2 | 4 | Familia X de cada endpoint (límite exacto y límite + 1). CAR-CUR-08 y CAR-IDE-07 (NUL) | Sí (H11) | Parcial (`cursos-gestion.test.ts` prueba algunos límites sin HTTP) | `qa-edge` |
| RG-25 | **H1.** JSON mal formado, cuerpo > 1 MB o `Content-Type` inesperado | ver H1 | 3 | 2 | **6** | CAR-GEN-05/06/07 fijan el 500 | Sí | **CONGELADO-INSEGURO** | `be-a` (ADR-011) |
| RG-26 | **Query strings anómalas:** `q` repetido (llega como array), `pagina=10000` con `limite=50`, parámetros desconocidos (`strictObject`) | `cursos.controller.ts:14-21`; `administracion.esquemas.ts:9-13, 34-36` | 2 | 1 | 2 | CAR-CAT-08 a CAR-CAT-12; CAR-REV-02; CAR-SOL-08 | No | Parcial (`cursos-publicos.test.ts:176`) | — |
| RG-27 | **Campos extra en el cuerpo.** `strictObject` los rechaza con 400; un refactor a `object()` los aceptaría en silencio | todos los esquemas | 2 | 1 | 2 | Familia V: un campo extra da 400 `SOLICITUD_INVALIDA` | No | Hueco | — |

### 3.6 Disco y archivos

| ID | Riesgo | Evidencia | P | I | Pts | Mitigación y casos | ¿Contrato? | Estado | Dueño |
|---|---|---|---|---|---|---|---|---|---|
| RG-28 | **Disco lleno o sin permiso** al guardar | `almacen-pdf.ts:62-76`; `contenido.service.ts:178-201` | 1 | 3 | 3 | Fallo genérico de escritura: cubierto (`administracion-contenido.test.ts:935`). SEG-23 simula `ENOSPC` y comprueba 500 `ERROR_INTERNO` con el mensaje "No se pudo guardar el PDF…", sin fila nueva y con el PDF anterior intacto | No | Parcial | `qa-edge` |
| RG-29 | **PDF ausente en disco** al descargarlo o al aprobar | `contenido.service.ts:205-235`; `almacen-pdf.ts:78` | 2 | 2 | 4 | Al aprobar: cubierto (`administracion-contenido.test.ts:1097`). SEG-24 fija el código de `GET /archivos/:id` cuando el fichero ya no existe (**NO VERIFICADO**: hoy no se sabe qué código devuelve) | No | Parcial | `qa-edge` |
| RG-30 | **H3 y A5.** Lectura y escritura de disco con filas bloqueadas: un disco lento alarga los bloqueos | `contenido.service.ts:89-138`; `cursos-integracion.service.ts:334-344, 413-418` | 2 | 2 | 4 | SEG-25: un `guardar` lento y, en paralelo, un GET del detalle privado; mide que la lectura no queda bloqueada más de X s (umbral a fijar en la 2A) | No | Hueco | `be-b` |
| RG-31 | **Huérfanos.** `archivo → curso ON DELETE CASCADE` borra metadatos pero no el disco; borrar una lección o un módulo deja el PDF en `archivo_borrado_pendiente`; si el proceso cae entre escribir y confirmar, queda la reserva de `programarNuevo` | Auditoría §6 (Huérfanos); `contenido.service.ts:83`; `administracion-contenido.test.ts:1419` | 2 | 2 | 4 | **Invariante §4** al final de cada suite que sube archivos. SEG-26 (borrar una lección con PDF por HTTP) | No | Parcial | `qa-edge` |
| RG-32 | **S5.** `memoryStorage` de 10 MiB por petición y sin límite por IP en la subida: N subidas simultáneas ocupan N × 10 MiB de RAM | `contenido.multipart.ts:15-25`; `contenido.routes.ts:18-25` | 2 | 2 | 4 | SEG-28 caracteriza que hoy no hay 429 tras N subidas | **Sí** (añadir un 429) | **CONGELADO-INSEGURO** | `be-b` (ADR-011) |
| RG-33 | **Nombre de archivo malicioso:** `..\\..\\x.pdf`, CRLF, control, unicode, más de 200 caracteres | `pdf-validacion.ts:20-40`; `contenido.controller.ts:88` (`attachment`) | 1 | 2 | 2 | Cubierto en parte (`pdf-validacion.test.ts:46`). SEG-20 comprueba el `Content-Disposition` de la descarga con nombres unicode y con comillas | No | Parcial | — |
| RG-34 | **PDF hostil:** políglota, JavaScript embebido, cifrado o miles de páginas (CPU de `pdf-lib`) | `pdf-validacion.ts` (`validarBytesPdf`) | 1 | 2 | 2 | SEG-21: comprueba el tiempo de respuesta con un PDF de 5000 páginas ≤ 10 MiB. La descarga sale como `attachment` y con `nosniff` | No | Hueco | Fase 3 |

### 3.7 Base de datos caída o transacción a medias

| ID | Riesgo | Evidencia | P | I | Pts | Mitigación y casos | ¿Contrato? | Estado | Dueño |
|---|---|---|---|---|---|---|---|---|---|
| RG-35 | **PostgreSQL corta la conexión a mitad de una transacción**: tiene que haber `ROLLBACK`, 500 y ningún estado parcial. Si la conexión ya murió, el `ROLLBACK` del `catch` también falla y **oculta el error original**, y `cliente.release()` se llama sin el error, así que el pool podría reutilizar un cliente roto (**NO VERIFICADO**) | `pool.ts:29-40` (`enTransaccion`) | 1 | 3 | 3 | Fallo de asociación: cubierto (`administracion-contenido.test.ts:875`). SEG-29 inyecta un fallo después de la primera escritura en crear módulo, decidir revisión y aprobar solicitud. SEG-30 usa `pg_terminate_backend(pid)` sobre la propia sesión: suele estar permitido sin superusuario para el mismo rol, pero **NO VERIFICADO** hasta la 2A. Si no se puede, se usa solo SEG-29 | No | Parcial | `qa-edge` |
| RG-36 | **H8.** `/api/salud` con la BD caída | `app.ts:35-40` | 1 | 1 | 1 | CAR-GEN-03 | Sí | **CONGELADO-INSEGURO** | `be-a` |
| RG-37 | **Pool agotado** (`max: 10`) por transacciones largas (A5, H3), sin `statement_timeout` | `pool.ts:6-14` | 1 | 2 | 2 | Fase 3 (carga) | No | Hueco | `be-b`/`db` |
| RG-38 | **SQL-2.** `server.ts:36-47` ejecuta SQL al arrancar, fuera de un repositorio. No hay datos del usuario | `server.ts:36-47` | 1 | 1 | 1 | Ninguna prueba: lo resuelve `be-a` (tarea 4 de la 2A) | No | — | `be-a` |

### 3.8 Inyección

| ID | Riesgo | Evidencia | P | I | Pts | Mitigación y casos | ¿Contrato? | Estado | Dueño |
|---|---|---|---|---|---|---|---|---|---|
| RG-39 | **SQL.** Hoy todo está parametrizado, pero hay fragmentos fijos interpolados (orden, `FOR UPDATE`, prefijos). Al migrar el catálogo a vistas (D8) o al dividir repositorios es fácil colar texto del cliente | `cursos.repository.ts:48-67, 102-127`; `cursos-integracion.repository.ts:623, 655`; `administracion.repository.ts:116-118` | 1 | 3 | 3 | SEG-14: `q` con `' OR 1=1 --`, `%`, `_`, `\` y `$1`; `categoria` con comillas. El total no cambia y no aparecen cursos que no son PUBLICADO. Orden fuera del enum → 400 | No | Parcial (`cursos-publicos.test.ts:176` prueba el enum) | `qa-edge` |
| RG-40 | **Cabeceras.** `Content-Disposition` usa el nombre original del PDF; el CRLF lo bloquea el filtro de caracteres de control | `pdf-validacion.ts:34-37`; `contenido.controller.ts:88` | 1 | 2 | 2 | SEG-20 | No | Hueco | — |
| RG-41 | **HTML en el correo.** Los nombres del usuario entran en la plantilla del correo de recuperación; hoy se escapan | `identidad.correos.ts:6, 14` | 1 | 2 | 2 | SEG-16: registro con `nombres = "<b>x</b>"`; el correo del buzón contiene `&lt;b&gt;` | No | Hueco | — |

### 3.9 XSS y contenido

| ID | Riesgo | Evidencia | P | I | Pts | Mitigación y casos | ¿Contrato? | Estado | Dueño |
|---|---|---|---|---|---|---|---|---|---|
| RG-42 | **XSS almacenado.** Títulos, descripción, objetivos, motivo de la solicitud, biografía y nombre del PDF se guardan y se devuelven sin modificar. Angular escapa por defecto y no hay `innerHTML` (F6) | Auditoría §5.2 F6 | 1 | 3 | 3 | SEG-15 (HTTP): la API devuelve el texto literal y `Content-Type: application/json`. E2E-03 (navegador, pendiente de D9): el payload se ve como texto | No | Hueco | `qa-edge`; `fe-a`/`fe-b` |
| RG-43 | **S6 y H4.** Portada externa (rastreo, contenido mixto) y dos validaciones distintas | ver H4 | 1 | 1 | 1 | CAR-CUR-07, SEG-19 | Sí | **CONGELADO-INSEGURO** | `be-b` |
| RG-44 | **S4.** Swagger UI público en cualquier entorno | `app.ts:43` | 3 | 1 | 3 | CAR-GEN-04: `GET /api/docs/` responde 200 con HTML | Sí | **CONGELADO-INSEGURO** | `be-a` (ADR-011) |

### 3.10 CSRF, origen y CORS

| ID | Riesgo | Evidencia | P | I | Pts | Mitigación y casos | ¿Contrato? | Estado | Dueño |
|---|---|---|---|---|---|---|---|---|---|
| RG-45 | **CSRF en las rutas que usan la cookie** (`/auth/refresh`, `/auth/logout`): doble envío firmado y `verificarOrigen` en todo `/auth`. Las rutas con `Bearer` no necesitan CSRF | `cookies-sesion.ts:46-76`; `identidad.routes.ts:20-29` | 1 | 3 | 3 | Cubierto (`identidad.test.ts:271, 339`). SEG-07: `Sec-Fetch-Site: cross-site` → 403 `ORIGEN_NO_PERMITIDO`; sin `Origin` → pasa. SEG-08: CORS con un origen no permitido no recibe `Access-Control-Allow-Origin` | No | Parcial | — |
| RG-46 | **Atributos de las cookies:** `learnity_rt` con HttpOnly, SameSite=Lax y Path=/api/auth; `XSRF-TOKEN` legible y con Path=/; Secure según `COOKIE_SECURE` | `cookies-sesion.ts:18-31` (opciones en `:18-20`) | 1 | 2 | 2 | Cubierto en parte (`identidad.test.ts:158`). CAR-IDE-02 fija todos los atributos | No | Parcial | — |

### 3.11 Exposición de información

| ID | Riesgo | Evidencia | P | I | Pts | Mitigación y casos | ¿Contrato? | Estado | Dueño |
|---|---|---|---|---|---|---|---|---|---|
| RG-47 | **S4.** `/api/salud` expone `current_database`, `current_user` y el número de roles a cualquier visitante | `app.ts:35-40` | 3 | 1 | 3 | CAR-GEN-01 fija `{ estado: 'ok', baseDeDatos: { base, usuario, roles } }` | Sí | **CONGELADO-INSEGURO** | `be-a` (ADR-011) |
| RG-48 | **S7.** `console.error(error)` incluye el `detail` de PostgreSQL. En `development`, `detalles` del 500 lleva `error.message` | `manejador-errores.ts:43-49` | 2 | 1 | 2 | CAR-GEN-05: con `NODE_ENV=test` no hay `detalles` en el 500 | No | Hueco | `be-a` |
| RG-49 | **`archivo.ruta` nunca sale en una respuesta** (2.3-d), y menos en el catálogo migrado a vistas (D8) | `cursos.repository.ts:69-78`; `cursos-integracion.service.ts:315-324` | 1 | 3 | 3 | **Recorrido profundo de cada JSON** de la caracterización: ninguna clave `ruta` y ningún valor con un nombre interno `<uuid>.pdf` ni con `PDF_DIR`. Lo aplica la ayuda `sinRutasPrivadas()` en todos los casos C | No | Parcial (`cursos-publicos.test.ts:161`; `administracion-contenido.test.ts:515, 1336`) | `qa-edge` |
| RG-50 | **Hash de la contraseña en una respuesta** | `identidad.test.ts:289` | 1 | 3 | 3 | Cubierto. La ayuda de recorrido profundo también busca `hash`, `contrasena` y `password` | No | **Cubierto** | — |

### 3.12 Límites de tasa

| ID | Riesgo | Evidencia | P | I | Pts | Mitigación y casos | ¿Contrato? | Estado | Dueño |
|---|---|---|---|---|---|---|---|---|---|
| RG-51 | **H7 y A12.** La clave del límite se puede falsear con `TRUST_PROXY`; el contador está en memoria | ver H7 | 1 | 2 | 2 | SEG-33 (con `TRUST_PROXY=false`, `X-Forwarded-For` no cambia la clave) | No | Hueco | `be-a` |
| RG-52 | **Rutas sin límite por IP:** solo hay 10 `limitarPorIp` (Identidad y la solicitud de docente). Cursos, contenido y revisión no tienen | `grep limitarPorIp` en `*.routes.ts` | 1 | 2 | 2 | Se caracteriza la ausencia de límite en la subida (SEG-28) | Sí, si se añade | CONGELADO-INSEGURO | `be-b` |

### 3.13 Riesgos del propio refactor

| ID | Riesgo | Evidencia | P | I | Pts | Mitigación y casos | ¿Contrato? | Estado | Dueño |
|---|---|---|---|---|---|---|---|---|---|
| RG-53 | **D8: el catálogo pasa a leer de vistas.** Pueden cambiar sin querer los campos, su orden, el desempate, el `COALESCE` de `publicadoEn`, los minutos redondeados, `totalPaginas = 0` cuando no hay resultados, y los filtros. Hoy **no** se filtra por categoría activa ni por docente activo en el catálogo ni en el detalle: solo `c.estado = 'PUBLICADO'` | `cursos.repository.ts:48-157`; `cursos.service.ts:30-53, 951-994` | 2 | 3 | **6** | JSON de referencia de CAR-CAT-01 a CAR-CAT-22 (PLAN §3.2 y §4) | No | Parcial | `qa-edge`; `be-a`; `db` |
| RG-54 | **Al dividir Cursos (R2) y romper el ciclo con Contenido** puede cambiar el **orden de las comprobaciones** (rol → validación del ID → existe → propietario → estado → cuerpo) y, con él, el código que recibe el cliente (400, 401, 403, 404 o 409) | `cursos.service.ts:108-946`; `contenido.routes.ts:18-25` (`autorizarCarga` antes de multer) | 3 | 3 | **9** | Casos de **precedencia** (PLAN §2.3): para cada ruta con `:id`, combinaciones que fijan qué error gana | No | Hueco | `qa-edge` |
| RG-55 | **A6: unificar la validación** cambiaría los mensajes y los `detalles`. Hoy Cursos responde `'Revisa los datos del módulo.'` / `'Revisa los datos de la lección.'` con `detalles[{campo, mensaje}]`; Identidad y Solicitudes responden con el `ZodError` del manejador (`'Revisa los datos enviados.'`) | `cursos.controller.ts:33-108`; `manejador-errores.ts:21-30`; `validar.ts` | 3 | 2 | **6** | Familia V: se fijan `codigo`, `mensaje` y los `campo` de `detalles` (no el texto de cada `mensaje` de zod, que cambia entre versiones) | Sí, si cambia el mensaje | Hueco | `qa-edge` |
| RG-56 | **El nuevo `openapi.yaml` y el comportamiento real divergen** | `shared/http/openapi*.ts` (33 operaciones) | 2 | 2 | 4 | Contraste final (PLAN §10) | — | Pendiente de `openapi.yaml` | `arquitecto` |

## 4. Invariantes que comprueba cada suite al terminar

1. **Filas = ficheros:** las filas `archivo` de la marca de la suite coinciden con los ficheros de `PDF_DIR` (una carpeta temporal por suite, como hace `administracion-contenido.test.ts`). Sin huérfanos en disco ni en la BD.
2. **Sin restos:** tras el `after`, no queda ninguna fila con la marca de la suite (`persona`, `usuario`, `curso`, `categoria`, `solicitud_docente`).
3. **Base correcta:** `verificarBaseConectada(pool)` se ejecuta en el `before` de cada suite.

## 5. Resumen

| Prioridad | Riesgos |
|---|---|
| Alta (≥ 6) | RG-01, RG-02, RG-05, RG-06, RG-12, RG-16 (cubierto), RG-19, RG-25, RG-53, RG-54, RG-55 |
| Media (3–4) | RG-03, RG-04, RG-07, RG-09, RG-11, RG-17, RG-18, RG-20, RG-21, RG-22, RG-24, RG-28, RG-29, RG-30, RG-31, RG-32, RG-35, RG-39, RG-42, RG-44, RG-45, RG-47, RG-49, RG-50, RG-56 |
| Baja (≤ 2) | RG-08, RG-10, RG-13, RG-14, RG-15, RG-23, RG-26, RG-27, RG-33, RG-34, RG-36, RG-37, RG-38, RG-40, RG-41, RG-43, RG-46, RG-48, RG-51, RG-52 |

**CONGELADO-INSEGURO:** RG-13, RG-23, RG-25, RG-32, RG-36, RG-43, RG-44, RG-47 y RG-52. Cada uno se cierra con el ADR-011 (o el que corresponda), y su expectativa cambia en el mismo commit que aplica ese ADR.
