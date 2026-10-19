# Plan de pruebas del refactor de Learnity

- **Autor:** `qa-edge` (Fase 1). Rama `refactor/qa-edge`, base `3c3c159`.
- **Qué es:** la matriz endpoint → casos de caracterización, más las pruebas de seguridad, el recorrido completo y la guarda de BD que `qa-edge` escribirá en la **Fase 2A**, antes de que nadie refactorice.
- **Riesgos:** los `RG-xx` y los hallazgos `H1–H11` están en `docs/refactor/RIESGOS.md`.
- **Regla de oro (decisión del lead, 19-10-2026):** la caracterización fija el comportamiento **actual**, aunque sea inseguro o erróneo. Esos casos llevan la marca **CONGELADO-INSEGURO**, el riesgo y el ADR que los corregiría. La expectativa solo cambia en el mismo commit que aplica ese ADR aprobado. No se dejan pruebas en rojo a propósito.
- **"Esperado actual":** lo que se deduce del código en `3c3c159`. Si dice **capturar**, el valor exacto se fija en la 2A ejecutando contra `learnity_test` y se guarda como referencia. Mientras no se ejecute, es **NO VERIFICADO**.

## 1. Convenciones

### 1.1 Familias de casos

| Familia | Qué fija |
|---|---|
| **C** Contrato | Código HTTP, **claves exactas y en orden** (`Object.keys` recursivo), tipos y cabeceras relevantes. Ids y fechas se normalizan. Todos los JSON pasan por `sinRutasPrivadas()` (RG-49, RG-50) |
| **V** Validación | 400 `SOLICITUD_INVALIDA`, `mensaje` y los `campo` de `detalles`. No se fija el texto de cada `mensaje` de zod, que cambia entre versiones (RG-55) |
| **A** Autenticación | Paquete AUT (§2.1) |
| **R** Rol | 403 `SIN_PERMISO` para cada rol no autorizado |
| **P** Propiedad e IDOR | Paquete IDOR (§2.2): docente ajeno, IDs enumerados, 404 frente a 403 |
| **E** Estado del curso | BORRADOR, RECHAZADO (editables), EN_REVISION, PUBLICADO y ARCHIVADO (409 `CURSO_BLOQUEADO`) |
| **K** Concurrencia | `Promise.all` de dos o más peticiones; se comprueba el estado final en la BD |
| **X** Extremos | Límite exacto y límite + 1, unicode, NUL, cadenas vacías y con espacios, IDs del paquete ID |
| **F** Fallo | Disco o BD que fallan a mitad (seam verificado, RG-06) |
| **S** Seguridad | Inyección, XSS, CSRF, origen, CORS y cabeceras |
| **PREC** Precedencia | Qué error gana cuando hay varios a la vez (RG-54) |

### 1.2 Identificadores

- `CAR-<MOD>-nn` (caracterización). Módulos: GEN, IDE, CAT, CUR, CON, REV y SOL.
- `SEG-nn` (seguridad), `REC-nn` (recorrido), `GUA-nn` (guarda de BD) y `E2E-nn` (navegador; depende de D9).
- **Existe:** prueba de la suite actual que ya lo cubre (`archivo:línea` de su `it(`). El nuevo caso la complementa: no la duplica ni la sustituye.

### 1.3 Dónde viven

| Carpeta | Contenido |
|---|---|
| `backend/test/ayudas/` | `guardia-bd.ts`, `servidor.ts` (app en un puerto efímero + `pedir()`), `sesiones.ts` (usuarios por rol), `datos.ts` (fábricas con la marca de la suite), `contrato.ts` (`forma()`, `normalizar()` y `sinRutasPrivadas()`), `archivos.ts` (PDF mínimo con `pdf-lib` + invariante filas = ficheros) |
| `backend/test/caracterizacion/` | Una suite por módulo: `general`, `identidad`, `catalogo`, `cursos`, `contenido`, `revision` y `solicitudes`. Más `recorrido.test.ts` (REC) |
| `backend/test/seguridad/` | SEG, agrupadas por categoría de `RIESGOS.md` |
| `e2e/` | Solo si se aprueba el ADR de `@playwright/test` (D9) |

**Datos.** Correo `<rol>.<marca>.<n>@caracterizacion.test`, con una marca única por suite. Cada suite borra solo las filas de su marca. **Nunca** se usa `@pruebas.test`: `identidad.test.ts` borra todo ese dominio (RG-03). Cada suite que sube archivos usa su propia carpeta temporal en `PDF_DIR`.

**Permisos de los fixtures (019, mínimo privilegio).** Pendiente de la Puerta 1 (lo propone `db` en `docs/bd/PLAN_BD.md`). La propuesta de `qa-edge` es un pool de fixtures en `ayudas/bd-fixtures.ts` que hace `SET ROLE learnity_pruebas`, con una pertenencia **sin herencia**, para que la app siga corriendo con el mínimo privilegio real (RG-60). `seguridad/privilegios.test.ts` compara los permisos directos de `learnity_app` con la matriz de `db`.

**Sesiones.** Por defecto, login real por HTTP (caja negra). Como el login tiene un límite por IP de 20 cada 15 min, se decide en la 2A entre (a) reutilizar las sesiones por suite y (b) usar `reiniciarLimites()`. Las suites actuales usan `firmarAccessToken` más una fila de `sesion`, pero eso depende de internos.

## 2. Paquetes comunes (pruebas guiadas por tabla)

### 2.1 Paquete AUT: 23 operaciones protegidas con `Bearer`

| ID | Petición | Esperado actual | Riesgo |
|---|---|---|---|
| AUT-1 | Sin `Authorization` | 401 `NO_AUTENTICADO` "Debes iniciar sesión." | RG-11 |
| AUT-2 | `Bearer` con la firma alterada | 401 `TOKEN_INVALIDO` | RG-11 |
| AUT-3 | Esquema distinto (`Basic …`) o `Bearer` sin token | 401 `NO_AUTENTICADO` | RG-11 |
| AUT-4 | Token de una sesión cerrada con `logout` | 401 `SESION_REVOCADA` | RG-10 |
| AUT-5 | Rol no autorizado (por cada rol: ESTUDIANTE, DOCENTE y ADMIN según la ruta) | 403 `SIN_PERMISO` | RG-12 |

Se aplica a: `GET/PUT /perfil`, `PUT /perfil/contrasena` (AUT-1 a 4; AUT-5 no aplica porque no hay `autorizar`), las 11 operaciones de gestión de cursos, las 2 de contenido, las 3 de revisión y las 4 de solicitudes (`/solicitudes-docente/mia` sin AUT-5). Ya existe en parte: `identidad.test.ts:284, 305`; `cursos-gestion-http.test.ts:253`; `administracion-contenido.test.ts:467`; `solicitudes-docente.test.ts:93, 132`.

### 2.2 Paquete ID: 15 rutas con `:id`

| ID | Valor de `:id` | Esperado actual | Riesgo |
|---|---|---|---|
| ID-1 | `abc`, `0`, `-1`, `1.5` | 400 `SOLICITUD_INVALIDA` | RG-23 |
| ID-2 | `2147483648` | 400 `SOLICITUD_INVALIDA` | RG-23 |
| ID-3 | `2147483647` (existe como entero, no en la BD) | 404 `NO_ENCONTRADO` | RG-23 |
| ID-4 | `1e3`, `0x10`, `%207%20`, `7.0` | Se tratan como 1000, 16, 7 y 7. **CONGELADO-INSEGURO** (RG-23, H6; ADR-011) | RG-23 |

Rutas: `GET /cursos/:id`, `GET /docente/cursos/:id`, `PUT /cursos/:id`, `POST /cursos/:id/modulos`, `PUT/DELETE /modulos/:id`, `POST /modulos/:id/lecciones`, `PUT/DELETE /lecciones/:id`, `POST /cursos/:id/enviar-revision`, `POST /lecciones/:id/archivo`, `GET /archivos/:id`, `GET /admin/cursos/:id`, `PUT /admin/cursos/:id/revision` y `PUT /admin/solicitudes/:id`. Ya existe en parte: `cursos-gestion-http.test.ts:353, 387`; `cursos-publicos.test.ts:176`; `administracion-contenido.test.ts:515`.

### 2.3 Paquete IDOR y precedencia

| ID | Caso | Esperado actual | Riesgo |
|---|---|---|---|
| IDOR-1 | Docente B sobre un recurso del docente A (curso, módulo, lección o archivo) | 403 (fijar `codigo` y `mensaje` por ruta: **capturar**) | RG-12 |
| IDOR-2 | ID ajeno existente frente a ID inexistente | 403 frente a 404. **CONGELADO-INSEGURO** (S10, RG-13) | RG-13 |
| IDOR-3 | ADMIN sin rol DOCENTE en una ruta de docente; DOCENTE en una ruta de ADMIN | 403 `SIN_PERMISO` | RG-12 |
| PREC-1 | ESTUDIANTE + `:id` inválido | 403 (`autorizar` va antes de validar el ID) | RG-54 |
| PREC-2 | Sin token + `:id` inválido | 401 | RG-54 |
| PREC-3 | Docente ajeno + cuerpo inválido (POST/PUT de curso, módulo o lección) | **400**: el controlador valida el cuerpo antes de que el servicio compruebe la propiedad | RG-54 |
| PREC-4 | Docente ajeno + curso PUBLICADO | 403 o 409: **capturar** | RG-54 |
| PREC-5 | Subida: `:id` inválido sin multipart → 400; lección ajena sin multipart → 403; lección propia sin multipart → 415 (`autorizarCarga` va antes de `recibirPdf`) | Según `contenido.routes.ts:18-25` | RG-54 |

## 3. Matriz endpoint → casos

### 3.0 General

**E00 · Cualquier ruta inexistente**

| ID | Fam. | Caso | Esperado actual | Riesgo | Existe |
|---|---|---|---|---|---|
| CAR-GEN-02 | C | `GET /api/no-existe`; `PATCH /api/cursos/1` | 404 `NO_ENCONTRADO` "La ruta GET /api/no-existe no existe." | — | — |
| CAR-GEN-08 | C | Rutas previstas congeladas: `POST /api/cursos/1/inscripcion`, `GET /api/mi-aprendizaje`, `PUT /api/lecciones/1/progreso`, `GET /api/evaluaciones/1`, `POST /api/evaluaciones/1/intentos` | 404 `NO_ENCONTRADO`. Ojo: `PUT /api/evaluaciones/1` también da 404 | RG-15 | — |

**E01 · `GET /api/salud`**

| ID | Fam. | Caso | Esperado actual | Riesgo | Existe |
|---|---|---|---|---|---|
| CAR-GEN-01 | C | Sin sesión | 200 `{ estado: 'ok', baseDeDatos: { base, usuario, roles } }`; `base` = `learnity_test`. **CONGELADO-INSEGURO** (S4; ADR-011) | RG-47 | — |
| CAR-GEN-03 | F | Con la consulta fallando (seam) | 500 `ERROR_INTERNO` "Ocurrió un error inesperado.", sin `detalles` en `test`. **CONGELADO-INSEGURO** (H8; ADR-011) | RG-36 | — |

**E02 · `GET /api/docs`**

| ID | Fam. | Caso | Esperado actual | Riesgo | Existe |
|---|---|---|---|---|---|
| CAR-GEN-04 | C | `GET /api/docs` y `GET /api/docs/` sin sesión | Redirección y 200 `text/html` (**capturar** el código de la redirección). **CONGELADO-INSEGURO** (S4; ADR-011) | RG-44 | — |

**Transversales** (se prueban sobre `POST /api/auth/login` y `POST /api/cursos`)

| ID | Fam. | Caso | Esperado actual | Riesgo | Existe |
|---|---|---|---|---|---|
| CAR-GEN-05 | X | JSON mal formado (`{`) | **500** `ERROR_INTERNO`, sin `detalles`. **CONGELADO-INSEGURO** (H1 = C-14; ADR-011, punto 11.6) | RG-25, RG-48 | — |
| CAR-GEN-06 | X | Cuerpo JSON > 1 MB | **500** (**capturar**; body-parser lo marca como 413 `entity.too.large`, pero el manejador lo ignora). **CONGELADO-INSEGURO** (H1 = C-14) | RG-25 | — |
| CAR-GEN-11 | X | `Content-Type: application/json; charset=latin1` con cuerpo válido | **500** (**capturar**; body-parser lo marca como 415 `charset.unsupported`). **CONGELADO-INSEGURO** (C-14) | RG-25 | — |
| CAR-GEN-07 | X | `Content-Type: text/plain` con cuerpo JSON | **Capturar** (previsto: 400 por `req.body` vacío; se captura ejecutándolo en la 2A) | RG-25 | — |
| CAR-GEN-09 | S | Cabeceras de `helmet` en cualquier respuesta | `X-Content-Type-Options: nosniff`, sin `X-Powered-By`, `Content-Security-Policy` presente (**capturar** su valor) | RG-42 | — |
| CAR-GEN-10 | C | Forma de todo error | `{ error: { codigo, mensaje, detalles? } }` y nada más | RG-55 | Implícito en varias |

### 3.1 Identidad

**E03 · `POST /api/auth/registro`**

| ID | Fam. | Caso | Esperado actual | Riesgo | Existe |
|---|---|---|---|---|---|
| CAR-IDE-01 | C | Registro válido | 201 `{ accessToken, expiraEn, usuario }` (**capturar** las claves de `usuario`); rol ESTUDIANTE | — | `identidad.test.ts:158` |
| CAR-IDE-02 | C | Cookies emitidas | `learnity_rt`: HttpOnly, SameSite=Lax, Path=/api/auth, `Expires`; `XSRF-TOKEN`: sin HttpOnly, Path=/; `Secure` según `COOKIE_SECURE` | RG-46 | `identidad.test.ts:158` (parcial) |
| CAR-IDE-03 | V | Correo ya registrado (con otras mayúsculas) | 409 `CONFLICTO` "Ese correo ya está registrado. Inicia sesión o recupera tu contraseña." | — | `identidad.test.ts:179` |
| CAR-IDE-04 | V | Política de contraseña | 400, `detalles[0].campo = 'contrasena'` | — | `identidad.test.ts:186` |
| CAR-IDE-05 | V | Falta un campo; campo extra | 400 `SOLICITUD_INVALIDA` "Revisa los datos enviados.", `detalles[].campo` | RG-27, RG-55 | — |
| CAR-IDE-06 | X | `nombres`/`apellidos` de 80 y 81 caracteres; emoji; NFD | 201 con 80 / 400 con 81; **capturar** la normalización | RG-24 | — |
| CAR-IDE-07 | X | `nombres` con `\u0000` | **Capturar** (previsto: 500 por H11). Si da 500: **CONGELADO-INSEGURO** (ADR-011) | RG-24 | — |
| CAR-IDE-08 | S | `Origin` no permitido | 403 `ORIGEN_NO_PERMITIDO` | RG-45 | `identidad.test.ts:271` |
| CAR-IDE-09 | X | 11.º registro desde la misma IP en 60 min | 429 `DEMASIADAS_PETICIONES` + `Retry-After` + `detalles.reintentarEnSegundos` | RG-51 | — |

**E04 · `POST /api/auth/login`**

| ID | Fam. | Caso | Esperado actual | Riesgo | Existe |
|---|---|---|---|---|---|
| CAR-IDE-10 | C | Credenciales correctas | 200, la misma forma que CAR-IDE-01, más las cookies de CAR-IDE-02 | — | `identidad.test.ts:217` |
| CAR-IDE-11 | V | Correo inexistente o contraseña errónea | 401 `CREDENCIALES_INVALIDAS`, cuerpo idéntico en los dos casos | — | `identidad.test.ts:225` |
| CAR-IDE-12 | E | 5 fallos seguidos | Bloqueo de 15 min con el mismo mensaje genérico | — | `identidad.test.ts:234` |
| CAR-IDE-13 | E | Cuenta desactivada | 403 `CUENTA_INACTIVA` solo con la contraseña correcta; con la errónea, 401 | RG-10 | `identidad.test.ts:254` |
| CAR-IDE-14 | X | 21.º intento en 15 min | 429 + `Retry-After` | RG-51 | `identidad.test.ts:264` |
| CAR-IDE-15 | V | Cuerpo inválido; origen ajeno | 400; 403 | RG-45 | `identidad.test.ts:271` |
| CAR-IDE-16 | X | Correo con mayúsculas y espacios alrededor | **Capturar** si normaliza | RG-24 | — |

**E05 · `POST /api/auth/refresh`**

| ID | Fam. | Caso | Esperado actual | Riesgo | Existe |
|---|---|---|---|---|---|
| CAR-IDE-20 | C | Cookie y CSRF válidos | 200, la forma de la sesión; rota `learnity_rt` y `XSRF-TOKEN` | RG-09 | `identidad.test.ts:348` |
| CAR-IDE-21 | A | Sin cookie | 401 `SESION_INVALIDA` y borra las cookies | — | `identidad.test.ts:339` |
| CAR-IDE-22 | S | CSRF ausente, falso o de otra sesión | 403 `CSRF_INVALIDO` | RG-45 | `identidad.test.ts:339` (ausente y falso) |
| CAR-IDE-23 | S | Reutilizar un refresh viejo | 401 y la familia queda revocada | RG-09 | `identidad.test.ts:348` |
| CAR-IDE-24 | C | Refresh tras aprobar la solicitud de docente | `usuario.roles` incluye DOCENTE (enlaza con CAR-SOL-12) | RG-08 | — |

**E06 · `POST /api/auth/logout`**

| ID | Fam. | Caso | Esperado actual | Riesgo | Existe |
|---|---|---|---|---|---|
| CAR-IDE-25 | C | Con cookie y CSRF | 204 sin cuerpo; borra las cookies; el access token pasa a 401 `SESION_REVOCADA` | RG-10 | `identidad.test.ts:373` |
| CAR-IDE-26 | A | Sin cookie | **Capturar** (`exigirCsrf` deja pasar; previsto: 204) | — | — |
| CAR-IDE-27 | S | CSRF falso | 403 `CSRF_INVALIDO` | RG-45 | — |

**E07 · `POST /api/auth/recuperar`**

| ID | Fam. | Caso | Esperado actual | Riesgo | Existe |
|---|---|---|---|---|---|
| CAR-IDE-30 | C | Correo existente frente a inexistente | 202 con el mismo `{ mensaje }`; solo se escribe correo en el buzón para la cuenta real | — | `identidad.test.ts:419` |
| CAR-IDE-31 | E | Más de 3 enlaces por hora | Sigue respondiendo 202, pero no envía más | — | `identidad.test.ts:462` |
| CAR-IDE-32 | V | Correo inválido; campo extra | 400 | RG-27 | — |
| CAR-IDE-33 | X | 6.º intento en 15 min desde la misma IP | 429 + `Retry-After` | RG-51 | — |

**E08 · `POST /api/auth/restablecer`**

| ID | Fam. | Caso | Esperado actual | Riesgo | Existe |
|---|---|---|---|---|---|
| CAR-IDE-35 | C | Token válido | 200 `{ mensaje }`; revoca las sesiones anteriores; el token no se puede reutilizar | — | `identidad.test.ts:431` |
| CAR-IDE-36 | V | Token vencido, inventado o anterior a uno nuevo | 400, `detalles[0].campo = 'token'` | — | `identidad.test.ts:462` |
| CAR-IDE-37 | V | Token válido + contraseña débil | 400 `campo = 'contrasena'`; **capturar** si el token queda consumido | — | — |

**E09 · `GET /api/perfil`** · AUT-1 a 4

| ID | Fam. | Caso | Esperado actual | Riesgo | Existe |
|---|---|---|---|---|---|
| CAR-IDE-40 | C | Con sesión | 200 perfil (**capturar** las claves); sin hash | RG-50 | `identidad.test.ts:289` |
| CAR-IDE-44 | E | C-07: 404 "La cuenta no existe." (`identidad.service.ts:337-347`) | **Capturar** si se puede alcanzar: `sesionVigente` exige que exista la fila de `usuario`, así que es probable que gane antes el 401 `SESION_REVOCADA`. Si es inalcanzable por HTTP, se anota así y se informa al `arquitecto` | — | — |

**E10 · `PUT /api/perfil`** · AUT-1 a 4

| ID | Fam. | Caso | Esperado actual | Riesgo | Existe |
|---|---|---|---|---|---|
| CAR-IDE-41 | C | Actualización válida | 200 perfil actualizado | — | `identidad.test.ts:289` |
| CAR-IDE-42 | X/V | `nombres` 80/81, `ciudad` 60/61, `biografia` 300/301, `null` permitido en ciudad y biografía, campo extra | 200 / 400 | RG-24, RG-27 | — |
| CAR-IDE-43 | S | `biografia = "<img src=x onerror=alert(1)>"` | 200; se devuelve literal (ver SEG-15) | RG-42 | — |

**E11 · `PUT /api/perfil/contrasena`** · AUT-1 a 4

| ID | Fam. | Caso | Esperado actual | Riesgo | Existe |
|---|---|---|---|---|---|
| CAR-IDE-45 | C | Cambio válido | 200 `{ mensaje }`; cierra las demás sesiones, no la actual | — | `identidad.test.ts:392` |
| CAR-IDE-46 | V | Contraseña actual incorrecta; nueva débil | 400 `campo = 'actual'` / `'nueva'` | — | `identidad.test.ts:392` |
| CAR-IDE-47 | X | 11.º intento en 15 min | 429 | RG-51 | — |

### 3.2 Catálogo público (D8: JSON de referencia, ver §4)

**E12 · `GET /api/categorias`**

| ID | Fam. | Caso | Esperado actual | Riesgo | Existe |
|---|---|---|---|---|---|
| CAR-CAT-01 | C | Lista | 200 `[{ id, nombre }]` (solo esas claves, en ese orden), ordenado por `nombre ASC, id ASC` | RG-53 | `cursos-publicos.test.ts:114` (parcial) |
| CAR-CAT-02 | E | Categoría inactiva | No aparece | RG-53 | `cursos-publicos.test.ts:114` |
| CAR-CAT-03 | X | Nombres con tildes, mayúsculas y ñ | **Capturar** el orden según la *collation* de `learnity_test` | RG-53 | — |

**E13 · `GET /api/cursos`**

| ID | Fam. | Caso | Esperado actual | Riesgo | Existe |
|---|---|---|---|---|---|
| CAR-CAT-04 | C | Página con resultados | 200 `{ items, pagina, limite, total, totalPaginas }` (ese orden). Cada item: `id, titulo, subtitulo, categoria{id, nombre}, docente, nivel, portadaUrl, modulos, lecciones, minutos, publicadoEn, estado:'PUBLICADO'` (`cursos.service.ts:30-53`) | RG-53 | — |
| CAR-CAT-05 | C | Sin parámetros | `pagina = 1`, `limite = 9`, `orden = recientes` | RG-53 | — |
| CAR-CAT-06 | C | `orden=recientes\|populares\|az` | `publicado_en DESC NULLS LAST, id DESC` · `inscripciones DESC, id DESC` · `titulo ASC, id ASC` | RG-53 | `cursos-publicos.test.ts:152` (populares) |
| CAR-CAT-07 | C | `categoria` y `nivel` repetidos | OR dentro de cada grupo, AND entre grupos | RG-53 | `cursos-publicos.test.ts:137` |
| CAR-CAT-08 | X | `q` repetido (`q=a&q=b`) | 400 | RG-26 | — |
| CAR-CAT-09 | X | `limite=0\|51`, `pagina=0\|10001`, `limite=abc`; y `limite=50`, `pagina=10000` | 400 / 200 | RG-26 | `cursos-publicos.test.ts:176` (parcial) |
| CAR-CAT-10 | V | Parámetro desconocido; `nivel=EXPERTO`; `orden=otro`; 21 valores de `categoria`; `q` de 101 caracteres | 400 | RG-26 | `cursos-publicos.test.ts:176` (parcial) |
| CAR-CAT-11 | C | `pagina` mayor que `totalPaginas` | 200 `items: []`, con `total` y `totalPaginas` reales | RG-53 | — |
| CAR-CAT-12 | C | Sin resultados | 200 `items: []`, `total: 0`, `totalPaginas: 0` | RG-53 | `cursos-publicos.test.ts:122` (parcial) |
| CAR-CAT-13 | S | `q` con `%`, `_`, `\` | Se buscan literales (`ESCAPE`) | RG-39 | — |
| CAR-CAT-14 | E | Solo PUBLICADO cuenta y se lista | BORRADOR, EN_REVISION, RECHAZADO y ARCHIVADO quedan fuera del `total` | RG-53 | `cursos-publicos.test.ts:122` |
| CAR-CAT-15 | E | PUBLICADO sin `publicado_en` (dato heredado) | `publicadoEn` = `creado_en` en ISO; va **al final** en `recientes` (NULLS LAST). Vale **hasta la migración 023** (CHECK de PUBLICADO): se retira en el mismo commit que la aplica a `learnity_test` (RG-58) | RG-07, RG-53, RG-58 | — |
| CAR-CAT-16 | E | PUBLICADO en una categoría inactiva; PUBLICADO de un docente inactivo | **Aparecen** hoy: no hay filtro (`cursos.repository.ts:48-67`); **capturar** | RG-53 | — |
| CAR-CAT-17 | C | `minutos` | `Math.round(segundos / 60)` con la suma de `archivo.duracion_seg` (DOCUMENTO sin duración → 0) | RG-53 | — |

**E14 · `GET /api/cursos/:id`** · paquete ID

| ID | Fam. | Caso | Esperado actual | Riesgo | Existe |
|---|---|---|---|---|---|
| CAR-CAT-18 | C | Curso PUBLICADO | 200 con las claves de CAR-CAT-04 + `descripcion, docenteBio, objetivos, requisitos, temario[{ id, orden, titulo, lecciones[{ id, orden, titulo, tipo, minutos }] }]` (`cursos.service.ts:971-994`) | RG-53 | `cursos-publicos.test.ts:161` (parcial) |
| CAR-CAT-19 | E | BORRADOR, EN_REVISION, RECHAZADO y ARCHIVADO | 404 `NO_ENCONTRADO` "Curso no disponible." | RG-53 | `cursos-publicos.test.ts:161` (BORRADOR) |
| CAR-CAT-20 | S | Recorrido profundo del JSON | Sin `ruta`, sin `<uuid>.pdf`, sin `PDF_DIR` | RG-49 | `cursos-publicos.test.ts:161` |
| CAR-CAT-21 | C | Módulo sin lecciones; orden del temario | `lecciones: []`; orden `m.orden, m.id_modulo, l.orden, l.id_leccion` | RG-53 | — |
| CAR-CAT-22 | E | PUBLICADO en categoría inactiva o de un docente inactivo | **Capturar** (previsto: 200) | RG-53 | — |

### 3.3 Gestión de cursos (docente)

**E15 · `GET /api/docente/cursos`** · AUT-1 a 5 · **HUECO: no hay ninguna prueba HTTP** (confirmado con grep en `backend/test/*.ts`: solo aparece `/api/docente/cursos/${id}`)

| ID | Fam. | Caso | Esperado actual | Riesgo | Existe |
|---|---|---|---|---|---|
| CAR-CUR-01 | C | Docente con cursos en los 5 estados | 200 solo con sus cursos, con estado y `motivoRechazo` (**capturar** la forma y el orden; `cursos-integracion.repository.ts:50-77`) | RG-12 | — |
| CAR-CUR-02 | C | Docente sin cursos | **Fijado (2A):** 200 `{ items: [] }` (objeto, no array). La lista llega ordenada por id descendente; cada item: `id, titulo, estado, motivoRechazo, docente, modulos` | — | — |
| CAR-CUR-30 | P | No incluye cursos de otro docente | Solo los propios | RG-12 | — |

**E16 · `GET /api/docente/cursos/:id`** · AUT-1 a 5 · paquete ID

| ID | Fam. | Caso | Esperado actual | Riesgo | Existe |
|---|---|---|---|---|---|
| CAR-CUR-03 | C | Curso propio | 200 CursoDetalle privado (**capturar**); `archivo` sin `ruta` | RG-49 | `cursos-gestion-http.test.ts:396` (parcial) |
| CAR-CUR-04 | P | Inexistente frente a ajeno | 404 "Curso no disponible." frente a 403 "No tienes permiso para consultar este curso.". **CONGELADO-INSEGURO** (S10) | RG-13 | — |
| CAR-CUR-05 | P | Docente desactivado (`docente.estado = INACTIVO`) | **Fijado (2A):** `GET /docente/cursos` → 200 `{ items: [] }`; `POST /cursos` → 403 `SIN_PERMISO` "No tienes un perfil docente activo." | RG-14 | — |

**E17 · `POST /api/cursos`** · AUT-1 a 5

| ID | Fam. | Caso | Esperado actual | Riesgo | Existe |
|---|---|---|---|---|---|
| CAR-CUR-06 | C | Curso válido | 201 CursoDetalle en BORRADOR (**capturar**) | — | `cursos-gestion-http.test.ts` (lo usan las fixtures) |
| CAR-CUR-07 | X | `portadaUrl`: `/img/a.png` → 201; `//x`, `/a/../b`, `/a?b`, `javascript:x`, `https://u:p@x` → 400; `https://externo` → 201 | Según `cursos-gestion.esquemas.ts:11-31`. **CONGELADO-INSEGURO** la URL externa (S6) | RG-43 | — |
| CAR-CUR-08 | X | `titulo` con `\u0000` | **Fijado (2A):** 500 `ERROR_INTERNO`. **CONGELADO-INSEGURO** (H11; ADR-011, punto 11.7) | RG-24 | — |
| CAR-CUR-09 | V/X | `titulo` 150/151 y vacío tras `trim`; `descripcion` 10 000/10 001; 10/11 objetivos; objetivo de 200/201; `categoriaId: "1"` (string); `nivel` fuera del enum; campo extra | 201 / 400 "Revisa los datos enviados." con `detalles[].campo` | RG-24, RG-27, RG-55 | `cursos-gestion.test.ts:28-65` (sin HTTP) |
| CAR-CUR-10 | E | Categoría inactiva o inexistente | **Capturar** (400 o 404) | — | — |

**E18 · `PUT /api/cursos/:id`** · AUT · ID · IDOR · PREC-3 · PREC-4

| ID | Fam. | Caso | Esperado actual | Riesgo | Existe |
|---|---|---|---|---|---|
| CAR-CUR-11 | C | Edición válida en BORRADOR | 200 CursoDetalle | — | — |
| CAR-CUR-12 | E | RECHAZADO → 200; EN_REVISION, PUBLICADO y ARCHIVADO → 409 `CURSO_BLOQUEADO` "El curso no permite modificaciones." | Según `cursos.service.ts:236-242` | RG-54 | `cursos-gestion-http.test.ts:280` (PUBLICADO) |
| CAR-CUR-13 | P | Curso de otro docente | 403 | RG-12 | `cursos-gestion-http.test.ts:267` |

**E19 · `POST /api/cursos/:id/modulos`** · AUT · ID · IDOR · PREC-3

| ID | Fam. | Caso | Esperado actual | Riesgo | Existe |
|---|---|---|---|---|---|
| CAR-CUR-14 | C | Módulo válido | 201 CursoDetalle con el módulo | — | `cursos-gestion-http.test.ts:302` (fixture) |
| CAR-CUR-15 | V/X | `orden` 1 y 10 → 201; 0 y 11 → 400 "Revisa los datos del módulo."; orden duplicado → **400 `SOLICITUD_INVALIDA`** "El orden del módulo ya está ocupado." (corregido en la 2A: no es 409; el 409 `CONFLICTO` solo sale en una carrera, SEG-12); curso bloqueado → 409 `CURSO_BLOQUEADO` | — | RG-21, RG-55 | `cursos-gestion-http.test.ts:302` (duplicado) |

**E20 · `PUT /api/modulos/:id`** · AUT · ID · IDOR (**hueco**) · PREC-3

| ID | Fam. | Caso | Esperado actual | Riesgo | Existe |
|---|---|---|---|---|---|
| CAR-CUR-16 | C | Edición válida; conservar su propio orden | 200 | — | `cursos-gestion-http.test.ts:402` |
| CAR-CUR-17 | E/K | Orden de otro módulo → **400 `SOLICITUD_INVALIDA`** (no 409, ver CAR-CUR-15); módulo eliminado entre la búsqueda y el bloqueo → 404 `NO_ENCONTRADO`; curso bloqueado → 409 | — | RG-21 | `cursos-gestion-http.test.ts:402, 497` |
| CAR-CUR-31 | P | Módulo de un curso ajeno | 403 (**capturar**) | RG-12 | — |

**E21 · `DELETE /api/modulos/:id`** · AUT · ID · IDOR (**hueco**)

| ID | Fam. | Caso | Esperado actual | Riesgo | Existe |
|---|---|---|---|---|---|
| CAR-CUR-18 | C | Borrado válido | 200 CursoDetalle sin el módulo | — | `cursos-gestion-http.test.ts:550` (dentro de la prueba de carrera) |
| CAR-CUR-19 | E | Curso bloqueado → 409; inexistente → 404; con lecciones y PDF → se borran y la fila `archivo` desaparece; **fijado (2A):** `archivo_borrado_pendiente` queda en 0 en el camino feliz (limpieza inmediata) (SEG-26) | — | RG-31 | — |
| CAR-CUR-32 | P | Módulo ajeno | 403 (**capturar**) | RG-12 | — |

**E22 · `POST /api/modulos/:id/lecciones`** · AUT · ID · IDOR (**hueco**) · PREC-3

| ID | Fam. | Caso | Esperado actual | Riesgo | Existe |
|---|---|---|---|---|---|
| CAR-CUR-20 | C | Lección DOCUMENTO válida | 201 CursoDetalle | — | `cursos-gestion-http.test.ts:445` (fixture) |
| CAR-CUR-21 | V/E | `tipo` VIDEO o EVALUACION → 400 "Revisa los datos de la lección."; `orden` 12 → 201 y 13 → 400; duplicado → **400 `SOLICITUD_INVALIDA`** "El orden de la lección ya está ocupado." (no 409; ver CAR-CUR-15); curso bloqueado → 409 | — | RG-21, RG-55 | `cursos-gestion.test.ts:109-131` (sin HTTP) |
| CAR-CUR-33 | P | Módulo ajeno | 403 (**capturar**) | RG-12 | — |

**E23 · `PUT /api/lecciones/:id`** · AUT · ID · IDOR (**hueco**) · PREC-3

| ID | Fam. | Caso | Esperado actual | Riesgo | Existe |
|---|---|---|---|---|---|
| CAR-CUR-22 | C | Edición válida; conservar su propio orden | 200 | — | `cursos-gestion-http.test.ts:445` |
| CAR-CUR-23 | E | Orden de otra lección → **400 `SOLICITUD_INVALIDA`** (no 409); curso bloqueado → 409 | — | RG-21 | `cursos-gestion-http.test.ts:445` |
| CAR-CUR-34 | P | Lección ajena | 403 (**capturar**) | RG-12 | — |

**E24 · `DELETE /api/lecciones/:id`** · AUT · ID · IDOR · **HUECO: no hay ninguna prueba HTTP** (confirmado con grep: el único `'DELETE'` por HTTP es de `/api/modulos/:id`)

| ID | Fam. | Caso | Esperado actual | Riesgo | Existe |
|---|---|---|---|---|---|
| CAR-CUR-24 | C | Borrado válido | 200 CursoDetalle sin la lección | — | — |
| CAR-CUR-25 | E | Con PDF → la fila `archivo` se borra y el fichero se retira; **fijado (2A):** `archivo_borrado_pendiente` queda en 0 (SEG-26); curso bloqueado → 409; inexistente → 404 | — | RG-31 | `administracion-contenido.test.ts:1419` (por servicio, sin HTTP) |
| CAR-CUR-35 | P | Lección ajena | 403 (**capturar**) | RG-12 | — |

**E25 · `POST /api/cursos/:id/enviar-revision`** · AUT · ID · IDOR (**hueco**)

| ID | Fam. | Caso | Esperado actual | Riesgo | Existe |
|---|---|---|---|---|---|
| CAR-CUR-26 | C | Curso completo en BORRADOR | 200 con el curso en EN_REVISION (**capturar** la forma). **Hueco por HTTP** | — | — |
| CAR-CUR-27 | V | Curso incompleto | 400 `SOLICITUD_INVALIDA` (**capturar** los `detalles` de completitud) | — | `cursos-gestion-http.test.ts:332` |
| CAR-CUR-28 | E | Desde RECHAZADO → 200 y `motivoRechazo = null`; desde EN_REVISION o PUBLICADO → 409 `CURSO_BLOQUEADO` "Este curso ya no puede enviarse a revisión." | — | RG-17 | — |
| CAR-CUR-36 | P | Curso ajeno | 403 (**capturar**) | RG-12 | — |

### 3.4 Contenido

**E26 · `POST /api/lecciones/:id/archivo`** · AUT · ID · PREC-5

| ID | Fam. | Caso | Esperado actual | Riesgo | Existe |
|---|---|---|---|---|---|
| CAR-CON-01 | C | PDF válido | 200 CursoDetalle; `archivo: { id, nombreOriginal, tamanoBytes, tipo }`, sin `ruta` | RG-49 | `administracion-contenido.test.ts:584` |
| CAR-CON-02 | V | Sin multipart → 415 `TIPO_ARCHIVO_INVALIDO`; otro nombre de campo, campos extra o dos archivos → 400; `.exe` → 415; > 10 MiB → 413 `ARCHIVO_DEMASIADO_GRANDE`; sin archivo → 400 "Selecciona un archivo PDF."; cabecera PDF falsa → 400 | Según `contenido.multipart.ts:65-136`; `contenido.service.ts:60-72` | RG-33, RG-34 | `administracion-contenido.test.ts:734`; `pdf-validacion.test.ts:31-86` |
| CAR-CON-03 | C | Reemplazo | Se elimina el anterior solo tras confirmar la asociación | RG-31 | `administracion-contenido.test.ts:829` |
| CAR-CON-04 | E/P | Lección de otro docente, curso EN_REVISION, PUBLICADO o ARCHIVADO, lección VIDEO | 403 / 409 / 400 | RG-12 | `administracion-contenido.test.ts:680, 1235` |
| CAR-CON-07 | X | Exactamente 10 485 760 bytes → 200; nombre de 200/201 caracteres; nombre unicode NFD | 200 / 400; **capturar** el `nombreOriginal` resultante | RG-33 | `pdf-validacion.test.ts:46, 86` (sin HTTP) |

**E27 · `GET /api/archivos/:id`** · AUT · ID

| ID | Fam. | Caso | Esperado actual | Riesgo | Existe |
|---|---|---|---|---|---|
| CAR-CON-05 | C | Docente propietario o ADMIN | 200, `Content-Type: application/pdf`, `Content-Disposition: attachment; filename…`, `Cache-Control: private, no-store`, `nosniff`; bytes idénticos | RG-40 | `administracion-contenido.test.ts:584` (parcial) |
| CAR-CON-06 | P | Docente ajeno; ESTUDIANTE; inexistente; archivo sin lección | 403; 403 `SIN_PERMISO`; 404 "Archivo no encontrado."; 404 | RG-12 | `administracion-contenido.test.ts:584` |

### 3.5 Revisión (administración)

**E28 · `GET /api/admin/cursos`** · AUT (DOCENTE y ESTUDIANTE → 403)

| ID | Fam. | Caso | Esperado actual | Riesgo | Existe |
|---|---|---|---|---|---|
| CAR-REV-01 | C | Cola | 200 solo con EN_REVISION (**capturar** la forma y el orden) | — | `administracion-contenido.test.ts:515` |
| CAR-REV-02 | V | `?estado=EN_REVISION` → 200; `?estado=PUBLICADO` → 400; `?extra=1` → 400 | — | RG-26 | `administracion-contenido.test.ts:515` |

**E29 · `GET /api/admin/cursos/:id`** · AUT · ID

| ID | Fam. | Caso | Esperado actual | Riesgo | Existe |
|---|---|---|---|---|---|
| CAR-REV-03 | C | Curso EN_REVISION | 200 con el detalle completo, sin rutas físicas | RG-49 | `administracion-contenido.test.ts:515` |
| CAR-REV-04 | E | Curso en otro estado; inexistente | **Capturar** (puede responder 200 para refrescar un curso ya decidido: `administracion-contenido.test.ts:1016`); 404 | — | `administracion-contenido.test.ts:1016` (parcial) |

**E30 · `PUT /api/admin/cursos/:id/revision`** · AUT · ID

| ID | Fam. | Caso | Esperado actual | Riesgo | Existe |
|---|---|---|---|---|---|
| CAR-REV-05 | C | APROBAR | 200; PUBLICADO con `revisado_por` y `publicado_en`; aparece en `GET /api/cursos` | — | `administracion-contenido.test.ts:1097` |
| CAR-REV-06 | C | RECHAZAR con motivo | 200; RECHAZADO con `motivo_rechazo` y el revisor | — | `administracion-contenido.test.ts:1016` |
| CAR-REV-07 | V/X | RECHAZAR sin motivo o con motivo vacío tras `trim`; motivo de 300/301; `decision` desconocida; campo extra; APROBAR con `motivo` | 400 (`strictObject` y `discriminatedUnion`) | RG-24, RG-27 | — |
| CAR-REV-08 | E/K | Curso ya decidido → 409 "Este curso ya no está pendiente de revisión."; dos administradores a la vez → un 200 y un 409 | — | RG-16 | `administracion-contenido.test.ts:1202` |
| CAR-REV-09 | E | Aprobar revalida PDFs, datos, mínimo de objetivos y categoría activa | 400 o 409 según el caso | — | `administracion-contenido.test.ts:1097, 1279, 1336` |

### 3.6 Solicitudes de docente

**E31 · `GET /api/solicitudes-docente/mia`** · AUT-1 a 4

| ID | Fam. | Caso | Esperado actual | Riesgo | Existe |
|---|---|---|---|---|---|
| CAR-SOL-01 | C | Sin solicitudes | 200 `{ solicitud: null }` | — | `solicitudes-docente.test.ts:93` |
| CAR-SOL-02 | C | Con solicitud pendiente o rechazada | 200 `{ solicitud: {…} }` con observación si fue rechazada (**capturar** las claves). DOCENTE y ADMIN también reciben 200 (no hay `autorizar`) | — | `solicitudes-docente.test.ts:155` |

**E32 · `POST /api/solicitudes-docente`** · AUT (DOCENTE puro y ADMIN → 403)

| ID | Fam. | Caso | Esperado actual | Riesgo | Existe |
|---|---|---|---|---|---|
| CAR-SOL-03 | C | Solicitud válida | 201 con la solicitud PENDIENTE (**capturar**) | — | `solicitudes-docente.test.ts:109` |
| CAR-SOL-04 | E | Ya tiene una pendiente → 409 `SOLICITUD_PENDIENTE`; ya es DOCENTE → 409 `YA_ES_DOCENTE` (**capturar** si `autorizar('ESTUDIANTE')` deja pasar a un docente-estudiante) | — | RG-18 | `solicitudes-docente.test.ts:109` (pendiente) |
| CAR-SOL-05 | V/X | `especialidad` 2/3/100/101; `motivo` 49/50/2000/2001; campo extra | 400 / 201 | RG-24, RG-27 | `solicitudes-docente.test.ts:101` (parcial) |
| CAR-SOL-06 | K/X | Dos envíos simultáneos → una sola pendiente; 11.º envío en 60 min → 429 | — | RG-18, RG-51, RG-57 | `solicitudes-docente.test.ts:122, 223` |
| CAR-SOL-13 | R | C-03: una cuenta DOCENTE sin ESTUDIANTE y una ADMIN envían una solicitud | 403 `SIN_PERMISO` (no declarado en el contrato) | RG-12 | — |

**E33 · `GET /api/admin/solicitudes`** · AUT (ESTUDIANTE y DOCENTE → 403)

| ID | Fam. | Caso | Esperado actual | Riesgo | Existe |
|---|---|---|---|---|---|
| CAR-SOL-07 | C | Sin filtro | 200 con las PENDIENTE y los datos del solicitante (**capturar** la forma). C-16: pendientes de la más antigua a la más reciente; revisadas al revés; máximo 200 filas sin paginar | — | `solicitudes-docente.test.ts:142` |
| CAR-SOL-08 | V | **C-05:** `?estado=OTRO` → 400 `SOLICITUD_INVALIDA` "Revisa los datos enviados." con `detalles[0].campo = 'estado'`; `?extra=1` → 400 (`strictObject`); `APROBADA` y `RECHAZADA` → 200 filtrado. El contrato no declara el 400: es una diferencia de documentación, y el caso fija el comportamiento real | — | RG-26 | `solicitudes-docente.test.ts:132` (parcial) |

**E34 · `PUT /api/admin/solicitudes/:id`** · AUT · ID

| ID | Fam. | Caso | Esperado actual | Riesgo | Existe |
|---|---|---|---|---|---|
| CAR-SOL-09 | C | APROBAR | 200; asigna DOCENTE, conserva ESTUDIANTE y crea el perfil docente | — | `solicitudes-docente.test.ts:178` |
| CAR-SOL-10 | V | RECHAZAR sin observación; observación de 300/301; campo extra | 400 / 200 | RG-24 | `solicitudes-docente.test.ts:155` (parcial) |
| CAR-SOL-11 | E/P/K | Ya revisada → 409 `SOLICITUD_YA_REVISADA`; la suya propia → 403 "No puedes decidir tu propia solicitud."; inexistente → 404 "La solicitud no existe."; dos administradores a la vez → solo una gana | — | RG-14, RG-16 | `solicitudes-docente.test.ts:203, 215` |
| CAR-SOL-12 | E | Tras aprobar, el **token viejo** del solicitante en `GET /api/docente/cursos` → 403; tras `refresh` → 200 | **CONGELADO-INSEGURO** (H5; ADR-011) | RG-08 | — |

## 4. Catálogo: JSON de referencia para D8

Objetivo: que la migración del catálogo a vistas SQL (D8 = A, `modules/catalogo` de `be-a` y vistas de `db`) no cambie **nada** observable.

1. **Datos deterministas.** La suite `catalogo` crea con su marca: 2 categorías activas y 1 inactiva; 2 docentes (uno inactivo); 6 cursos (3 PUBLICADO con `publicado_en` distinto, 1 PUBLICADO sin `publicado_en`, 1 BORRADOR y 1 EN_REVISION); temario con un módulo vacío y una lección DOCUMENTO con PDF; inscripciones para el orden `populares`.
2. **Filtrado por marca.** Todas las peticiones usan `q=<marca>` para aislarse de los demás datos de `learnity_test`, salvo CAR-CAT-01, que filtra la respuesta por los ids propios.
3. **Referencia.** Se guarda el JSON normalizado en el propio test, con los ids sustituidos por `<id:curso#1>` y las fechas por `<fecha>`. Se comparan con `deepStrictEqual` y con `Object.keys` recursivo (el orden importa).
4. **Cobertura:** CAR-CAT-01 a CAR-CAT-22: claves y orden, tipos, paginación, valores por defecto, desempates, 404 de no publicados, ausencia de `ruta`, el caso de categoría o docente inactivo y el `publicadoEn` heredado.
5. **Uso en la migración:** la suite se ejecuta **antes** y **después** de aplicar las vistas en `learnity_test`. El resultado tiene que ser idéntico.

## 5. Guarda de BD (`backend/test/ayudas/guardia-bd.ts`)

Lo pide S1 agravado (RG-01), H2 (RG-02) y RG-03.

**Diseño:**
- `comprobarEntorno(env)`: función pura que devuelve un error o `null`. Exige `NODE_ENV === 'test'` y que `DB_NAME` exista, termine en `_test` y no sea `learnity` (sin distinguir mayúsculas). **Sin excepciones**: `LEARNITY_PRUEBA_LOCAL` se ignora.
- Al importarlo, el módulo ejecuta `comprobarEntorno(process.env)` y lanza si hay error. Debe ser el **primer** `import` de cada suite, antes de `src/app.js` y de `pool.js`, que cargan `dotenv`.
- `verificarBaseConectada(pool)` se llama en el `before` de cada suite: `SELECT current_database()` con el mismo criterio. Es la defensa frente a H2, porque comprueba la conexión real.

| ID | Caso | Esperado |
|---|---|---|
| GUA-01 | `NODE_ENV` distinto de `test` | Error |
| GUA-02 | `DB_NAME = 'learnity'`, `'Learnity'` o `'otra'` | Error |
| GUA-03 | `DB_NAME = 'Learnity'` con `LEARNITY_PRUEBA_LOCAL = 'true'` | Error (sin excepción) |
| GUA-04 | `DB_NAME` ausente en `process.env` | Error (no se espera a `dotenv`) |
| GUA-05 | `verificarBaseConectada` con un cliente falso que devuelve `Learnity` → error; con `learnity_test` → ok | Error / ok |
| GUA-06 | El generador de correos de `ayudas/datos.ts` nunca produce `@pruebas.test` y siempre lleva la marca | ok |
| GUA-07 | Tras el cambio del `arquitecto` en `test:local`, el conteo de `npm test` incluye las suites nuevas (78 + N) | Conteo esperado |

GUA-01 a GUA-06 son unitarias y no necesitan BD. GUA-07 es una comprobación de la ejecución completa. `be-a` y `be-b` añaden `import './ayudas/guardia-bd.js'` (o la ruta que corresponda) como primera línea de sus suites.

## 6. Recorrido HTTP completo (REC)

Todo por HTTP, sin SQL salvo para crear las cuentas DOCENTE y ADMIN y la categoría con la marca.

| ID | Paso | Esperado |
|---|---|---|
| REC-01 | DOCENTE `POST /api/cursos` | 201 BORRADOR |
| REC-02 | `POST /api/cursos/:id/modulos` | 201 |
| REC-03 | `POST /api/modulos/:id/lecciones` (DOCUMENTO) | 201 |
| REC-04 | `POST /api/lecciones/:id/archivo` (PDF real) | 200, con `archivo` sin `ruta` |
| REC-05 | `POST /api/cursos/:id/enviar-revision` | 200, EN_REVISION |
| REC-06 | ADMIN `GET /api/admin/cursos` | Contiene el curso |
| REC-07 | ADMIN `PUT /api/admin/cursos/:id/revision` `{ decision: 'APROBAR' }` | 200, PUBLICADO |
| REC-08 | Visitante `GET /api/cursos?q=<marca>` | Lo lista |
| REC-09 | Visitante `GET /api/cursos/:id` | 200, temario con la lección y ningún `ruta` |
| REC-10 | Variante: RECHAZAR con motivo → el docente lo ve en `GET /api/docente/cursos` → edita → reenvía (`motivoRechazo = null`) → aprobar | Cierra el hueco de E15 y de CAR-CUR-28 |
| REC-11 | Invariante al final | Filas `archivo` = ficheros; sin restos de la marca |

## 7. Seguridad (SEG)

| ID | Caso | Esperado actual | Riesgo |
|---|---|---|---|
| SEG-01 | Token con `alg: none` o firmado con otro secreto | 401 `TOKEN_INVALIDO` | RG-11 |
| SEG-02 | Token caducado (firmado con `exp` pasado) | 401 `TOKEN_INVALIDO` | RG-11 |
| SEG-03 | Cuenta desactivada con un access token vigente | 401 `SESION_REVOCADA` | RG-10 |
| SEG-04 | Cookie de refresh de la cuenta A con el CSRF de la cuenta B | 403 `CSRF_INVALIDO` | RG-45 |
| SEG-05 | Dos `refresh` simultáneos con la misma cookie | Un 200 y un 409 `REFRESCO_CONCURRENTE` (**capturar**) | RG-09 |
| SEG-06 | Dos registros simultáneos con el mismo correo | Un 201 y un 409 (**capturar** el código) | RG-22 |
| SEG-07 | `Sec-Fetch-Site: cross-site` en `/api/auth/*` → 403 `ORIGEN_NO_PERMITIDO`; sin `Origin` (curl) → pasa | — | RG-45 |
| SEG-08 | CORS: un origen no permitido no recibe `Access-Control-Allow-Origin`; uno permitido sí, con `credentials` | — | RG-45 |
| SEG-09 | *Preflight* `OPTIONS` desde un origen permitido y desde uno no permitido | **Capturar** | RG-45 |
| SEG-10 | Dos `enviar-revision` simultáneos | Un 200 y un error (**capturar**); el estado final es EN_REVISION | RG-17 |
| SEG-11 | `PUT /api/cursos/:id` en paralelo con `enviar-revision` | Final coherente: o la edición entra antes del envío, o recibe 409 | RG-20 |
| SEG-12 | Dos `POST` de módulo con el mismo `orden` a la vez | 201 + 409 `CONFLICTO` | RG-21 |
| SEG-13 | Enumeración: el docente B recorre IDs consecutivos de cursos, módulos, lecciones y archivos de A | Nunca 200; solo 403 o 404 (IDOR-2) | RG-12 |
| SEG-14 | Inyección SQL en `q` (`' OR 1=1 --`, `$1`, `\'`) y en `categoria` (comillas) | 200 sin resultados ajenos a la marca; `total` sin cambio; nunca 500 | RG-39 |
| SEG-15 | XSS almacenado en título, descripción, objetivos, motivo de la solicitud, biografía y nombre del PDF | Se guarda y se devuelve literal; `Content-Type: application/json; charset=utf-8` | RG-42 |
| SEG-16 | Registro con `nombres = "<b>x</b>"` y luego `recuperar` | El correo del buzón contiene `&lt;b&gt;x&lt;/b&gt;` | RG-41 |
| SEG-17 | Logs sin contraseñas, tokens ni cookies, también en el 500 de CAR-GEN-05 | Ninguna coincidencia | RG-48 |
| SEG-18 | Ruta física manipulada en la BD → la descarga no sale de `PDF_DIR` | 404 o 409 (**capturar**) | RG-33 |
| SEG-19 | H4: curso creado con SQL con `portada_url = '/a/../b'` → `enviar-revision` lo acepta (`portadaValida` es laxa) | **Capturar**. **CONGELADO-INSEGURO** (ADR-011) | RG-43 |
| SEG-20 | Descarga con `nombreOriginal` unicode, con comillas o con `;` | `Content-Disposition` bien escapado; sin CRLF | RG-33, RG-40 |
| SEG-21 | PDF de 5000 páginas, ≤ 10 MiB | Responde en menos de X s (umbral en la 2A) | RG-34 |
| SEG-22 | Dos subidas simultáneas a la misma lección | Un solo archivo asociado; filas = ficheros | RG-19 |
| SEG-23 | `almacenPdf.guardar` lanza `ENOSPC` (seam verificado) | 500 `ERROR_INTERNO` "No se pudo guardar el PDF. Inténtalo nuevamente."; sin fila nueva; el PDF anterior intacto; sin huérfano | RG-28 |
| SEG-24 | Se borra el fichero del disco y luego `GET /api/archivos/:id` | **Capturar** el código | RG-29 |
| SEG-25 | `guardar` lento (seam con un retardo) y, en paralelo, `GET /api/docente/cursos/:id` | Medir la espera; el umbral se fija en la 2A | RG-30 |
| SEG-26 | `DELETE /api/lecciones/:id` y `DELETE /api/modulos/:id` con PDF, por HTTP | Fila en `archivo_borrado_pendiente`; tras la limpieza no queda fichero | RG-31 |
| SEG-27 | Toda inyección de fallo comprueba que el doble se llamó (contador > 0) | Si el contador es 0, la prueba falla | RG-06 |
| SEG-28 | 20 subidas seguidas desde la misma IP | Ningún 429. **CONGELADO-INSEGURO** (S5; ADR-011) | RG-32, RG-52 |
| SEG-29 | Fallo inyectado tras la primera escritura en crear módulo, decidir revisión y aprobar solicitud | 500 `ERROR_INTERNO`; la BD queda como antes (ROLLBACK) | RG-35 |
| SEG-30 | `pg_terminate_backend(pg_backend_pid())` de la propia sesión a mitad de una transacción (seam) | 500; sin estado parcial; el pool sigue sirviendo las peticiones siguientes. **NO VERIFICADO** que `learnity_app` pueda hacerlo; si no puede, se queda solo SEG-29 | RG-35 |
| SEG-31 | Rutas privadas: ninguna respuesta contiene `hash`, `contrasena`, `password` ni `ruta` | — | RG-49, RG-50 |
| SEG-32 | Cada ruta con `limitarPorIp` devuelve 429 + `Retry-After` al superar su máximo (registro 10/60, login 20/15, refresh 120/15, logout 60/15, recuperar 5/15, restablecer 10/15, cambiar contraseña 10/15, solicitud 10/60) | — | RG-51 |
| SEG-33 | Con `TRUST_PROXY=false`, `X-Forwarded-For` no cambia la clave del límite | Sigue el 429 | RG-51 |

## 8. Qué se prueba por HTTP y qué necesita navegador (D9)

| Se hace con `node:test` por HTTP | Necesita navegador (`@playwright/test`, pendiente del ADR y de la Puerta 1) |
|---|---|
| Toda la caracterización (§3), la guarda (§5), el recorrido (§6) y la seguridad (§7), incluidas la concurrencia y la inyección de fallos | **E2E-01** login, recarga de página y restauración de la sesión con `refresh` (interceptor de Angular) |
| Las cabeceras, las cookies, CSRF, origen y CORS (en el nivel HTTP) | **E2E-02** guards de ruta por rol (`rolGuard`, `perfilEstudianteGuard`) y la redirección |
| El texto literal de XSS en el JSON (SEG-15) | **E2E-03** el payload de XSS se ve como texto en el catálogo, el detalle, la revisión y las solicitudes |
| | **E2E-04** subida de PDF con progreso y bloqueo del editor en EN_REVISION y PUBLICADO |
| | **E2E-05** accesibilidad AA (axe) y **E2E-06** responsive a 390 px |
| | **E2E-07** el recorrido REC completo desde la interfaz |

**Sin Playwright:** E2E-02 y E2E-03 se pueden aproximar con specs de Angular (`ng test`), que serían de `fe-a`/`fe-b`; `qa-edge` las propone y no las escribe. E2E-05 y E2E-06 quedan como **NO CUBIERTO** hasta la Fase 3.

## 9. Huecos de la §2.6 de la auditoría

| Hueco | Lo cierra | Fase |
|---|---|---|
| Recorrido HTTP completo de punta a punta | REC-01 a REC-11 | 2A |
| Frontend de las páginas admin y docente | E2E-02, E2E-04 y E2E-07 (si se aprueba D9); si no, specs de `fe-a`/`fe-b` | 2B |
| Concurrencia de subidas | SEG-22 | 2A |
| Disco lleno | SEG-23 (y SEG-24, SEG-25) | 2A |
| Fallo de PostgreSQL a mitad de una operación | SEG-29 y SEG-30 (este último **NO VERIFICADO** hasta la 2A) | 2A |
| Accesibilidad | E2E-05 | Fase 3 (o **NO CUBIERTO** sin D9) |
| Carga | Fuera del alcance; RG-37 queda anotado | Fase 3 |
| **Nuevos (Fase 1):** HTTP de `GET /docente/cursos` (lista) | CAR-CUR-01, CAR-CUR-02, CAR-CUR-30 y REC-10 | 2A |
| **Nuevos (Fase 1):** HTTP de `DELETE /lecciones/:id` | CAR-CUR-24, CAR-CUR-25, CAR-CUR-35 y SEG-26 | 2A |
| **Nuevos (Fase 1):** caso de éxito de `enviar-revision` por HTTP | CAR-CUR-26 y REC-05 | 2A |
| **Nuevos (Fase 1):** IDOR en módulos, lecciones y envío | CAR-CUR-31 a CAR-CUR-36 y SEG-13 | 2A |
| **Nuevos (Fase 1):** `salud`, `docs` y 404 genérico | CAR-GEN-01 a CAR-GEN-04 y CAR-GEN-08 | 2A |

## 10. Orden de trabajo de la Fase 2A

1. `ayudas/` y `guardia-bd.ts` con GUA-01 a GUA-06. Aviso a `be-a`/`be-b` para que la importen. GUA-07, cuando el `arquitecto` cambie `test:local`.
2. Caracterización de **cursos, contenido y revisión** (R2, RG-54): es lo primero que se refactoriza.
3. **Catálogo** (§4, D8).
4. Identidad, solicitudes y general.
5. REC.
6. SEG, de mayor a menor puntuación de `RIESGOS.md`.
7. Informe de cobertura por módulo.

Cada paso lleva su turno de `learnity_test` con el lead y se cierra con un commit propio.

**Contraste con `docs/api/openapi.yaml`:** hecho en §12 (merge de `integration/sprint-2` en `055dcbe`).

## 11. Conteo endpoint → casos

| Endpoint | Operación | Casos CAR propios | De ellos, con prueba previa (total o parcial) | Paquetes | SEG / REC |
|---|---|---|---|---|---|
| E00 | `Cualquier ruta inexistente` | 2 | 0 | — | — |
| E01 | `GET /api/salud` | 2 | 0 | — | — |
| E02 | `GET /api/docs` | 1 | 0 | — | — |
| E03 | `POST /api/auth/registro` | 9 | 5 | — | SEG-06, 16, 32 |
| E04 | `POST /api/auth/login` | 7 | 6 | — | SEG-07, 32, 33 |
| E05 | `POST /api/auth/refresh` | 5 | 4 | — | SEG-04, 05, 07, 32 |
| E06 | `POST /api/auth/logout` | 3 | 1 | — | SEG-32 |
| E07 | `POST /api/auth/recuperar` | 4 | 2 | — | SEG-16, 32 |
| E08 | `POST /api/auth/restablecer` | 3 | 2 | — | SEG-32 |
| E09 | `GET /api/perfil` | 2 | 1 | AUT | SEG-31 |
| E10 | `PUT /api/perfil` | 3 | 1 | AUT | SEG-15 |
| E11 | `PUT /api/perfil/contrasena` | 3 | 2 | AUT | SEG-32 |
| E12 | `GET /api/categorias` | 3 | 2 | — | — |
| E13 | `GET /api/cursos` | 14 | 6 | — | SEG-14; REC-08 |
| E14 | `GET /api/cursos/:id` | 5 | 3 | ID | SEG-31; REC-09 |
| E15 | `GET /api/docente/cursos` | 3 | 0 | AUT | REC-10 |
| E16 | `GET /api/docente/cursos/:id` | 3 | 1 | AUT, ID, IDOR | SEG-13, 25, 31 |
| E17 | `POST /api/cursos` | 5 | 2 | AUT | SEG-15; REC-01 |
| E18 | `PUT /api/cursos/:id` | 3 | 2 | AUT, ID, IDOR, PREC | SEG-11 |
| E19 | `POST /api/cursos/:id/modulos` | 2 | 2 | AUT, ID, IDOR, PREC | SEG-12, 29; REC-02 |
| E20 | `PUT /api/modulos/:id` | 3 | 2 | AUT, ID, IDOR, PREC | SEG-13 |
| E21 | `DELETE /api/modulos/:id` | 3 | 1 | AUT, ID, IDOR | SEG-13, 26 |
| E22 | `POST /api/modulos/:id/lecciones` | 3 | 2 | AUT, ID, IDOR, PREC | SEG-13; REC-03 |
| E23 | `PUT /api/lecciones/:id` | 3 | 2 | AUT, ID, IDOR, PREC | SEG-13 |
| E24 | `DELETE /api/lecciones/:id` | 3 | 1 | AUT, ID, IDOR | SEG-13, 26 |
| E25 | `POST /api/cursos/:id/enviar-revision` | 4 | 1 | AUT, ID, IDOR | SEG-10, 11, 19; REC-05, 10 |
| E26 | `POST /api/lecciones/:id/archivo` | 5 | 5 | AUT, ID, PREC | SEG-21, 22, 23, 25, 27, 28; REC-04 |
| E27 | `GET /api/archivos/:id` | 2 | 2 | AUT, ID | SEG-13, 18, 20, 24 |
| E28 | `GET /api/admin/cursos` | 2 | 2 | AUT | REC-06 |
| E29 | `GET /api/admin/cursos/:id` | 2 | 2 | AUT, ID | SEG-31 |
| E30 | `PUT /api/admin/cursos/:id/revision` | 5 | 4 | AUT, ID | SEG-29; REC-07 |
| E31 | `GET /api/solicitudes-docente/mia` | 2 | 2 | AUT | — |
| E32 | `POST /api/solicitudes-docente` | 5 | 4 | AUT | SEG-15 |
| E33 | `GET /api/admin/solicitudes` | 2 | 2 | AUT | — |
| E34 | `PUT /api/admin/solicitudes/:id` | 4 | 3 | AUT, ID | SEG-29 |
| Transversales | CAR-GEN-05, 06, 07, 09, 10 y 11 (todas las rutas) | 6 | 1 | — | — |
| **Total** | **33 operaciones + `/api/docs` + 404** | **136** | **78** | AUT en 23, ID en 15, IDOR en 9, PREC en 6 | **33 SEG + 11 REC** |

**Condición de salida de la Fase 1.** Los 35 elementos de la tabla (las 33 operaciones de `*.routes.ts`, `/api/docs` y el 404 genérico) tienen **al menos un caso CAR propio**. Los números salen de contar las filas `| CAR-` de cada sección con `awk`. De los 136 casos CAR, 78 amplían una prueba que ya existe y 58 son nuevos. Ninguna operación queda sin casos. Cuando el lead integre `docs/api/openapi.yaml`, se repite el contraste (§10) y esta tabla se actualiza si aparece alguna diferencia.

## 12. Contraste con `docs/api/openapi.yaml` y `COMPARACION_RUTAS.md`

**Resultado.** `openapi.yaml` (28 rutas, 33 operaciones) se parseó como JSON quitando las líneas `#`, igual que hace el `arquitecto`, y se buscó cada operación en la tabla de §11: **33 de 33 tienen casos asignados**. No hay operaciones en el contrato sin casos, ni casos sobre operaciones que no estén en el contrato. `/api/docs` (E02) no está en el contrato, como es normal (C-02).

**Comando → salida** (19-10-2026, `refactor/qa-edge` tras `git merge integration/sprint-2` = `055dcbe`; script de solo lectura en el scratchpad de `qa-edge`, fuera del repositorio. Quita las líneas `#` de `openapi.yaml`, hace `JSON.parse` y busca cada `| \`VERBO /api/ruta\`` en la tabla de §11):

```
node contraste-openapi.cjs
openapi.yaml: rutas 28 · operaciones 33 · con casos en §11 33
```

**Hallazgos C-01 a C-18 → casos.** La caracterización fija el comportamiento **real**, no el que declara el contrato. Donde el contrato y el código discrepan, gana el código, y la discrepancia se cierra por documentación (`arquitecto`) o por contrato (ADR).

| Hallazgo | Tipo de cierre | Caso que fija el comportamiento real |
|---|---|---|
| C-01 `/salud` expone la base y el usuario | Documentación; quitarlo es Contrato (ADR-011) | CAR-GEN-01 (**CONGELADO-INSEGURO**) |
| C-02 `/api/docs` público | Contrato (ADR-011) | CAR-GEN-04 (**CONGELADO-INSEGURO**) |
| C-03 403 no declarado en `POST /solicitudes-docente` | Documentación | CAR-SOL-13 |
| C-04 401 no declarado en `PUT /admin/solicitudes/{id}` | Documentación | Paquete AUT en E34 |
| **C-05** 400 no declarado en `GET /admin/solicitudes` | Documentación | **CAR-SOL-08** |
| C-06 400 no declarado en login | Documentación | CAR-IDE-15 |
| C-07 404 no declarado en `/perfil` | Documentación | CAR-IDE-44 (**capturar** si se puede alcanzar) |
| C-08 Cuatro esquemas de error; `detalles` variable (lista, `{ reintentarEnSegundos }`, texto o ausente) | Documentación | CAR-GEN-10, CAR-IDE-09 (429), CAR-GEN-05 (500), SEG-12 (409 de PostgreSQL sin `detalles`) |
| C-09 Esquemas duplicados de `CursoDetalle` y `CursoResumen` | Documentación | CAR-CUR-03, CAR-REV-03: la **misma** forma real de `detallePrivado` en las rutas del docente y del administrador |
| C-10 `strictObject` sin `additionalProperties: false` | Documentación | Familia V "campo extra → 400" en E13, E17–E23, E28, E30, E32–E34; Identidad ignora las claves extra (CAR-IDE-05: **capturar**, porque usa `z.object`) |
| C-11 Límites de zod no declarados | Documentación | Familia X: CAR-IDE-06, CAR-IDE-42, CAR-CAT-10, CAR-CUR-07, CAR-CUR-09, CAR-SOL-05, CAR-SOL-10, ID-2 |
| C-12 Errores declarados imposibles en `GET /docente/cursos` | Documentación | CAR-CUR-01, CAR-CUR-02: solo 200, 401 y 403 |
| C-13 Cualquier ruta puede dar 500; mapeo de `23505`/`23514`/`23503` | Documentación | SEG-12 (`23505` → 409), CAR-CUR-10 (FK de categoría: **capturar** si da 400 por `23503`), CAR-IDE-07 y CAR-CUR-08 (NUL → `22021` → 500, H11) |
| **C-14** JSON mal formado, más de 1 MB o charset no admitido → 500 | **Contrato** (ADR-011, punto 11.6) | **CAR-GEN-05, CAR-GEN-06 y CAR-GEN-11 (CONGELADO-INSEGURO)** |
| C-15 `Content-Disposition` no declarado | Documentación | CAR-CON-05, SEG-20 |
| C-16 Máximo 200 filas y orden en `GET /admin/solicitudes` | Documentación | CAR-SOL-07 |
| C-17 Catálogo: `publicadoEn` con `COALESCE`, `totalPaginas = 0`, sin filtro por categoría o docente inactivo | Documentación; las vistas de D8 deben conservarlo | CAR-CAT-12, CAR-CAT-15, CAR-CAT-16, CAR-CAT-22 (§4) |
| C-18 Nombres por persona en los esquemas | Documentación | No afecta a la forma JSON: ningún caso, a propósito |
