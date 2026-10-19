# ADR-006: Validación uniforme y logger con ID de correlación

- **Estado:** Propuesto. Son tres puntos que se aprueban por separado: 6.1 validación, 6.2 logger y 6.3 errores del parser JSON.
- **Fecha:** 2026-10-19
- **Decisores:** el usuario (Puerta 1). Propone: `arquitecto`
- **Cambia el contrato:**
  - 6.1: no;
  - 6.2: no cambia cuerpos ni códigos, solo añade un encabezado de respuesta, `X-Request-Id`;
  - 6.3: **sí**, porque cambia códigos HTTP (hallazgo C-14).

## Contexto

**La validación es inconsistente (A6).** Conviven tres estilos:

| Estilo | Dónde | Error resultante |
|---|---|---|
| `validarCuerpo(esquema)` en la ruta | `identidad.routes.ts:23-38`, `administracion.routes.ts:52` | `ZodError` → `manejador-errores.ts:21-29` → 400 `SOLICITUD_INVALIDA`, "Revisa los datos enviados.", `detalles: [{campo, mensaje}]` |
| `esquema.parse(req.params / req.query / req.body)` en el controlador | `administracion.controller.ts:38-100`, `contenido.controller.ts:39-72`, `cursos.controller.ts:56-319` | igual que la anterior (`ZodError`) |
| `safeParse` + `AppError.solicitudInvalida('Revisa los datos enviados.', issues→{campo, mensaje})` | `cursos.controller.ts:33, 64, 94, 127, 196, 231` | **el mismo cuerpo**, construido a mano |

Leyendo el código, los tres producen el mismo JSON (estado, `codigo`, `mensaje` y forma de `detalles`). Falta que la caracterización de `qa-edge` lo confirme. `shared/http/validar.ts` (13 líneas) solo ofrece `validarCuerpo`. En Express 5, `req.query` es un *getter* de solo lectura: un `validarConsulta` no puede reasignarlo.

**El log no es uniforme y no tiene correlación (A7, S7).**
- Hay 24 llamadas a `registrarEvento` (`shared/log/registro.ts`, JSON por línea, filtra claves sensibles) y 24 `console.*`, repartidos así: `server.ts` (7), `database/seed.ts` (7), `env.ts` (2), `pool.ts` (1), `manejador-errores.ts` (1), `registro.ts` (2, internos), `cursos.service.ts` (2) y `contenido*.ts` (2).
- No hay un ID por petición, así que no se pueden relacionar las líneas de una misma petición.
- `manejador-errores.ts:43` hace `console.error(error)`, y un error de PostgreSQL incluye `detail` con valores (por ejemplo, el correo duplicado).

**Errores del parser (C-14).** Un JSON mal formado, un cuerpo de más de 1 MB o un charset no admitido producen errores de `http-errors` (`type: entity.parse.failed`, `entity.too.large` o `charset.unsupported`). `manejadorErrores` no los reconoce y responde 500 `ERROR_INTERNO`. Esto se dedujo leyendo el código y está **NO VERIFICADO en ejecución**.

## Decisión propuesta

### 6.1 Validación: un middleware por cada origen de datos

```ts
// shared/http/validar.ts (be-a)
export function validarParametros(esquema: ZodType): RequestHandler  // → res.locals.parametros
export function validarConsulta(esquema: ZodType): RequestHandler    // → res.locals.consulta (req.query no es asignable en Express 5)
export function validarCuerpo(esquema: ZodType): RequestHandler      // → req.body (como hoy)
export function datosValidados<P, Q>(res: Response): { parametros: P; consulta: Q }  // lectura tipada en el controlador
```

- Cada ruta declara: `autenticar` → `autorizar` → `validarParametros` → `validarConsulta` → `validarCuerpo` → controlador. Este orden reproduce el actual: el 401 y el 403 llegan antes que el 400, y en los controladores de hoy los parámetros se validan antes que el cuerpo (por ejemplo, `cursos.controller.ts:56-64`). Así, si hay varios errores, el primero que se informa es el mismo.
- Los controladores dejan de llamar a `parse` o `safeParse`. Los esquemas pasan a `<m>.esquemas.ts` (ADR-001). Desaparece la construcción manual del error en `cursos.controller.ts`.
- **Se conservan:** los esquemas (`strictObject` donde hoy lo es, `z.object` en Identidad), los mensajes de zod y el cuerpo de error.
- **Caso especial: la subida de PDF.** `autorizarCarga` comprueba los permisos **antes** de leer el multipart (`contenido.routes.ts:18-25`). Se mantiene, con `validarParametros` delante.

### 6.2 Logger con ID de correlación

- **Middleware `correlacion`**, el primero de `app.ts`:
  - usa el `X-Request-Id` entrante si cumple `^[A-Za-z0-9-]{8,64}$`; si no, genera `randomUUID()`;
  - lo guarda en un `AsyncLocalStorage`;
  - lo devuelve en el encabezado de respuesta `X-Request-Id`, también en los errores, y se añade a `exposedHeaders` de CORS.
- **`registrarEvento`** añade `idPeticion` a cada línea desde el `AsyncLocalStorage`, sin cambiar su firma ni su filtro de claves sensibles. Se mantiene el silencio en pruebas (`registro.ts:19`).
- **`console.*` se sustituye por `registrarEvento`** en el código de la aplicación: `server.ts`, `env.ts`, `pool.ts`, `manejador-errores.ts` y los servicios. `seed.ts` y los scripts de consola pueden seguir con `console`, porque no son la API, pero **dejan de imprimir contraseñas** (S8).
- **`manejadorErrores`** registra `error_no_controlado` con `{ idPeticion, nombre, mensaje, codigoPg }`. **Nunca** registra `detail`, `parameters` ni el cuerpo de la petición, y solo incluye la pila en `development`. La respuesta 500 no cambia.
- **Sin dependencias nuevas.** `pino` sería la opción estándar, pero exige su propio ADR y no está entre las candidatas de D9.

### 6.3 Errores del parser JSON (C-14). Cambia el contrato y se aprueba aparte

`manejadorErrores` reconoce `error.type`:
- `entity.parse.failed` → 400 `SOLICITUD_INVALIDA`;
- `entity.too.large` → 413 `CUERPO_DEMASIADO_GRANDE`;
- `charset.unsupported` o `encoding.unsupported` → 415 `TIPO_NO_ADMITIDO`.

Todos llevan un mensaje en español y ninguno incluye el contenido recibido. Si el usuario lo rechaza, se mantiene el 500 actual, se documenta tal cual en `openapi.yaml` (C-13) y solo se aplican 6.1 y 6.2.

## Opciones consideradas

### Validación

| Opción | Complejidad | Riesgo de regresión | Contrato | Valoración |
|---|---|---|---|---|
| A. Dejarlo como está | Nula | Nulo | — | Tres estilos y el error construido a mano en Cursos |
| **B. Middlewares por origen (elegida)** | Baja | Bajo: el mismo cuerpo y el mismo orden | Sin cambios | Uniforme; los controladores quedan sin reglas |
| C. Validar todo en el servicio | Media | Medio: mezcla HTTP y negocio | Sin cambios | Contradice las capas del ADR-001 |
| D. Librería de validación de OpenAPI (`express-openapi-validator`) | Alta | Alto: los mensajes y `detalles` cambiarían | **Cambia** | Dependencia nueva, y el contrato actual no es lo bastante preciso (C-10, C-11) |

### Logger

| Opción | Complejidad | Riesgo | Contrato | Valoración |
|---|---|---|---|---|
| A. Dejarlo como está | Nula | — | — | Sin correlación y con `detail` en los logs (S7) |
| **B. `registrarEvento` + `AsyncLocalStorage` (elegida)** | Baja | Bajo | Solo añade el encabezado `X-Request-Id` | Sin dependencias; reutiliza el filtro de claves sensibles |
| C. `pino` + `pino-http` | Media | Bajo | Igual que B | Estándar y rápido, pero es una dependencia nueva sin ADR de D9 |
| D. `morgan` para el acceso más `console` | Baja | Bajo | — | No da correlación ni estructura uniforme |

### Errores del parser

| Opción | Contrato | Valoración |
|---|---|---|
| A. Mantener el 500 y documentarlo | Sin cambios | Es honesto, pero mezcla errores del cliente con fallos del servidor y llena el log de falsos errores |
| **B. Mapear a 400, 413 y 415 (propuesta)** | **Cambia** códigos | Semántica HTTP correcta; requiere la aprobación del usuario |

## Análisis de compromisos

Para 6.1 y 6.2 se eligen las versiones que no añaden dependencias y conservan el cuerpo de error byte a byte. La comodidad de `pino` no compensa abrir otra dependencia en este refactor. 6.3 es la única pieza que cambia el contrato, y por eso se presenta sola.

## Consecuencias

- **Más fácil:**
  - leer cualquier ruta, porque su validación está declarada en ella;
  - seguir una petición en los logs con `idPeticion`;
  - cumplir el objetivo de la materia (*trace ID*);
  - quitar el `detail` de PostgreSQL de los logs (S7).
- **Más difícil:** los controladores leen la consulta y los parámetros validados con `datosValidados(res)`, no con `req.query` o `req.params`.
- **A revisar:** si el volumen de logs lo pide, migrar a `pino` con su propio ADR. El encabezado `X-Request-Id` se declara en `openapi.yaml` cuando se implemente.

## Acciones

1. [ ] Caracterizar el cuerpo exacto de un 400 en cada estilo (cursos con `safeParse`, administración con `parse` e identidad con `validarCuerpo`), y C-14 (`qa-edge`, Fase 2A).
2. [ ] `validarParametros`, `validarConsulta` y `datosValidados` en `shared/http/validar.ts`; middleware `correlacion`; `registrarEvento` con `idPeticion`; `manejadorErrores` sin `console.error` ni `detail` (`be-a`, Fase 2A).
3. [ ] Migrar las rutas de cada módulo a los middlewares (cada dueño, Fase 2B).
4. [ ] Si se aprueba 6.3: mapear `error.type` en `manejadorErrores` (`be-a`) y actualizar `openapi*.ts` (`arquitecto`).

## Cómo se verifica

```bash
grep -rnE "\.(safeParse|parse)\(" backend/src/modules/*/*.controller.ts   # vacío: no se valida en controladores
grep -rn "console\." backend/src --include=*.ts | grep -v "database/seed.ts"   # vacío
grep -n "console.error\|detail" backend/src/shared/http/manejador-errores.ts   # vacío
```

Además, la caracterización de errores 400 pasa sin cambios, y una petición devuelve `X-Request-Id` y su línea de log lleva el mismo `idPeticion`.
