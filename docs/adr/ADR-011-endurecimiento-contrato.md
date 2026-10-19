# ADR-011: Endurecimiento con impacto en el contrato

- **Estado:** Aceptado parcialmente (19-10-2026, Puerta 1, decisión P1-3). **Son 11 puntos independientes**: 11.1–11.8, 11.10 y 11.11 aceptados; **11.9 rechazado** (se mantiene el comportamiento actual). Cada punto aceptado va en su propio commit, que actualiza sus pruebas CONGELADO-INSEGURO.
- **Fecha:** 2026-10-19 (ampliado el mismo día con los hallazgos H1–H11 de `qa-edge`, `docs/refactor/RIESGOS.md`)
- **Decisores:** el usuario (Puerta 1). Propone: `arquitecto`
- **Regla de proceso (decisión del lead, 19-10-2026):** la caracterización de `qa-edge` **congela el comportamiento actual**, incluido lo inseguro (marcado **CONGELADO-INSEGURO**). Cada punto indica qué pruebas de caracterización actualiza. Esas expectativas cambian **en el mismo commit** que aplica el punto aprobado, nunca antes. Si un punto se rechaza, sus pruebas siguen fijando el comportamiento actual.

## Resumen

| Punto | Hallazgo | ¿Cambia el contrato? | Qué cambia | Pruebas que actualiza | Dueño | Decisión (Puerta 1) |
|---|---|---|---|---|---|---|
| 11.1 | S4 / C-01 | **Sí** | `GET /api/salud` deja de devolver `baseDeDatos` | CAR-GEN-01 | be-a | Aceptado |
| 11.2 | H8 | **Sí** | `GET /api/salud` con la base caída: 500 → 503 | CAR-GEN-03 | be-a | Aceptado |
| 11.3 | S4 / C-02 | **Sí** (fuera del JSON) | `/api/docs` solo en desarrollo | CAR-GEN-04 | be-a | Aceptado |
| 11.4 | S5 | **Sí** | Nuevo 429 en `POST /api/lecciones/{id}/archivo` | SEG-28 | be-b | Aceptado |
| 11.5 | S5 | No | La subida pasa a disco temporal (cambia el modo de fallo) | Ninguna (ver H9) | be-b | Aceptado |
| 11.6 | H1 / C-14 | **Sí** | Errores del parser JSON: 500 → 400, 413 o 415 | CAR-GEN-05, 06 y 11 | be-a | Aceptado |
| 11.7 | H11 | **Sí** | Texto con `\u0000`: 500 → 400 | CAR-CUR-08, CAR-IDE-07 | be-a / be-b | Aceptado |
| 11.8 | H4 | **Sí** | Una sola regla de portada (la revalidación al enviar y al aprobar se vuelve más estricta) | CAR-CUR-07, SEG-19 | be-b | Aceptado (B) |
| 11.9 | S6 | **Sí** | `portadaUrl` deja de aceptar URLs externas | CAR-CUR-07, SEG-19 | be-b (+ fe-b) | **Rechazado** (A: se mantiene) |
| 11.10 | H5 | **Sí** | Los roles se leen de la base en cada petición (un token antiguo deja de recibir 403 tras la aprobación) | CAR-SOL-12 | be-a | Aceptado (B) |
| 11.11 | H6 | **Sí** | Los IDs rechazan `1e3`, `0x10`, ` 7 ` y `7.0` (pasan a 400) | Paquete ID (`PLAN_PRUEBAS.md` §2.2) | be-a / be-b | Aceptado (B) |

Los identificadores de las pruebas son los de `RIESGOS.md` y `PLAN_PRUEBAS.md` (`qa-edge`). Si cambian, manda el registro de `qa-edge`.

## Contexto común

- La regla del equipo prohíbe cambiar rutas, cuerpos, códigos HTTP o códigos de error sin un ADR aprobado. Estos puntos cierran riesgos de la auditoría (§4.2) y de `RIESGOS.md`, y **todos** cambian lo que la API responde, salvo 11.5.
- Por eso se reúnen aquí, separados de los refactors que no cambian el contrato (ADR-001 a 007).
- Consumidores conocidos:
  - el README enlaza `/api/salud` y `/api/docs` (`README.md:93-94, 361, 864`);
  - el frontend no llama a `/api/salud` (grep en `frontend/src`).
- Recomendación global: aprobar 11.1–11.7 (bajo riesgo y alto valor); 11.8–11.11 según el criterio del usuario (ver cada uno).

---

## 11.1 `/api/salud` sin datos internos (S4, C-01)

**Problema.** `app.ts:35-40` devuelve `{ estado: 'ok', baseDeDatos: { base, usuario, roles } }` a cualquier visitante: el nombre de la base, el usuario de PostgreSQL y el número de roles. Además, es SQL fuera de un repositorio. La consulta de arranque de `server.ts:36-47` (`current_database()`, `current_user`, `to_regclass('public.sesion')`) no es contrato, pero también es SQL fuera de un repositorio.

**Propuesta (B).**
- `200 { "estado": "ok" }`, con un `SELECT 1` desde una función de repositorio en `shared/database` (`comprobarConexion`).
- La comprobación de arranque pasa también a un repositorio (`verificarEsquema`) y se registra con `registrarEvento` (ADR-006). Puede seguir registrando el nombre de la base en el log local: no es una respuesta HTTP.

| Opción | Contrato | A favor | En contra |
|---|---|---|---|
| A. Dejarlo así | Sin cambios | Nada que hacer | La fuga de información sigue |
| **B. `{ estado }`** | Cambia el cuerpo | No revela nada | Quien leía `baseDeDatos` (solo el README) deja de verlo |
| C. `baseDeDatos` solo en desarrollo | Depende del entorno | Comodidad para depurar | Un contrato distinto por entorno |

**Pruebas que actualiza:** CAR-GEN-01. **Otros:** `openapi*.ts` y el README (`arquitecto`).

## 11.2 `/api/salud` con la base caída (H8)

**Problema.** Si la consulta falla, el error no se controla y `manejadorErrores` responde **500 `ERROR_INTERNO`**. Un balanceador no puede distinguir "proceso caído" de "base caída".

**Propuesta (B).** `503 { "estado": "sin_bd" }` cuando falla `comprobarConexion`, y se registra el evento.

| Opción | Contrato | Valoración |
|---|---|---|
| A. 500 genérico | Sin cambios | Mezcla un fallo de dependencia con un error inesperado |
| **B. 503 `{ estado: 'sin_bd' }`** | Nuevo 503 | Semántica estándar de disponibilidad |
| C. Dos rutas (`/salud` y `/salud/bd`) | Ruta nueva | Separa *liveness* de *readiness*; es innecesario para una sola instancia local |

**Pruebas que actualiza:** CAR-GEN-03. Requiere 11.1, o al menos mover la consulta a un repositorio.

## 11.3 Swagger solo en desarrollo (S4, C-02)

**Problema.** `app.ts:43` sirve Swagger UI en cualquier entorno.

**Propuesta (B).** Montar `/api/docs` solo si `NODE_ENV === 'development'`. En `test` y `production` responde el 404 de `rutaNoEncontrada`. `openapi.yaml` sigue siendo la referencia publicada en el repositorio.

| Opción | Contrato | A favor | En contra |
|---|---|---|---|
| A. Público siempre | Sin cambios | Cómodo | Expone toda la superficie de la API |
| **B. Solo `development`** | 404 fuera de desarrollo | Simple | Sin documentación interactiva en despliegues |
| C. Variable `SWAGGER_ACTIVO` (apagada por defecto) | Igual que B, según la configuración | Flexible | Una variable más en `env.ts` |
| D. Detrás de `autorizar('ADMIN')` | Cambia el acceso | Disponible para administradores | Swagger UI no envía el `Bearer` en sus recursos estáticos: es frágil |

**Pruebas que actualiza:** CAR-GEN-04 (hoy `GET /api/docs/` → 200 HTML; con B, en `test` → 404).

## 11.4 Límite por IP en la subida de PDF (S5)

**Problema.** `contenido.routes.ts:18-25` no tiene `limitarPorIp` (RG-52: solo hay 10 límites, en Identidad y la solicitud de docente). Las subidas se pueden repetir sin freno.

**Propuesta (B).** `limitarPorIp('subida-pdf', 30, 15)` antes de `autenticar`, como en `administracion.routes.ts:47-54`. Responde 429 `DEMASIADAS_PETICIONES` con `Retry-After` y `detalles.reintentarEnSegundos`. El valor (30 por 15 minutos) se puede ajustar al aprobar.

| Opción | Contrato | A favor | En contra |
|---|---|---|---|
| A. Sin límite | Sin cambios | — | Agotamiento de memoria o de disco (S5) |
| **B. `limitarPorIp`** | Nuevo 429 | Reutiliza el mecanismo y el formato de error | Detrás de un NAT se comparte el límite |
| C. Límite por usuario autenticado | Nuevo 429 | Más justo con NAT | Ayudante nuevo y no protege antes de autenticar |
| D. Semáforo de subidas simultáneas | Nuevo 503/429 | Protege la RAM directamente | Más código y un comportamiento menos predecible |

**Consecuencias:**
- Hay que actualizar `openapi-revision-contenido.ts` (antes `openapi-integrante3.ts`; respuesta 429) y el frontend (`pdf-leccion`) debe mostrar el mensaje. Si `peticion.ts` ya lo hace está **NO VERIFICADO**.
- **H7 (configuración, no contrato):** `limitarPorIp` usa `req.ip` como clave (`limite-peticiones.ts:24`). Con `TRUST_PROXY=true` (`app.ts:23`, `env.ts:75`) un cliente puede falsear `X-Forwarded-For` y saltarse **este y todos los demás** límites por IP. `TRUST_PROXY` solo debe activarse detrás de un proxy propio que **sobrescriba** esa cabecera, y con el número exacto de saltos, no con `true`. El contador vive en memoria y solo sirve para una instancia (A12). Lo documenta el README (`arquitecto`) y lo prueba SEG-33.

**Pruebas que actualiza:** SEG-28 (hoy fija que no hay 429 tras N subidas).

## 11.5 Subida a disco temporal en vez de `memoryStorage` (S5, sin cambio de contrato)

**Problema.** `contenido.multipart.ts:15` usa `multer.memoryStorage()` (10 MiB por archivo). N subidas simultáneas ocupan N × 10 MiB de RAM antes de validar nada.

**Propuesta (B).**
- `multer.diskStorage` en un directorio temporal del mismo volumen que `PDF_DIR` (por ejemplo `PDF_DIR/.tmp`), con un nombre aleatorio y los mismos `limits`.
- Después de validar, se **renombra** al nombre definitivo (es atómico en el mismo volumen). Se conserva `programarNuevo`.
- En cualquier error se borra el temporal, y al arrancar se limpian los huérfanos.

| Opción | A favor | En contra |
|---|---|---|
| A. `memoryStorage` (actual) | Simple | Si se agota la RAM, cae el proceso y con él todas las sesiones |
| **B. Disco temporal y `rename`** | La RAM queda acotada mientras se recibe; un disco lleno da un error controlado | Hay que gestionar los temporales huérfanos. **`pdf-lib` sigue cargando el archivo entero al validar** (`pdf-validacion.ts:79`): el pico por subida en la validación no desaparece (para eso, 11.4) |
| C. *Stream* al destino final | Sin copia | Si la validación falla, quedan archivos inválidos en el directorio definitivo |

**Comportamiento ante fallos:**

| Fallo | Hoy | Con B |
|---|---|---|
| Muchas subidas simultáneas | Crece la RAM y el proceso puede caer | La RAM queda acotada mientras se recibe |
| Disco lleno | Solo falla al guardar | Falla al recibir con un error controlado (500), se borra el temporal y se registra |
| El proceso cae a mitad | Se pierde lo que estaba en memoria | Queda un temporal huérfano, que se limpia al arrancar |

**Pruebas que actualiza:** ninguna CONGELADO-INSEGURO.
- **Atención a H9:** `administracion-contenido.test.ts:888, 939-951, 960-974` inyecta fallos sustituyendo `almacenPdf.guardar` y `almacenPdf.eliminar`. Si el flujo de 11.5 deja de llamar a `guardar` (por ejemplo, porque solo hace `rename`), esas pruebas podrían **pasar sin inyectar el fallo**. `be-b` debe comprobar que el fallo inyectado sigue ocurriendo (SEG-27).
- **Relación con H3** (escribir el PDF con filas bloqueadas, SEG-25): el `rename` debe quedar fuera de la sección bloqueada, igual que la lectura del ADR-005.

## 11.6 Errores del parser JSON (H1, C-14)

**Problema.** Un JSON mal formado, un cuerpo de más de 1 MB o un charset no admitido producen errores de `http-errors` con `status` y `type` (`entity.parse.failed`, `entity.too.large`, `charset.unsupported`). `manejadorErrores` (`manejador-errores.ts:16-50`) solo reconoce `AppError`, `ZodError` y los códigos de PostgreSQL, así que responde **500 `ERROR_INTERNO`** y hace `console.error`.

**Propuesta (B).** Reconocer `error.type`:
- `entity.parse.failed` → 400 `SOLICITUD_INVALIDA`;
- `entity.too.large` → 413 `CUERPO_DEMASIADO_GRANDE`;
- `charset.unsupported` o `encoding.unsupported` → 415 `TIPO_NO_ADMITIDO`.

Cada uno con un mensaje en español y sin el contenido recibido.

| Opción | Contrato | Valoración |
|---|---|---|
| A. Mantener el 500 y documentarlo (C-13) | Sin cambios | Mezcla errores del cliente con fallos del servidor y llena el log de falsos errores |
| **B. 400 / 413 / 415** | Cambia los códigos | Semántica HTTP correcta |
| C. Usar `error.status` de cualquier error con `expose: true` | Cambia los códigos | Más genérico, pero pierde el control del código de error y del mensaje |

**Pruebas que actualiza:** CAR-GEN-05 (JSON mal formado), CAR-GEN-06 (más de 1 MB) y CAR-GEN-11 (charset no admitido). CAR-GEN-07 (`Content-Type: text/plain`) **no cambia**: `express.json` no procesa ese cuerpo, así que el error lo da la validación y no el parser. Se vuelve a ejecutar para confirmarlo. El ADR-006 remite aquí.

## 11.7 Texto con el carácter NUL (H11)

**Problema.** Un texto con `\u0000` pasa zod, y PostgreSQL lo rechaza (`22021`, *invalid byte sequence*). Ese código no está mapeado (`manejador-errores.ts:33-44`), así que la respuesta es **500**.

**Propuesta (B).** Un ayudante zod de texto en `shared/http` (`textoSeguro`) que rechace `\u0000` con un mensaje por campo, para usarlo en todos los esquemas de texto. Como red de seguridad, mapear `22021` → 400 `SOLICITUD_INVALIDA` en `manejadorErrores`.

| Opción | Contrato | Valoración |
|---|---|---|
| A. Dejarlo así | Sin cambios | Un 500 provocable a voluntad, con `console.error` |
| **B. Rechazar en zod y mapear `22021`** | 500 → 400 con `detalles` por campo | Error claro y ubicado |
| C. Solo mapear `22021` | 500 → 400 sin campo | Más simple, pero sin indicar el campo |
| D. Eliminar el NUL en silencio | Cambia los datos guardados | Modifica la entrada del usuario sin avisar |

**Pruebas que actualiza:** CAR-CUR-08 y CAR-IDE-07.

## 11.8 Una sola regla de portada (H4)

**Problema.** Hay dos validaciones distintas:
- el esquema zod (`cursos-gestion.esquemas.ts:12-31`) en las rutas relativas rechaza `..`, `\`, `?`, `#` y los espacios, y en las URL rechaza las credenciales;
- `portadaValida` (`cursos-integracion.service.ts:66-82`), que se usa al revalidar en el envío a revisión y en la aprobación, acepta cualquier `/…` sin `//` ni `\` y cualquier URL `http(s)`.

Una portada que solo pase la regla laxa (por ejemplo, insertada por semilla o directamente en la base) se puede enviar y aprobar.

**Propuesta (B).** Una sola función (en `cursos`) con la regla del esquema zod, que se usa en los dos sitios.

| Opción | Contrato | Valoración |
|---|---|---|
| A. Dos reglas | Sin cambios | Inconsistente |
| **B. Unificar en la regla estricta** | La revalidación puede rechazar cursos que hoy pasan | Solo afecta a datos que no entraron por la API (las semillas) |
| C. Unificar en la regla laxa | El `PUT` aceptaría portadas que hoy rechaza | Debilita la validación de entrada |

**Pruebas que actualiza:** CAR-CUR-07 y SEG-19.

## 11.9 Portada externa (S6)

> **Decisión (Puerta 1, 19-10-2026): rechazado.** Se mantiene la opción A: `portadaUrl` sigue aceptando URLs `http(s)` externas, y CAR-CUR-07 y SEG-19 siguen fijando ese comportamiento. La regla única del 11.8 conserva esa aceptación.

**Problema.** `portadaUrl` acepta cualquier URL `http(s)` externa: la imagen se carga desde terceros (rastreo y contenido mixto).

**Propuesta.** **Decisión del usuario, sin recomendación fuerte**, porque cambia lo que el docente puede hacer:
- **B**: solo rutas relativas propias (`/…`);
- **C**: una lista de dominios permitidos en la configuración.

| Opción | Contrato | Valoración |
|---|---|---|
| A. Mantener las URL externas | Sin cambios | Riesgo bajo, aceptado hoy |
| B. Solo rutas propias | `PUT /cursos/{id}` y `POST /cursos` rechazan URLs externas (400) | Hoy no hay subida de imágenes, así que el docente no tendría cómo poner una portada propia |
| C. Lista de dominios permitidos | Igual que B, salvo para los dominios permitidos | Equilibrado, pero añade configuración |

**Pruebas que actualiza:** CAR-CUR-07 y SEG-19. Si se aprueba B o C, el formulario del editor (`fe-b`) debe explicar la restricción.

## 11.10 Roles actualizados en cada petición (H5)

**Problema.** Los roles viajan en el JWT (`shared/auth/jwt.ts:10`). `sesionVigente` (`identidad.repository.ts:242-252`) comprueba la sesión y `usuario.estado`, pero no los roles. Por eso, cuando se aprueba una solicitud, el estudiante sigue recibiendo 403 en las rutas de DOCENTE hasta que renueva el token. Y al revés: un rol retirado sigue valiendo hasta que el token vence (15 minutos).

**Propuesta: decisión del usuario.** Recomendación: **B**.

| Opción | Contrato | Valoración |
|---|---|---|
| A. Dejarlo así (documentado en el contrato: "el rol llega en la próxima renovación") | Sin cambios | Ya lo dice `openapi-solicitudes.ts`; como mucho, 15 minutos de desfase |
| **B. `sesionVigente` devuelve también los roles actuales y `autenticar` sustituye `req.usuario.roles`** | Un token antiguo pasa de 403 a 200 tras la aprobación | Se reutiliza la consulta que ya se hace en cada petición (un `JOIN` con `usuario_rol` y `rol`); los roles retirados dejan de valer de inmediato |
| C. El frontend llama a `/auth/refresh` al ver la solicitud `APROBADA` | Sin cambios en el backend | Arregla la experiencia del estudiante, pero no la revocación de roles |

**Pruebas que actualiza:** CAR-SOL-12.

## 11.11 IDs estrictos (H6)

**Problema.** Los IDs con `z.coerce.number().int()` (`cursos.controller.ts:23`, `contenido.controller.ts:19-23`, `administracion.esquemas.ts:3-7`) aceptan `1e3`, `0x10`, ` 7 ` y `7.0` como números válidos.

**Propuesta: decisión del usuario.** El ADR-006 la recoge como opción, no como decisión.
- **B:** un único esquema `idRuta = z.string().regex(/^[1-9][0-9]{0,9}$/).transform(Number).pipe(z.number().max(2147483647))` en `shared/http`, usado por `validarParametros`.

| Opción | Contrato | Valoración |
|---|---|---|
| A. Mantener `coerce` | Sin cambios | Tolerante; el riesgo real es bajo (se convierte a un entero válido) |
| **B. Solo dígitos decimales** | Esas formas pasan a 400 | Entrada canónica y URLs únicas por recurso |

**Pruebas que actualiza:** el paquete de ID de `PLAN_PRUEBAS.md` §2.2 (los casos `1e3`, `0x10`, ` 7 ` y `7.0`).

---

## Consecuencias generales

- **Si se aprueban:**
  - cada punto se implementa en un commit propio, que actualiza a la vez el código, las pruebas de caracterización que se citan, `openapi*.ts` (`arquitecto`) y, si hace falta, el README;
  - `qa-edge` revisa que solo cambien esas expectativas.
- **Si se rechazan:** el comportamiento queda congelado tal cual. `openapi*.ts` se alinea para documentarlo como es (por ejemplo, el 500 de C-13 y C-14).
- **A revisar:**
  - 11.4 + 11.5 tienen sentido juntos;
  - 11.1 + 11.2 también;
  - 11.8 + 11.9 tocan la misma regla y conviene decidirlos a la vez.

## Cómo se verifica (por punto aprobado)

- 11.1: `GET /api/salud` → `{"estado":"ok"}`; `grep -n "current_database\|current_user" backend/src/app.ts` → vacío.
- 11.2: con la base detenida en un entorno de prueba → 503 `{"estado":"sin_bd"}`.
- 11.3: con `NODE_ENV=test`, `GET /api/docs/` → 404 `NO_ENCONTRADO`.
- 11.4: la petición 31 dentro de la ventana → 429 con `Retry-After`.
- 11.5: `grep -n "memoryStorage" backend/src/modules/contenido/*.ts` → vacío; `PDF_DIR/.tmp` vacío tras la suite.
- 11.6 a 11.11: las pruebas citadas, con la nueva expectativa, en verde, y el resto de la caracterización sin cambios.
