# Verificación de la auditoría inicial (Paso 2)

- **Fecha:** 18 de octubre de 2026.
- **Rama / commit:** `Edison` / `ce5e83c` (= `origin/Edison`).
- **Modo:** solo lectura. No se editó código de la aplicación, no se leyó ningún `.env*` y no se escribió en ninguna base. La suite del backend no se ejecutó.
- **Método:** el lead verificó en persona git, S1–S10, R1–R7, los builds, PostgreSQL y la propiedad de archivos. Dos subagentes `Explore` de solo lectura revisaron la tabla del Sprint 2 (§2) y A1–A12, F1–F6 y §4.1. El lead volvió a comprobar cada discrepancia que reportaron.
- **BD:** los datos los da el script de solo lectura `verificar-bd.mjs`, que ejecuta el usuario (está fuera del repositorio y corre dentro de `BEGIN READ ONLY … ROLLBACK`). Las filas `BD-*` se completan con su salida.

Resultados posibles: **Confirmado** (el código dice lo que afirma la auditoría; si solo cambió el número de línea, se indica la línea real), **Cambió** (la afirmación ya no es exacta o le falta algo) y **No verificable**. *Pendiente BD* indica que el dato espera la salida del script.

## 1. Git

| ID | Afirmación | Resultado | Evidencia |
|---|---|---|---|
| G1 | `origin/Edison` = `ce5e83c` | Confirmado | `git log -1 origin/Edison` → `ce5e83c Integra solicitudes de docente…` (tras `git fetch --all`) |
| G2 | `origin/Melissa`, `origin/Milena` y `origin/main` son ancestros de `origin/Edison` | Confirmado | `git merge-base --is-ancestor` → 0 para las tres |
| G3 | Solo `contrasena.ts` modificado, más los documentos sin versionar | Confirmado | `git status --short`: ` M backend/src/shared/auth/contrasena.ts`; `??` en los 4 documentos del Sprint 2, `PROMPT_INICIO_REFACTOR.md` y `docs/` |
| G4 | Ningún `.env` en el historial | Confirmado | `git log --all --diff-filter=A -- "*.env"` → vacío. Con un patrón más amplio solo aparecen `backend/.env.example` (`47a58f2`) y `backend/.env.test.example` (`31e9cfe`), que son plantillas |
| G5 | `.gitignore` cubre `.env*`, `dist/`, `uploads/` y `.buzon/` | Confirmado | `git check-ignore -v` → `.gitignore:7,8,3,13,16` y `frontend/.gitignore:4` |

## 2. Sprint 2 (26 requisitos)

| ID | Afirmación | Resultado | Evidencia |
|---|---|---|---|
| 2.1-a | `GET /api/categorias` solo devuelve las activas | Confirmado | `cursos.routes.ts:11`; `cursos.repository.ts:93-98` |
| 2.1-b | Catálogo con `ILIKE`/`ESCAPE`, `ANY`, `COUNT`, paginación y zod; 6 pruebas | Confirmado | `cursos.repository.ts:47-67, 100-127`; `cursos.controller.ts:11-21` (el esquema cierra en `:21`; `limite ≤ 50` está en `:20`); 6 `it(` |
| 2.1-c | El detalle da 404 en borradores y no expone `a.ruta` | Confirmado | `cursos.repository.ts:129-154`; `cursos.service.ts:971-979`; prueba en `cursos-publicos.test.ts:161` |
| 2.1-d | Angular usa la API en el catálogo y el detalle; el inicio y el encabezado siguen con datos de ejemplo | Confirmado | `cursos-publicos.service.ts:77,88,93`; `inicio.ts` y `header-sitio.ts` importan `datos-demo` |
| 2.2-a | `GET /docente/cursos` devuelve solo los propios, con el motivo de rechazo | Confirmado | `cursos-integracion.repository.ts:50-77` |
| 2.2-b | `POST` y `PUT` de curso; 11 pruebas | Confirmado | `cursos.service.ts:152-272`; 11 `it(` en `cursos-gestion.test.ts` |
| 2.2-c | Módulos y lecciones; restricciones en la BD; 10 pruebas HTTP con la de carrera | Confirmado | `cursos.service.ts:274-867`; `learnity_esquema.sql:106-107, 139-141`; prueba de carrera en `cursos-gestion-http.test.ts:497` |
| 2.2-d | `enviar-revision` atómico | Confirmado | `cursos.service.ts:869-946`. El bloqueo no está escrito en el servicio: llega vía `base(…, true)`, que añade `FOR UPDATE OF c` en `cursos-integracion.repository.ts:623`; `:531-549` |
| 2.2-e | Nadie importa `cursos.repository`; ciclo con Contenido | Confirmado | Solo lo importa `cursos.service.ts:28`; ciclo en `:19-21` ↔ `contenido.service.ts:19-21` |
| 2.3-a | `GET /admin/cursos` y el detalle | Confirmado | `administracion.routes.ts:19-31`; `cursos-integracion.service.ts:397-428` |
| 2.3-b | `PUT` de revisión atómico y con prueba de concurrencia | Confirmado | `cursos-integracion.service.ts:531-623`; repositorio `:738-769`; prueba en `administracion-contenido.test.ts:1202` |
| 2.3-c | Subida de PDF segura; 2 ficheros = 2 filas | Confirmado | `contenido.multipart.ts:15-20`; `contenido.service.ts:55-203`; repositorio `:703-736`; `app.ts` sin `static`; `ls uploads/pdf` = 2. BD-8: 2 filas = 2 ficheros |
| 2.3-d | `GET /archivos/:id` sin `ruta` | Confirmado | `contenido.routes.ts:27-31`; `cursos-integracion.service.ts:495-529, 315-324` |
| 2.4-a | `mis-cursos` con estados y API | Confirmado | `listado-cursos.html:34-39`. La línea citada `gestion-cursos.api.ts:24` es en realidad `:21` (método) y `:23` (URL) |
| 2.4-b | Editor con progreso, PDF y bloqueo | Confirmado | `gestion-cursos.api.ts:156`; `pdf-leccion.ts`; `editor-curso.ts:74,203` |
| 2.4-c | `revision-curso` usa la API real | Confirmado | `gestion-cursos.api.ts:110-141` (el rango citado `:113-137` queda dentro) |
| 2.4-d | Ese recorrido no usa `datos-demo` | Confirmado | grep: ninguno de los tres lo importa |
| 2.4-e | Sin `localStorage` ni `sessionStorage` | Confirmado | Solo aparecen en comentarios (`auth.service.ts:16`, `sesion.model.ts:25`) |
| 2.5-a | Recorrido completo: Parcial; no hay prueba HTTP de punta a punta | Confirmado | `README.md:392,768`; `administracion-contenido.test.ts:212` (`INSERT INTO curso`); `enviar-revision` solo aparece en `cursos-gestion-http.test.ts:336` |
| 2.5-b | OpenAPI y README: Parcial | Confirmado | Existen 4 `openapi*.ts`; `README.md:141`; `app.routes.ts:142-144`; no existe `docs/api/` |
| 2.5-c | Pruebas de permisos | Confirmado | `cursos-gestion-http.test.ts:253,267,353`; `administracion-contenido.test.ts:467,680` |
| 2.5-d | Build y typecheck | Confirmado | Hoy: `npm run build` → exit 0; `npm run typecheck` → exit 0; `npx ng build` → exit 0 (inicial 363,80 kB); `npx ng test --watch=false` → 5 archivos, **20/20** |
| 2.5-e | Suite del backend: Parcial (`.env.test` en 5499; sin `learnity_test`) | Confirmado | `pg_isready -p 5499` → "sin respuesta"; 79 `it(` (78 + 1 omitida: HIBP en `identidad.test.ts:208`). BD-11: `learnity_test` no existe; BD-12/13: `.env.test` apunta a otro puerto y a una base inexistente |
| 2.5-f | Gmail: Falta | Confirmado | `SPRINT_2_LEARNITY.md:5` |
| 2.5-g | P1 de solicitudes: Hecho | Confirmado | `administracion.service.ts:57+`; `administracion.repository.ts:40-69`; 11 `it(`; `solicitudes.ts` |
| 2.5-h | CRUD de categorías: Falta; discrepancia entre los planes | Confirmado | Única ruta: `cursos.routes.ts:11`; `categorias.ts:3` importa `datos-demo`; `PLAN_SPRINTS_LEARNITY.md:51` (Sprint 2) frente a `SPRINT_2_LEARNITY.md:117` (P1) |

Conteos de §2.6: identidad 22, cursos-publicos 6, pdf-validacion 4, administracion-contenido 15, cursos-gestion 11, cursos-gestion-http 10 y solicitudes-docente 11. Todos se confirman.

## 3. Seguridad (S1–S10)

| ID | Afirmación | Resultado | Evidencia |
|---|---|---|---|
| S1 | Sin base de pruebas aislada | Confirmado, **y es más grave de lo que dice la auditoría** | 5499 no responde (`pg_isready`). Además, **`identidad.test.ts:11-13` solo exige `NODE_ENV=test` y no comprueba que `DB_NAME` termine en `_test`**, aunque borra todas las cuentas `@pruebas.test` (`:114-117`). `cursos-publicos.test.ts:5-8` admite `Learnity` si `LEARNITY_PRUEBA_LOCAL=true`. Solo `administracion-contenido`, `cursos-gestion-http` y `solicitudes-docente` exigen `_test` |
| S2 | DML completo de `learnity_app` en las 22 tablas | Confirmado | BD-6: `22/22` |
| S3 | Las reglas `deny` solo cubren `Bash(…)` | Confirmado | `.claude/settings.local.json`: `deny` = 2 `Read` y 5 `Bash`; ninguna `PowerShell(…)` |
| S4 | `/api/salud` expone la base y el usuario; Swagger es público | Confirmado | `app.ts:35-40` (`current_database()`, `current_user`) y `:43` (`/api/docs` sin condición de entorno) |
| S5 | `memoryStorage` de 10 MB sin límite por IP | Confirmado | `contenido.multipart.ts:15,18`; `contenido.routes.ts:18-25` (sin `limitarPorIp`) |
| S6 | `portadaUrl` admite cualquier URL `http(s)` | Confirmado | `cursos-integracion.service.ts:66-82` (`portadaValida`) |
| S7 | `console.error(error)` con el `detail` de PostgreSQL | Confirmado | `manejador-errores.ts:43` |
| S8 | El seed imprime la contraseña de prueba | Confirmado | `seed.ts:142` |
| S9 | `rejectUnauthorized: false` | Confirmado | Está en `pool.ts:12`, no en `:13` |
| S10 | 404 frente a 403 en el detalle privado | Confirmado | `cursos.service.ts:133-146` |

## 4. Arquitectura (A1–A12), SQL (§4.1) y frontend (F1–F6)

| ID | Afirmación | Resultado | Evidencia |
|---|---|---|---|
| A1 | 994 líneas, 10 `'BORRADOR'`, 14 `roles.includes` y la cadena repetida unas 8 veces | **Cambió** (un conteo) | 994 líneas ✓; **`'BORRADOR'` aparece 8 veces** (`:236,308,408,516,617,718,816,904`), no 10; `roles.includes` = 14 ✓; la cadena completa se repite 8 veces ✓ |
| A2 | `...cursosIntegracionService` | Confirmado | `cursos.service.ts:105-106` |
| A3 | Ciclo Cursos ⇄ Contenido | Confirmado | `cursos.service.ts:19-21, 746, 761, 844, 859` ↔ `contenido.service.ts:19-21` |
| A4 | Administración tiene dos dominios | Confirmado | `administracion.service.ts:31,38,47` (revisión) y `:58,82` (solicitudes) |
| A5 | Lectura de disco dentro de la transacción | Confirmado | `cursos-integracion.service.ts:334-344` (`almacenPdf.esValido`) y `:413-418` |
| A6 | Validación inconsistente | Confirmado | `safeParse` en `cursos.controller.ts:33,64,94,127,196,231`; `validarCuerpo` en `identidad.routes.ts:23-38` |
| A7 | 24 `console.*` frente a 20 `registrarEvento`; sin ID de correlación | **Cambió** (un conteo) | `console.` = 24 ✓; **`registrarEvento` = 24 llamadas**, no 20; sin ID de correlación ✓ |
| A8 | `if (CORREO_TRANSPORTE === 'gmail')` | Confirmado | `correo.ts:20-23` |
| A9 | `almacenPdf` fijo | Confirmado | `almacen-pdf.ts:61-160` |
| A10 | Módulos vacíos | Confirmado | `*.service.ts` de 6 líneas en los dos módulos |
| A11 | `openapi-integrante2/3.ts` | Confirmado | Existen en `shared/http/` |
| A12 | Límite por IP en memoria | Confirmado | `limite-peticiones.ts:10` (`Map` en memoria) |
| SQL-1 | Interpolación de fragmentos fijos | Confirmado | `cursos.repository.ts:52-64, 102, 114-123` (además, `:131-134` interpola constantes); `cursos-integracion.repository.ts:623,655`; `administracion.repository.ts:116-118`; `identidad.repository.ts:70,78`; `administracion.repository.ts:100,108` |
| SQL-2 | SQL fuera de repositorios: `app.ts`, `seed.ts`, `sembrar-catalogo.ts`, `pool.ts` y las pruebas | **Cambió** | Falta **`server.ts:36-47`**: al arrancar ejecuta `pool.query` con `current_database()`, `current_user` y `to_regclass('public.sesion')`. El SQL de `seed.ts` empieza en `:66`, no en `:92` (8 llamadas). `sembrar-catalogo.ts`: 6 ✓; pruebas: 87 ✓ |
| SQL-3 | Conteo por repositorio (26/26/11/12/5) | Confirmado | En `administracion` son 11 líneas con 12 llamadas (`:101` tiene dos) |
| F1 | 16 archivos importan `datos-demo` o `demo-sesiones` | Confirmado | 16 (lista en el informe del subagente; `demo-sesiones` está en `core/auth/auth.service.ts`) |
| F2 | Paneles huérfanos | Confirmado | `docente/panel/panel.ts` (287 líneas) y `admin/panel/panel.ts` (152 líneas), sin ruta; `app.routes.ts:142-144, 202-204` |
| F3 | Servicios HTTP repartidos | **Cambió** (falta uno) | También usa `HttpClient` **`core/auth/auth.service.ts:1,24`** |
| F4 | 465 y 316 líneas | Confirmado | `wc -l` |
| F5 | `app.routes.ts` tiene 267 líneas | Confirmado | `wc -l` |
| F6 | 23 `loadComponent`, guards, sin `innerHTML`, `modoDemo: false` | **Cambió** (falta un guard) | 23 ✓; **falta `perfilEstudianteGuard`** (`guards.ts:30`; `app.routes.ts:7,123`); sin `innerHTML` ✓; `environment.development.ts:3` ✓ |
| §7.2 | `datos-demo.ts` tiene 484 líneas | Confirmado | `frontend/src/app/data/datos-demo.ts` |

## 5. Riesgos (R1–R7)

| ID | Afirmación | Resultado | Evidencia |
|---|---|---|---|
| R1 | Sin suite ejecutable | Confirmado | 5499 no responde; BD-11: sin `learnity_test` |
| R2 | Regresiones al dividir Cursos | Confirmado | A1, A3 |
| R3 | Datos que rompen reglas; sin auditoría ni `actualizado_en` | Confirmado | BD-4 = 3, BD-5 = 3, BD-9 = 0, BD-2 = 0 triggers |
| R4 | Lecturas de disco con filas bloqueadas | Confirmado | A5 |
| R5 | PowerShell sin restricciones; DML amplio | Confirmado | S3; BD-6: `22/22` |
| R6 | Conflictos en archivos compartidos | Confirmado | `app.routes.ts`, `app.ts`, `package.json` y `openapi*.ts` existen; cada uno tiene un solo dueño en la §6 (ver C1) |
| R7 | Mezclar refactor con funcionalidad nueva | Confirmado (riesgo de proceso) | D1 lo mitiga con commits separados |

## 6. Compilación, pruebas y PostgreSQL

| ID | Afirmación | Resultado | Evidencia |
|---|---|---|---|
| B1 | `backend`: `npm run build` | Confirmado | exit 0 |
| B2 | `backend`: `npm run typecheck` | Confirmado | exit 0 |
| B3 | `frontend`: `npx ng build` | Confirmado | exit 0; inicial 363,80 kB (101,58 kB transferidos) |
| B4 | `frontend`: `npx ng test --watch=false` = 20/20 | Confirmado | `Test Files 5 passed (5)`, `Tests 20 passed (20)` |
| P1 | PostgreSQL 17 en 5432 | Confirmado | `pg_isready -h localhost -p 5432` → "aceptando conexiones"; servicio `postgresql-x64-17` en marcha |
| P2 | 5499 no responde | Confirmado | `pg_isready -p 5499` → "sin respuesta" (rc 2) |
| P3 | Herramientas de PostgreSQL disponibles | Observación | `pg_isready`, `psql` y `pg_dump` **no están en el PATH**: hay que usar `"C:\Program Files\PostgreSQL\17\bin\…"` |

## 7. Base de datos `Learnity` (script del usuario)

| ID | Afirmación | Resultado | Evidencia |
|---|---|---|---|
Ejecutado por el usuario el 18-10-2026 con `node verificar-bd.mjs`. Las 21 comprobaciones dieron `OK`.

| ID | Afirmación | Resultado | Evidencia |
|---|---|---|---|
| BD-0 | Conexión a `Learnity` como `learnity_app`; PostgreSQL 17.10 | Confirmado | `true/learnity_app`; `17.10` |
| BD-1 | 22 tablas | Confirmado | `information_schema.tables` → 22 |
| BD-2 | Sin vistas, funciones ni triggers | Confirmado | `0/0/0` |
| BD-3 | 13 FK sin índice | Confirmado | 13: `categoria.creada_por`, `curso.id_categoria`, `curso.revisado_por`, `inscripcion.id_ultima_leccion`, `intento_evaluacion.id_evaluacion`, `progreso_leccion.id_leccion`, `recurso_adjunto.id_leccion`, `respuesta.id_opcion`, `respuesta.id_pregunta`, `solicitud_docente.id_persona`, `solicitud_docente.revisada_por`, `usuario_rol.asignado_por` y `usuario_rol.id_rol` |
| BD-4 | 3 cursos `PUBLICADO` sin revisor | Confirmado | 3 |
| BD-5 | 3 lecciones `DOCUMENTO` sin PDF en cursos publicados | Confirmado | 3 |
| BD-6 | `learnity_app` con DML completo en todas las tablas (S2) | Confirmado | `22/22`; sin superusuario, `CREATEROLE`, `CREATEDB` ni `BYPASSRLS`; sin `CREATE` en `public`; `USAGE` en 20 secuencias; las 22 tablas son de `postgres` |
| BD-7 | Scripts 015 y 016 aplicados | Confirmado | `true/true` (`sesion`, `token_recuperacion`, `sesion_familia_idx`, y `archivo_borrado_pendiente` con `DELETE` para la app) |
| BD-8 | Filas en `archivo` = ficheros en `PDF_DIR` | Confirmado | `2=2`; 0 filas sin fichero y 0 ficheros sin fila |
| BD-9 | Sin `actualizado_en` | Confirmado | 0 columnas |
| BD-10 | RLS desactivado | Confirmado | 0 tablas con RLS |
| BD-11 | `learnity_test` no existe en 5432 | Confirmado | `false`. Bases del servidor: `Learnity`, `STS`, `SistemaAulas`, `arquitecturahexagonal`, `dwCamaronera2026_A`, `dw_andinomarket`, `mmoc_db` y `postgres` |
| BD-12/13 | `.env.test` apunta a otro puerto y a una base inexistente | Confirmado | Puerto distinto del de `.env`: `true`; base existente: `false` |
| BD-14 | El `DB_NAME` de `.env.test` termina en `_test` | Confirmado | `true` |


## 8. Coherencia entre la auditoría y el prompt

| ID | Afirmación | Resultado | Evidencia |
|---|---|---|---|
| C1 | Cada archivo de `backend/src` y `frontend/src` tiene exactamente un dueño (§6) | **Cambió** | Script `duenos.mjs` sobre 196 archivos (src, test y scripts). **Sin dueño:** `frontend/src/main.ts`, `frontend/src/index.html` y `frontend/src/app/app.spec.ts`. **Con dos dueños:** ninguno. **Solapamiento entre congelado y dueño:** `shared/layout/vista-previa-aprendizaje.ts` está congelado (§3) y a la vez cae en `shared/{layout}/**` de `fe-a` |
| C2 | Las rutas que citan las fases existen | **Cambió** (dos) | (a) `shared/auth/middlewares.ts:209-214` no existe: el archivo tiene 47 líneas y `registrarVerificadorSesion` está en `:13-15`. (b) La regla "las guardas actuales de `backend/test/*.ts` ya abortan si `DB_NAME` no termina en `_test`" (§4.6 y Anexo A) es falsa para `identidad.test.ts` y `cursos-publicos.test.ts` (ver S1). El resto existe: `correo.ts:20-24`, `auth.interceptor.ts`, `shared/cursos/peticion.ts`, `scripts/crear-modulos.mjs`, `Tono`/`ICONO_CATEGORIA` en `datos-demo.ts:7,45`, `cursos.service.ts:948-994`, README §14 (`:618`, con `CREATE DATABASE learnity_test` y los `GRANT`) |
| C3 | Cada decisión pendiente tiene su momento | Confirmado | El prompt programa D10, D5, D7 y D6 (§2.5). **No programa D8 ni D9** (solo aparecen como condiciones: "si se aprueba el ADR-002" y "dependencias aprobadas por ADR"). D3 y D4 aparecen como condiciones de la Fase 2A/2B, sin un momento para preguntarlas. Se usa el calendario del Paso 3 de `PROMPT_INICIO_REFACTOR.md`: D8 y D9 tras la Puerta 0B, y D3 y D4 en la Puerta 1 |

## 9. Resumen

- **Afirmaciones verificadas: 94.** Son estos bloques: G1–G5, los 26 requisitos del Sprint 2, S1–S10, A1–A12, SQL-1–3, F1–F6, §7.2, R1–R7, B1–B4, P1–P3, las 14 filas BD y C1–C3.
  - **Confirmadas: 86.** En varias, el contenido coincide pero la línea citada está desplazada: 2.1-b, 2.4-a, 2.4-c, S9 y A12.
  - **Cambiaron: 7.** Son A1, A7, SQL-2, F3, F6, C1 y C2.
  - **Observación: 1** (P3).
  - **No verificables: 0.**
- S1 se confirma, pero es más grave de lo que describe la auditoría.
- La auditoría sigue siendo válida como fuente de verdad: ningún estado del Sprint 2 cambia y ningún dato de la base difiere.

## 10. Impacto en el plan

| Discrepancia | Impacto | Acción |
|---|---|---|
| **S1 / C2-b:** `identidad.test.ts` no exige `_test` y `cursos-publicos.test.ts` admite `Learnity` con `LEARNITY_PRUEBA_LOCAL=true` | **Alto.** Si `.env.test` queda mal configurado en la Fase 0B, la suite podría borrar cuentas `@pruebas.test` de `Learnity`. La regla del prompt "las guardas actuales ya abortan" era falsa | Fase 0B: antes del primer `npm test`, el lead repite el chequeo booleano (la base de `.env.test` existe, termina en `_test` y no es `Learnity`) con un script del tipo de `verificar-bd.mjs`. Fase 2A: `qa-edge` crea `guardia-bd.ts`, y `be-a` y `be-b` la importan en las suites que tienen hoy. Se corrigen la §4.6, el Anexo A y la tarea 1 de `qa-edge` en 2A |
| **SQL-2:** `server.ts:36-47` ejecuta SQL al arrancar | Medio. El objetivo es que no quede SQL fuera de repositorios. `server.ts` es de `be-a` | Se añade a los hallazgos de la §3 del prompt. `be-a` lo resuelve junto con `/api/salud` (tarea 4 de 2A) |
| **C1:** `main.ts`, `index.html` y `app.spec.ts` sin dueño; `vista-previa-aprendizaje.ts` congelado y a la vez de `fe-a` | Bajo. Evita conflictos de propiedad | Se asignan a `fe-a` (§6 y Anexo B), y se aclara que lo congelado prevalece sobre `shared/layout/**` |
| **C2-a:** `middlewares.ts:209-214` no existe | Ninguno funcional | Se corrige a `:13-15` en la §5 del prompt |
| **C3:** D8 y D9 (también D3 y D4) sin momento en el prompt | Ninguno: lo cubre el calendario del Paso 3 | D8 y D9 tras la Puerta 0B; D3 y D4 en la Puerta 1 |
| **P3:** las herramientas de PostgreSQL no están en el PATH | Bajo (operativo) | En la Fase 0B y en los scripts de `db`, usar `"C:\Program Files\PostgreSQL\17\bin\<herramienta>.exe"` |
| **A1, A7, F3, F6, SQL-2 (líneas del seed)** y las líneas desplazadas | Ninguno en el plan | Quedan en *Correcciones tras la verificación* de la auditoría |

**Líneas del prompt que se tocaron** (`PROMPT_CLAUDE_CODE_AGENT_TEAMS.md`): 75 (§3, hallazgo 4), 103 (§4.6), 142 (§5), 185 y 189 (§6), 228 (Fase 0B, paso 5; es una línea nueva), 249 (Fase 2A, `qa-edge`), 344 (Anexo A, Pruebas) y 461 (Anexo B, `fe-a`). Los números son los del archivo ya editado.
