# Estado del refactor de Learnity

> Solo lo escribe el lead. Los teammates informan por mensaje con el formato de `REGLAS_EQUIPO.md`.

## Fase actual

**Fase 2A: fundaciones** (desde el 19-10-2026). La **Puerta 1 está cerrada**: el usuario aprobó P1-1 a P1-3, y el lead decidió BD-022, BD-019b, D3 y D4 con la autonomía que le delegó el usuario (ver *Decisiones*). Siguiente puerta: **Puerta 2A**, cuando la caracterización esté en verde sobre la línea base y las fundaciones integradas, con la suite completa y los builds en verde.

**Plan de la 2A en tandas** (máximo 3 teammates a la vez; Sonnet para `qa-edge`, `be-*` y `fe-*`; Opus para `arquitecto` y `db`):
1. **Tanda 1:** `db` (022/023 sin datos inventados), `qa-edge` (`guardia-bd.ts`, pool de fixtures y caracterización de todos los endpoints) y `arquitecto` (ADR a *Aceptado*/*Rechazado*, `test:local` con glob, devDependency `openapi-typescript`, correcciones solo documentales C-08–C-11 y C-18, renombrar `openapi-integrante2/3.ts`, `README.md:141`).
2. **Tanda 2** (desde el 19-10-2026; la caracterización está en verde): `be-a` y `be-b` (fundaciones del backend y puntos del ADR-011 asignados a la 2A), más `qa-edge` (REC y SEG).

**Resultado de la tanda 1 (19-10-2026):** `integration/sprint-2` en `7ffa8d6`. backend `npm run build` → exit 0; `npm run typecheck` → exit 0; `npm test` (glob) → **tests 199 · suites 46 · pass 199 · fail 0** (78 de la línea base + 114 de caracterización + 7 de la guarda; 112 s). `learnity_test` sin residuos (0 filas en persona, usuario, curso, categoría, archivo, solicitud, pendiente y sesión) y sin migraciones.

**Regla de integración para los cambios de contrato (decidida por el lead):** cada punto aprobado del ADR-011 se entrega en tres partes de dueños distintos: el código (`be-*`), las aserciones CONGELADO-INSEGURO que cambian (`qa-edge`) y `openapi*.ts` + `openapi.yaml` (`arquitecto`). El lead las integra **en un solo merge por punto** y ejecuta la suite completa antes de dar el punto por hecho. Así se cumple "la expectativa cambia en el mismo cambio" sin que nadie edite archivos ajenos ni la suite quede en rojo.

**Reparto de los puntos del ADR-011:** 2A → 11.1, 11.2, 11.3, 11.6, 11.7 y 11.11 (`be-a`, ligados a la validación uniforme y al manejador de errores) y 11.5 (`be-b`, interfaz `AlmacenArchivos`); 2B → 11.8 (`be-b`, cursos) y 11.10 (`be-a`, identidad); Fase 3 → 11.4 (límite por IP en la subida).
3. **Tanda 3:** `fe-a` (rutas por *feature* con `loadChildren`, `layouts` y adoptar `core/estado`) y `fe-b` (`core/api`, `peticion.ts` → `core/estado` cambiando su import de `pages/auth/mensaje-error` a `core/http/error-api`, `shared/ui`, tipos fuera de `datos-demo` y tokens de diseño). **Ya hecho por Codex e integrado:** el flag de D4 y `core/http`.

**Avance de la tanda 2 (19-10-2026, tras el segundo corte por el límite de uso):**
- **`be-a`, refactor sin cambio de contrato: verificado e integrado** (merge `acb9e9c`, hasta `c275215`). Verificación del lead en el worktree de `be-a`: `npm test` en `c275215` → **199/199**. Ojo: es la suite corriendo sobre el código refactorizado de `be-a`, no el 199/199 de la línea base. En la punta de la rama (`aac5d60`, con 11.1, 11.2, 11.3, 11.6 = `245d437`, 11.7 y 11.11), `npm test` → **192/199**, y fallan **solo** los 7 casos CONGELADO declarados: CAR-GEN-01, 04, 05, 06 y 11, CAR-IDE-07 y CAR-CUR-08. Sin regresiones. Los commits de contrato siguen **sin integrar**: esperan las aserciones de `qa-edge` y `openapi*.ts` del `arquitecto`.
- **Codex adelantó dos tareas de `fe-a`** en `refactor/codex-fe-a` (`.worktrees/codex-fe-a`, desde `b78512e`): `eacccce` (flag `sprint34Habilitado: false` en los dos `environment`, que oculta rutas y navegación del Sprint 3/4 sin editar páginas congeladas; D4) y `fb7ac83` (`core/http/error-api.ts` con `convertirErrorApi`, `mensajeDeError` y `erroresPorCampo`, los mismos mensajes visibles y su spec). Revisados por el lead: solo tocan archivos de `fe-a`. **Integrados** (merge `60d1e7d`). En `integration/sprint-2`: `npx ng build` → exit 0 (inicial 364,68 kB); `npx ng test --watch=false` → **6 archivos, 22/22**. `pages/auth/mensaje-error.ts` queda como reexportación temporal; su único consumidor es `shared/cursos/peticion.ts:4` (de `fe-b`).
- **`be-b`:** 6 commits sin integrar (`refactor/be-b`, HEAD `577cff9`) y **cambios sin commit** en `administracion-contenido`, `cursos-gestion-http`, `cursos-gestion` y `pdf-validacion.test.ts` (tarea 5). **No se descartan**: los cierra `be-b`.
- **`qa-edge`:** las aserciones de los puntos del ADR-011 siguen pendientes.
- **Puntos del ADR-011 (11.1, 11.2, 11.3, 11.6 y 11.7), verificación previa del lead:** en un worktree temporal (`.worktrees/verif`, separado) se juntaron el código de `be-a` (`aac5d60`) y las aserciones de `qa-edge` (`9294343` 11.1, `2b9da73` 11.2 con CAR-GEN-03 nuevo, `1a8f11a` 11.3, `997a324` 11.6 y `0848d6d` 11.7). Resultado: `npm run build`/`typecheck` → exit 0; `npm test` → **216/216** (215 + CAR-GEN-03). Falta `openapi*.ts` del `arquitecto` para integrar los puntos en `integration/sprint-2`.
- **`be-b`, verificación del lead sobre `103b69e`:** build y typecheck → exit 0; todos los archivos son suyos; `npm test` → **231/232**. Único fallo: su prueba nueva `test/database/semillas.test.ts:26` (`crearSolicitudDocenteAprobada`, en `semillas.repository.ts:73`, viola `solicitud_docente_motivo_check`). Las 215 de línea base, caracterización y seguridad pasan. Pendiente de su corrección; **no integrado**. Nota de propiedad: `be-b` añadió `backend/test/database/**`, que no estaba en su lista. **Se le asigna** (pruebas de `shared/database` y semillas, que son suyos).
- **Integrado (19-10-2026):** `be-b` corrigió su prueba de semillas en `3059ed5`; el fallo era un dato de la prueba, porque el `CHECK` exige un motivo de 50 o más caracteres (`learnity_esquema.sql:50`). `npm test` en su worktree (lead) → **232/232**. Después, en orden y sin conflictos: un merge por punto con código, aserciones y contrato: 11.1 `e158e5e`, 11.2 `12dd709`, 11.3 `b065746`, 11.6 `6b377ee` y 11.7 `4239550`; `idRuta` de `be-a` (`f4a2c1a`, base del 11.11, sin cambio de contrato) y las fundaciones de `be-b` (`eb7c534`).
- **Verificación final en `integration/sprint-2` (`eb7c534`):** backend `npm run build`/`typecheck` → exit 0; `npm test` → **tests 233 · suites 59 · pass 233 · fail 0** (157 s); frontend `npx ng build` → exit 0; `npx ng test --watch=false` → **22/22**; `learnity_test` sin residuos. Quedan **cerrados** C-01, C-02 y C-14 del contrato.
- **Siguiente en la 2A:** 11.11 (`be-b` adopta `idRuta` → aserciones ID de `qa-edge` → contrato del `arquitecto`, en un solo merge), `seguridad/fallos.test.ts` (`qa-edge`, con el seam ya integrado), `README.md:862` (`arquitecto`) y, después, la tanda 3 (`fe-a` y `fe-b`).
- **Pendiente para la 2B:** quitar `datos-demo` del inicio y del encabezado (A2, D1).

### Fase 1: diseño (cerrada, Puerta 1 el 19-10-2026)

> **Fase 1 terminada (19-10-2026, 09:40):** los tres entregables están integrados y probados. **Puerta 1 lista para presentar.** Los teammates están cerrados o inactivos.
>
> **Interrupción (19-10-2026, ~06:11):** la sesión se cortó por el límite de uso. Todos los teammates quedaron inactivos y **no se les escribe**. Estado comprobado por el lead al retomar:
> - **Git:** `integration/sprint-2` en `6a4bdee`. `refactor/arquitecto` (`0b3c0a6`) y `refactor/qa-edge` (`5743b07`) están integradas por completo. `refactor/db` (`4d7b787`) tiene 7 commits **sin integrar** (35 archivos, +3201): PLAN_BD, migraciones 017–026 con `down`, `RETENIDAS.txt` (023), `propuestas/pg_trgm`, `verificacion/` (4), `pruebas/` (019b y quitar), `scripts/` (4 .ps1) y `database/README.md`. Los tres worktrees están limpios.
> - **Bases** (consulta de solo lectura como `postgres`): `learnity_test` y `Learnity` siguen **en la línea base**: 22 tablas de `postgres`, 0 vistas, 0 triggers, sin `schema_migraciones`, `auditoria_cambio` ni `actualizado_en`. En el clúster solo existe el rol `learnity_app` (no se crearon `learnity_owner`, `learnity_lectura` ni `learnity_pruebas`). `learnity_refactor` **no existe** (nunca se creó, según la decisión de alcance). `learnity_test` está vacía de datos (0 cursos, 0 usuarios).
> - **Ninguna migración se ha ejecutado nunca:** todo el SQL de `db` sigue **NO VERIFICADO**.

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
| Turno BD Fase 1 | ¿Quién ejecuta con `postgres` las pruebas de migraciones sobre `learnity_test`? | **El lead**, con la contraseña dada por el usuario en el chat, solo como variable de entorno y solo sobre `learnity_test`. `Learnity` sigue sin tocarse (Puerta DB) | 19-10-2026 |
| D10 | ¿Endureces `.claude/settings.local.json` con los equivalentes `PowerShell(…)`? | **Sí.** El usuario lo guardó y el lead lo comprobó: JSON válido y 30 reglas `deny`, entre ellas `PowerShell(git push/reset --hard/clean/branch -D)`, `Remove-Item -Recurse`, la lectura de `.env*` por Bash y por PowerShell, y `git push` sin argumentos. Son reglas por patrón: frenan errores, pero no son una barrera infalible | 19-10-2026 |
| D5 | ¿Se versionan `contrasena.ts` y los documentos del Sprint 2? | **A) Todo, en dos commits, solo en `integration/sprint-2`.** (1) `docs: documentos del Sprint 2 y del arranque del refactor` (documentos del Sprint 2, `PROMPT_INICIO_REFACTOR.md`, `docs/refactor/**` y `CLAUDE.md`). (2) `chore: ajusta comentario en contrasena.ts` (una línea de comentario, sin cambio de comportamiento). Revisados: no contienen secretos | 19-10-2026 |
| D7 | ¿Quién ejecuta las operaciones con `postgres`? | **A) El usuario ejecuta todo lo que requiere `postgres`** (crear `learnity_test`, esquema, 015/016, permisos, `pg_dump` y migraciones sobre `Learnity`), con scripts preparados por el lead (Fase 0B) o por `db` (desde la Fase 1). Los ejecuta con `psql` desde `C:\Program Files\PostgreSQL\17\bin\` y pega la salida. Nadie del equipo usa credenciales de `postgres`. Alcance: entorno local y una única `learnity_test` compartida (18-10-2026). **Excepción del 19-10-2026:** el usuario pidió al lead crear `learnity_test` él mismo y le dio la contraseña de `postgres` en el chat. Se usó solo como variable de entorno en esos comandos y no se guardó. La regla general de D7 sigue vigente para los teammates | 19-10-2026 |
| D6 | ¿Cuándo se actualiza `main`? | **A)** Tras la Puerta 0B, y con aprobación explícita de ese paso, el `main` **local** avanza con `git merge --ff-only baseline-pre-refactor` (hoy `main` = `55fc8ff`, ancestro de `ce5e83c`). El push a `origin/main` solo se hace si el usuario lo pide. Durante el refactor `main` no se toca; el siguiente avance se propone en la Fase 3 | 19-10-2026 |
| D8 | ¿El catálogo pasa a ser un módulo de lectura con vistas? | **A) Sí.** `modules/catalogo` (`be-a`) lee solo de vistas SQL de solo lectura (acordadas en el ADR-002: `catalogo_categoria`, `catalogo_curso` y `catalogo_temario`; `GET /api/categorias` pasa al módulo `catalogo`) creadas por `db` en una migración `up`/`down`, que solo exponen columnas públicas (nunca `archivo.ruta`). El JSON y las rutas no cambian. Requiere el ADR-002 (`arquitecto`), la migración probada `up → down → up` en `learnity_test` y la Puerta DB para aplicarla a `Learnity` | 19-10-2026 |
| D9 | ¿Se aceptan las dependencias nuevas (`openapi-typescript`, `@playwright/test`, `pg_trgm`)? | **A) Las tres son candidatas.** El `arquitecto` escribe un ADR por cada una (alternativas y consecuencias). El usuario las aprueba o rechaza en la Puerta 1. Nada se agrega a `package.json` ni a migraciones sin ese ADR aprobado | 19-10-2026 |
| P1-1 | Puerta 1: ¿se aprueban el contrato (`openapi.yaml`) y los ADR 001–007? | **A) Aprobados tal cual**, incluidos 5.1 (correo) y 5.2 (almacenamiento). El `arquitecto` pasa su estado a *Aceptado* cuando se reactive | 19-10-2026 |
| P1-2 | Puerta 1: dependencias de D9 (ADR-008/009/010) | **A)** ADR-008 `openapi-typescript` **aceptado** (devDependency del frontend, solo tipos; antes se corrigen en `openapi*.ts` C-08–C-11 y C-18). ADR-009 `@playwright/test` **aceptado** en un `e2e/package.json` propio (**excepción de propiedad:** `e2e/package.json` es de `qa-edge`). ADR-010 `pg_trgm` **aplazado** (opción A; se reconsidera con más de 10 000 cursos publicados o p95 > 200 ms; la migración queda en `propuestas/`) | 19-10-2026 |
| P1-3 | Puerta 1: ADR-011, cambios de contrato, punto por punto | **A)** **Aprobados:** 11.1 (`/salud` solo `{estado}`), 11.2 (503 con la BD caída), 11.3 (Swagger solo en desarrollo), 11.4 (429 en la subida de PDF), 11.5 (subida a disco temporal), 11.6 (400/413/415 en errores del parser JSON), 11.7 (NUL → 400), 11.8 (una sola regla de portada), 11.10 (roles leídos de la BD en cada petición) y 11.11 (IDs solo con dígitos decimales). **No se aplica:** 11.9 (portada externa; se mantiene el comportamiento actual). Cada punto va en su propio commit, que actualiza sus pruebas CONGELADO-INSEGURO | 19-10-2026 |
| Modo de trabajo | Regla del usuario (19-10-2026) | El lead decide la opción técnicamente más sólida en todo lo reversible (código, documentos, `learnity_test`), la justifica aquí y sigue. Solo pregunta, una vez y al cierre de la fase, por decisiones de producto que no se puedan inferir o antes de una acción irreversible: modificar `Learnity`, hacer push o integrar definitivamente en `main` o en las ramas del Sprint 2 | 19-10-2026 |
| BD-022 | ¿Cómo se tratan los 3 cursos PUBLICADO sin revisor? | **Decidido por el lead, siguiendo la indicación del usuario de no inventar un revisor ni una fecha de revisión.** La 022 deja de corregir datos: inventaría los cursos que incumplen la regla y deja la excepción a la vista y auditable. La 023 añade el `CHECK` como **`NOT VALID`**: PostgreSQL lo exige en todo `INSERT` o `UPDATE` nuevo, pero no reescribe ni rechaza las filas heredadas. **Por qué:** las tres rutas que hacen `UPDATE curso` (`cursos-integracion.repository.ts:184, 537, 747`) exigen BORRADOR/RECHAZADO o EN_REVISION, así que la app nunca reescribe un curso PUBLICADO y el `CHECK` no la bloquea. **Efecto en el catálogo: ninguno** (los 3 cursos siguen publicados). `VALIDATE CONSTRAINT` fallará mientras existan esas filas; queda documentado. Se prueba en `learnity_test` simulando las filas heredadas dentro de una transacción. **No se aplica a `Learnity`** (Puerta DB, Fase 3) | 19-10-2026 |
| BD-019b | ¿Cómo limpian sus datos las pruebas con privilegios mínimos? | **Opción 3, decidida por el lead:** `learnity_pruebas` concedido a `learnity_app` `WITH INHERIT FALSE, SET TRUE`, y un pool de fixtures con `SET ROLE` (`qa-edge`, `backend/test/ayudas/`). **Por qué:** es la única opción en la que la app corre en `learnity_test` con el mismo mínimo privilegio que en `Learnity`; con la 1, un permiso que falte pasa en verde. Ya está implementada y probada (matriz `inherit=false,set=true`, prueba 8 OK). Falta verificar `SET ROLE` desde una sesión real de `learnity_app` (lo hará `qa-edge`) | 19-10-2026 |
| D3 | ¿Se borran los paneles huérfanos o se restauran? | **Borrar, decidido por el lead:** `pages/docente/panel` y `pages/admin/panel` no tienen ruta (`app.routes.ts:142-144, 202-204` redirigen), así que borrarlos no cambia nada visible; restaurarlos sería funcionalidad nueva. Se corrige `README.md:141` (`arquitecto`) y el borrado lo hace `fe-b` en la 2B | 19-10-2026 |
| D4 | ¿Las pantallas del Sprint 3/4 van detrás de un flag? | **Sí, flag apagado por defecto, decidido por el lead.** Se infiere de una regla ya aprobada (REGLAS_EQUIPO, Frontend: "Sin `datos-demo.ts` en recorridos reales. Los mocks solo van detrás de un flag apagado por defecto"). Lo implementa `fe-a` en `app.routes.ts` (Fase 2A); las pantallas congeladas no se editan | 19-10-2026 |
## Teammates activos

| Teammate | Modelo | Worktree / rama | Fase | Estado |
|---|---|---|---|---|
| `db` | Opus 5.5 | `.worktrees/db` / `refactor/db` | 2A, tanda 1 | **Terminado, integrado y cerrado** (BD-022, merge `3d7f703`) |
| `qa-edge` | Sonnet 5.5 | `.worktrees/qa-edge` / `refactor/qa-edge` | 2A, tandas 1 y 2 | Tanda 1 **integrada** (merge `7ffa8d6`): `guardia-bd`, pool de fixtures y 8 suites (114 pruebas, 0 fallos). Sigue con REC-01..11 y SEG prioritarias, y con las aserciones de los puntos del ADR-011 |
| `be-a` | Sonnet 5.5 | `.worktrees/be-a` / `refactor/be-a` | 2A, tanda 2 | Refactor **integrado** (`acb9e9c`); código de los puntos 11.1, 11.2, 11.3, 11.6, 11.7 y 11.11 listo en su rama (192/199, solo fallan los 7 declarados). **Cerrado** para liberar sitio; se reactiva si hace falta corregir algo de esos puntos |
| `be-b` | Sonnet 5.5 | `.worktrees/be-b` / `refactor/be-b` | 2A, tanda 2 | Fundaciones **integradas** (`eb7c534`, 232/232). Ahora: 11.11 (adoptar `idRuta`) |

Equipo completo (7), que se activa por fases con un máximo de 6 simultáneos: Fase 1 `arquitecto`, `db` y `qa-edge`; Fases 2A y 2B `arquitecto`, `qa-edge`, `be-a`, `be-b`, `fe-a` y `fe-b`; Fase 3 `qa-edge`, `db`, `arquitecto` y `be-a`/`be-b` si hacen falta.

**Turno de la base `learnity_test`:** libre. Lo administra el lead (una suite a la vez, con la guarda de `.env.test` antes de cada `npm test`). `learnity_test` está en la línea base. `.env.test` se copió sin leerlo a los worktrees de `qa-edge` y `arquitecto`.

### Prueba de migraciones (19-10-2026, ejecutada por el lead con `postgres`)

- **Intento 1** (`4d7b787`): falló al tomar la huella H0, antes de aplicar nada (`text || "char"` en `huella_esquema.sql:172`). `learnity_test` quedó intacta (comprobado). `db`, relanzado, lo corrigió en `43374ea` (conversiones `::TEXT` en las columnas `"char"` del catálogo y un `acldefault` que habría fallado después).
- **Intento 2** (`43374ea`, `probar-migraciones.ps1 -Base learnity_test`, exit 0; salidas en `%TEMP%\learnity-probar-learnity_test-20261019-093359`):
  ```
  H0 705|f15432412a68… · H1 820|cfe1d5dc2148… · H2 705|f15432412a68… · H3 820|cfe1d5dc2148… · H4 819|072b478e6f08…
  H2 = H0: IGUAL · H3 = H1: IGUAL · cada down 026…017 deja la huella previa: IGUAL (10/10)
  Estado migrado: 000, 015, 016, 017–022, 024–026 (023 retenida)
  Matriz de privilegios: 47 filas, 0 diferencias (MATRIZ OK), también con la 019b (inherit=false, set=true)
  Pruebas funcionales: 0 fallas (identidad sin USAGE de secuencia OK; app no puede DELETE persona ni con la 019b; lectura no ve contrasena_hash ni archivo.ruta; auditoría sin hash ni ruta; actualizado_en; pendiente única)
  Catálogo, consultas actuales frente a vistas: 9/9 IGUAL (CATALOGO IGUAL)
  Estado final: línea base, huella final = H0: IGUAL
  ```
- **Después:** guarda `.env.test` → APTO; `npm test` → 78/78, 0 fallos. Roles del clúster: solo `learnity_app`.
- **NO VERIFICADO:** (a) *[superado por BD-022: la 022 ya no corrige datos y la prueba de filas heredadas cubre el caso]*; (b) las pruebas "NO APLICA" 9–11 y 22 dependen de la 019b o de la 023; (c) que `learnity_app` pueda hacer `SET ROLE learnity_pruebas` desde su propia sesión (las pruebas corren como `postgres`).

## Tareas y dueños

### Propiedad de carpetas

Copia de la §6 del prompt del lead, con las correcciones de la verificación. Solo el dueño edita.

| Dueño | Archivos |
|---|---|
| `arquitecto` | `docs/adr/**`, `docs/api/**`, `docs/arquitectura/**`, `backend/src/shared/http/openapi*.ts`, `backend/package.json`, `backend/tsconfig*.json`, `frontend/package.json`, `frontend/angular.json`, `frontend/tsconfig*.json`, `README.md` |
| `db` | `database/**`, `docs/bd/**` |
| `qa-edge` | `backend/test/caracterizacion/**`, `backend/test/seguridad/**`, `backend/test/ayudas/**`, `e2e/**` (incluido `e2e/package.json`, excepción aprobada en P1-2), `docs/refactor/RIESGOS.md`, `docs/refactor/PLAN_PRUEBAS.md` |
| `be-a` | `backend/src/app.ts`, `backend/src/server.ts`, `backend/src/shared/{config,auth,http,log,correo,seguridad}/**` (excepto `openapi*.ts`), `backend/src/modules/{identidad,catalogo,categorias,usuarios}/**`, `backend/test/{identidad,catalogo,categorias,usuarios}/**`, `backend/test/{identidad,cursos-publicos,solicitudes-docente}.test.ts` |
| `be-b` | `backend/src/shared/{database,archivos}/**`, `backend/src/modules/{cursos,contenido,revision,administracion}/**`, `backend/src/database/seed.ts`, `backend/scripts/**`, `backend/test/{cursos,contenido,revision,database}/**`, `backend/test/{pdf-validacion,administracion-contenido,cursos-gestion,cursos-gestion-http}.test.ts` |
| `fe-a` | `frontend/src/{main.ts,index.html}`, `frontend/src/app/{app.ts,app.spec.ts,app.config.ts,app.routes.ts}`, `frontend/src/environments/**`, en `frontend/src/app/`: `core/{auth,http,solicitudes}/**`, `layouts/**`, `shared/{layout,validadores}/**`, `features/{identidad,catalogo,admin-categorias,usuarios}/**`, `pages/{auth,cuenta,publico}/**`, `pages/estudiante/perfil/**`, `pages/admin/{categorias,usuarios,solicitudes}/**` |
| `fe-b` | `frontend/src/styles.scss`, en `frontend/src/app/`: `core/{api,cursos,estado}/**`, `shared/{ui,cursos}/**`, `features/{docente-cursos,contenido,revision}/**`, `pages/docente/{mis-cursos,editor-curso,panel}/**`, `pages/admin/{revision-cursos,revision-curso,panel}/**`, `data/datos-demo.ts` (solo para sacar los tipos de UI) |
| lead | `CLAUDE.md`, `docs/refactor/{REGLAS_EQUIPO,ESTADO,VERIFICACION_AUDITORIA}.md`, `.gitignore`, la rama `integration/sprint-2` y las etiquetas |
| **Congelado** (nadie lo edita) | `backend/src/modules/{aprendizaje,evaluaciones}/**`; `pages/estudiante/{inicio-estudiante,mi-aprendizaje,leccion,evaluacion}/**`; `pages/docente/{editor-evaluacion,estudiantes}/**`; `shared/layout/vista-previa-aprendizaje.ts` (prevalece sobre `fe-a`). Excepción: el flag de D4 en `app.routes.ts` |

### Tareas abiertas

| Tarea | Dueño | Estado |
|---|---|---|
| Fase 0B: línea base | lead | Hecho |
| `docs/api/openapi.yaml` (contrato actual) y `docs/api/COMPARACION_RUTAS.md` (hallazgos C-01–C-18) | `arquitecto` | Hecho e integrado (`ff37b06`). 33/33 operaciones coinciden con las rutas reales. Los que cambian el contrato van al ADR-011 (C-14 → 11.6; C-01 → 11.1; C-02 → 11.3); el resto es documentación |
| ADR 001–011 | `arquitecto` | **Hecho e integrado** (`0e754bf`, `2d9265e`, más los ajustes `97ac229`–`eaf329d`). El ADR-011 tiene 11 puntos independientes (11.1–11.11), cada uno con las pruebas CONGELADO-INSEGURO que actualiza; los 16 IDs citados existen en PLAN_PRUEBAS. El ADR-002 recoge las 3 vistas acordadas con `db`. ADR-010 recomienda aplazar `pg_trgm` |
| `docs/arquitectura/PLANTILLA_MODULO.md` (lista de revisión de integración R1–R11) y `CONTRATOS_SERVICIO.md` | `arquitecto` | Integrados (`157fe81`) |
| `docs/bd/PLAN_BD.md` y migraciones 017–026, 019b (opción 3), scripts y `pg_trgm` (propuesta) | `db` | **Hecho, probado e integrado** (`5d0819d`–`43374ea`, merge `7afb63a`). Ver *Prueba de migraciones* |
| BD-022: 022 → `022_inventario_cursos_publicados` (vista `curso_publicado_sin_revision`, sin tocar `curso`) y 023 `CHECK … NOT VALID` | `db` | **Hecho, probado e integrado** (`f27dda8`–`b9e7ba3`, merge `3d7f703`). `probar-migraciones` (lead, 10:04): H2=H0 y H3=H1 IGUAL; cada down IGUAL (10/10); prueba de filas heredadas 12/12 OK (los 3 heredados siguen PUBLICADO y en `catalogo_curso`; `curso` sin cambios; 0 UPDATE/DELETE en la auditoría; se rechazan el INSERT y el UPDATE inválidos nuevos; `VALIDATE` falla con heredados y pasa sin ellos) sin rastro (huella = previa a la 022); matriz 48/48; pruebas funcionales 0 fallas (la 22 da OK en H3); catálogo IGUAL; huella final = H0. **Efecto en el catálogo: ninguno.** NO VERIFICADO: que `pg_dump`/`pg_restore` conserve el `CHECK NOT VALID` |
| Estado de los ADR, `test:local` con glob, `openapi-typescript` 7.13.0 (`api:tipos`), contrato documental (cierra C-01, C-03–C-13 y C-15–C-18; queda C-14 → 11.6), `openapi-gestion-cursos.ts`/`openapi-revision-contenido.ts`, `README.md:141` | `arquitecto` | **Hecho e integrado** (`8ca9f7f`–`53d6db0`, merge `a153670`). backend build/typecheck exit 0; `npm test` con glob 78/78; frontend `ng build` 363.80 kB y `ng test` 20/20; contrato regenerado IDÉNTICO a `openapi*.ts` (33/33 operaciones) || Seam estable para inyectar fallos de disco y BD que sobreviva al refactor (RG-06/H9); revisar `pool.ts:29-40`: si la conexión murió, el ROLLBACK del catch falla y oculta el error original, y `release()` se llama sin el error, con lo que el pool podría reutilizar un cliente roto (NO VERIFICADO, qa-edge) | `be-b` (con `qa-edge`) | Fase 2A |
| Corregir la dependencia invertida `shared/cursos/peticion.ts:4` → `pages/auth/mensaje-error` (detectada en el ADR-007) al mover `peticion.ts` a `core/estado` | `fe-b` (con `fe-a`, dueño de `pages/auth`) | Fase 2A |
| En PLAN_PRUEBAS, cambiar la referencia de CAR-GEN-05 a "ADR-011, punto 11.6" (hoy dice "ADR-011 o ampliación del ADR-006") y capturar CAR-GEN-07 | `qa-edge` | Fase 2A |
| Ajustar el arreglo de datos de las pruebas para fijar `revisado_por` y `publicado_en` en los cursos PUBLICADO (requisito para aplicar la 023) | `be-a` (`cursos-publicos.test.ts`) y `be-b` (`cursos-gestion-http.test.ts`, `administracion-contenido.test.ts`, `scripts/sembrar-catalogo.ts`) | Fase 2A |
| `docs/refactor/RIESGOS.md` y `docs/refactor/PLAN_PRUEBAS.md` | `qa-edge` | **Hecho e integrado** (`5e5791c` y `cb47761`): 60 riesgos (13 altos, 9 CONGELADO-INSEGURO) y 136 casos CAR. Contraste con `openapi.yaml`: 33/33 operaciones con casos; C-01–C-18 asignados (C-14 CONGELADO-INSEGURO). Huecos confirmados: sin prueba HTTP de `GET /docente/cursos`, `DELETE /lecciones/:id` ni del éxito de `enviar-revision` |

## Integraciones hechas

| Fecha | Origen | Commit | Contenido | Verificación del lead |
|---|---|---|---|---|
| 19-10-2026 | `refactor/db` | `5d0819d`–`43374ea` (merge `7afb63a`) | PLAN_BD, migraciones 017–026, 019b, verificación, scripts .ps1, `database/README.md` y `propuestas/pg_trgm` | Solo toca `database/**` y `docs/bd/**` (0 archivos fuera); ciclo `up → down → up` IGUAL y suite 78/78 |
| 19-10-2026 | `refactor/arquitecto` | `97ac229`–`eaf329d` | ADR-011 (11 puntos), ADR-002 (vistas acordadas), ADR-005/006, COMPARACION_RUTAS, PLANTILLA_MODULO, CONTRATOS_SERVICIO y README §2/§14 (solo enlaces) | Solo toca archivos suyos; los 16 IDs de prueba que cita el ADR-011 existen en PLAN_PRUEBAS |
| 19-10-2026 | `refactor/arquitecto` | `0e754bf`, `2d9265e`, `157fe81` | ADR 001–011, `docs/adr/README.md`, `PLANTILLA_MODULO.md`, `CONTRATOS_SERVICIO.md` | Sus commits solo tocan `docs/adr/**` y `docs/arquitectura/**`; todos los ADR tienen opciones (tabla) y consecuencias |
| 19-10-2026 | `refactor/qa-edge` | `cb47761` | Contraste con `openapi.yaml` (§12 de PLAN_PRUEBAS) y riesgos RG-57–RG-60 de las migraciones | Solo toca sus 2 archivos; 136 filas CAR y 60 RG |
| 19-10-2026 | `refactor/qa-edge` | `5e5791c` | `RIESGOS.md` y `PLAN_PRUEBAS.md` | Solo toca esos dos archivos (de su propiedad); se cuentan 56 filas RG y 133 IDs CAR distintos |
| 19-10-2026 | `refactor/arquitecto` | `ff37b06` | E1: `docs/api/openapi.yaml` y `docs/api/COMPARACION_RUTAS.md` | Solo toca `docs/api/**` (de su propiedad); JSON válido tras quitar la cabecera `#`: 28 rutas, 33 operaciones y 15 esquemas |

## Bloqueos

| Bloqueo | Afecta a | Quién lo resuelve |
|---|---|---|
| `identidad.test.ts` y `cursos-publicos.test.ts` sin guarda `_test` | Cualquier `npm test` | Mitigación: chequeo de `.env.test` antes de cada ejecución. Solución: `guardia-bd.ts` (`qa-edge`, Fase 2A) |
| Recepción de Gmail sin confirmar (cierre del Sprint 1) | Informativo; no bloquea el refactor | El usuario |
