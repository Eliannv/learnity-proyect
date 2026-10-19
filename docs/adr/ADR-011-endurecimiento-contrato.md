# ADR-011: Endurecimiento con impacto en el contrato

- **Estado:** Propuesto. **Son cuatro puntos que el usuario aprueba o rechaza por separado** en la Puerta 1.
- **Fecha:** 2026-10-19
- **Decisores:** el usuario (Puerta 1). Propone: `arquitecto`
- **Cambia el contrato:**

| Punto | ¿Cambia el contrato? | Qué cambia |
|---|---|---|
| 11.1 `/api/salud` sin datos internos | **Sí** | El cuerpo de `GET /api/salud` |
| 11.2 Swagger solo en desarrollo | **Sí** (fuera del contrato JSON) | `GET /api/docs` deja de existir fuera de desarrollo |
| 11.3 Límite por IP en la subida de PDF | **Sí** | Nuevo 429 en `POST /api/lecciones/{id}/archivo` |
| 11.4 Subida a disco temporal | No | El comportamiento ante fallos (memoria frente a disco) |

## Contexto

La auditoría (§4.2) y la arquitectura objetivo (§5, *Seguridad mínima*) piden cuatro endurecimientos. La regla del equipo prohíbe cambiar rutas, cuerpos o códigos sin un ADR aprobado. Por eso se reúnen aquí, separados de los refactors que no cambian el contrato.

- **S4:**
  - `app.ts:35-40` responde a `GET /api/salud` con `{ estado: 'ok', baseDeDatos: { base, usuario, roles } }`, que revela a cualquier visitante el nombre de la base, el usuario de PostgreSQL y cuántos roles hay. Además, es SQL fuera de un repositorio;
  - `app.ts:43` sirve Swagger (`/api/docs`) en cualquier entorno;
  - `server.ts:36-47` consulta `current_database()`, `current_user` y `to_regclass('public.sesion')` al arrancar, y lo escribe en consola. No forma parte del contrato, pero también es SQL fuera de repositorio.
- **S5:** `contenido.multipart.ts:15` usa `multer.memoryStorage()` con un límite de 10 MiB por archivo, y `contenido.routes.ts:18-25` no aplica `limitarPorIp`. N subidas simultáneas ocupan hasta N × 10 MiB de RAM antes de validar nada. Además, `validarBytesPdf` carga el documento completo con `pdf-lib` (`pdf-validacion.ts:79`).
- **Consumidores conocidos:** el README enlaza `/api/salud` y `/api/docs` (`README.md:93-94, 361, 864`). El frontend no llama a `/api/salud` (`grep` en `frontend/src`: solo un comentario que menciona `/api/docs`). Ninguna prueba de `backend/test` usa estas dos rutas.

## 11.1 `/api/salud` sin datos internos

**Propuesta (B):** `GET /api/salud` → `200 { "estado": "ok" }` si `SELECT 1` funciona. Si falla la base, `503 { "estado": "sin_bd" }`. La consulta se mueve a una función de repositorio en `shared/database` (`comprobarConexion`). La comprobación de arranque de `server.ts:36-47` se mueve también a un repositorio (`verificarEsquema`) y se registra con `registrarEvento` (ADR-006). Puede seguir registrando el nombre de la base en el log local, porque no es una respuesta HTTP.

| Opción | Contrato | A favor | En contra |
|---|---|---|---|
| A. Dejarla como está | Sin cambios | Nada que hacer | Mantiene la fuga de información (S4) y el SQL en `app.ts` |
| **B. `{estado}` con 200 o 503 (propuesta)** | Cambia el cuerpo y añade el 503 | No revela nada; un 503 lo entiende cualquier balanceador | Quien leía `baseDeDatos` (solo el README) deja de verlo |
| C. Dos rutas: `/api/salud` (proceso) y `/api/salud/bd` (base) | Añade una ruta | Separa *liveness* de *readiness* | Amplía el contrato sin necesidad para una sola instancia local |
| D. Dejar `baseDeDatos` solo en desarrollo | Depende del entorno | Comodidad para depurar | Un contrato que cambia según el entorno es más difícil de probar y documentar |

**Consecuencias:** se actualizan `openapi*.ts` (C-01) y el README. `qa-edge` caracteriza el cuerpo nuevo.

## 11.2 Swagger solo en desarrollo

**Propuesta (B):** montar `/api/docs` solo si `NODE_ENV === 'development'`. En `test` y `production` responde el 404 genérico de `rutaNoEncontrada`. `openapi.yaml` sigue siendo la referencia publicada en el repositorio.

| Opción | Contrato | A favor | En contra |
|---|---|---|---|
| A. Público siempre | Sin cambios | Cómodo | Expone toda la superficie de la API en producción (S4) |
| **B. Solo en `development` (propuesta)** | `/api/docs` da 404 fuera de desarrollo | Simple; no depende de la autenticación | En un despliegue no hay documentación interactiva |
| C. Variable `SWAGGER_ACTIVO` (apagada por defecto) | Igual que B, según la configuración | Flexible | Una variable más en `env.ts` y en `.env.example` |
| D. Detrás de `autenticar` + `autorizar('ADMIN')` | Cambia el acceso | Disponible para administradores | Swagger UI carga recursos estáticos que no envían el `Bearer`, así que es complicado y frágil |

**Consecuencias:** se ajusta el README ("solo en desarrollo"). Ninguna prueba depende de esta ruta.

## 11.3 Límite por IP en la subida de PDF (nuevo 429)

**Propuesta (B):** `limitarPorIp('subida-pdf', 30, 15)` antes de `autenticar` en `POST /lecciones/:id/archivo`, igual que las demás rutas limitadas (`administracion.routes.ts:47-54`). Responde 429 `DEMASIADAS_PETICIONES` con `Retry-After` y `detalles.reintentarEnSegundos`, como el resto. El valor de 30 por 15 minutos se puede ajustar en la aprobación.

| Opción | Contrato | A favor | En contra |
|---|---|---|---|
| A. Sin límite | Sin cambios | — | Un cliente puede agotar la memoria o el disco con subidas repetidas (S5) |
| **B. `limitarPorIp` (propuesta)** | Nuevo 429 | Reutiliza el mecanismo existente y su formato de error | Detrás de un NAT, varios docentes comparten el límite. El contador vive en memoria y sirve solo para una instancia (A12, documentado) |
| C. Límite por usuario autenticado | Nuevo 429 | Más justo con NAT | Requiere un ayudante nuevo (`limitarPorUsuario`) y no protege antes de autenticar |
| D. Límite de subidas simultáneas (semáforo) | Nuevo 503 o 429 | Protege la RAM directamente | Más código y un comportamiento menos predecible |

**Consecuencias:** se actualizan `openapi-integrante3.ts` (respuesta 429) y el frontend (`pdf-leccion`), que debe mostrar el mensaje del 429. Falta comprobar si `shared/cursos/peticion.ts` (`fallar`) ya muestra el `mensaje` de un 429: **NO VERIFICADO**. `qa-edge` añade el caso.

## 11.4 Subida a disco temporal en vez de `memoryStorage`

**Propuesta (B):** `multer.diskStorage` en un directorio temporal **dentro del mismo volumen** que `PDF_DIR` (por ejemplo `PDF_DIR/.tmp`), con un nombre aleatorio y los mismos `limits` (`fileSize`, `files: 1`, `fields: 0`, `parts: 2`). Después de validar, el archivo se **renombra** al nombre definitivo. Se mantiene el registro previo `programarNuevo` de `contenido.service.ts`, que permite recuperar la limpieza. En cualquier error se borra el temporal. Al arrancar se limpian los temporales huérfanos.

| Opción | Contrato | A favor | En contra |
|---|---|---|---|
| A. `memoryStorage` (actual) | — | Simple y sin archivos temporales | Hasta N × 10 MiB de RAM con subidas simultáneas; si se agota, se cae el proceso (y con él todas las sesiones) |
| **B. Disco temporal y luego `rename` (propuesta)** | Sin cambios | Mientras se recibe, la RAM queda acotada; un disco lleno da un error controlado (500) en vez de tumbar el proceso; el `rename` es atómico en el mismo volumen | Hay que gestionar los temporales huérfanos; **la validación con `pdf-lib` sigue cargando el archivo entero** (`pdf-validacion.ts:79`), así que el pico de RAM por subida en validación no desaparece. Para eso hace falta además 11.3 o la Opción D de 11.3 |
| C. *Stream* directo al destino final, validando después | Sin cambios | Sin copia | Si la validación falla, quedan archivos inválidos en el directorio definitivo. Peor |

**Consecuencias (comportamiento ante fallos, sin cambiar el contrato):**

| Fallo | Hoy | Con B |
|---|---|---|
| Muchas subidas simultáneas | Crece la RAM; riesgo de que el proceso se caiga | La RAM está acotada mientras se recibe; el disco absorbe la carga |
| Disco lleno | No ocurre al recibir (solo al guardar) | Error controlado al recibir: 500 `ERROR_INTERNO`, se borra el temporal y se registra el evento |
| El proceso se cae a mitad de una subida | Se pierde lo que estaba en memoria | Queda un temporal huérfano, que se limpia al arrancar |

`qa-edge` debe cubrir en `RIESGOS.md`: el disco lleno, el temporal huérfano y una subida cancelada a mitad.

## Análisis de compromisos

Los cuatro puntos reducen la superficie expuesta o el riesgo de caída sin funcionalidad nueva. 11.1 y 11.2 son baratos y su único "consumidor" es el README. 11.3 añade un código HTTP que el frontend ya sabe mostrar. 11.4 no cambia el contrato, pero sí el modo de fallo, y solo tiene sentido completo junto con 11.3. Por eso se recomienda aprobarlos juntos, aunque la decisión es independiente para cada uno.

## Acciones (solo para los puntos aprobados)

1. [ ] 11.1 y 11.2: `app.ts`, `server.ts` y `shared/database` (`be-a` y `be-b`, Fase 2A); `openapi*.ts` y README (`arquitecto`).
2. [ ] 11.3: ruta de Contenido (`be-b`, Fase 2B, B3); `openapi-integrante3.ts` (`arquitecto`).
3. [ ] 11.4: `contenido.multipart.ts` y la limpieza al arrancar (`be-b`, B3), con la caracterización de la subida en verde antes de empezar.
4. [ ] `qa-edge`: casos de 429, 503, 404 de `/api/docs` en `test`, y fallos de disco.

## Cómo se verifica

- 11.1: `GET /api/salud` → `{"estado":"ok"}`; `grep -n "current_database\|current_user" backend/src/app.ts` → vacío.
- 11.2: con `NODE_ENV=test`, `GET /api/docs` → 404 `NO_ENCONTRADO`.
- 11.3: la petición 31 dentro de la ventana → 429 con `Retry-After`.
- 11.4: `grep -n "memoryStorage" backend/src/modules/contenido/*.ts` → vacío; después de la suite, `PDF_DIR/.tmp` queda vacío.
