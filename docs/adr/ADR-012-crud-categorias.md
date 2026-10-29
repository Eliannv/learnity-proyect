# ADR-012: CRUD de categorías para el administrador (A3)

- **Estado:** Propuesto
- **Fecha:** 2026-10-19
- **Nota (29-10-2026):** la pantalla y el cliente de este ADR viven ahora en `frontend/src/app/features/admin/categorias/` (`categorias.api.ts`, `categorias.routes.ts`), tras la reorganización de carpetas de Sprint 4.
- **Decisores:** el usuario. Propone: `arquitecto`, y coordinan `be-a` (módulo), `fe-a` (pantalla) y `db` (migración 027).
- **Cambia el contrato:** **Sí, lo amplía.** Añade 3 operaciones (de 33 a 36), los esquemas `CategoriaAdmin`, `DatosCategoriaNueva` y `DatosCategoria`, y el código de error `CATEGORIA_DUPLICADA`. Las 33 operaciones que ya existen, `GET /api/categorias` incluida, no cambian.
- **Pruebas de caracterización que actualiza:** ninguna. Las pruebas de las rutas nuevas son nuevas (ver *Acciones*).
- **Tipo de trabajo:** funcionalidad nueva del Sprint 2, decidida en D1/D2 (lote A3, Fase 2B), en commits `feat` separados del refactor.

## Contexto

- **Requisito.** Sprint 2, P1: "CRUD completo de categorías; el P0 puede usar categorías ya creadas en el seed" (`SPRINT_2_LEARNITY.md:117`). Criterio de terminado: "API real para CRUD de categorías, cursos, módulos y lecciones" (`PLAN_SPRINTS_LEARNITY.md:51`). Hoy solo existe la lectura pública `GET /api/categorias` (`cursos.routes.ts:11`), que devuelve las activas (`cursos.repository.ts`, `categoriasPublicas`).
- **Tabla** (`database/learnity_esquema.sql:71-78`): `categoria (id_categoria identity, nombre VARCHAR(80) NOT NULL UNIQUE, descripcion VARCHAR(300), activa BOOLEAN NOT NULL DEFAULT TRUE, creada_por → persona NOT NULL, creado_en)`. `curso.id_categoria` es `NOT NULL REFERENCES categoria` y no tiene `ON DELETE` (`:83`). El `UNIQUE` de `nombre` distingue mayúsculas: hoy caben "Diseño" y "diseño". La 021 añade `actualizado_en` con trigger y la 020 audita `categoria` (`020_auditoria.up.sql:105`).
- **Permisos.** Con la 019, `learnity_app` solo tiene `SELECT, INSERT` sobre `categoria` (`019_privilegios_minimos.up.sql:53`). Un `UPDATE` daría 42501 → 500. La 019 todavía **no** está aplicada en `Learnity` (Puerta DB, Fase 3), así que hoy el CRUD funcionaría allí, pero dejaría de hacerlo al aplicar la 019 sin una migración nueva.
- **Quién usa `categoria.activa` hoy:**
  - `GET /api/categorias` muestra solo las activas. Con el ADR-002 lo hará la vista `catalogo_categoria` (`026_vistas_catalogo.up.sql:37-41`).
  - El catálogo (`GET /api/cursos` y `GET /api/cursos/{id}`) **no** filtra por categoría activa (C-17, RG-53, CAR-CAT-16 y CAR-CAT-22). Un curso PUBLICADO sigue visible aunque su categoría se desactive. El filtro `?categoria=<nombre>` compara por **nombre** (`cursos.repository.ts:55-56`).
  - Crear o editar un curso exige una categoría existente y activa: 400 `SOLICITUD_INVALIDA` con `detalles[{campo:'categoriaId'}]` (`cursos.service.ts:174-187` y `:247`).
  - La completitud exige categoría activa (`cursos-integracion.service.ts:122`). Por eso un BORRADOR o un RECHAZADO con categoría inactiva no se puede enviar a revisión (400), y un curso EN_REVISION no se puede aprobar (409 `CURSO_INCOMPLETO`, `:581-588`).
- **Pantalla.** `pages/admin/categorias/categorias.ts` (de `fe-a`; ruta `admin/categorias`, que ya carga `features/admin-categorias/admin-categorias.routes.ts`) usa `CATEGORIAS_ADMIN` de `datos-demo` (`data/datos-demo.ts:423-430`). Muestra nombre, icono, cursos, **estudiantes** y estado, con "Nueva categoría", "Editar" y "Activar/Desactivar", pero ninguno de esos botones llama a la API. Los estudiantes salen de `inscripcion`, que es del Sprint 3.
- **Arquitectura destino.** `modules/categorias` (de `be-a`) escribe `categoria` y la lee desde su propio repositorio, también las inactivas, no desde la vista pública (ADR-001 §5, ADR-002 y `CONTRATOS_SERVICIO.md` §3.3). La lectura pública es de `catalogo` (A2).

## Decisión propuesta

### 1. Rutas (todas `autenticar` → `autorizar('ADMIN')`, como `/admin/cursos*` y `/admin/solicitudes*`)

| Operación | Entrada | Éxito | Errores |
|---|---|---|---|
| `GET /api/admin/categorias` | — (sin consulta: un parámetro desconocido da 400, con `z.strictObject({})`) | 200 `CategoriaAdmin[]`, **todas** (activas e inactivas), ordenadas por `nombre ASC, id ASC`, sin paginar | 400, 401, 403, 500 |
| `POST /api/admin/categorias` | cuerpo `DatosCategoriaNueva` | 201 `CategoriaAdmin` (nace activa, con `creada_por` = `usuario.idPersona`) | 400, 401, 403, 409 `CATEGORIA_DUPLICADA`, 413, 415, 500 |
| `PUT /api/admin/categorias/{id}` | `id` con `idRuta` (11.11) y cuerpo `DatosCategoria` (reemplazo completo) | 200 `CategoriaAdmin` | 400, 401, 403, 404 `NO_ENCONTRADO`, 409 `CATEGORIA_DUPLICADA`, 413, 415, 500 |

**No hay `DELETE`.** Retirar una categoría es desactivarla: `PUT` con `activa: false` (ver la opción A). Los 413 y 415 son los del parser JSON (11.6) y se declaran igual que en las otras operaciones con cuerpo.

### 2. Esquemas

- **`CategoriaAdmin`:** `{ id: number, nombre: string, descripcion: string | null, activa: boolean, cursos: number, cursosPublicados: number }`. `cursos` cuenta los cursos de cualquier estado con esa categoría y `cursosPublicados`, los PUBLICADO. Sirven para avisar antes de desactivar. **No** hay `estudiantes`, porque las inscripciones son del Sprint 3: la columna se quita de la pantalla.
- **`DatosCategoriaNueva`** (`z.strictObject`): `nombre` y `descripcion?`.
- **`DatosCategoria`** (`z.strictObject`): `nombre`, `descripcion?` y `activa: boolean` (obligatorio).
- **Reglas de los campos** (con `textoSeguro()` de `shared/http/esquemas.ts`, sin NUL):
  - `nombre`: `trim`, normalizado a NFC, de 1 a 80 caracteres.
  - `descripcion`: `trim`, NFC, hasta 300; si llega vacía o no llega, se guarda `NULL`.
  - Mensajes en español y 400 `SOLICITUD_INVALIDA` con `detalles[{campo, mensaje}]`, igual que el resto (ADR-006).

### 3. Reglas de negocio (servicio de `categorias`)

1. **Nombre único sin distinguir mayúsculas.** Antes de insertar o renombrar, el servicio busca `lower(nombre) = lower($1)` en otra fila y, si la encuentra, responde 409 `CATEGORIA_DUPLICADA` ("Ya existe una categoría con ese nombre."). Si dos administradores crean a la vez, la carrera la cierra el índice único de la 027: el repositorio traduce el `23505` de `categoria_nombre_key` o de `categoria_nombre_minusculas_uq` a ese mismo 409, en vez del `CONFLICTO` genérico del manejador.
2. **Desactivar con cursos asociados está permitido.** No toca ningún curso, y sus efectos son los de §4. La pantalla avisa con `cursos` y `cursosPublicados` antes de confirmar.
3. **Escrituras dentro de `enTransaccion`**, con el actor de auditoría (`set_config('learnity.id_persona', $1, true)`, mediante el ayudante de `shared/database`). Además se registra `registrarEvento('categoria_creada' | 'categoria_actualizada', { idCategoria, activa })`, sin el nombre ni la descripción.
4. **Un `PUT` es un reemplazo completo** (como `PUT /cursos/{id}`). La pantalla envía los tres campos. Si dos administradores editan a la vez, gana el último en escribir; se acepta porque son pocos y no hay control optimista en ninguna otra ruta.

### 4. Efectos sobre el resto (sin cambiar ninguna operación existente)

| Al… | `GET /api/categorias` | Catálogo (`GET /api/cursos`, detalle) | Cursos del docente |
|---|---|---|---|
| crear | aparece | — | se puede elegir |
| renombrar | sale con el nombre nuevo | los cursos muestran `categoria.nombre` nuevo. El filtro `?categoria=` usa el nombre, así que un enlace guardado con el nombre viejo da 0 resultados (no da error) | sin cambios |
| desactivar | desaparece | **sin cambios**: los PUBLICADO siguen visibles y el filtro por su nombre sigue funcionando (comportamiento actual, C-17) | crear o editar con ella: 400. BORRADOR o RECHAZADO: no se puede enviar a revisión hasta cambiar de categoría. EN_REVISION: el administrador no puede aprobar (409 `CURSO_INCOMPLETO`); rechaza o reactiva la categoría |
| reactivar | vuelve a aparecer | sin cambios | vuelve a ser válida |

Que una categoría desactivada también oculte sus cursos publicados sería un cambio de comportamiento del catálogo (CAR-CAT-16 y CAR-CAT-22). **No forma parte de este ADR** (ver la opción D2).

### 5. Base de datos: migración `027` (de `db`)

- `GRANT UPDATE ON categoria TO learnity_app`. Sin `DELETE`.
- Comprobación previa: si `SELECT lower(nombre) FROM categoria GROUP BY 1 HAVING count(*) > 1` devuelve filas, aborta con un mensaje que las lista. Después, `CREATE UNIQUE INDEX categoria_nombre_minusculas_uq ON categoria (lower(nombre))`. El `UNIQUE` original se mantiene.
- `down`: `DROP INDEX` y `REVOKE UPDATE`. Depende de la 019 (y de la 018 para el dueño). Se prueba `up → down → up` en `learnity_test`, y se actualizan la matriz de privilegios de `database/verificacion/` y RG-60.
- **Orden:** la 027 va en el **mismo lote** que la 019 en la Puerta DB. Si se aplicara la 019 sin la 027, el `PUT` daría 500 (42501). `db` decide si separa el índice y el permiso en dos migraciones.

### 6. Módulo y pantalla

- **Backend (`be-a`)** — `modules/categorias/` con la plantilla (`PLANTILLA_MODULO.md`):
  - `index.ts` exporta solo `categoriasRoutes`, y `app.ts` lo monta.
  - El repositorio lee `categoria` y cuenta `curso` por `id_categoria`, solo para leer. Esa lectura se documenta en `CONTRATOS_SERVICIO.md` §3.3.
  - Sin dependencias de otros módulos.
  - Pruebas en `backend/test/categorias/**`, con `guardia-bd.ts`.
- **Frontend (`fe-a`)** — `features/admin-categorias/`:
  - un contenedor y componentes de presentación (tabla y formulario en el modal accesible de `shared/ui`);
  - un cliente `admin-categorias.api.ts` tipado con los tipos generados del contrato (ADR-008), que `fe-b` regenera con `npm run api:tipos`;
  - los estados de carga, vacío y error (`shared/ui/estado-vista`), y los errores con `core/http/error-api`;
  - AA y 390 px;
  - el icono se toma de `ICONO_CATEGORIA` (`shared/ui/tipos-ui.ts`), con uno por defecto para los nombres nuevos;
  - se borra `pages/admin/categorias` (o se convierte en el contenedor) y desaparece el uso de `CATEGORIAS_ADMIN`.
- **Editor de curso (`fe-b`):** si el curso tiene una categoría inactiva, el selector (que carga `GET /api/categorias`) no la ofrece. Debe mostrar la actual como "(inactiva)" con `categoriaNombre` del detalle, para que el docente entienda el 400 y elija otra. Comportamiento actual de la pantalla en ese caso: **NO VERIFICADO**.

## Opciones consideradas

### Opción A: borrado lógico, solo `activa = false` mediante `PUT` (elegida)

| Dimensión | Valoración |
|---|---|
| Complejidad | Baja: 3 rutas y una migración de permisos e índice |
| Riesgo de regresión | Bajo: no toca `curso` y las reglas de "categoría activa" ya existen y están probadas (CAR-CUR-10, CAR-REV-09) |
| Impacto en el contrato | Amplía con 3 operaciones; ninguna existente cambia |
| Familiaridad del equipo | Alta: mismo patrón que `PUT /admin/solicitudes/{id}` |

**A favor:**
- Coincide con la pantalla, que ya tiene "Activar/Desactivar" y no tiene "Eliminar".
- Conserva el historial de cursos y la auditoría.
- La app no necesita `DELETE`.

**En contra:**
- Una categoría creada por error queda en la lista como inactiva.
- El nombre sigue ocupado, aunque se puede renombrar.

### Opción B: A más `DELETE /api/admin/categorias/{id}` físico, solo si ningún curso la usa

| Dimensión | Valoración |
|---|---|
| Complejidad | Media: otra ruta, comprobar el uso con bloqueo y `GRANT DELETE` |
| Riesgo de regresión | Bajo, pero sin el control previo el `23503` de la FK acabaría en 400 `SOLICITUD_INVALIDA` (C-13), un código engañoso. Haría falta 409 `CATEGORIA_EN_USO` |
| Impacto en el contrato | Una operación y un código de error más |
| Familiaridad del equipo | Alta |

**A favor:** limpia los errores de tecleo. **En contra:** da a la app un privilegio destructivo que no necesita; la fila borrada solo queda en la auditoría (y solo con la 020); añade una carrera con la creación de cursos (hay que bloquear la categoría con `FOR UPDATE` frente a un `INSERT curso` concurrente). Se puede añadir más adelante con otro ADR si se echa en falta.

### Opción C: borrado físico con reasignación o cascada de cursos

| Dimensión | Valoración |
|---|---|
| Complejidad | Alta |
| Riesgo de regresión | Alto: modifica cursos PUBLICADO, y el `CHECK NOT VALID` de la 023 se evalúa en cada `UPDATE curso` (falla con los 3 heredados sin revisor, BD-022) |
| Impacto en el contrato | Amplio |
| Familiaridad del equipo | Media |

**A favor:** ninguna ventaja que el usuario haya pedido. **En contra:** cambia cursos de otros docentes, choca con BD-022 y no tiene pantalla. Descartada.

### Decisiones secundarias

| Tema | Opción elegida | Alternativa | Por qué |
|---|---|---|---|
| Unicidad del nombre | **D1-B:** sin distinguir mayúsculas (comprobación previa e índice `lower(nombre)` en la 027) | D1-A: solo el `UNIQUE` actual, que distingue mayúsculas | El catálogo filtra por nombre exacto, y dos categorías "Diseño" y "diseño" confundirían a docentes y visitantes. Coste: un índice y una comprobación previa |
| Catálogo con categoría inactiva | **D2-A:** sin cambios (sus cursos PUBLICADO siguen visibles) | D2-B: ocultarlos en `GET /api/cursos` y en el detalle | D2-B cambia una operación existente (CAR-CAT-16/22), las vistas de la 026 y el ADR-002. Si el usuario lo quiere, va en otro ADR |
| Forma de la edición | **D3-A:** `PUT` completo con `activa` | D3-B: `PATCH .../activa` aparte | El proyecto solo usa `PUT`, y un único esquema simplifica el cliente tipado |
| Columna "Estudiantes" | **D4-A:** se quita | D4-B: contar `inscripcion` | Las inscripciones son del Sprint 3 (fuera del alcance); hoy siempre darían 0 |

## Análisis de compromisos

La opción A cubre el requisito (crear, editar, activar y desactivar) con el menor privilegio y sin tocar `curso`, que es la tabla con más reglas (ADR-003 y BD-022). Las reglas de "categoría activa" que ya existen en Cursos dan el efecto esperado sin código nuevo en ese módulo. El único coste visible es que una categoría no se puede borrar, solo ocultar, y eso coincide con lo que la pantalla ya muestra.

## Consecuencias

- **Más fácil:**
  - el administrador gestiona las categorías sin SQL ni seed;
  - `features/admin-categorias` deja `datos-demo`, con lo que avanza el cierre de A3 y D1;
  - el contrato y los tipos generados cubren las rutas nuevas.
- **Más difícil:**
  - la 027 queda atada a la 019 en la Puerta DB;
  - `openapi*.ts` crece (un parcial nuevo, `openapi-categorias.ts`);
  - `comparar-rutas` pasa a esperar 36 operaciones.
- **A revisar:**
  - un enlace guardado con el nombre viejo de una categoría renombrada da 0 resultados en el catálogo;
  - un curso EN_REVISION con categoría desactivada no se puede aprobar hasta que se reactive o se rechace (hoy ya ocurre si alguien cambia `activa` por SQL);
  - el selector del editor de cursos (punto de `fe-b`).

## Acciones (solo si el usuario lo aprueba)

1. [ ] Contrato: el parcial `openapi-categorias.ts` (tag "Categorías (administración)"), el `openapi.yaml` regenerado y `CONTRATOS_SERVICIO.md` §1 y §3.3 (`arquitecto`, 2B, antes del código).
2. [ ] Migración 027, con su `down`, la prueba `up → down → up` en `learnity_test`, la matriz de privilegios y RG-60 (`db`).
3. [ ] `modules/categorias` y su `index.ts`, el montaje en `app.ts` y las pruebas en `backend/test/categorias/**` (`be-a`, commits `feat`).
4. [ ] Pruebas nuevas (`qa-edge`, IDs a su elección, p. ej. `ADM-CAT-nn`):
   - 401, y 403 para ESTUDIANTE y DOCENTE;
   - `id` no decimal → 400 `id`;
   - nombre de 0, 80 y 81 caracteres, con NUL, solo espacios y en NFD;
   - duplicado con otra capitalización → 409;
   - dos `POST` concurrentes con el mismo nombre → un 201 y un 409;
   - desactivar → desaparece de `GET /api/categorias`, y sus cursos PUBLICADO **siguen** en `GET /api/cursos`;
   - aprobar un curso EN_REVISION con la categoría desactivada → 409 `CURSO_INCOMPLETO`;
   - sin residuos.
5. [ ] `npm run api:tipos` después del contrato (`fe-b`), y `features/admin-categorias` sin `datos-demo` (`fe-a`, commits `feat`).
6. [ ] Mostrar en el editor de curso la categoría inactiva actual (`fe-b`).

## Cómo se verifica

```bash
# Contrato (scripts de docs/api/COMPARACION_RUTAS.md §1):
verificar-openapi.mts      # IDÉNTICO · operaciones 36
comparar-rutas.mjs         # rutas reales: 36 · operaciones en el spec: 36 · 0 y 0
# Las 33 operaciones previas sin cambios:
git diff <commit-previo> -- docs/api/openapi.yaml   # solo añade paths /admin/categorias*, 3 esquemas y CATEGORIA_DUPLICADA

# Módulo (R1–R11 de PLANTILLA_MODULO.md):
grep -rnE "from '\.\./" backend/src/modules/categorias | grep -v "\.\./\.\./shared/"   # vacío
grep -nE "(FROM|JOIN) catalogo_" backend/src/modules/categorias/*.repository.ts       # vacío: lee la tabla, no la vista
grep -rn "DELETE" backend/src/modules/categorias                                      # vacío

# Base (learnity_test con 019 y 027 aplicadas):
SELECT has_table_privilege('learnity_app','categoria','UPDATE'),   -- t
       has_table_privilege('learnity_app','categoria','DELETE');   -- f
SELECT indexname FROM pg_indexes WHERE indexname = 'categoria_nombre_minusculas_uq';  -- 1 fila

# Frontend:
grep -rn "datos-demo\|CATEGORIAS_ADMIN" frontend/src/app/features/admin-categorias frontend/src/app/pages/admin/categorias   # vacío
npx ng build && npx ng test --watch=false   # verde
```

Además: la suite completa en verde **sin cambiar ninguna expectativa existente** (CAR-CAT-*, CAR-CUR-10 y CAR-REV-09 siguen igual) y R9b (tipos al día).
