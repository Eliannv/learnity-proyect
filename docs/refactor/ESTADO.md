# Estado del refactor de Learnity

> Solo lo escribe el lead. Los teammates informan por mensaje con el formato de `REGLAS_EQUIPO.md`.

## Fase actual

**Fase 1: diseño** (`arquitecto`, `db` y `qa-edge`; solo escriben documentos y migraciones sin aplicar). Empezó el 19-10-2026. Siguiente puerta: **Puerta 1** (allí se preguntan D3 y D4, y se aprueban o rechazan los ADR de D9).

### Fase 0B: línea base (cerrada, Puerta 0B aprobada el 19-10-2026)

| Paso | Estado |
|---|---|
| Paso 2: verificación de la auditoría | Hecho. **Puerta V aprobada (19-10-2026)** |
| `REGLAS_EQUIPO.md`, `CLAUDE.md`, `ESTADO.md` | Hecho |
| Decisiones D10 → D5 → D7 → D6 | Hecho (19-10-2026) |
| Rama `integration/sprint-2` | Hecho. Creada desde `origin/Edison` (`ce5e83c`), sin upstream para que un push no pueda apuntar a `Edison`. Commits D5: `6524aa1` (docs) y `fc840a3` (`contrasena.ts`) |
| `.worktrees/` en `.gitignore` | Hecho (`317b392`) |
| `learnity_test` creada y `.env.test` corregido | Hecho (19-10-2026), ver *Línea base* |
| Línea base verde (backend 78; frontend 20/20) | Hecho (19-10-2026), ver *Línea base* |
| Etiqueta `baseline-pre-refactor` | Hecho (19-10-2026): etiqueta anotada y local en `654824d`, con permiso del usuario. Sin push |
| **Puerta 0B** | **Aprobada por el usuario (19-10-2026)** |
| `main` local con `--ff-only` a `baseline-pre-refactor` (D6) | Hecho (19-10-2026), con el visto bueno del usuario: `55fc8ff..654824d`, fast-forward (`reflog`: `main@{0}`). Sin push: `origin/main` sigue en `4109368` |

### Línea base (Fase 0B, 19-10-2026)

**`learnity_test`.** La creó el lead con `postgres`, por instrucción expresa del usuario ("tú crea todo"), con `crear-learnity-test.sql` (README §14, fuera del repositorio). La contraseña no se guardó en ningún archivo, documento ni commit. Verificación posterior como `postgres` sobre `learnity_test`:

```
     base      | tablas | roles | tablas_con_dml | secuencias | duenio_postgres | connect_app
 learnity_test |     22 |     3 |             22 |         20 |              22 | t
```

**`.env.test`.** Lo ajustó el script `ajustar-env-test.mjs` sin imprimir valores.
- Copia de seguridad: `backend/.env.test.bak-20261019` (ignorada por git).
- Claves fijadas: `NODE_ENV=test`, `DB_HOST`, `DB_PORT=5432`, `DB_NAME=learnity_test`, `DB_USER=learnity_app`, `DB_SSL=false`, `CORREO_TRANSPORTE=buzon`, `HIBP_ACTIVO=false` y `PDF_DIR=uploads/pdf-test`.
- `DB_PASSWORD` se copió de `.env`: es la misma cuenta `learnity_app` en el mismo servidor.

**Guarda previa a `npm test`** (`verificar-env-test.mjs`): las 11 comprobaciones dieron `OK` → `APTO para npm test`.

**Salidas** (HEAD `317b392`):

```
backend  npm run build      → exit 0
backend  npm run typecheck  → exit 0
backend  npm test           → exit 0
  ℹ tests 78 · suites 16 · pass 78 · fail 0 · cancelled 0 · skipped 0 · duration_ms 31446
  (la prueba de HIBP se excluye con --test-skip-pattern, así que no cuenta como "skipped": 79 it( − 1 = 78)
frontend npx ng build              → exit 0 · Initial total 363.80 kB (101.58 kB transferidos)
frontend npx ng test --watch=false → exit 0 · Test Files 5 passed (5) · Tests 20 passed (20)
```

**`Learnity` intacta tras la suite** (`verificar-bd.mjs`): BD-0 a BD-10 y BD-14 dan `OK`, con los mismos valores del 18-10-2026 (3 cursos inconsistentes; 2 filas en `archivo` = 2 PDF). BD-11 a BD-13 cambian como se esperaba: `learnity_test` ya existe y `.env.test` apunta a ella.

**Siguiente puerta:** Puerta 0B.

### Resultado de la verificación (Paso 2)

Detalle en `docs/refactor/VERIFICACION_AUDITORIA.md`.

- **Resultado:** de 94 afirmaciones, 86 se confirman, 7 cambiaron, 1 es una observación y ninguna quedó sin verificar. La base `Learnity` coincide en las 21 comprobaciones.
- **Git:** HEAD `ce5e83c` (= `origin/Edison`).
- **Builds del 18-10-2026:**
  - backend: `build` y `typecheck` → exit 0;
  - frontend: `ng build` → exit 0 (363,80 kB); `ng test` → 20/20.
- **Impacto en el plan:**
  1. `identidad.test.ts` y `cursos-publicos.test.ts` no exigen que la base termine en `_test`. Antes de cada `npm test` se comprueba `.env.test`, y en la Fase 2A llega `guardia-bd.ts`.
  2. `server.ts:36-47` tiene SQL fuera de repositorio (lo resuelve `be-a`).
  3. `main.ts`, `index.html` y `app.spec.ts` se asignan a `fe-a`.
  4. Las herramientas de PostgreSQL no están en el PATH: se usan desde `C:\Program Files\PostgreSQL\17\bin\`.

## Decisiones del usuario

| # | Decisión | Respuesta | Fecha |
|---|---|---|---|
| D1 | ¿Lo que falta del Sprint 2 se completa antes o dentro del refactor? | **Dentro**: Fase 2B, después de caracterizar cada módulo, en tareas y commits separados marcados como funcionalidad nueva. Cubre el CRUD de categorías (A3, con un ADR previo del `arquitecto`) y los datos reales en el inicio y el encabezado (A2) | 18-10-2026 |
| D2 | ¿El CRUD de categorías es P0 o P1? | **Resuelto con D1**: se completa en el lote A3 | 18-10-2026 |
| Alcance BD | ¿Qué entorno y qué bases de prueba? | Solo local, sin producción. Una única base de pruebas, `learnity_test`, compartida, sin clon `learnity_refactor` ni bases por desarrollador | 18-10-2026 |
| Puerta V | ¿Se aprueba la verificación de la auditoría? | **Aprobada** | 19-10-2026 |
| Puerta 0B | ¿Se aprueba la línea base? | **Aprobada** | 19-10-2026 |
| D10 | ¿Endureces `.claude/settings.local.json` con los equivalentes `PowerShell(…)`? | **Sí.** El usuario lo guardó y el lead lo comprobó: JSON válido y 30 reglas `deny`, entre ellas `PowerShell(git push/reset --hard/clean/branch -D)`, `Remove-Item -Recurse`, la lectura de `.env*` por Bash y por PowerShell, y `git push` sin argumentos. Son reglas por patrón: frenan errores, pero no son una barrera infalible | 19-10-2026 |
| D5 | ¿Se versionan `contrasena.ts` y los documentos del Sprint 2? | **A) Todo, en dos commits, solo en `integration/sprint-2`.** (1) `docs: documentos del Sprint 2 y del arranque del refactor` (documentos del Sprint 2, `PROMPT_INICIO_REFACTOR.md`, `docs/refactor/**` y `CLAUDE.md`). (2) `chore: ajusta comentario en contrasena.ts` (una línea de comentario, sin cambio de comportamiento). Revisados: no contienen secretos | 19-10-2026 |
| D7 | ¿Quién ejecuta las operaciones con `postgres`? | **A) El usuario ejecuta todo lo que requiere `postgres`** (crear `learnity_test`, esquema, 015/016, permisos, `pg_dump` y migraciones sobre `Learnity`), con scripts preparados por el lead (Fase 0B) o por `db` (desde la Fase 1). Los ejecuta con `psql` desde `C:\Program Files\PostgreSQL\17\bin\` y pega la salida. Nadie del equipo usa credenciales de `postgres`. Alcance: entorno local y una única `learnity_test` compartida (18-10-2026). **Excepción del 19-10-2026:** el usuario pidió al lead crear `learnity_test` él mismo y le dio la contraseña de `postgres` en el chat. Se usó solo como variable de entorno en esos comandos y no se guardó. La regla general de D7 sigue vigente para los teammates | 19-10-2026 |
| D6 | ¿Cuándo se actualiza `main`? | **A)** Tras la Puerta 0B, y con aprobación explícita de ese paso, el `main` **local** avanza con `git merge --ff-only baseline-pre-refactor` (hoy `main` = `55fc8ff`, ancestro de `ce5e83c`). El push a `origin/main` solo se hace si el usuario lo pide. Durante el refactor `main` no se toca; el siguiente avance se propone en la Fase 3 | 19-10-2026 |
| D8 | ¿El catálogo pasa a ser un módulo de lectura con vistas? | **A) Sí.** `modules/catalogo` (`be-a`) lee solo de vistas SQL de solo lectura (por ejemplo `catalogo_curso` y `catalogo_detalle`) creadas por `db` en una migración `up`/`down`, que solo exponen columnas públicas (nunca `archivo.ruta`). El JSON y las rutas no cambian. Requiere el ADR-002 (`arquitecto`), la migración probada `up → down → up` en `learnity_test` y la Puerta DB para aplicarla a `Learnity` | 19-10-2026 |
| D9 | ¿Se aceptan las dependencias nuevas (`openapi-typescript`, `@playwright/test`, `pg_trgm`)? | **A) Las tres son candidatas.** El `arquitecto` escribe un ADR por cada una (alternativas y consecuencias). El usuario las aprueba o rechaza en la Puerta 1. Nada se agrega a `package.json` ni a migraciones sin ese ADR aprobado | 19-10-2026 |
| D3 | ¿Se borran los paneles huérfanos o se restauran? | *Pendiente*: se pregunta en la Puerta 1 | |
| BD-022 | ¿Cómo se corrigen los 3 cursos PUBLICADO sin revisor? (A: pasan a EN_REVISION; B: revisor = el ADMIN con menor id, propuesta de `db`; C: no se corrigen y se aplaza el CHECK) | *Pendiente*: se pregunta en la Puerta 1 | |
| BD-019b | ¿Cómo limpian las pruebas con privilegios mínimos? (1: rol `learnity_pruebas` heredado por `learnity_app` solo en _test, propuesta de `db`; 2: conexión de fixtures con otro login; 3: `learnity_pruebas` concedido `WITH INHERIT FALSE, SET TRUE` y un pool de fixtures con `SET ROLE`, propuesta de `qa-edge` para que la app corra con el mismo mínimo privilegio que en `Learnity`; NO VERIFICADA) | *Pendiente*: se pregunta en la Puerta 1 | |
| D4 | ¿Las pantallas del Sprint 3/4 van detrás de un flag? | *Pendiente*: se pregunta en la Puerta 1 | |

## Teammates activos

| Teammate | Modelo | Worktree / rama | Fase | Estado |
|---|---|---|---|---|
| `arquitecto` | Opus 5.5 | `.worktrees/arquitecto` / `refactor/arquitecto` | 1 | Activo: **plan aprobado (19-10-2026)**, trabajando en E1 (openapi.yaml y COMPARACION_RUTAS.md) → E2 (ADR 001–007) → E3 (ADR 008–011) → E4 (plantilla y contratos) |
| `db` | Opus 5.5 | `.worktrees/db` / `refactor/db` | 1 | Activo: **plan aprobado (19-10-2026)**, escribiendo PLAN_BD y migraciones 017–026, más la propuesta de pg_trgm |
| `qa-edge` | Opus 5.5 | `.worktrees/qa-edge` / `refactor/qa-edge` | 1 | **Fase 1 terminada y cerrado (19-10-2026).** Se reactiva en la 2A con su worktree y su rama |

Equipo completo (7), que se activa por fases con un máximo de 6 simultáneos: Fase 1 `arquitecto`, `db` y `qa-edge`; Fases 2A y 2B `arquitecto`, `qa-edge`, `be-a`, `be-b`, `fe-a` y `fe-b`; Fase 3 `qa-edge`, `db`, `arquitecto` y `be-a`/`be-b` si hacen falta.

**Turno de la base `learnity_test`:** libre.

## Tareas y dueños

### Propiedad de carpetas

Copia de la §6 del prompt del lead, con las correcciones de la verificación. Solo el dueño edita.

| Dueño | Archivos |
|---|---|
| `arquitecto` | `docs/adr/**`, `docs/api/**`, `docs/arquitectura/**`, `backend/src/shared/http/openapi*.ts`, `backend/package.json`, `backend/tsconfig*.json`, `frontend/package.json`, `frontend/angular.json`, `frontend/tsconfig*.json`, `README.md` |
| `db` | `database/**`, `docs/bd/**` |
| `qa-edge` | `backend/test/caracterizacion/**`, `backend/test/seguridad/**`, `backend/test/ayudas/**`, `e2e/**`, `docs/refactor/RIESGOS.md`, `docs/refactor/PLAN_PRUEBAS.md` |
| `be-a` | `backend/src/app.ts`, `backend/src/server.ts`, `backend/src/shared/{config,auth,http,log,correo,seguridad}/**` (excepto `openapi*.ts`), `backend/src/modules/{identidad,catalogo,categorias,usuarios}/**`, `backend/test/{identidad,catalogo,categorias,usuarios}/**`, `backend/test/{identidad,cursos-publicos,solicitudes-docente}.test.ts` |
| `be-b` | `backend/src/shared/{database,archivos}/**`, `backend/src/modules/{cursos,contenido,revision,administracion}/**`, `backend/src/database/seed.ts`, `backend/scripts/**`, `backend/test/{cursos,contenido,revision}/**`, `backend/test/{pdf-validacion,administracion-contenido,cursos-gestion,cursos-gestion-http}.test.ts` |
| `fe-a` | `frontend/src/{main.ts,index.html}`, `frontend/src/app/{app.ts,app.spec.ts,app.config.ts,app.routes.ts}`, `frontend/src/environments/**`, en `frontend/src/app/`: `core/{auth,http,solicitudes}/**`, `layouts/**`, `shared/{layout,validadores}/**`, `features/{identidad,catalogo,admin-categorias,usuarios}/**`, `pages/{auth,cuenta,publico}/**`, `pages/estudiante/perfil/**`, `pages/admin/{categorias,usuarios,solicitudes}/**` |
| `fe-b` | `frontend/src/styles.scss`, en `frontend/src/app/`: `core/{api,cursos,estado}/**`, `shared/{ui,cursos}/**`, `features/{docente-cursos,contenido,revision}/**`, `pages/docente/{mis-cursos,editor-curso,panel}/**`, `pages/admin/{revision-cursos,revision-curso,panel}/**`, `data/datos-demo.ts` (solo para sacar los tipos de UI) |
| lead | `CLAUDE.md`, `docs/refactor/{REGLAS_EQUIPO,ESTADO,VERIFICACION_AUDITORIA}.md`, `.gitignore`, la rama `integration/sprint-2` y las etiquetas |
| **Congelado** (nadie lo edita) | `backend/src/modules/{aprendizaje,evaluaciones}/**`; `pages/estudiante/{inicio-estudiante,mi-aprendizaje,leccion,evaluacion}/**`; `pages/docente/{editor-evaluacion,estudiantes}/**`; `shared/layout/vista-previa-aprendizaje.ts` (prevalece sobre `fe-a`). Excepción: el flag de D4 en `app.routes.ts` |

### Tareas abiertas

| Tarea | Dueño | Estado |
|---|---|---|
| Fase 0B: línea base | lead | Hecho |
| `docs/api/openapi.yaml` (contrato actual) y `docs/api/COMPARACION_RUTAS.md` (hallazgos C-01–C-18) | `arquitecto` | Hecho e integrado (`ff37b06`). 33/33 operaciones coinciden con las rutas reales. Solo C-14 (500 ante JSON mal formado o >1 MB) es de contrato (ADR-006); C-01/C-02 van al ADR-011; el resto es documentación |
| ADR 001–011 | `arquitecto` | Integrados (`0e754bf`, `2d9265e`). Ajuste pendiente: el ADR-011 debe incluir C-14/H1, H4+S6, H5 y H11 como puntos opcionales; el ADR-002 debe recoger las vistas acordadas con `db` (`catalogo_curso`, `catalogo_temario` y `catalogo_categoria` propuesta). ADR-010 recomienda aplazar `pg_trgm` |
| `docs/arquitectura/PLANTILLA_MODULO.md` (lista de revisión de integración R1–R11) y `CONTRATOS_SERVICIO.md` | `arquitecto` | Integrados (`157fe81`) |
| `docs/bd/PLAN_BD.md` y migraciones 017–026 (`up`/`down`): control de migraciones, roles y dueños, privilegios mínimos (+019b solo en _test), auditoría, `actualizado_en`, corrección de cursos (022), CHECK PUBLICADO (023), solicitud pendiente única, índices de FK, vistas del catálogo (D8); `pg_trgm` como propuesta sin número | `db` | En curso: PLAN_BD (`5d0819d`) y 017–021 (`35c7775`) escritos, **sin ejecutar** (NO VERIFICADO hasta el turno en `learnity_test`). No se integran hasta pasar el ciclo `up → down → up`. Faltan 022–026, los scripts, `database/README.md` y `pg_trgm` |
| Seam estable para inyectar fallos de disco y BD que sobreviva al refactor (RG-06/H9); revisar `pool.ts:29-40`: si la conexión murió, el ROLLBACK del catch falla y oculta el error original, y `release()` se llama sin el error, con lo que el pool podría reutilizar un cliente roto (NO VERIFICADO, qa-edge) | `be-b` (con `qa-edge`) | Fase 2A |
| Corregir la dependencia invertida `shared/cursos/peticion.ts:4` → `pages/auth/mensaje-error` (detectada en el ADR-007) al mover `peticion.ts` a `core/estado` | `fe-b` (con `fe-a`, dueño de `pages/auth`) | Fase 2A |
| Ajustar el arreglo de datos de las pruebas para fijar `revisado_por` y `publicado_en` en los cursos PUBLICADO (requisito para aplicar la 023) | `be-a` (`cursos-publicos.test.ts`) y `be-b` (`cursos-gestion-http.test.ts`, `administracion-contenido.test.ts`, `scripts/sembrar-catalogo.ts`) | Fase 2A |
| `docs/refactor/RIESGOS.md` y `docs/refactor/PLAN_PRUEBAS.md` | `qa-edge` | **Hecho e integrado** (`5e5791c` y `cb47761`): 60 riesgos (13 altos, 9 CONGELADO-INSEGURO) y 136 casos CAR. Contraste con `openapi.yaml`: 33/33 operaciones con casos; C-01–C-18 asignados (C-14 CONGELADO-INSEGURO). Huecos confirmados: sin prueba HTTP de `GET /docente/cursos`, `DELETE /lecciones/:id` ni del éxito de `enviar-revision` |

## Integraciones hechas

| Fecha | Origen | Commit | Contenido | Verificación del lead |
|---|---|---|---|---|
| 19-10-2026 | `refactor/arquitecto` | `0e754bf`, `2d9265e`, `157fe81` | ADR 001–011, `docs/adr/README.md`, `PLANTILLA_MODULO.md`, `CONTRATOS_SERVICIO.md` | Sus commits solo tocan `docs/adr/**` y `docs/arquitectura/**`; todos los ADR tienen opciones (tabla) y consecuencias |
| 19-10-2026 | `refactor/qa-edge` | `cb47761` | Contraste con `openapi.yaml` (§12 de PLAN_PRUEBAS) y riesgos RG-57–RG-60 de las migraciones | Solo toca sus 2 archivos; 136 filas CAR y 60 RG |
| 19-10-2026 | `refactor/qa-edge` | `5e5791c` | `RIESGOS.md` y `PLAN_PRUEBAS.md` | Solo toca esos dos archivos (de su propiedad); se cuentan 56 filas RG y 133 IDs CAR distintos |
| 19-10-2026 | `refactor/arquitecto` | `ff37b06` | E1: `docs/api/openapi.yaml` y `docs/api/COMPARACION_RUTAS.md` | Solo toca `docs/api/**` (de su propiedad); JSON válido tras quitar la cabecera `#`: 28 rutas, 33 operaciones y 15 esquemas |

## Bloqueos

| Bloqueo | Afecta a | Quién lo resuelve |
|---|---|---|
| `identidad.test.ts` y `cursos-publicos.test.ts` sin guarda `_test` | Cualquier `npm test` | Mitigación: chequeo de `.env.test` antes de cada ejecución. Solución: `guardia-bd.ts` (`qa-edge`, Fase 2A) |
| Recepción de Gmail sin confirmar (cierre del Sprint 1) | Informativo; no bloquea el refactor | El usuario |
