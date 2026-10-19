# Prompt para Claude Code CLI (Opus 5.5): refactor de Learnity con agent teams

> Cómo usarlo: abre Claude Code en `C:\Users\ASUS VIVOBOOK\Documents\Programación\Practicas preprofesionales\learnity` (ahí está `.claude/settings.local.json`, con `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`) y pega todo lo que hay debajo de la línea.

---

## 1. Misión y rol

Eres el **lead** del refactor de Learnity: un ingeniero senior de refactorización. Trabajas en dos tiempos: primero verificas y planificas con evidencia, y después coordinas la implementación.

**Refactorizar no es cambiar funcionalidades.** El comportamiento visible y el contrato de la API se mantienen. Toda funcionalidad nueva (la deuda del Sprint 2) va en tareas y commits separados, y solo si el usuario lo decidió.

**Crea un agent team** para este trabajo, con los teammates de la §6, y usa el modelo **Opus 5.5** (`claude-opus-5-5`) para cada uno. Tú coordinas, integras y hablas con el usuario. No implementas código de módulos: lo delegas. Activa los teammates **por fases** (máximo 6 a la vez) y ciérralos cuando terminen su fase. Exige **aprobación de plan** a cada teammate antes de que modifique archivos.

## 2. Arranque: qué haces primero y dónde te detienes

1. Lee `docs/refactor/AUDITORIA_INICIAL.md`. Es la **fuente de verdad**: no repitas la auditoría. Solo verifica rápido estos datos clave y anota el resultado:
   - `git log -1 origin/Edison`: debe ser `ce5e83c`.
   - `git merge-base --is-ancestor origin/Melissa origin/Edison`: debe salir 0.
   - `pg_isready -h localhost -p 5432`.
   - Que `learnity_test` no existe todavía.
2. Crea `docs/refactor/REGLAS_EQUIPO.md` copiando **tal cual** el Anexo A de este prompt.
3. Crea `CLAUDE.md` en la raíz con un enlace a ese archivo y a la auditoría. Contenido mínimo: "Antes de cualquier tarea lee `docs/refactor/REGLAS_EQUIPO.md` y `docs/refactor/ESTADO.md`".
4. Crea `docs/refactor/ESTADO.md` con las secciones *Fase actual*, *Decisiones del usuario*, *Teammates activos*, *Tareas y dueños*, *Integraciones hechas* y *Bloqueos*. **Solo tú escribes en ESTADO.md**; los teammates te informan por mensaje.
5. Pregunta al usuario, **una pregunta a la vez**, las decisiones D1–D10 de la §9 de la auditoría que necesita la Fase 0B: **D10, D5, D7 y D6**, en ese orden. Registra cada respuesta en ESTADO.md.
6. Ejecuta la **Fase 0B** (§7) sin teammates. **Detente en la Puerta 0B** y espera la aprobación del usuario. No crees el equipo antes.

## 3. Contexto real (resumen de la auditoría)

**Stack:**
- Backend: Node 22, Express 5, TypeScript (`tsx`), `pg` sin ORM y zod.
- Frontend: Angular 21 standalone, con signals.
- Base: PostgreSQL 17.10 en `localhost:5432`, base **`Learnity`** (con L mayúscula), cuenta de la aplicación `learnity_app`. Las tablas son de `postgres`.
- Windows con PowerShell y Git Bash.

**Ramas:**
- `Edison` (`ce5e83c`) contiene todo; `Melissa`, `Milena` y `main` son ancestros suyos.
- `main` local está 5 commits por delante de `origin/main`, sin push.
- Hay un cambio local sin commit en `backend/src/shared/auth/contrasena.ts` y documentos del Sprint 2 sin versionar.

**Backend (`backend/src`):**
- `app.ts` y `server.ts`.
- `shared/`: `config`, `database` (`pool.ts`: `consultar`, `enTransaccion`), `http` (`app-error`, `manejador-errores`, `validar`, `limite-peticiones`, `cookies-sesion`, `openapi*.ts`), `auth`, `log` (`registrarEvento`), `correo` (gmail/buzón), `archivos` (`almacen-pdf`, `pdf-validacion`) y `seguridad`.
- `modules/`:
  - `identidad`
  - `cursos`:
    - `cursos.service.ts` (994 líneas);
    - `cursos-integracion.service.ts` y `cursos-integracion.repository.ts`;
    - `cursos.repository.ts` (público).
  - `contenido` (PDF)
  - `administracion` (revisión de cursos y solicitudes de docente)
  - `aprendizaje` y `evaluaciones` (vacíos)

**Frontend (`frontend/src/app`):**
- `core/`: `auth`, `cursos` (`gestion-cursos.api.ts`) y `solicitudes`.
- `pages/`: `publico`, `auth`, `cuenta`, `estudiante`, `docente` y `admin`.
- `shared/`: `ui`, `layout`, `cursos` (`listado-cursos`, `temario-curso`, `pdf-leccion`, `peticion.ts`) y `validadores`.
- `layouts/` y `data/datos-demo.ts`.

**Sprint 2:** 21 requisitos Hecho, 3 Parcial y 2 Falta.

| Faltante o parcial | Tratamiento |
|---|---|
| CRUD de categorías (solo existe `GET /api/categorias`) | **Decidido (D1/D2): se completa dentro del refactor.** Lote A3 en la Fase 2B, como funcionalidad nueva y en commits separados |
| Inicio público y encabezado con `datos-demo` | **Decidido (D1): dentro del refactor.** Lote A2 en la Fase 2B, en commits separados |
| Prueba HTTP automática del recorrido docente → ADMIN → catálogo | Es una prueba, no una funcionalidad: la escribe `qa-edge` en la Fase 2A |
| README con el panel docente desactualizado (`README.md:141`) y paneles huérfanos | Según **D3** |
| Suite completa no ejecutable (`learnity_test` no existe; `.env.test` usa el puerto 5499) | Fase 0B |
| Recepción de Gmail (cierre del Sprint 1) | Solo informar; no es parte del refactor |

**Hallazgos críticos** (detalle en las §4–§6 de la auditoría):
1. Cadena de guardas repetida unas 8 veces en `cursos.service.ts`: rol → `base()` → propietario → `estado` en BORRADOR o RECHAZADO.
2. **Ciclo** Cursos ⇄ Contenido: `cursos.service.ts:19-21` importa `contenido-limpieza.service`, y `contenido.service.ts:19-21` importa `cursos.service`.
3. `detallePrivado` lee los PDF del disco dentro de transacciones con `FOR UPDATE` (`cursos-integracion.service.ts:334-344, 413-418`).
4. SQL fuera de repositorios: `app.ts:35-40` (`/api/salud`, que además expone la base y el usuario), `server.ts:36-47` (consulta de diagnóstico al arrancar), `src/database/seed.ts` y `scripts/sembrar-catalogo.ts`. No hay SQL con datos del cliente concatenados; las interpolaciones son fragmentos fijos (`cursos.repository.ts:52-123`, `administracion.repository.ts:116-118`, `cursos-integracion.repository.ts:623,655`).
5. `learnity_app` tiene DML completo en las 22 tablas.
6. La base no tiene vistas, triggers, auditoría, `actualizado_en` ni control de migraciones.
7. Hay 13 FK sin índice y 3 cursos `PUBLICADO` sin `revisado_por`/`publicado_en` (semillas).
8. La creación de roles y permisos no está en el repositorio (`seed.ts:67` remite a una guía externa).
9. Subida en memoria (`multer.memoryStorage`, 10 MB) sin límite por IP.
10. 16 archivos de Angular importan `datos-demo`. Las pantallas del Sprint 3/4 tienen rutas activas.
11. Las reglas `deny` de `.claude/settings.local.json` solo cubren `Bash(...)`, no `PowerShell(...)`.

**Fuera de alcance (no se implementa nada del Sprint 3/4):**
- Backend: `modules/aprendizaje` y `modules/evaluaciones`.
- Frontend: `pages/estudiante/{inicio-estudiante,mi-aprendizaje,leccion,evaluacion}`, `pages/docente/{editor-evaluacion,estudiantes}` y `shared/layout/vista-previa-aprendizaje`.
- También video, PowerPoint, inscripciones, progreso y la gestión de usuarios (`admin/usuarios`).

## 4. Reglas inquebrantables (resumen; el texto completo está en `docs/refactor/REGLAS_EQUIPO.md`)

1. **Propiedad por carpeta.**
   - Backend nunca edita `frontend/`; Frontend nunca edita `backend/` ni `database/`.
   - Nadie edita lo que no es suyo (§6). Las necesidades cruzadas se piden por mensaje al dueño.
2. **El contrato de la API no cambia** (rutas, JSON, códigos y errores) salvo con un ADR aprobado por el usuario. Primero se documenta como está hoy en `docs/api/openapi.yaml`, que solo edita `arquitecto`.
3. **SQL solo en `*.repository.ts`**, siempre parametrizado (`$1…`), nunca concatenado ni interpolado con datos.
   - Los fragmentos dinámicos solo salen de listas cerradas definidas en el código.
   - Ningún módulo importa el repositorio ni los archivos internos de otro: solo su API pública (`modules/<m>/index.ts`).
4. **Secretos solo en `.env`.** No se leen, no se imprimen y no se copian. La app usa un rol de mínimo privilegio, nunca `postgres`.
5. **Protocolo de BD (entorno local, sin producción):** `Learnity` es la base local de cada integrante y no se toca directamente. El orden es:
   1. migraciones numeradas `up`/`down` probadas `up → down → up` en `learnity_test`;
   2. **Puerta DB**: con aprobación explícita del usuario y tras un `pg_dump` rápido de su `Learnity` local (fuera del repositorio), se aplican a `Learnity`;
   3. cada integrante aplica después las mismas migraciones en su propia `Learnity` local; `schema_migraciones` indica cuáles ya tiene.
6. **Una sola base de pruebas, `learnity_test`, compartida por todo el equipo.** Las pruebas nunca corren contra `Learnity`. **Ojo:** hoy solo `administracion-contenido`, `cursos-gestion-http` y `solicitudes-docente` abortan si `DB_NAME` no termina en `_test`. `identidad.test.ts` solo exige `NODE_ENV=test`, y `cursos-publicos.test.ts` admite `Learnity` con `LEARNITY_PRUEBA_LOCAL=true` (verificación del 19-10-2026). Hasta que todas las suites importen `backend/test/ayudas/guardia-bd.ts`, el lead comprueba antes de cada `npm test` que la base de `.env.test` existe, termina en `_test` y no es `Learnity`. Como la base es compartida y las pruebas crean y borran datos, **solo se ejecuta una suite a la vez**: el teammate pide turno al lead y avisa al terminar.
7. **Archivos privados** fuera de git y de rutas estáticas. Nunca se expone `archivo.ruta`.
8. **Frontend:**
   - Sin tokens en `localStorage`.
   - Sin `datos-demo.ts` en recorridos reales.
   - Los mocks solo van detrás de un flag apagado por defecto y se quitan antes de dar un módulo por hecho.
9. **Git seguro:**
   - Ramas `refactor/<rol>` en worktrees propios.
   - Prohibido: force push, `reset --hard`, `git clean`, borrar ramas del Sprint 2 y hacer push sin que el usuario lo pida.
10. **Caracterizar antes de refactorizar** y mostrar evidencia ejecutada (comando y resultado) antes de decir "hecho".
11. **Una pregunta a la vez.** No inventar: lo no comprobado se marca **NO VERIFICADO**.
12. **Coordinación:**
    - Memoria compartida en `docs/refactor/ESTADO.md` (la escribe solo el lead).
    - Máximo 6 teammates activos.
    - Cada teammate se cierra al terminar su fase.
13. **Polimorfismo solo donde elimine `if/switch` por tipo o duplicación**, y con un ADR. Nada de sobreingeniería ni de arquitectura hexagonal. Candidatos reales:
    - política de estados del curso;
    - estrategia de transporte de correo (`shared/correo/correo.ts:20-24`);
    - interfaz de almacenamiento de archivos (solo la implementación local; nada del Sprint 3).

## 5. Arquitectura objetivo (evolución, no reescritura)

**Backend: monolito modular en capas.**
- **Controlador** = HTTP. Valida con zod mediante middleware uniforme (`validarCuerpo`, `validarParametros` y `validarConsulta`) y no contiene reglas.
- **Servicio** = reglas de negocio y transacciones.
- **Repositorio** = datos y SQL parametrizado.
- Cada módulo expone **una API pública** (`index.ts`) con sus rutas y su interfaz de servicio. Los tipos compartidos van en `<m>.modelo.ts`.
- **Plantilla de módulo** (la mantiene `arquitecto` en `docs/arquitectura/PLANTILLA_MODULO.md`, y `be-b` actualiza `scripts/crear-modulos.mjs`):
  ```
  modules/<m>/
    index.ts
    <m>.routes.ts
    <m>.controller.ts
    <m>.service.ts
    <m>.repository.ts
    <m>.esquemas.ts
    <m>.modelo.ts
  ```
- **Dependencias entre módulos** solo por interfaces públicas.
  - Cuando haya un ciclo, se invierte la dependencia: el consumidor define un *puerto* y el proveedor registra la implementación al arrancar, como ya hace `registrarVerificadorSesion` en `shared/auth/middlewares.ts:13-15`.
  - Así se rompe Cursos ⇄ Contenido.
- **Módulos destino:**
  - `identidad`, `catalogo` (lectura pública; ADR), `categorias` y `usuarios` (incluye solicitudes de docente);
  - `cursos` (con `temario/`), `contenido` y `revision`;
  - `administracion` desaparece al repartir su contenido.
- **Seguridad mínima:**
  - `/api/salud` sin datos internos y Swagger solo en desarrollo;
  - límite por IP en la subida y almacenamiento temporal en disco en vez de memoria (ADR);
  - logger estructurado con ID de correlación por petición;
  - errores sin `detail` de PostgreSQL en los logs.
- **Escalabilidad:**
  - nada de lecturas de disco con filas bloqueadas;
  - índices en FK consultadas;
  - límite por IP documentado como de una sola instancia.

**Frontend Angular:**
- Componentes standalone y carga diferida por *feature*:
  ```
  features/<f>/
    <f>.routes.ts
    paginas/      (contenedores)
    componentes/  (presentación)
    <f>.api.ts
  ```
- **Separación contenedor y presentación**: los componentes de presentación no inyectan servicios HTTP.
- **Cliente HTTP tipado** desde `docs/api/openapi.yaml` (`core/api/`). Si se aprueba `openapi-typescript`, los tipos se generan; si no, se escriben a mano en `core/api/contrato.ts`.
- Interceptor de sesión (`core/auth/auth.interceptor.ts`, ya existe) y mapeo de errores en `core/http/`.
- Guards por rol (ya existen).
- Estados de carga, vacío y error con un componente común en `shared/ui/`.
- Accesibilidad: foco visible, etiquetas y contraste AA. Responsive sin scroll horizontal a 390 px.

## 6. Equipo: roles, skills y propiedad de carpetas

Cada teammate es una sesión independiente: **no ve esta conversación**. Por eso, al crearlo, pásale el *prompt de teammate* del Anexo B que le corresponde, completo.

| Teammate | Skill que debe invocar | Es dueño de (solo él edita) |
|---|---|---|
| `arquitecto` | `engineering:architecture` | `docs/adr/**`, `docs/api/**`, `docs/arquitectura/**`, `backend/src/shared/http/openapi*.ts`, `backend/package.json`, `backend/tsconfig*.json`, `frontend/package.json`, `frontend/angular.json`, `frontend/tsconfig*.json`, `README.md` |
| `db` | `postgresql-database-engineering` | `database/**`, `docs/bd/**` |
| `qa-edge` | `engineering:code-review` | `backend/test/caracterizacion/**`, `backend/test/seguridad/**`, `backend/test/ayudas/**`, `e2e/**` (raíz), `docs/refactor/RIESGOS.md`, `docs/refactor/PLAN_PRUEBAS.md` |
| `be-a` | `nodejs-backend-patterns` | `backend/src/app.ts`, `backend/src/server.ts`, `backend/src/shared/{config,auth,http,log,correo,seguridad}/**` (excepto `openapi*.ts`), `backend/src/modules/{identidad,catalogo,categorias,usuarios}/**`, `backend/test/{identidad,catalogo,categorias,usuarios}/**`, y los actuales `backend/test/identidad.test.ts`, `cursos-publicos.test.ts` y `solicitudes-docente.test.ts` |
| `be-b` | `nodejs-backend-patterns` | `backend/src/shared/{database,archivos}/**`, `backend/src/modules/{cursos,contenido,revision,administracion}/**`, `backend/src/database/seed.ts`, `backend/scripts/**`, `backend/test/{cursos,contenido,revision}/**`, y los actuales `backend/test/{pdf-validacion,administracion-contenido,cursos-gestion,cursos-gestion-http}.test.ts` |
| `fe-a` | `anthropic-skills:ui-ux-pro-max` y `anthropic-skills:frontend-design` | `frontend/src/{main.ts,index.html}`, `frontend/src/app/{app.ts,app.spec.ts,app.config.ts,app.routes.ts}`, `frontend/src/environments/**`, `core/{auth,http,solicitudes}/**`, `layouts/**`, `shared/{layout,validadores}/**`, `features/{identidad,catalogo,admin-categorias,usuarios}/**`, `pages/{auth,cuenta,publico}/**`, `pages/estudiante/perfil/**`, `pages/admin/{categorias,usuarios,solicitudes}/**` |
| `fe-b` | `anthropic-skills:ui-ux-pro-max` y `anthropic-skills:frontend-design` | `frontend/src/styles.scss`, `core/{api,cursos,estado}/**`, `shared/{ui,cursos}/**`, `features/{docente-cursos,contenido,revision}/**`, `pages/docente/{mis-cursos,editor-curso,panel}/**`, `pages/admin/{revision-cursos,revision-curso,panel}/**`, `data/datos-demo.ts` (solo para sacar de ahí los tipos de UI) |

- **Lead:** `CLAUDE.md`, `docs/refactor/{REGLAS_EQUIPO,ESTADO}.md`, `.gitignore`, `integration/sprint-2` y las etiquetas.
- **Congelado (nadie lo edita):** las rutas del Sprint 3/4 listadas en la §3, salvo que `fe-a` las oculte detrás de un flag en `app.routes.ts` si así lo decide **D4**. Lo congelado prevalece sobre la propiedad por carpeta: `shared/layout/vista-previa-aprendizaje.ts` está congelado aunque quede dentro de `shared/layout/**` (`fe-a`).

**Parejas y lotes** (§7.3 de la auditoría):
- **Pareja A** = `be-a` + `fe-a`:
  - A1 Identidad y cuenta;
  - A2 Catálogo público;
  - A3 Categorías;
  - A4 Usuarios y roles (solicitudes de docente).
- **Pareja B** = `be-b` + `fe-b`:
  - B1 Cursos del docente;
  - B2 Temario;
  - B3 Contenido PDF;
  - B4 Revisión administrativa.

**Traspasos entre lotes** (se piden por mensaje):
- `administracion/` es de `be-b`. `be-a` crea `modules/usuarios` con la lógica de solicitudes. Después `be-b` retira esa parte de `administracion`, y por último `be-a` registra las rutas nuevas en `app.ts`. Nunca se registran las dos a la vez.
- `fe-b` exporta las rutas de sus *features* (`features/<f>/<f>.routes.ts`) y `fe-a` las conecta con `loadChildren` en `app.routes.ts`.
- El puerto de limpieza de archivos lo define `be-b` en `cursos`, y `be-a` lo registra en `app.ts`.

## 7. Fases y puertas de aprobación

Cada fase termina en una **Puerta**. Presenta al usuario el resumen y la evidencia, y **no avances sin su aprobación explícita**.

### Fase 0B: línea base (solo el lead, sin teammates)

1. **D10:** pide al usuario que agregue a `deny` en `.claude/settings.local.json` los equivalentes `PowerShell(git push *)`, `PowerShell(git reset --hard *)`, `PowerShell(git clean *)`, `PowerShell(git branch -D *)` y `PowerShell(Remove-Item -Recurse *)`, y la lectura de `.env` por shell. Tú no editas ese archivo.
2. Rama de integración:
   ```
   git fetch --all
   git switch -c integration/sprint-2 origin/Edison
   ```
   Es un avance directo; no se tocan las ramas originales. Aplica **D5**: versionar o no los documentos del Sprint 2 y `contrasena.ts`.
3. Agrega `.worktrees/` a `.gitignore` y crea un worktree por teammate de código cuando llegue su fase:
   ```
   git worktree add .worktrees/<rol> -b refactor/<rol> integration/sprint-2
   ```
   Después ejecuta `npm ci` en `backend/` y `frontend/` de ese worktree.
4. **Base de prueba (D7):** el usuario crea, con `postgres` y siguiendo la §14 del `README.md`, **una sola** base `learnity_test`, compartida por el lead, `qa-edge`, `be-a` y `be-b` (es un entorno local; no hacen falta bases por desarrollador). Le aplica el esquema y los scripts 015 y 016 y concede los permisos a `learnity_app`. Luego corrige `backend/.env.test` (`DB_PORT=5432` y la contraseña) y lo copia a cada worktree. **Tú no lees `.env*`.**
5. Línea base verde, con la salida pegada en ESTADO.md:
   - Antes del primer `npm test`, el usuario ejecuta un script de solo lectura (como `verificar-bd.mjs`, fuera del repositorio) que confirme con booleanos que la base de `.env.test` existe, termina en `_test` y no es `Learnity`. Motivo: `identidad.test.ts` no tiene esa guarda.
   - `backend`: `npm run build`, `npm run typecheck` y `npm test` (se esperan 78 pruebas superadas y 1 omitida).
   - `frontend`: `npx ng build` y `npx ng test --watch=false` (se esperan 20/20).
6. Pide permiso al usuario y crea la etiqueta `git tag baseline-pre-refactor`.

**Puerta 0B:** suite en verde y decisiones D5, D6, D7 y D10 registradas.

### Fase 1: diseño (`arquitecto`, `db` y `qa-edge`; solo escriben documentos)

| Teammate | Entregables | Condición de salida |
|---|---|---|
| `arquitecto` | `docs/api/openapi.yaml`: contrato **tal como está hoy**, serializado desde el objeto de `shared/http/openapi.ts` (JSON es YAML válido) y contrastado con las rutas reales. ADRs en `docs/adr/`: 001 arquitectura y API pública por módulo; 002 catálogo como módulo de lectura; 003 política de estados del curso; 004 ruptura del ciclo Cursos ⇄ Contenido mediante un puerto; 005 estrategia de correo e interfaz de almacenamiento; 006 validación uniforme y logger con correlación; 007 estructura de *features* en Angular y cliente tipado. `docs/arquitectura/PLANTILLA_MODULO.md` y `CONTRATOS_SERVICIO.md` | Contrato verificado contra `*.routes.ts`; ADRs con alternativas y consecuencias |
| `db` | `docs/bd/PLAN_BD.md` y migraciones en `database/migraciones/0NN_<nombre>.{up,down}.sql` (desde 017). Contenido: tabla `schema_migraciones`; roles `learnity_owner` (NOLOGIN, dueño), `learnity_app` (DML mínimo por tabla) y `learnity_lectura`; `auditoria_cambio` con trigger genérico (quién, cuándo, operación, antes y después en `jsonb`, **sin** `contrasena_hash` ni `token_hash`; el actor se toma de `current_setting('learnity.id_persona', true)`); `actualizado_en` con trigger; corrección de los 3 cursos inconsistentes antes del `CHECK (estado <> 'PUBLICADO' OR (revisado_por IS NOT NULL AND publicado_en IS NOT NULL))`; índice único parcial de la solicitud pendiente; índices de FK consultadas; vistas del catálogo si se aprueba el ADR-002. Procedimiento para Windows: `pg_dump` rápido antes de aplicar a `Learnity` y cómo aplica cada integrante las migraciones en su base local | Migraciones probadas `up → down → up` en `learnity_test`, en un turno de pruebas concedido por el lead |
| `qa-edge` | `docs/refactor/RIESGOS.md` ("cómo se rompe la app": permisos, IDOR, concurrencia, entradas extremas, disco lleno, caída de BD, inyección, XSS, CSRF y subidas simultáneas). `docs/refactor/PLAN_PRUEBAS.md`: matriz endpoint → casos de caracterización, y huecos de la §2.6 de la auditoría | Cada endpoint de `openapi.yaml` tiene casos asignados |

**Puerta 1:** el usuario aprueba los ADRs, el contrato y el plan de BD. Cierra a `db` y, si no hay pendientes, también a `arquitecto` mientras no se necesite.

### Fase 2A: fundaciones (`arquitecto`, `qa-edge`, `be-a`, `be-b`, `fe-a` y `fe-b`)

| Teammate | Tareas (5–6) |
|---|---|
| `qa-edge` | (1) Guarda `backend/test/ayudas/guardia-bd.ts` (`NODE_ENV=test`, `DB_NAME` terminado en `_test` y distinto de `Learnity`, sin excepciones como `LEARNITY_PRUEBA_LOCAL`). `be-a` y `be-b` la importan en las suites de las que son dueños. (2) Pruebas de caracterización del contrato (estado, forma JSON y código de error) de **todos** los endpoints. (3) **Prueba HTTP del recorrido completo**: docente crea → módulo → lección DOCUMENTO → sube PDF → envía → ADMIN aprueba → `GET /api/cursos` lo lista → detalle. (4) Pruebas de seguridad de RIESGOS.md. (5) Informe de cobertura por módulo |
| `arquitecto` | (1) Script `test:local` con glob `test/**/*.test.ts`. (2) Dependencias aprobadas por ADR. (3) Revisión de cada integración. (4) Mantener `openapi.yaml` y `openapi*.ts` alineados. (5) Renombrar `openapi-integrante2/3.ts` por dominio |
| `be-a` | (1) Middleware de validación uniforme. (2) Logger con ID de correlación (`x-request-id`) que sustituya los `console.*` de `shared`. (3) Estrategia `TransporteCorreo` (gmail/buzón). (4) `/api/salud` sin datos internos y Swagger solo en desarrollo. (5) Manejador de errores sin `detail` de PostgreSQL en logs. (6) Registro de puertos en `app.ts` |
| `be-b` | (1) `shared/database`: transacción con actor (`SELECT set_config('learnity.id_persona', $1, true)`; parametrizado, nunca interpolado) y tipo `Ejecutor`. (2) Interfaz `AlmacenArchivos` (solo la implementación local) y validador PDF. (3) Plantilla de módulo y `scripts/crear-modulos.mjs`. (4) Mover la SQL de `seed.ts` y `sembrar-catalogo.ts` a repositorios o a SQL de `database/` (este último, coordinado con `db`) |
| `fe-a` | (1) `core/http` (mapeo de errores). (2) Separar `app.routes.ts` en rutas por *feature* con `loadChildren`. (3) `layouts` y `shared/layout`. (4) Flag para las pantallas congeladas, si así lo decide D4. (5) Adoptar en sus páginas el estado de petición que publique `fe-b` en `core/estado` |
| `fe-b` | (1) `core/api` (cliente tipado). (2) Mover `shared/cursos/peticion.ts` a `core/estado` y avisar a `fe-a`. (3) `shared/ui`: componente de estado de carga, vacío y error, y modal. (4) Tipos de UI (`Tono`, `ICONO_CATEGORIA`) fuera de `datos-demo`. (5) Tokens de diseño en `styles.scss` y accesibilidad base |

**Puerta 2A:** caracterización en verde sobre la línea base, fundaciones integradas en `integration/sprint-2`, suite completa y builds en verde.

### Fase 2B: módulos en paralelo por parejas (`be-a`, `fe-a`, `be-b`, `fe-b`, `qa-edge` y `arquitecto`)

Orden dentro de cada lote. No se refactoriza ningún módulo sin su caracterización en verde.

- **Lote B:**
  - B1 + B2: dividir `cursos.service.ts` en ficha y temario y aplicar la política de estados (ADR-003). La lectura de PDF sale de la sección bloqueada (ADR, riesgo R4).
  - B3: romper el ciclo con un puerto (ADR-004).
  - B4: `revision` sale de `administracion`.
- **Lote A:**
  - A1 Identidad;
  - A2 Catálogo (extraer las lecturas de `cursos.repository.ts`);
  - A4 Usuarios (traslado de las solicitudes);
  - A3 Categorías, con el CRUD nuevo (decidido en D1/D2). Antes, `arquitecto` documenta las rutas nuevas con un ADR, porque amplían el contrato.
  - La deuda de `datos-demo` en el inicio y el encabezado va **en commits separados** (decidido en D1).
- **Frontend de cada lote:** mover `pages/*` a `features/*` con separación contenedor/presentación, cliente tipado y estados de carga, vacío y error.

**Puerta 2B:** se abre una por lote. Requiere la definición de hecho (§8) de cada módulo, la revisión de `arquitecto` y la de `qa-edge`.

### Fase 3: endurecimiento (`qa-edge`, `db`, `arquitecto`, y `be-a`/`be-b` si hacen falta)

1. Pruebas de seguridad de todos los S2–S9 de la auditoría.
2. Límite por IP en la subida.
3. Migraciones aplicadas en `learnity_test`.
4. **Puerta DB (Learnity):** tras un `pg_dump` rápido, aplicar las migraciones a la `Learnity` local **solo con aprobación** y luego verificar con consultas de solo lectura. Dejar en el README cómo las aplica cada integrante en su máquina.
5. Cambiar la conexión de la app al rol de mínimo privilegio. El usuario actualiza `.env`.
6. README y OpenAPI finales y recorrido e2e.
7. Propuesta para actualizar `main` (`--ff-only`); el push solo si el usuario lo pide.

**Puerta final.**

## 8. Definición de hecho y formato de reporte

**Un módulo está hecho cuando:**
- Su caracterización y sus pruebas pasan sin cambiar expectativas, salvo con un ADR.
- No tiene SQL fuera de su repositorio ni imports de internos de otros módulos (comprobado con `grep`).
- `npm run build`, `npm run typecheck`, `npm test` (en `learnity_test`, con turno del lead), `npx ng build` y `npx ng test --watch=false` están en verde.
- No contiene `datos-demo` ni mocks activos.
- Tiene estados de carga, vacío y error, y es accesible y responsive.
- `openapi.yaml` sigue igual (o hay un ADR).
- Lo revisaron `arquitecto` y `qa-edge`.

**Reporte de cada teammate al lead** (mensaje y bloque en su PR o commit):

```
### <rol> · <tarea>
**Qué hice:** …
**Archivos tocados:** (solo de mi propiedad) …
**Cómo verificarlo:** `<comando>` → <resultado real pegado>
**Riesgos / pendientes / NO VERIFICADO:** …
**Necesito de otro dueño:** …
```

## 9. Primera acción

Empieza por la **§2 (Arranque)** y la **Fase 0B**. Detente en la **Puerta 0B** y no crees el agent team ni avances de fase sin la aprobación explícita del usuario.

---

## Anexo A: texto de `docs/refactor/REGLAS_EQUIPO.md` (cópialo tal cual)

```markdown
# Reglas del equipo de refactor de Learnity

Fuente de verdad del estado inicial: `docs/refactor/AUDITORIA_INICIAL.md`. Estado vivo: `docs/refactor/ESTADO.md` (solo lo escribe el lead).

## Propiedad
- Edita solo tus carpetas (tabla de propiedad en ESTADO.md). Si necesitas un cambio fuera de ellas, envía un mensaje al dueño con: archivo, cambio y motivo.
- Backend no toca `frontend/`. Frontend no toca `backend/` ni `database/`.
- Archivos compartidos con dueño único: `app.ts`/`server.ts` (be-a), `app.routes.ts` (fe-a), `package.json`/`tsconfig`/`angular.json`/`openapi*` (arquitecto), `.gitignore` y ESTADO.md (lead).

## Contrato
- No cambian rutas, cuerpos JSON, códigos HTTP ni códigos de error (`{ error: { codigo, mensaje, detalles } }`) sin un ADR aprobado por el usuario.
- Contrato de referencia: `docs/api/openapi.yaml` (lo edita solo arquitecto).

## SQL y datos
- SQL solo en `*.repository.ts`, con parámetros `$1…`. Prohibido concatenar o interpolar valores. Los fragmentos dinámicos (orden, `FOR UPDATE`) solo salen de listas cerradas del código.
- Ningún módulo importa el repositorio ni los archivos internos de otro módulo; solo su `index.ts` público.
- Transacciones con la ayuda de `shared/database`. Nunca hay lecturas de disco con filas bloqueadas.
- El actor de la auditoría se fija con `set_config('learnity.id_persona', $1, true)`.

## Base de datos
- Entorno local, sin producción. `Learnity` no se modifica directamente. Orden: migraciones `database/migraciones/0NN_*.up.sql` y `.down.sql` probadas `up → down → up` en `learnity_test` → Puerta DB → `pg_dump` rápido (fuera del repositorio) → aplicar a `Learnity` solo con aprobación del usuario. Cada integrante aplica luego las mismas migraciones en su base local.
- Las operaciones con `postgres` (crear bases, `pg_dump`, cambiar dueños) las ejecuta el usuario con los scripts que prepare `db`.
- La app usa un rol de mínimo privilegio, nunca `postgres`.

## Pruebas
- Nunca contra `Learnity`. Todo el equipo comparte una sola base, `learnity_test`. Toda suite debe importar `backend/test/ayudas/guardia-bd.ts`, que aborta si `DB_NAME` no termina en `_test`. Hasta entonces, `identidad.test.ts` y `cursos-publicos.test.ts` **no** tienen esa guarda: el lead comprueba `.env.test` antes de cada ejecución.
- **Una suite a la vez:** como la base es compartida y las pruebas crean y borran datos (por ejemplo, `identidad.test.ts` borra todas las cuentas `@pruebas.test`), pide turno al lead antes de `npm test` y avísale al terminar.
- Antes de refactorizar un módulo, su caracterización debe estar en verde. No se cambian expectativas para "hacer pasar" una prueba.
- "Hecho" exige evidencia ejecutada: comando y salida.

## Seguridad
- Secretos solo en `.env*`. No los leas, no los imprimas, no los copies a documentos ni a mensajes.
- Archivos privados fuera de git y de rutas estáticas. Nunca expongas `archivo.ruta` en respuestas ni en logs.
- Toda entrada se valida con zod. Autorización por rol **y** por propiedad en el servicio.

## Frontend
- Sin tokens en `localStorage` ni en `sessionStorage`. Sin `innerHTML` ni `bypassSecurityTrust`.
- Sin `datos-demo.ts` en recorridos reales. Los mocks solo van detrás de un flag apagado por defecto y se eliminan antes de cerrar el módulo.
- *Features* con carga diferida, separación contenedor/presentación, cliente tipado, estados de carga/vacío/error, accesibilidad AA y responsive a 390 px.

## Git
- Trabaja en tu worktree `.worktrees/<rol>` y en tu rama `refactor/<rol>`. Para traer cambios integrados usa `git merge integration/sprint-2`.
- Prohibido: force push, `reset --hard`, `git clean`, borrar ramas del Sprint 2 y hacer push sin que el usuario lo pida.
- Commits pequeños, en español, separando refactor de funcionalidad nueva.

## Alcance
- Refactorizar no es cambiar funcionalidades. No se implementa nada del Sprint 3/4 (aprendizaje, evaluaciones, video, PowerPoint, inscripciones, progreso, gestión de usuarios).
- Polimorfismo solo donde elimine `if/switch` por tipo o duplicación, y con un ADR. Nada de arquitectura hexagonal ni de reescrituras.

## Comunicación
- Una pregunta a la vez. Lo no comprobado se marca **NO VERIFICADO**.
- Informa al lead con este formato:
  - `### <rol> · <tarea>`
  - **Qué hice:** …
  - **Archivos tocados** (solo de mi propiedad): …
  - **Cómo verificarlo:** `<comando>` → resultado real pegado
  - **Riesgos / pendientes / NO VERIFICADO:** …
  - **Necesito de otro dueño:** …
- Máximo 6 teammates activos; cada uno se cierra al terminar su fase.
```

---

## Anexo B: prompts de teammate (pásale a cada uno el suyo, completo)

**Encabezado común** (antepónlo a cada prompt):
> Eres un teammate del equipo de refactor de Learnity (`C:\Users\ASUS VIVOBOOK\Documents\Programación\Practicas preprofesionales\learnity`). No ves la conversación del lead. Antes de nada, lee `docs/refactor/REGLAS_EQUIPO.md`, `docs/refactor/ESTADO.md` y las secciones de `docs/refactor/AUDITORIA_INICIAL.md` que se indican abajo. Trabaja solo en tus carpetas y desde tu worktree `.worktrees/<rol>` si escribes código. Antes de modificar archivos, envía tu plan al lead para que lo apruebe. Reporta con el formato de la §8 del prompt del lead (está copiado en REGLAS_EQUIPO.md, en "Comunicación").

**`arquitecto`** (skill `engineering:architecture`).
- Lee las §1, §4, §5 y §7 de la auditoría.
- Eres dueño de: `docs/adr/**`, `docs/api/**`, `docs/arquitectura/**`, `backend/src/shared/http/openapi*.ts`, los `package.json`, `tsconfig*.json`, `angular.json` y `README.md`.
- **Fase 1:**
  1. Genera `docs/api/openapi.yaml` con el contrato tal como está hoy y compáralo con cada `*.routes.ts`; anota cada diferencia como hallazgo y no la corrijas.
  2. Escribe los ADR 001–007 (contexto, opciones, decisión propuesta, consecuencias): API pública por módulo; catálogo como módulo de lectura; política de estados del curso que elimine las guardas repetidas de `cursos.service.ts`; puerto para romper el ciclo Cursos ⇄ Contenido; Strategy de correo e interfaz de almacenamiento sin nada del Sprint 3; validación uniforme y logger con correlación; *features* Angular y cliente tipado.
  3. Escribe `PLANTILLA_MODULO.md` y `CONTRATOS_SERVICIO.md` (qué expone cada módulo).
- **Fases 2A y 2B:**
  - Revisas cada integración: capas, imports cruzados, SQL fuera de repositorios y contrato sin cambios.
  - Aplicas en `package.json` solo las dependencias con ADR aprobado.
  - Cambias `test:local` por el glob `test/**/*.test.ts`.
- No escribes código de módulos.

**`db`** (skill `postgresql-database-engineering`).
- Lee las §2.5, §4.2 (S1, S2) y §6 completa de la auditoría.
- Eres dueño de `database/**` y `docs/bd/**`.
- Contexto: PostgreSQL 17.10, base `Learnity`, 22 tablas con dueño `postgres`, app como `learnity_app` con DML total, sin vistas, triggers, auditoría, `actualizado_en` ni control de migraciones. Faltan índices en 13 FK. Hay 3 cursos `PUBLICADO` sin `revisado_por`/`publicado_en`. La creación de roles no está en el repositorio.
- **Fase 1:** escribe `docs/bd/PLAN_BD.md` (diagnóstico, actividad de la web según la matriz de la §6 y propuesta) y las migraciones `017+` con su `down`:
  - `schema_migraciones`;
  - roles `learnity_owner`, `learnity_app` con mínimo privilegio por tabla y `learnity_lectura`;
  - `auditoria_cambio` con una función de trigger genérica (actor desde `current_setting('learnity.id_persona', true)`, excluyendo `contrasena_hash` y `token_hash`);
  - `actualizado_en`;
  - corrección de datos y luego el `CHECK` de PUBLICADO;
  - índice único parcial de la solicitud `PENDIENTE`;
  - índices de FK consultadas;
  - vistas del catálogo, si se aprueba el ADR-002.
- Escribe también el procedimiento para Windows: `pg_dump -F c` rápido fuera del repositorio antes de aplicar a `Learnity`, y cómo aplica cada integrante las migraciones en su base local.
- Pruebas solo en `learnity_test`, con turno del lead. **Nunca** ejecutas nada en `Learnity`. Las órdenes que requieren `postgres` las preparas para que las ejecute el usuario.

**`qa-edge`** (skill `engineering:code-review`).
- Lee las §2, §4, §6 (matriz) y §8 de la auditoría.
- Eres dueño de: `backend/test/caracterizacion/**`, `backend/test/seguridad/**`, `backend/test/ayudas/**`, `e2e/**`, `docs/refactor/RIESGOS.md` y `PLAN_PRUEBAS.md`.
- Piensas "cómo se rompe la app": permisos e IDOR (IDs enumerados, docente ajeno, ESTUDIANTE), concurrencia (dos administradores, doble envío, subidas simultáneas), entradas extremas, disco lleno o caído, BD caída a mitad de una transacción, inyección, XSS, CSRF y huérfanos de archivos.
- **Fase 1:** RIESGOS.md y PLAN_PRUEBAS.md (endpoint → casos).
- **Fase 2A, antes de que nadie refactorice:**
  1. La guarda de BD.
  2. La caracterización de todos los endpoints.
  3. La prueba HTTP del recorrido docente → ADMIN → catálogo.
  4. Las pruebas de seguridad.
- Usa `learnity_test`, con turno del lead. **No corriges código ajeno**: reporta el fallo al dueño con los pasos para reproducirlo.

**`be-a`** (skill `nodejs-backend-patterns`). Pareja A con `fe-a`.
- Lee las §4, §5.1 y §7.3 de la auditoría.
- Eres dueño de: `backend/src/app.ts`, `server.ts`, `shared/{config,auth,http,log,correo,seguridad}` (sin `openapi*`), los módulos `identidad`, `catalogo`, `categorias` y `usuarios`, sus pruebas, y los actuales `identidad.test.ts`, `cursos-publicos.test.ts` y `solicitudes-docente.test.ts`. Base de pruebas: `learnity_test` (compartida; pide turno al lead).
- **Fase 2A:**
  1. Validación uniforme (cuerpo, parámetros y consulta).
  2. Logger con ID de correlación.
  3. Strategy `TransporteCorreo`.
  4. `/api/salud` sin datos internos y Swagger solo en desarrollo.
  5. Errores sin `detail` de PostgreSQL en logs.
  6. Registro de puertos en `app.ts`.
- **Fase 2B:**
  - A1 Identidad, en capas limpias.
  - A2 `catalogo`: extraer las lecturas públicas de `cursos.repository.ts` y `cursos.service.ts:948-994` sin cambiar el JSON.
  - A4 `usuarios`: trasladar las solicitudes de docente desde `administracion` (coordina con `be-b` y no registres las dos rutas a la vez).
  - A3 `categorias`: lectura pública y CRUD de administración (decidido en D1/D2), según el ADR y las rutas que documente `arquitecto`.
- La deuda del Sprint 2 va en commits separados. Nada del Sprint 3/4.

**`be-b`** (skill `nodejs-backend-patterns`). Pareja B con `fe-b`.
- Lee las §2.2, §2.3, §4, §5.1 (A1–A5, A9) y §7.3 de la auditoría.
- Eres dueño de: `shared/{database,archivos}`, los módulos `cursos`, `contenido`, `revision` y `administracion`, `src/database/seed.ts`, `scripts/**`, sus pruebas, y los actuales `pdf-validacion`, `administracion-contenido` y `cursos-gestion*.test.ts`. Base de pruebas: `learnity_test` (compartida; pide turno al lead).
- **Fase 2A:**
  1. Transacción con actor mediante `set_config(..., $1, true)`.
  2. Interfaz `AlmacenArchivos` (solo local) y validador PDF.
  3. Plantilla de módulo y `crear-modulos.mjs`.
  4. SQL de semillas fuera de los scripts.
- **Fase 2B:**
  - B1 + B2: dividir `cursos.service.ts` (994 líneas) y `cursos-integracion.*` en ficha y `temario/`, con la política de estados del ADR-003; sacar la lectura de PDF de las secciones con `FOR UPDATE`.
  - B3: romper el ciclo con Contenido mediante el puerto del ADR-004.
  - B4: crear `revision` con las rutas `/admin/cursos*` y retirar de `administracion` la parte de solicitudes cuando `be-a` lo pida.
- Mismo JSON y mismos códigos de error.

**`fe-a`** (skills `anthropic-skills:ui-ux-pro-max` y `anthropic-skills:frontend-design`). Pareja A con `be-a`.
- Lee las §5.2 y §7.3 de la auditoría.
- Eres dueño de: `frontend/src/main.ts`, `index.html`, `app.ts`, `app.spec.ts`, `app.config.ts`, `app.routes.ts`, `environments`, `core/{auth,http,solicitudes}`, `layouts`, `shared/{layout,validadores}`, `features/{identidad,catalogo,admin-categorias,usuarios}` y las páginas actuales `auth`, `cuenta`, `publico`, `estudiante/perfil` y `admin/{categorias,usuarios,solicitudes}`.
- **Fase 2A:**
  1. `core/http`.
  2. Rutas por *feature* con `loadChildren`.
  3. Layouts.
  4. Flag para las pantallas del Sprint 3/4 si D4 lo decide.
  5. Usar el estado de petición que `fe-b` publique en `core/estado`.
- **Fase 2B:**
  - Migrar tus páginas a `features/*` con contenedor/presentación, cliente tipado de `core/api` (lo provee `fe-b`) y estados de carga, vacío y error.
  - Inicio y encabezado sin `datos-demo` (decidido en D1), en commits separados.
  - Conectar `admin/categorias` al CRUD real cuando `be-a` lo publique.
- Accesibilidad AA y 390 px sin scroll horizontal. No tocas `backend/`.

**`fe-b`** (skills `anthropic-skills:ui-ux-pro-max` y `anthropic-skills:frontend-design`). Pareja B con `be-b`.
- Lee las §2.4, §5.2 y §7.3 de la auditoría.
- Eres dueño de: `styles.scss`, `core/{api,cursos,estado}`, `shared/{ui,cursos}`, `features/{docente-cursos,contenido,revision}`, las páginas `docente/{mis-cursos,editor-curso,panel}` y `admin/{revision-cursos,revision-curso,panel}`, y `data/datos-demo.ts` (solo para sacar los tipos).
- **Fase 2A:**
  1. Cliente tipado en `core/api`.
  2. Mover `shared/cursos/peticion.ts` a `core/estado` y avisar a `fe-a`.
  3. `shared/ui` con estado de carga, vacío y error, y modal.
  3. Tipos `Tono` e `ICONO_CATEGORIA` fuera de `datos-demo`.
  4. Tokens de diseño.
  5. Accesibilidad base.
- **Fase 2B:**
  - Migrar `mis-cursos`, `editor-curso` (dividido en ficha y temario), `pdf-leccion` y la revisión a `features/*`, manteniendo el progreso de subida y el bloqueo en EN_REVISION/PUBLICADO.
  - Exportar tus rutas a `fe-a`.
  - Borrar los paneles huérfanos solo si D3 lo decide.
- No tocas `backend/`.
