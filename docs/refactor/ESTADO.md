# Estado del refactor de Learnity

> Solo lo escribe el lead. Los teammates informan por mensaje con el formato de `REGLAS_EQUIPO.md`.

## Fase actual

**Fase 0B: línea base** (solo el lead, sin teammates). Empezó el 19-10-2026.

| Paso | Estado |
|---|---|
| Paso 2: verificación de la auditoría | Hecho. **Puerta V aprobada (19-10-2026)** |
| `REGLAS_EQUIPO.md`, `CLAUDE.md`, `ESTADO.md` | Hecho |
| Decisiones D10 → D5 → D7 → D6 | Hecho (19-10-2026) |
| Rama `integration/sprint-2` | Pendiente |
| `.worktrees/` en `.gitignore` | Pendiente |
| `learnity_test` creada por el usuario y `.env.test` corregido | Pendiente |
| Línea base verde (backend 78 + 1 omitida; frontend 20/20) | Pendiente |
| Etiqueta `baseline-pre-refactor` | Pendiente |

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
| D10 | ¿Endureces `.claude/settings.local.json` con los equivalentes `PowerShell(…)`? | **Sí.** El usuario lo guardó y el lead lo comprobó: JSON válido y 30 reglas `deny`, entre ellas `PowerShell(git push/reset --hard/clean/branch -D)`, `Remove-Item -Recurse`, la lectura de `.env*` por Bash y por PowerShell, y `git push` sin argumentos. Son reglas por patrón: frenan errores, pero no son una barrera infalible | 19-10-2026 |
| D5 | ¿Se versionan `contrasena.ts` y los documentos del Sprint 2? | **A) Todo, en dos commits, solo en `integration/sprint-2`.** (1) `docs: documentos del Sprint 2 y del arranque del refactor` (documentos del Sprint 2, `PROMPT_INICIO_REFACTOR.md`, `docs/refactor/**` y `CLAUDE.md`). (2) `chore: ajusta comentario en contrasena.ts` (una línea de comentario, sin cambio de comportamiento). Revisados: no contienen secretos | 19-10-2026 |
| D7 | ¿Quién ejecuta las operaciones con `postgres`? | **A) El usuario ejecuta todo lo que requiere `postgres`** (crear `learnity_test`, esquema, 015/016, permisos, `pg_dump` y migraciones sobre `Learnity`), con scripts preparados por el lead (Fase 0B) o por `db` (desde la Fase 1). Los ejecuta con `psql` desde `C:\Program Files\PostgreSQL\17\bin\` y pega la salida. Nadie del equipo usa credenciales de `postgres`. Alcance: entorno local y una única `learnity_test` compartida (18-10-2026) | 19-10-2026 |
| D6 | ¿Cuándo se actualiza `main`? | **A)** Tras la Puerta 0B, y con aprobación explícita de ese paso, el `main` **local** avanza con `git merge --ff-only baseline-pre-refactor` (hoy `main` = `55fc8ff`, ancestro de `ce5e83c`). El push a `origin/main` solo se hace si el usuario lo pide. Durante el refactor `main` no se toca; el siguiente avance se propone en la Fase 3 | 19-10-2026 |
| D8 | ¿El catálogo pasa a ser un módulo de lectura con vistas? | *Pendiente*: se pregunta tras la Puerta 0B | |
| D9 | ¿Se aceptan las dependencias nuevas (`openapi-typescript`, `@playwright/test`, `pg_trgm`)? | *Pendiente*: se pregunta tras la Puerta 0B | |
| D3 | ¿Se borran los paneles huérfanos o se restauran? | *Pendiente*: se pregunta en la Puerta 1 | |
| D4 | ¿Las pantallas del Sprint 3/4 van detrás de un flag? | *Pendiente*: se pregunta en la Puerta 1 | |

## Teammates activos

Ninguno. El equipo se crea después de la Puerta 0B y de las decisiones D8 y D9 (Fase 1: `arquitecto`, `db` y `qa-edge`, con Opus 5.5).

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
| Fase 0B: línea base | lead | En curso |

## Integraciones hechas

Ninguna todavía.

## Bloqueos

| Bloqueo | Afecta a | Quién lo resuelve |
|---|---|---|
| `learnity_test` no existe y `.env.test` apunta a otro puerto (5499) | Línea base de la Fase 0B (R1/S1) | El usuario, con `postgres` (según D7) |
| `identidad.test.ts` y `cursos-publicos.test.ts` sin guarda `_test` | Cualquier `npm test` | Mitigación: chequeo de `.env.test` antes de cada ejecución. Solución: `guardia-bd.ts` (`qa-edge`, Fase 2A) |
| Recepción de Gmail sin confirmar (cierre del Sprint 1) | Informativo; no bloquea el refactor | El usuario |
