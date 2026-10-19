# ADR-002: Catálogo como módulo de lectura sobre vistas SQL

- **Estado:** Propuesto. El usuario ya eligió el enfoque (**D8 = A**, 19-10-2026); este ADR fija el *cómo* y se aprueba en la Puerta 1.
- **Fecha:** 2026-10-19
- **Decisores:** el usuario (Puerta 1). Propone: `arquitecto`, en coordinación con `db`, que define las vistas.
- **Cambia el contrato:** No. `GET /api/cursos` y `GET /api/cursos/:id` devuelven exactamente el mismo JSON.

## Contexto

- Hoy el catálogo público vive dentro de Cursos:
  - las rutas están en `cursos.routes.ts:12-13`;
  - el servicio, en `cursos.service.ts:30-102` y `:948-994`;
  - el SQL, en `cursos.repository.ts:47-154`, que lee las tablas `curso`, `categoria`, `docente`, `persona`, `modulo`, `leccion`, `archivo` e `inscripcion`.
- Cualquier cambio en la gestión de cursos (Lote B) puede romper el catálogo (Lote A), y al revés.
- El catálogo es público: un error en un `JOIN` podría exponer columnas privadas. La más sensible es `archivo.ruta`, la ruta física del PDF. Hoy no se expone (prueba en `cursos-publicos.test.ts:161`), pero lo que lo impide es solo la disciplina del SQL.
- La base no tiene vistas (BD-2 = 0) y la app usa `learnity_app`, con DML en las 22 tablas (S2). `db` propone un rol `learnity_lectura` (PLAN_BD, Fase 1).
- Hay detalles de comportamiento que no están en el contrato y deben conservarse (C-17):
  - `publicadoEn` es `COALESCE(publicado_en, creado_en)`, pero el orden `recientes` usa `publicado_en` sin `COALESCE`, con `NULLS LAST`;
  - el catálogo **no** filtra por categoría inactiva ni por docente inactivo;
  - `GET /categorias` sí muestra solo las categorías activas.

## Decisión propuesta

1. **Módulo `modules/catalogo`** (dueño `be-a`). Ofrece `GET /cursos` y `GET /cursos/:id`, con las mismas rutas, validación (`filtros` en `strictObject`, `idCurso`) y respuestas. `GET /categorias` pasa a `modules/categorias` (A3). Express no tiene conflicto con `POST /cursos` y `PUT /cursos/:id` de Cursos: son verbos distintos.
2. **El catálogo lee solo vistas de solo lectura** creadas por `db` en una migración `up`/`down`. Nunca lee tablas. Nombres propuestos a `db` (pendientes de confirmar en su plan):
   - **`catalogo_curso`:** una fila por curso, con `WHERE c.estado = 'PUBLICADO'` dentro de la vista. Un borrador no aparece, y el detalle sigue respondiendo 404 "Curso no disponible." desde el servicio.
   - **`catalogo_temario`:** una fila por módulo y lección, solo de cursos publicados, con LEFT JOIN de `modulo` a `leccion` y a `archivo`.

   No hace falta una `catalogo_detalle` aparte: el listado y el detalle usan hoy las mismas columnas (`camposCurso`, `cursos.repository.ts:69-78`).
3. **Columnas permitidas.** Son las únicas que necesita el JSON actual:

| Vista | Columna | Origen actual |
|---|---|---|
| `catalogo_curso` | `id`, `titulo`, `subtitulo` | `c.id_curso`, `c.titulo`, `c.subtitulo` |
| | `descripcion` | `COALESCE(c.descripcion, '')` |
| | `categoria_id`, `categoria_nombre` | `cat.id_categoria`, `cat.nombre` |
| | `docente`, `docente_bio` | `concat_ws(' ', p.nombres, p.apellidos)`, `p.biografia` |
| | `nivel`, `portada_url`, `objetivos`, `requisitos` | columnas de `curso` |
| | `publicado_en` | `COALESCE(c.publicado_en, c.creado_en)` (lo que se devuelve) |
| | `publicado_en_orden` | `c.publicado_en` sin `COALESCE` (solo para ordenar) |
| | `modulos`, `lecciones`, `segundos` | agregados de `modulo`, `leccion` y `archivo.duracion_seg` |
| | `inscripciones` | `COUNT(*)` de `inscripcion`, solo para ordenar `populares`; no sale en el JSON |
| `catalogo_temario` | `curso_id`, `modulo_id`, `modulo_orden`, `modulo_titulo` | `modulo` |
| | `leccion_id`, `leccion_orden`, `leccion_titulo`, `leccion_tipo` (nullables) | `leccion` |
| | `segundos` (nullable) | `archivo.duracion_seg` |

   **Prohibido** en cualquier vista: `archivo.ruta` y cualquier otra columna de `archivo` salvo `duracion_seg`; `id_archivo`; `nombre_original`; correos; `contrasena_hash` y `token_hash`.
4. **Lo que queda en `catalogo.repository.ts`** (SQL parametrizado, con fragmentos solo de listas cerradas):
   - **búsqueda `q`:** se escapan `\`, `%` y `_`, y se arma `%q%`, con `ILIKE … ESCAPE '\'` sobre `titulo`, `subtitulo` y `descripcion`;
   - **filtros:** `categoria_nombre = ANY($n::text[])` y `nivel = ANY($n::text[])`;
   - **orden** (lista cerrada): `recientes` → `publicado_en_orden DESC NULLS LAST, id DESC`; `populares` → `inscripciones DESC, id DESC`; `az` → `titulo ASC, id ASC`;
   - **paginación:** `LIMIT $a OFFSET $b`; `total` con el mismo WHERE; `totalPaginas = ceil(total/limite)`;
   - **temario:** `ORDER BY modulo_orden, modulo_id, leccion_orden, leccion_id`.
5. **Permisos:** `SELECT` sobre las vistas para `learnity_app` y `learnity_lectura`. Si las vistas son de `learnity_owner` y no son `security_invoker`, `learnity_lectura` no necesita permisos sobre las tablas base (lo decide `db`).
6. **Orden de despliegue:**
   1. caracterización exacta del JSON del catálogo (`qa-edge`);
   2. migración de las vistas probada `up → down → up` en `learnity_test` (`db`);
   3. Puerta DB;
   4. `modules/catalogo` cambia a leer las vistas (`be-a`).

   Si la migración no está aplicada, `catalogo` no se activa.

## Opciones consideradas

### Opción A: dejar el catálogo dentro de Cursos

| Dimensión | Valoración |
|---|---|
| Complejidad | Nula |
| Riesgo de regresión | Alto a medio plazo: cualquier cambio en la gestión toca el SQL público |
| Impacto en el contrato | Ninguno |
| Familiaridad del equipo | Total |

**A favor:** no hay que hacer nada. **En contra:** acopla los lotes A y B y deja `cursos.service.ts` con dos responsabilidades (A2).

### Opción B: módulo `catalogo` que lee las tablas directamente

| Dimensión | Valoración |
|---|---|
| Complejidad | Baja |
| Riesgo de regresión | Bajo: se mueve el SQL tal cual |
| Impacto en el contrato | Ninguno |
| Familiaridad del equipo | Alta |

**A favor:** no requiere migración. **En contra:** el catálogo sigue dependiendo del esquema interno de Cursos y Contenido; la protección de `archivo.ruta` sigue dependiendo del SQL; `learnity_lectura` necesitaría leer las tablas base.

### Opción C: módulo `catalogo` sobre vistas de solo lectura (elegida, D8 = A)

| Dimensión | Valoración |
|---|---|
| Complejidad | Media (migración `up`/`down` más el módulo) |
| Riesgo de regresión | Bajo si se caracteriza el JSON exacto antes de cambiar |
| Impacto en el contrato | Ninguno |
| Familiaridad del equipo | Media (vistas SQL simples) |

**A favor:** frontera explícita entre lo público y lo privado; las columnas prohibidas no existen en la vista; el rol de lectura solo ve lo publicado; el catálogo es independiente del Lote B. **En contra:** un cambio de esquema en `curso`, `modulo` o `leccion` obliga a revisar las vistas en una migración; hay un artefacto más que versionar.

### Opción D: vistas materializadas

| Dimensión | Valoración |
|---|---|
| Complejidad | Alta (refresco, `CONCURRENTLY`, índice único) |
| Riesgo de regresión | Medio: un curso recién publicado no aparece hasta el refresco, lo que cambia el comportamiento |
| Impacto en el contrato | Indirecto (datos desactualizados) |
| Familiaridad del equipo | Baja |

**A favor:** lecturas rápidas con mucho volumen. **En contra:** el volumen actual no lo justifica, y obliga a refrescar tras cada publicación.

## Análisis de compromisos

C cuesta una migración más que B, y a cambio convierte una protección de seguridad (no exponer `ruta`) en una propiedad del esquema, en lugar de una convención. Una vista normal se expande en la consulta del planificador, así que el rendimiento es el de hoy. D solo tendría sentido con mucho más volumen, y añadiría datos desactualizados.

## Consecuencias

- **Más fácil:**
  - el Lote A trabaja sin tocar Cursos;
  - auditar lo que es público: `\d+ catalogo_curso`;
  - dar acceso de solo lectura (`learnity_lectura`) sin abrir las tablas base.
- **Más difícil:**
  - todo cambio en las columnas de `curso`, `modulo`, `leccion` o `archivo` exige revisar las vistas (`db`);
  - hay que coordinar el despliegue (migración → Puerta DB → código).
- **A revisar:**
  - si el catálogo debe ocultar las categorías inactivas o los docentes inactivos. Hoy no lo hace, y cambiarlo sería un cambio de comportamiento con su propio ADR;
  - `pg_trgm` para la búsqueda (ADR-010).

## Acciones

1. [ ] Confirmar los nombres y columnas de las vistas (`db`; mensaje enviado el 19-10-2026).
2. [ ] Migración `0NN_vistas_catalogo.{up,down}.sql`, probada `up → down → up` en `learnity_test` (`db`, Fase 1). Aplicarla a `Learnity` tras la Puerta DB.
3. [ ] Caracterización del JSON exacto de `GET /cursos` (filtros, orden, paginación) y `GET /cursos/:id` (404 de borrador, sin `ruta`) (`qa-edge`, Fase 2A).
4. [ ] Crear `modules/catalogo` y quitar las lecturas públicas de `cursos.repository.ts` y `cursos.service.ts` (`be-a` y `be-b`, Fase 2B, lote A2).

## Cómo se verifica

- La caracterización de `qa-edge` pasa sin cambiar expectativas antes y después del cambio.
- `grep -nE "FROM (curso|categoria|modulo|leccion|archivo)\b" backend/src/modules/catalogo/*.repository.ts` → vacío: solo lee vistas.
- En `learnity_test`: `SELECT column_name FROM information_schema.columns WHERE table_name IN ('catalogo_curso','catalogo_temario')` no devuelve `ruta`, `id_archivo` ni `nombre_original`.
- `openapi.yaml` sin cambios.
