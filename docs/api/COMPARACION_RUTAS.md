# Contrato actual frente a las rutas reales

- **Fecha:** 19-10-2026 · **Commit de origen:** `3c3c159` (`integration/sprint-2`) · **Autor:** `arquitecto` (Fase 1).
- **Contrato:** `docs/api/openapi.yaml`, serializado sin cambios desde el objeto `openApi` de `backend/src/shared/http/openapi.ts`.
- **Alcance:** solo se documenta. **Ningún hallazgo se corrige aquí.** Cada `C-nn` indica cómo se cerraría:
  - **Documentación:** se alinea `openapi*.ts` con lo que la API ya hace. No cambia el comportamiento. Lo hace `arquitecto` en la Fase 2A (tarea 4: mantener `openapi.yaml` y `openapi*.ts` alineados).
  - **Contrato:** cerrarlo cambia lo que la API responde. Necesita un ADR y la aprobación del usuario.

## 1. Método

Los scripts están fuera del repositorio, en el directorio temporal de `arquitecto`. **No importan** `app.ts`, `server.ts`, `shared/config/env.ts` ni las rutas, así que no cargan `.env` ni tocan la base. Los parciales `openapi-integrante2.ts`, `openapi-integrante3.ts` y `openapi-solicitudes.ts` no tienen ningún `import`.

1. **Serializar** (cwd `backend/`): `npx tsx serializar-openapi.mts <raíz> 3c3c159`. Importa `openapi.ts` y escribe una cabecera de comentarios `#` seguida de `JSON.stringify(openApi, null, 2)`. Un JSON es YAML 1.2 válido, y los comentarios `#` previos también.
2. **Verificar la fidelidad:** `npx tsx verificar-openapi.mts <raíz>`. Quita las líneas `#`, hace `JSON.parse` y `assert.deepStrictEqual` contra el objeto importado, y calcula el sha256 del archivo.
3. **Comparar con las rutas:** `node comparar-rutas.mjs <raíz>`. Lee como texto los `modules/*/*.routes.ts` y `app.ts`, aplica el prefijo `/auth` del router interno de Identidad y el montaje en `/api`, y convierte `:id` en `{id}`. Para cada ruta cruza:
   - (verbo, ruta) en los dos sentidos;
   - `autenticar` ↔ `security` y 401;
   - `autorizar(...)` ↔ 403;
   - `limitarPorIp` ↔ 429;
   - `verificarOrigen` y `exigirCsrf` ↔ 403;
   - `validarCuerpo` o `.parse(req.body|query|params)` ↔ `requestBody` y 400;
   - el código de éxito del controlador (`res.status(n)` o `responderSesion(…, n)`) ↔ las respuestas del contrato.
4. **Revisión manual:** los esquemas zod (`*.esquemas.ts`, `cursos-gestion.esquemas.ts` y los esquemas de los controladores), los modelos de respuesta y `manejador-errores.ts`, contra los cuerpos y respuestas del contrato.

Salida real de los pasos 2 y 3:

```
IDÉNTICO
sha256 3c9280586310429b2e16a2638bac81f9d13f090be320bff06f75594f6fb52455
rutas 28 · operaciones 33 · esquemas 15

rutas reales: 33 · operaciones en el spec: 33
en código y no en spec: 0 · en spec y no en código: 0
```

**NO VERIFICADO:** que el archivo se lea como YAML con un parser YAML. PyYAML no está instalado y no se instaló nada. Lo verificado es `JSON.parse` + `deepStrictEqual` + sha256.

**Fin de línea:** el repositorio usa `core.autocrlf=true`. En un checkout de Windows, `openapi.yaml` puede quedar con CRLF y su sha256 cambia, aunque el contenido JSON sea el mismo. El sha256 de arriba es el del blob guardado en git (LF), y coincide con `git show <commit>:docs/api/openapi.yaml | sha256sum`. `verificar-openapi.mts` tolera CRLF, porque `JSON.parse` ignora el `` y la cabecera se detecta por el `#` inicial.

## 2. Resultado general

- Las **33 operaciones** del contrato coinciden 1:1 en verbo y ruta con las 33 rutas reales: identidad 9, cursos 14, contenido 2, administración 7 y `GET /api/salud` en `app.ts`.
- `GET /api/docs` (Swagger UI, `app.ts:43`) no está en el contrato. Es lo esperado: es la interfaz de documentación, no una operación de la API (ver ADR-011).
- Las diferencias están en el detalle: códigos no declarados, esquemas duplicados, límites de zod que no aparecen y un comportamiento de error global (C-14).

## 3. Operación por operación

Abreviaturas de middlewares: `origen` = `verificarOrigen` (todo `/auth`), `ip(…)` = `limitarPorIp(clave, máx, min)`, `csrf` = `exigirCsrf`, `auth` = `autenticar`, `roles(…)` = `autorizar(…)`, `body(…)` = `validarCuerpo(…)`.

| # | Operación | Rutas (`backend/src/…`) | Middlewares | Validación en el controlador | Éxito real | Respuestas del contrato | Hallazgos |
|---|---|---|---|---|---|---|---|
| 1 | `POST /auth/registro` | `identidad.routes.ts:23` | origen, ip(registro,10,60), body(registroSchema) | — | 201 | 201, 400, 403, 409, 429 | C-08, C-11 |
| 2 | `POST /auth/login` | `identidad.routes.ts:24` | origen, ip(login,20,15), body(loginSchema) | — | 200 | 200, 401, 403, 429 | **C-06**, C-11 |
| 3 | `POST /auth/refresh` | `identidad.routes.ts:25` | origen, ip(refresh,120,15), csrf | — | 200 | 200, 401, 403, 409, 429 | — |
| 4 | `POST /auth/logout` | `identidad.routes.ts:26` | origen, ip(logout,60,15), csrf | — | 204 | 204, 403, 429 | — |
| 5 | `POST /auth/recuperar` | `identidad.routes.ts:27` | origen, ip(recuperar,5,15), body(recuperarSchema) | — | 202 | 202, 400, 403, 429 | C-11 |
| 6 | `POST /auth/restablecer` | `identidad.routes.ts:28` | origen, ip(restablecer,10,15), body(restablecerSchema) | — | 200 | 200, 400, 403, 429 | C-11 |
| 7 | `GET /perfil` | `identidad.routes.ts:32` | auth | — | 200 | 200, 401 | **C-07** |
| 8 | `PUT /perfil` | `identidad.routes.ts:33` | auth, body(actualizarPerfilSchema) | — | 200 | 200, 400, 401 | C-07, C-11 |
| 9 | `PUT /perfil/contrasena` | `identidad.routes.ts:34` | ip(cambiar-contrasena,10,15), auth, body(cambiarContrasenaSchema) | — | 200 | 200, 400, 401, 429 | — |
| 10 | `GET /categorias` | `cursos.routes.ts:11` | — | — | 200 | 200 | — |
| 11 | `GET /cursos` | `cursos.routes.ts:12` | — | query: `filtros` (strict) | 200 | 200, 400 | C-10, C-11, C-17 |
| 12 | `GET /cursos/{id}` | `cursos.routes.ts:13` | — | params: `idCurso` | 200 | 200, 400, 404 | C-17 |
| 13 | `GET /docente/cursos` | `cursos.routes.ts:15` | auth, roles(DOCENTE) | — | 200 | 200, 400, 401, 403, 404, 409 | C-09, **C-12** |
| 14 | `GET /docente/cursos/{id}` | `cursos.routes.ts:22` | auth, roles(DOCENTE) | params | 200 | 200, 400, 401, 403, 404, 409 | C-09 |
| 15 | `POST /cursos` | `cursos.routes.ts:29` | auth, roles(DOCENTE) | body: `datosCursoSchema` (strict) | 201 | 201, 400, 401, 403, 404, 409 | C-09, C-10, C-11 |
| 16 | `PUT /cursos/{id}` | `cursos.routes.ts:36` | auth, roles(DOCENTE) | params, body (strict) | 200 | 200, 400, 401, 403, 404, 409 | C-09, C-10, C-11 |
| 17 | `POST /cursos/{id}/modulos` | `cursos.routes.ts:43` | auth, roles(DOCENTE) | params, body (strict) | 201 | 201, 400, 401, 403, 404, 409 | C-09, C-10 |
| 18 | `PUT /modulos/{id}` | `cursos.routes.ts:50` | auth, roles(DOCENTE) | params, body (strict) | 200 | 200, 400, 401, 403, 404, 409 | C-09, C-10 |
| 19 | `DELETE /modulos/{id}` | `cursos.routes.ts:57` | auth, roles(DOCENTE) | params | 200 | 200, 400, 401, 403, 404, 409 | C-09 |
| 20 | `POST /modulos/{id}/lecciones` | `cursos.routes.ts:64` | auth, roles(DOCENTE) | params, body (strict) | 201 | 201, 400, 401, 403, 404, 409 | C-09, C-10 |
| 21 | `PUT /lecciones/{id}` | `cursos.routes.ts:71` | auth, roles(DOCENTE) | params, body (strict) | 200 | 200, 400, 401, 403, 404, 409 | C-09, C-10 |
| 22 | `DELETE /lecciones/{id}` | `cursos.routes.ts:78` | auth, roles(DOCENTE) | params | 200 | 200, 400, 401, 403, 404, 409 | C-09 |
| 23 | `POST /cursos/{id}/enviar-revision` | `cursos.routes.ts:85` | auth, roles(DOCENTE) | params | 200 | 200, 400, 401, 403, 404, 409 | C-09 |
| 24 | `POST /lecciones/{id}/archivo` | `contenido.routes.ts:18` | auth, roles(DOCENTE), `controller.autorizarCarga`, `recibirPdf` (multer) | params | 200 | 200, 400, 401, 403, 404, 409, 413, 415, 500 | C-13; ver ADR-011 |
| 25 | `GET /archivos/{id}` | `contenido.routes.ts:27` | auth, roles(DOCENTE, ADMIN) | params | 200 (`application/pdf`) | 200, 400, 401, 403, 404, 500 | C-13, C-15 |
| 26 | `GET /admin/cursos` | `administracion.routes.ts:19` | auth, roles(ADMIN) | query: `filtroRevision` (strict) | 200 | 200, 400, 401, 403, 404, 500 | C-09, C-10, C-13 |
| 27 | `GET /admin/cursos/{id}` | `administracion.routes.ts:26` | auth, roles(ADMIN) | params | 200 | 200, 400, 401, 403, 404, 500 | C-09, C-13 |
| 28 | `PUT /admin/cursos/{id}/revision` | `administracion.routes.ts:33` | auth, roles(ADMIN) | params, body: `decisionRevision` (strict) | 200 | 200, 400, 401, 403, 404, 409, 500 | C-09, C-13 |
| 29 | `GET /solicitudes-docente/mia` | `administracion.routes.ts:41` | auth | — | 200 | 200, 401 | — |
| 30 | `POST /solicitudes-docente` | `administracion.routes.ts:47` | ip(solicitud-docente,10,60), auth, roles(ESTUDIANTE), body(nuevaSolicitudDocente) | — | 201 | 201, 400, 401, 409, 429 | **C-03**, C-10 |
| 31 | `GET /admin/solicitudes` | `administracion.routes.ts:56` | auth, roles(ADMIN) | query: `filtroSolicitudes` (strict) | 200 | 200, 401, 403 | **C-05**, C-10, C-16 |
| 32 | `PUT /admin/solicitudes/{id}` | `administracion.routes.ts:63` | auth, roles(ADMIN) | params, body: `decisionSolicitud` (strict) | 200 | 200, 400, 403, 404, 409 | **C-04**, C-10, C-11 |
| 33 | `GET /salud` | `app.ts:35` | — | — | 200 | 200 | **C-01** |

Además, todas las operaciones comparten C-08 (esquema de error), C-13 (500 y errores de restricción de PostgreSQL) y C-14 (errores del parser JSON).

## 4. Hallazgos

| ID | Hallazgo | Evidencia | Cierre |
|---|---|---|---|
| C-01 | `GET /salud` se documenta como `{type: object}`. Devuelve `{ estado: 'ok', baseDeDatos: { base, usuario, roles } }`, que expone el nombre de la base y el usuario de PostgreSQL (S4) | `openapi.ts:149-151`; `app.ts:35-40` | **Documentación** para describirla tal como es hoy. Quitar `baseDeDatos` es **Contrato** (ADR-011, punto 11.1), y lo mismo el 500 con la base caída (H8, punto 11.2) |
| C-02 | `GET /api/docs` (Swagger UI) no está en el contrato y es público en cualquier entorno | `app.ts:43` | Ninguno para el contrato (no es una operación de la API). Restringirlo a desarrollo es **Contrato** (ADR-011, punto 11.3) |
| C-03 | `POST /solicitudes-docente` no declara el 403, aunque `autorizar('ESTUDIANTE')` lo devuelve (`SIN_PERMISO`) a una cuenta sin ese rol | `administracion.routes.ts:47-54`; `middlewares.ts:41-47`; `openapi-solicitudes.ts` (respuestas 201, 400, 401, 409, 429) | Documentación |
| C-04 | `PUT /admin/solicitudes/{id}` no declara el 401, aunque usa `autenticar` | `administracion.routes.ts:63-67`; `openapi-solicitudes.ts:99-128` | Documentación |
| C-05 | `GET /admin/solicitudes` no declara el 400. `filtroSolicitudes` es `strictObject`: un `estado` fuera del enum o un parámetro desconocido dan 400 `SOLICITUD_INVALIDA` | `administracion.controller.ts:93-96`; `administracion.esquemas.ts` (`filtroSolicitudes`) | Documentación |
| C-06 | `POST /auth/login` no declara el 400. `validarCuerpo(loginSchema)` rechaza un correo no válido o una contraseña vacía o de más de 256 caracteres | `identidad.routes.ts:24`; `identidad.esquemas.ts` (`loginSchema`, `contrasenaEscrita`) | Documentación |
| C-07 | `GET /perfil` (y `PUT /perfil`, que termina en `obtenerPerfil`) puede responder 404 `NO_ENCONTRADO` ("La cuenta no existe."), que no está declarado | `identidad.service.ts:337-347` | Documentación |
| C-08 | Hay **cuatro** esquemas para el mismo cuerpo de error `{ error: { codigo, mensaje, detalles } }`: `error` en línea, `ErrorApiIntegrante2`, `ErrorIntegrante3` y `ErrorApi`. Además, `ErrorIntegrante3` define `detalles` como una lista de `{campo, mensaje}`, pero el 429 devuelve `detalles: { reintentarEnSegundos }`, el 500 en desarrollo devuelve un texto y el 409 `CONFLICTO` de PostgreSQL no lo incluye | `openapi.ts:50-61`; `openapi-integrante2.ts:85`; `openapi-integrante3.ts:231-252`; `openapi-solicitudes.ts:9`; `app-error.ts` (`demasiadasPeticiones`); `manejador-errores.ts:15-50` | Documentación: un solo esquema `Error` |
| C-09 | Las mismas respuestas aparecen con dos esquemas distintos: `CursoDetalle` y `CursoDetalleIntegrante2` (ambas salen de `detallePrivado`), y `CursoResumen` y `CursoResumenIntegrante2`. Las rutas del docente usan la versión sin `required` (por ejemplo, `subtitulo` y `portadaUrl` como opcionales); las de administración, la estricta | `openapi-integrante2.ts:141-231`; `openapi-integrante3.ts:142-229`; `cursos-privados.model.ts` | Documentación (un esquema por modelo). Importa para el cliente tipado (ADR-007 y ADR-008) |
| C-10 | Los cuerpos y consultas validados con `z.strictObject` rechazan claves desconocidas con 400, pero el contrato no declara `additionalProperties: false`. Afecta a: `DatosCurso`, `DatosModulo`, `DatosLeccion`, el cuerpo de `POST /solicitudes-docente` y el de `PUT /admin/solicitudes/{id}`, y las consultas de `GET /cursos`, `GET /admin/cursos` y `GET /admin/solicitudes`. `PUT /admin/cursos/{id}/revision` sí lo declara. Identidad usa `z.object` (ignora las claves extra), lo que coincide con su contrato | `cursos-gestion.esquemas.ts`; `administracion.esquemas.ts`; `cursos.controller.ts:14-21` | Documentación |
| C-11 | Hay límites de zod que el contrato no expresa: el correo, de 120 caracteres como máximo (registro, login y recuperar); `nombres` y `apellidos`, con `minLength` 1; el `token` de restablecer, de 100 como máximo; la contraseña de login, de 256 como máximo; `observacion`, con `minLength` 1; el `id` de `PUT /admin/solicitudes/{id}`, sin `minimum` ni `maximum` (el código exige de 1 a 2 147 483 647); `categoria` en `GET /cursos`, de 80 como máximo y 20 valores; y `portadaUrl`, que solo admite una ruta relativa segura o una URL `http(s)` sin credenciales. Tampoco se declara que `subtitulo`, `descripcion`, `portadaUrl`, `objetivos` y `requisitos` toman `''` o `[]` por defecto | `identidad.esquemas.ts`; `administracion.esquemas.ts`; `cursos.controller.ts:11-21`; `cursos-gestion.esquemas.ts:3-50`; `openapi-solicitudes.ts:107,118` | Documentación |
| C-12 | Hay errores declarados que la operación no puede producir. `GET /docente/cursos` declara 400, 404 y 409, pero el controlador no valida nada y el servicio solo lanza 403. El bloque `errores` de integrante2 se aplica igual a las 11 operaciones del docente, y el bloque `comunes` de integrante3 (por ejemplo, el 404 en `GET /admin/cursos`) también es genérico | `openapi-integrante2.ts:33-39, 68-82`; `cursos.controller.ts:274-285`; `cursos.service.ts:108-119`; `openapi-integrante3.ts:263-269` | Documentación. Solo `GET /docente/cursos` se comprobó con el código; las demás operaciones se revisan al unificar en la Fase 2A |
| C-13 | Solo 5 operaciones (las de integrante3) declaran el 500, pero **cualquier** ruta puede devolver 500 `ERROR_INTERNO`. Además, en cualquier ruta, las violaciones de PostgreSQL se convierten en 409 `CONFLICTO` (`23505`) o en 400 `SOLICITUD_INVALIDA` (`23514`, `23503`) | `manejador-errores.ts:33-50` | Documentación (una respuesta común o una nota en `info.description`) |
| C-14 | **Un JSON mal formado, un cuerpo de más de 1 MB o un charset no admitido acaban en 500 `ERROR_INTERNO`** y en `console.error`, no en 400, 413 o 415. `express.json` lanza errores de `http-errors` con `status` y `type` (`entity.parse.failed`, `entity.too.large`, `charset.unsupported`), y `manejadorErrores` solo reconoce `AppError`, `ZodError` y los códigos de PostgreSQL | `app.ts:28`; `manejador-errores.ts:15-50`; `node_modules/body-parser/lib/read.js:73,105,164`; `node_modules/raw-body/index.js:163,260`. Por lectura de código: **NO VERIFICADO en ejecución** (`qa-edge` debe caracterizarlo) | **Contrato**: pasar de 500 a 400, 413 o 415 cambia los códigos HTTP. Es el **ADR-011, punto 11.6** (= H1 de `RIESGOS.md`) |
| C-15 | `GET /archivos/{id}` envía `Content-Disposition: attachment; filename=…` (el nombre original), que no está declarado. Solo se declara `Cache-Control` | `contenido.controller.ts:68-90`; `openapi-integrante3.ts` (`/archivos/{id}`) | Documentación |
| C-16 | `GET /admin/solicitudes` devuelve como máximo 200 filas, sin paginar, y el contrato no lo dice. Tampoco documenta el orden: las pendientes, de la más antigua a la más reciente; las revisadas, de la más reciente a la más antigua | `administracion.repository.ts:114-121` | Documentación |
| C-17 | Catálogo público: `cursoPublico` no tiene `required`. `publicadoEn` es en realidad `COALESCE(publicado_en, creado_en)`. `totalPaginas` vale 0 si `total` es 0. El catálogo no filtra por categoría inactiva ni por docente inactivo (solo `GET /categorias` muestra únicamente las activas), y las vistas del ADR-002 deben conservar ese comportamiento | `openapi.ts:101-110`; `cursos.repository.ts:47-102`; `cursos.service.ts:951-969` | Documentación |
| C-18 | Hay nombres por persona en el contrato: los tags `Gestión de cursos - Integrante 2` y los esquemas `*Integrante2` y `ErrorIntegrante3` (A11). La descripción de `info` no menciona los límites del contenido ni de las solicitudes | `openapi-integrante2.ts:74`; `openapi.ts:117-132` | Documentación. Renombrarlos cambia los nombres de los esquemas, pero no el formato JSON de la API. Afecta a los tipos generados (ADR-008), así que se hace antes de generarlos |

## 5. Relacionado, pero no es una diferencia del contrato

- `POST /lecciones/{id}/archivo` no tiene `limitarPorIp` y usa `multer.memoryStorage()` (S5; `contenido.routes.ts:18-25`, `contenido.multipart.ts:15`). El contrato coincide con el código; el cambio se propone en el ADR-011, que añadiría un 429.
- `server.ts:36-47` consulta la base al arrancar (SQL fuera de repositorio). No forma parte del contrato; lo recoge el ADR-011.
