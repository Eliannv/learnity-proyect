# Auditoría inicial de Learnity (previa al refactor)

- **Fecha:** 18 de octubre de 2026.
- **Rama auditada:** `Edison` (`ce5e83c`), que contiene todo el trabajo del Sprint 2.
- **Modo:** solo lectura. No se editó código de la aplicación, no se hizo merge ni push y no se modificó ninguna base de datos.
- **Base `Learnity`:** se consultó con la cuenta de la aplicación (`learnity_app`, leída del `.env` sin copiar la contraseña), dentro de una transacción `BEGIN READ ONLY` que terminó en `ROLLBACK`.
- **Comandos ejecutados:** `npm run build`, `npm run typecheck`, `npx ng build` y `npx ng test --watch=false`. La suite del backend **no** se ejecutó porque apunta a una base que no existe (ver §2.6).

Convenciones: `archivo:línea` es evidencia en la rama `Edison`. **NO VERIFICADO** indica algo que no se pudo comprobar.

---

## 1. Resumen ejecutivo

1. El P0 del Sprint 2 está implementado. De 26 requisitos auditados: **21 Hecho, 3 Parcial y 2 Falta** (CRUD de categorías y cierre de Gmail).
2. Todas las ramas (`Melissa`, `Milena`, `main` local y remota) son ancestros de `Edison`. La integración es un avance directo (*fast-forward*), sin conflictos.
3. No hay SQL con datos del cliente concatenados. Todo el SQL de la aplicación está en `*.repository.ts` y es parametrizado. Solo hay interpolación de fragmentos fijos elegidos en el código.
4. Fuera de repositorios hay SQL en `app.ts:36` (`/api/salud`), `src/database/seed.ts`, `scripts/sembrar-catalogo.ts` y en las pruebas. Ninguno recibe datos del usuario.
5. **Bloqueante para refactorizar:** la base `learnity_test` no existe en el servidor local (5432) y `.env.test` apunta al puerto 5499, que no responde. Hoy la suite de 78 pruebas no puede servir de red de seguridad.
6. Principal deuda de arquitectura en **Cursos**:
   - `cursos.service.ts` tiene 994 líneas y repite unas 8 veces la misma cadena de guardas (rol → curso → propietario → estado editable).
   - Hay una **dependencia circular** Cursos ⇄ Contenido.
7. La aplicación ya **no** usa el superusuario: conecta como `learnity_app`. Pero esa cuenta tiene `SELECT/INSERT/UPDATE/DELETE` en las 22 tablas, incluidas `rol` y `usuario_rol`.
8. La base no tiene vistas, funciones, triggers, auditoría de cambios ni columnas de última modificación. Hay 13 FK sin índice y datos que rompen reglas de negocio que solo vive en el servicio (3 cursos publicados sin revisor).
9. Frontend:
   - Rutas con carga diferida (23 `loadComponent`) y guards por rol.
   - Sin `localStorage` ni `innerHTML`.
   - 16 archivos todavía importan `data/datos-demo.ts`: el inicio público, el encabezado y las pantallas del Sprint 3/4.
10. Builds: backend `build` y `typecheck` en verde. Angular compila y pasa 20/20 pruebas. Gmail: falta confirmar la recepción real (cierre del Sprint 1).

---

## 2. Sprint 2: requisitos con evidencia

### 2.1 Público (integrante 1)

| Requisito | Estado | Evidencia |
|---|---|---|
| `GET /api/categorias` | Hecho | `cursos.routes.ts` (`.get('/categorias')`); `cursos.repository.ts:93-98` (solo `activa = TRUE`) |
| `GET /api/cursos`: solo PUBLICADO, búsqueda en título/subtítulo/descripción, categorías y niveles repetidos, orden y paginación con conteo | Hecho | `cursos.repository.ts:47-67` (`ILIKE` parametrizado con `ESCAPE`, `ANY($n::text[])`); `:100-127` (`COUNT(*)`, `LIMIT/OFFSET`); `cursos.controller.ts:11-20` (zod: `repetible`, `orden` enum, `limite ≤ 50`); `test/cursos-publicos.test.ts` (6 pruebas) |
| `GET /api/cursos/:id`: 404 para borrador y sin archivos privados | Hecho | `cursos.repository.ts:129-154` (`estado = 'PUBLICADO'`, sin `a.ruta`); `cursos.service.ts:971-979` (404); prueba "detalla solo publicados y no expone archivos privados" |
| Angular consume la API (catálogo y detalle) | Hecho | `pages/publico/cursos-publicos.service.ts`; `catalogo.spec.ts`, `detalle-curso.spec.ts`. El inicio y el encabezado siguen con datos de ejemplo (§5) |

### 2.2 Cursos (integrante 2)

| Requisito | Estado | Evidencia |
|---|---|---|
| `GET /api/docente/cursos`: solo propios, con estado y motivo de rechazo | Hecho | `cursos-integracion.repository.ts:50-77` (`d.id_persona = $1`, `motivo_rechazo`) |
| `POST /api/cursos` y `PUT /api/cursos/:id`: solo propio, editable en BORRADOR/RECHAZADO, con validaciones | Hecho | `cursos.service.ts:152-272` (propietario, estado y categoría activa en transacción); `cursos-gestion.esquemas.ts`; `cursos-gestion.test.ts` (11 pruebas) |
| Módulos y lecciones: crear, editar y eliminar; propiedad por ID de módulo y de lección; orden único; 1–10 y 1–12; transacciones | Hecho | `cursos.service.ts:274-867`; BD `UNIQUE (id_curso, orden)`, `UNIQUE (id_modulo, orden)`, `CHECK orden 1–10 / 1–12`; `cursos-gestion-http.test.ts` (10 pruebas, incluida la condición de carrera "módulo eliminado entre la búsqueda y el bloqueo") |
| `POST /api/cursos/:id/enviar-revision`: completitud, atomicidad, sin doble envío y limpia el motivo | Hecho | `cursos.service.ts:869-946` (`FOR UPDATE` y revalidación); `cursos-integracion.repository.ts:531-549` (`motivo_rechazo = NULL`, `WHERE estado IN ('BORRADOR','RECHAZADO')`); reglas en `cursos-integracion.service.ts:84-275` |
| Servicio de Cursos para Administración y Contenido; nadie importa `cursos.repository` | Hecho, con observación | Ningún módulo importa `cursos.repository` (grep `from '../`). Observación: `cursos.service.ts:19-21` importa `contenido-limpieza.service` (un interno de Contenido) y `contenido.service.ts:19-21` importa `cursos.service`. Es un ciclo (§5) |

### 2.3 Administración y PDF (integrante 3)

| Requisito | Estado | Evidencia |
|---|---|---|
| `GET /api/admin/cursos?estado=EN_REVISION` y detalle | Hecho | `administracion.routes.ts` (`autenticar, autorizar('ADMIN')`); `cursos-integracion.service.ts:397-428` |
| `PUT /api/admin/cursos/:id/revision`: APROBAR, o RECHAZAR con motivo; atómico; la doble decisión falla; guarda `revisado_por`, `publicado_en` y `motivo_rechazo` | Hecho | `cursos-integracion.service.ts:531-623`; `cursos-integracion.repository.ts:738-769` (`WHERE estado = 'EN_REVISION'`); prueba "solo admite una decisión cuando dos administradores deciden simultáneamente" |
| `POST /api/lecciones/:id/archivo`: PDF ≤ 10 MB con firma real; nombre del servidor; fuera de rutas estáticas; propietario y estado; limpieza; sin huérfanos; mismo curso | Hecho | `contenido.multipart.ts:15-20` (`fileSize`, `files: 1`, `fields: 0`); `contenido.service.ts:55-203` (`validarBytesPdf`, `randomUUID()`, `retirarSiHuerfano`, `programarRetiro`); `cursos-integracion.repository.ts:703-736` (mismo `id_curso`); `app.ts` sin `express.static`; 2 archivos en `uploads/pdf` = 2 filas en `archivo` |
| `GET /api/archivos/:id`: solo ADMIN o DOCENTE propietario; sin `archivo.ruta` | Hecho | `contenido.routes.ts`; `cursos-integracion.service.ts:495-529`; `detallePrivado` arma `archivo` sin `ruta` (`:315-324`); prueba "rechaza rutas físicas manipuladas" |

### 2.4 Angular Docente y Admin (integrante 4)

| Requisito | Estado | Evidencia |
|---|---|---|
| `mis-cursos` usa la API con estados de carga, vacío y error | Hecho | `mis-cursos.ts` delega en `shared/cursos/listado-cursos` (`listado-cursos.html:34-39`, error con "Reintentar") y `core/cursos/gestion-cursos.api.ts:24` |
| `editor-curso` con API real, subida de PDF con progreso, envío a revisión y bloqueo en EN_REVISION/PUBLICADO | Hecho | `gestion-cursos.api.ts:156` (`reportProgress`); `shared/cursos/pdf-leccion.ts`; `editor-curso.ts:74,203` (`esEditable`) |
| `revision-curso` con API real | Hecho | `gestion-cursos.api.ts:113-137` |
| Sin `datos-demo.ts` en ese recorrido | Hecho | Ni `mis-cursos`, `editor-curso` ni `revision-curso` lo importan (grep) |
| Sin tokens en `localStorage` | Hecho | Sin usos de `localStorage` ni `sessionStorage` (grep); `auth.service.ts:16` |

### 2.5 Generales

| Requisito | Estado | Evidencia |
|---|---|---|
| Recorrido real docente → ADMIN → visitante con PostgreSQL | Parcial | `README.md:392,768` dice que se comprobó por HTTP y manualmente. Ninguna prueba automática encadena todo por HTTP: `administracion-contenido.test.ts` arma los cursos con SQL (`:212`) y solo `cursos-gestion-http.test.ts` usa `enviar-revision`. **NO VERIFICADO** hoy |
| OpenAPI y README actualizados | Parcial | `shared/http/openapi.ts` más `openapi-integrante2/3.ts` y `openapi-solicitudes.ts`. `README.md:141` todavía describe un panel docente que la rama quitó (`app.routes.ts:142-144` redirige `/docente` a `cursos`). No existe `docs/api/openapi.yaml` |
| Pruebas de permisos (docente ajeno, ESTUDIANTE, IDs enumerados) | Hecho | `cursos-gestion-http.test.ts` ("rechaza a estudiantes…", "impide editar un curso de otro docente", "rechaza IDs inválidos…"); `administracion-contenido.test.ts` ("protege rutas con sesión y rol…", "rechaza subidas… de otro propietario") |
| Build y typecheck | Hecho | Hoy: `npm run build` → exit 0; `npm run typecheck` → exit 0; `ng build` → exit 0 (inicial 363,80 kB); `ng test` → 5 archivos, 20/20 |
| Suite completa del backend | Parcial | Pasó 78/78 el 17-10-2026 en un clúster temporal de pruebas (sesión anterior). Hoy no se puede ejecutar: `.env.test` usa `DB_PORT=5499` (`pg_isready`: sin respuesta) y `learnity_test` no existe en 5432 (consulta a `pg_database`) |
| Cierre de Gmail (Sprint 1) | Falta (informativo) | `SPRINT_2_LEARNITY.md:5`: falta confirmar la recepción y el enlace en el buzón |
| P1: solicitud Estudiante → Docente | Hecho | `administracion.service.ts`, `administracion.repository.ts`; `test/solicitudes-docente.test.ts` (11 pruebas); `pages/admin/solicitudes/solicitudes.ts` |
| P1: CRUD de categorías | Falta | Solo existe `GET /api/categorias`. `pages/admin/categorias/categorias.ts` usa `datos-demo`. **Discrepancia:** `PLAN_SPRINTS_LEARNITY.md` lo pide en el Sprint 2 y `SPRINT_2_LEARNITY.md` lo deja como P1 |

**Fuera del Sprint 2, con datos de ejemplo:** `admin/usuarios` (no hay API `/admin/usuarios`).

### 2.6 Estado de las pruebas

| Archivo | Pruebas | Base |
|---|---|---|
| `identidad.test.ts` | 22 (1 omitida: HIBP) | `learnity_test` vía `--env-file=.env.test` |
| `cursos-publicos.test.ts` | 6 | ídem |
| `pdf-validacion.test.ts` | 4 | sin BD |
| `administracion-contenido.test.ts` | 15 | ídem |
| `cursos-gestion.test.ts` | 11 | validación (sin HTTP) |
| `cursos-gestion-http.test.ts` | 10 | ídem |
| `solicitudes-docente.test.ts` | 11 | ídem |
| Angular (`ng test`) | 20 | sin BD |

**No cubren:**
- el recorrido HTTP completo de punta a punta;
- el frontend de las páginas admin y docente (solo `gestion-cursos.spec.ts` prueba el cliente HTTP);
- concurrencia de subidas, disco lleno o fallo de PostgreSQL a mitad de una operación (solo hay una prueba de fallo de asociación);
- accesibilidad;
- carga.

---

## 3. Ramas y plan de integración

```
* ce5e83c (Edison, origin/Edison)      Elian Valarezo      Solicitudes de docente + correcciones
* 55fc8ff (main local, sin push)       Heroxy-2005 (Edison) Corrige integración de cursos
*   9ce36f9                            Edison Cárdenas      Merge PR #1 Edison/Melissa
|\
| * 3f3bf17 (origin/Melissa)           Melissa              Gestión privada de cursos (integrante 2)
| * 82751a5                            Melissa              Integra avances de cursos
* | 8550000                            Heroxy-2005 (Edison) "Trabajo del integrante 3 y 4"
|/
* 4109368 (origin/main, origin/Milena) Elian Valarezo      Primeras partes del Sprint 2 (catálogo)
```

| Rama | Integrante (inferido) | Aporta | ¿Integrada en Edison? | Estado |
|---|---|---|---|---|
| `origin/main` | Elian (integrante 1) | Sprint 1 y catálogo público | Sí (ancestro) | Atrasada 6 commits |
| `main` local | — | Igual que el `Edison` anterior (`55fc8ff`) | Sí | 5 commits por delante de `origin/main`, sin push |
| `origin/Milena` | **NO VERIFICADO** | Sin commits propios (= `4109368`) | Sí | Vacía |
| `origin/Melissa` | Melissa (integrante 2) | Backend de Cursos (`3f3bf17`) | Sí, por el PR #1 (`9ce36f9`) | Integrada |
| `origin/Edison` | Edison (`Heroxy-2005` = `alexiyo2685@…`, mismo correo que `9ce36f9`) + Elian | Integrantes 3 y 4, la integración y las solicitudes | — | Superconjunto de todo |

Evidencia: `git merge-base --is-ancestor <rama> origin/Edison` devuelve 0 para las cuatro ramas. `git diff --shortstat origin/main origin/Edison` muestra 87 archivos, +13 098 y −1 584.

**Cambios locales fuera de git:**
- `backend/src/shared/auth/contrasena.ts` está modificado (comentario del usuario).
- Hay documentos sin versionar: `SPRINT_2_LEARNITY.md`, `CONTRATO_API_PUBLICA_SPRINT_2.md`, `INTEGRANTE_2/3/4_*.md` y `docs/`.

**Orden de integración propuesto (no ejecutado):**
1. Crear `integration/sprint-2` desde `origin/Edison` (`ce5e83c`). No hay conflictos porque es un avance directo.
2. Decidir qué hacer con `contrasena.ts` y los documentos sin versionar (§9, D5).
3. Crear `learnity_test`, corregir `.env.test` y dejar la suite en verde.
4. Etiquetar `baseline-pre-refactor`.
5. Actualizar `main` con `--ff-only` hacia esa etiqueta solo con aprobación. No se borra ninguna rama del Sprint 2.

---

## 4. Seguridad y SQL (de mayor a menor severidad)

### 4.1 SQL

| Clase | Caso | Evidencia | Valoración |
|---|---|---|---|
| (c) Interpolado | Condiciones y `ORDER BY` armados con fragmentos fijos | `cursos.repository.ts:52-64, 102, 111-123` | **Seguro hoy**: los valores del cliente van como `$n` y el orden sale de un `Record` cerrado (zod enum en `cursos.controller.ts:18`). Patrón frágil: un cambio futuro podría colar texto del cliente |
| (c) Interpolado | `FOR UPDATE` opcional | `cursos-integracion.repository.ts:623, 655` | Seguro (booleano interno) |
| (c) Interpolado | `ORDER BY ${orden}` | `administracion.repository.ts:116-118` | Seguro (ternario fijo) |
| (c) Interpolado | Prefijo `${SELECT_CUENTA}` / `${SELECT_SOLICITUD}` | `identidad.repository.ts:70,78`; `administracion.repository.ts:100,108` | Seguro (constantes) |
| (b) Fuera de repositorio | `/api/salud` consulta la BD desde `app.ts` | `app.ts:35-40` | Rompe la regla de capas y **expone `current_database` y `current_user`** a cualquier visitante |
| (b) Fuera de repositorio | Semillas | `src/database/seed.ts:92-133`, `scripts/sembrar-catalogo.ts` (6 consultas) | Parametrizado. Debería vivir en repositorios o en SQL de `database/` |
| (b) Fuera de repositorio | Transacciones | `shared/database/pool.ts:32-37` (`BEGIN/COMMIT/ROLLBACK`) | Infraestructura (aceptable) |
| (b) Fuera de repositorio | Pruebas | 87 consultas en `test/*.ts` | Aceptable (datos de prueba), siempre contra `learnity_test` |
| (a) Repositorio parametrizado | Resto: identidad (26), cursos-integración (26), administración (11), contenido (12), cursos (5) | grep `consultar(` / `.query(` | Correcto |

### 4.2 Hallazgos de seguridad

| # | Severidad | Hallazgo | Evidencia |
|---|---|---|---|
| S1 | Alta (proceso) | Sin base de pruebas aislada: cualquier ejecución mal configurada podría correr la suite, que crea y borra datos, contra otra base | `.env.test` (5499, sin respuesta); `pg_database` sin `learnity_test` |
| S2 | Media | `learnity_app` tiene DML completo en las 22 tablas, incluidos `DELETE` sobre `rol`, `usuario_rol`, `sesion` y `token_recuperacion`; la aplicación nunca borra roles | Consulta `has_table_privilege` |
| S3 | Media | Las reglas de seguridad de Claude Code solo niegan `Bash(git push *)`, `Bash(rm -rf *)` y similares. No cubren la herramienta **PowerShell** de Windows, y `Read(**/.env)` no impide leerlo con un comando de shell | `.claude/settings.local.json` |
| S4 | Media | `/api/salud` expone la base y el usuario de PostgreSQL; `/api/docs` (Swagger) es público en cualquier entorno | `app.ts:35-43` |
| S5 | Media | La subida usa `multer.memoryStorage()` con 10 MB por petición. Varias subidas simultáneas consumen RAM, y el límite por IP no aplica a esta ruta | `contenido.multipart.ts:15`; `contenido.routes.ts` (sin `limitarPorIp`) |
| S6 | Baja | `portadaUrl` acepta cualquier URL `http(s)` externa: carga de imágenes de terceros (rastreo, contenido mixto) | `cursos-integracion.service.ts:66-82` |
| S7 | Baja | El manejador de errores hace `console.error(error)`. Los errores de PostgreSQL incluyen `detail` con valores (por ejemplo, el correo duplicado) | `manejador-errores.ts:43` |
| S8 | Baja | El seed imprime la contraseña de las cuentas de prueba | `seed.ts:142` |
| S9 | Baja | `DB_SSL=true` usa `rejectUnauthorized: false` | `pool.ts:13` |
| S10 | Baja | Distinguir 404 de 403 en `GET /docente/cursos/:id` permite saber si un ID existe (aceptado por el plan: "403 o 404 coherente") | `cursos.service.ts:133-146` |

**Correcto:**
- Ningún secreto versionado ni `.env` en el historial (`git log --all --diff-filter=A -- "*.env"` vacío).
- El script de Gmail escribe el refresh token en `.env` sin imprimirlo (`autorizar-gmail.ts:95-103`).
- El `.gitignore` cubre `.env*`, `dist/`, `backend/uploads/` y `backend/.buzon/` (`git check-ignore`).
- `helmet`, CORS con lista de orígenes, `express.json({limit:'1mb'})`, CSRF y verificación de origen en `/auth`, límites por IP en Identidad, logs que filtran claves sensibles (`registro.ts:10`), zod en todas las entradas y autorización por rol y por propiedad en el servicio.

---

## 5. Arquitectura y frontend

### 5.1 Backend

| # | Hallazgo | Evidencia | Impacto |
|---|---|---|---|
| A1 | `cursos.service.ts` tiene 994 líneas y repite la cadena *rol → `base()` → propietario → estado editable* en cada operación (10 comparaciones con `'BORRADOR'` y 14 `roles.includes` en módulos) | `cursos.service.ts:108-946` | Duplicación. Candidato a una **política de estados del curso** |
| A2 | Cursos se reparte en tres servicios y dos repositorios: `cursos.service`, que mezcla lo público con la gestión y hace `...cursosIntegracionService`, más `cursos-integracion.service/.repository` y `cursos.repository` | `cursos.service.ts:105-106` | Responsabilidades mezcladas y nombres por integrante |
| A3 | Ciclo Cursos ⇄ Contenido | `cursos.service.ts:19-21, 746, 761, 844, 859` ↔ `contenido.service.ts:19-21` | Impide repartir los módulos entre equipos sin romper el otro |
| A4 | Administración solo delega en Cursos para la revisión y además contiene las solicitudes de docente (roles) | `administracion.service.ts` | Dos dominios distintos en un módulo |
| A5 | `detallePrivado` lee y valida cada PDF desde disco dentro de la transacción, tras cada edición, y `detalleParaRevision` toma `FOR UPDATE` solo para leer | `cursos-integracion.service.ts:334-344, 413-418` | Bloqueos largos y poca escalabilidad |
| A6 | La validación de entrada es inconsistente: `validarCuerpo` en rutas (Identidad, Solicitudes) frente a `safeParse` en controladores (Cursos) | `cursos.controller.ts:33-231`; `identidad.routes.ts` | Mantenimiento |
| A7 | Hay 24 `console.*` frente a 20 `registrarEvento`, y no hay un ID de correlación por petición | grep | Observabilidad (tema de la materia: *trace ID*) |
| A8 | `if (CORREO_TRANSPORTE === 'gmail')` | `shared/correo/correo.ts:20-24` | Candidato a **Strategy** (transporte de correo) |
| A9 | Almacenamiento local fijo (`almacenPdf`) y validación solo de PDF | `shared/archivos/almacen-pdf.ts:61-160` | Candidato a una interfaz de almacenamiento y validadores por tipo **solo si un ADR lo justifica** (video y PPT son del Sprint 3: no se implementan) |
| A10 | Módulos vacíos `aprendizaje` y `evaluaciones` | `*.service.ts` (4–6 líneas) | Alcance del Sprint 3/4: se congelan |
| A11 | Nombres por persona: `openapi-integrante2.ts` y `openapi-integrante3.ts` | `shared/http/` | Mantenimiento |
| A12 | El límite por IP vive en la memoria del proceso | `limite-peticiones.ts:8-11` | Solo sirve con una instancia (está documentado) |

### 5.2 Frontend

| # | Hallazgo | Evidencia |
|---|---|---|
| F1 | 16 archivos importan `datos-demo` o `demo-sesiones`. En rutas activas del Sprint 2: `publico/inicio`, `shared/layout/header-sitio` (categorías), `admin/categorias` y `admin/usuarios`. `shared/ui/tarjeta-curso` y `portada-curso` usan tipos de `datos-demo`. El resto es del Sprint 3/4 | grep `datos-demo` |
| F2 | Páginas huérfanas sin ruta: `pages/docente/panel/panel.ts` (287 líneas) y `pages/admin/panel/panel.ts` | `app.routes.ts:142-144, 202-204` |
| F3 | Servicios HTTP repartidos: `core/cursos`, `core/solicitudes`, `core/auth/perfil.service` y `pages/publico/cursos-publicos.service.ts`, que está dentro de `pages/`. No hay cliente generado desde el contrato | grep `HttpClient` |
| F4 | Componentes grandes con plantilla en línea: `admin/solicitudes/solicitudes.ts` (465 líneas); `editor-curso.ts` (316) | `wc -l` |
| F5 | `app.routes.ts` (267 líneas) concentra todas las rutas, sin archivos de rutas por *feature* | `app.routes.ts` |
| F6 | Correcto: carga diferida (23 `loadComponent`); guards `invitadoGuard`, `autenticadoGuard`, `rolGuard` y `conSesionMatch`; sin `innerHTML` ni `bypassSecurityTrust`; `modoDemo: false` | `app.routes.ts`; `environment.development.ts:3` |

---

## 6. Base de datos `Learnity`

**Identidad:** PostgreSQL 17.10 (Windows); base `Learnity` (con L mayúscula); usuario de conexión `learnity_app`. Hay 22 tablas, todas con dueño `postgres`, que coinciden con `learnity_esquema.sql`, `015_sesiones_y_recuperacion.sql` y `016_limpieza_pdf.sql` (los dos scripts ya están aplicados).

| Aspecto | Estado | Evidencia |
|---|---|---|
| Roles | `learnity_app` (sin superusuario, sin `CREATEROLE`, `CREATEDB` ni `BYPASSRLS`) y `postgres` | `pg_roles` |
| Privilegios de la app | DML completo en las 22 tablas; sin `CREATE` en `public`; `USAGE` en 20 secuencias | `has_table_privilege`, `has_schema_privilege` |
| Creación de roles y permisos base | **No está en el repositorio**: `seed.ts:67` remite a "10_roles_learnity.sql de la guía" (documento externo) | — |
| Vistas, funciones y triggers | Ninguno | `information_schema.views`, `pg_proc`, `pg_trigger` |
| Auditoría (quién, cuándo, antes y después) | No existe | — |
| Columnas de última modificación (`actualizado_en`) | No existe ninguna | `information_schema.columns` |
| Control de migraciones aplicadas | No existe (scripts numerados manuales) | `database/` |
| CHECK de estados | Sí: `curso.estado`, `nivel`, `RECHAZADO ⇒ motivo`; `solicitud_docente.estado`; `usuario.estado`; tipos y tamaños de `archivo` | `pg_constraint` |
| Orden de módulos y lecciones | Sí: `UNIQUE (id_curso, orden)` y `CHECK 1–10`; `UNIQUE (id_modulo, orden)` y `CHECK 1–12` | ídem |
| Restricciones que faltan | `PUBLICADO ⇒ revisado_por y publicado_en NOT NULL`; una sola solicitud `PENDIENTE` por persona (índice único parcial; hoy solo lo garantiza un bloqueo en el servicio); `DOCUMENTO` publicada con PDF (regla compleja: servicio o trigger) | — |
| Datos que rompen reglas | 3 cursos `PUBLICADO` sin `revisado_por`/`publicado_en`; 3 lecciones `DOCUMENTO` de cursos publicados sin PDF (semillas sintéticas `[Prueba Sprint 2]`) | Consultas de datos |
| Índices que faltan (13 FK sin índice) | Relevantes hoy: `solicitud_docente(id_persona)` (y `(estado, enviada_en)` para la lista), `usuario_rol(id_rol)`, `curso(id_categoria)` (cubierto parcialmente por `curso_catalogo_idx(estado, id_categoria)`). La búsqueda `ILIKE '%q%'` recorre la tabla completa (no hay `pg_trgm`; requiere superusuario) | Consulta de FK sin índice |
| Huérfanos | 0 archivos sin lección; 0 archivos de otro curso; disco = BD (2 = 2). Riesgo: `archivo → curso ON DELETE CASCADE` borra metadatos pero no el disco (hoy no hay endpoint que borre cursos) | Consultas y `ls uploads/pdf` |
| RLS | Desactivado en todas las tablas | `pg_class.relrowsecurity` |

### Matriz acción → endpoint → tablas → qué puede fallar

| Acción en la web | Endpoint | Tablas | Qué puede fallar |
|---|---|---|---|
| Registrarse | `POST /api/auth/registro` | persona, usuario, usuario_rol, sesion | Correo duplicado (UNIQUE → 409); servicio HIBP caído; carrera entre dos registros |
| Iniciar sesión | `POST /api/auth/login` | usuario (intentos, bloqueo, último acceso), usuario_rol, sesion | Bloqueo a los 5 fallos; 429 por IP; cuenta inactiva |
| Renovar o cerrar sesión | `POST /api/auth/refresh`, `/logout` | sesion | Reutilización de un token viejo (revoca la familia); CSRF u origen inválido |
| Recuperar contraseña | `POST /api/auth/recuperar`, `/restablecer` | token_recuperacion, usuario, sesion | Gmail caído; token vencido o reutilizado |
| Editar perfil o contraseña | `PUT /api/perfil`, `/perfil/contrasena` | persona, usuario, sesion | Contraseña débil; sin auditoría de cambios |
| Ver catálogo y detalle | `GET /api/categorias`, `/api/cursos`, `/api/cursos/:id` | categoria, curso, docente, persona, modulo, leccion, archivo, inscripcion | Borrador por URL (404); búsqueda lenta sin índice de texto |
| Solicitar ser docente | `POST /api/solicitudes-docente` | usuario (`FOR UPDATE`), usuario_rol, solicitud_docente | Doble envío (lo evita el bloqueo; falta un índice único parcial) |
| Admin decide solicitud | `PUT /api/admin/solicitudes/:id` | solicitud_docente, usuario_rol, docente | Dos administradores a la vez (`FOR UPDATE`); el administrador decide la suya (403) |
| Docente crea o edita curso | `POST /api/cursos`, `PUT /api/cursos/:id` | curso, categoria, docente | Categoría inactiva; curso bloqueado; sin rastro de quién cambió qué |
| Temario | `POST /cursos/:id/modulos`, `PUT/DELETE /modulos/:id`, `POST /modulos/:id/lecciones`, `PUT/DELETE /lecciones/:id` | modulo, leccion, archivo, archivo_borrado_pendiente | Orden duplicado (UNIQUE); límites; el borrado deja el PDF pendiente de limpieza |
| Subir PDF | `POST /api/lecciones/:id/archivo` | archivo, leccion, archivo_borrado_pendiente + disco | Fallo de disco o de BD a mitad; memoria con subidas simultáneas; reemplazo |
| Descargar PDF | `GET /api/archivos/:id` | archivo, leccion, modulo, curso, docente + disco | ID enumerado (controlado); archivo ausente en disco |
| Enviar a revisión | `POST /api/cursos/:id/enviar-revision` | curso (+ lectura del temario y del disco) | Curso incompleto; doble envío; lectura de disco con la fila bloqueada |
| Admin revisa curso | `GET /api/admin/cursos(/:id)`, `PUT /api/admin/cursos/:id/revision` | curso (`FOR UPDATE`), temario y disco | Dos administradores; curso que dejó de ser válido; bloqueo prolongado |

---

## 7. Módulos, dependencias y reparto

### 7.1 Backend actual

```
identidad ──(registrarVerificadorSesion)──► shared/auth
cursos ◄──────── administracion (revisión; solicitudes aparte)
cursos ◄───────► contenido      (CICLO: limpieza de PDF)
aprendizaje, evaluaciones: vacíos (Sprint 3/4)
shared: config, database, http, auth, log, correo, archivos, seguridad
```

### 7.2 Frontend actual

- `core/` contiene `auth`, `cursos` y `solicitudes`.
- `pages/` se divide en `publico`, `auth`, `cuenta`, `estudiante`, `docente` y `admin`.
- `shared/` contiene `ui`, `layout`, `cursos` y `validadores`.
- `layouts/` contiene `layout-sitio` y `layout-panel`.
- `data/datos-demo.ts` tiene 484 líneas.

### 7.3 Reparto propuesto (unidades funcionales, de backend a frontend)

| Lote | Unidad | Backend (después del refactor) | Frontend |
|---|---|---|---|
| **A** (be-a + fe-a) | A1 Identidad y cuenta | `modules/identidad` | `auth/*`, `cuenta/ajustes-perfil`, `estudiante/perfil` |
| A | A2 Catálogo público | `modules/catalogo` (lecturas públicas extraídas de `cursos.repository.ts` y `cursos.service.ts:948-994`) | `publico/inicio`, `catalogo`, `detalle-curso`, categorías del encabezado |
| A | A3 Categorías (admin) | `modules/categorias` (hoy solo hay lectura; el CRUD es deuda del Sprint 2) | `admin/categorias` |
| A | A4 Usuarios y roles | `modules/usuarios` (solicitudes de docente movidas desde `administracion`; la gestión de usuarios queda fuera del Sprint 2) | `admin/solicitudes`, tarjeta de solicitud del perfil, `admin/usuarios` (congelada) |
| **B** (be-b + fe-b) | B1 Cursos del docente | `modules/cursos` (ficha, mis cursos, enviar a revisión, política de estados) | `docente/mis-cursos`, `editor-curso` (ficha), `shared/cursos/listado-cursos` |
| B | B2 Temario | `modules/cursos/temario` | `shared/cursos/temario-curso` |
| B | B3 Contenido (PDF) | `modules/contenido` | `shared/cursos/pdf-leccion` |
| B | B4 Revisión administrativa | `modules/revision` (rutas `/admin/cursos*` movidas desde `administracion`) | `admin/revision-cursos`, `admin/revision-curso` |

El Lote B tiene más código (Cursos más Contenido son unas 3 300 líneas). El Lote A suma más pantallas y la deuda de categorías. Las dependencias entre lotes son tres, y todas pasan por interfaces públicas:
- Revisión (B) llama a la API pública de Cursos (B), dentro del mismo lote.
- Usuarios (A) asigna el rol DOCENTE y crea la fila `docente`. Cursos (B) solo lee el docente desde su propio repositorio.
- Catálogo (A) lee los cursos publicados. Se propone un modelo de lectura propio (vistas creadas por `db`), con ADR.

**Núcleo compartido que se construye primero (Fase 2A):**
- **Backend:** `shared/config`, errores y validación HTTP uniforme (cuerpo, parámetros y consulta), autenticación y política de propiedad, unidad de transacción y ejecutor de repositorio, logger con ID de correlación, interfaces de correo y de almacenamiento, y la plantilla de módulo con API pública (`index.ts`).
- **Frontend:** `core/http` (interceptor y mapeo de errores), estado de petición (`shared/cursos/peticion.ts` → `core`), cliente tipado desde el contrato, rutas por *feature*, `layouts`, `shared/ui` (estados de carga, vacío y error, y modal) y los tipos de UI separados de `datos-demo`.

**Se congela (Sprint 3/4, nadie lo implementa):**
- Backend: `aprendizaje`, `evaluaciones`.
- Frontend: `estudiante/{inicio-estudiante, mi-aprendizaje, leccion, evaluacion}`, `docente/{editor-evaluacion, estudiantes}` y `shared/layout/vista-previa-aprendizaje`.

---

## 8. Riesgos priorizados

| # | Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|---|
| R1 | Refactorizar sin una suite ejecutable (`learnity_test` inexistente) | Alta | Alto | Fase 0B: crear la base, corregir `.env.test`, dejar la suite en verde y etiquetar la línea base |
| R2 | Regresiones al dividir Cursos (duplicación y ciclo con Contenido) | Alta | Alto | Pruebas de caracterización del contrato antes de tocarlo; romper el ciclo con inversión de dependencias (como ya hace `registrarVerificadorSesion`) |
| R3 | Datos que rompen reglas y ausencia de auditoría o última modificación | Media | Medio | Migraciones probadas en `learnity_test`: corregir los datos y después agregar las restricciones; tabla de auditoría con triggers |
| R4 | Bloqueos largos por leer el disco dentro de transacciones | Media | Medio | Validar los PDF fuera de la sección bloqueada o guardar el resultado de validación al subir (ADR) |
| R5 | Teammates con permisos de shell sin las mismas restricciones (PowerShell) y DML amplio de `learnity_app` | Media | Alto | Endurecer `.claude/settings.local.json` (lo hace el usuario); roles de mínimo privilegio por migración |
| R6 | Conflictos de archivos entre equipos (`app.routes.ts`, `app.ts`, `package.json`, `openapi*.ts`) | Media | Medio | Un solo dueño por archivo compartido; cambios cruzados por mensaje |
| R7 | Mezclar el refactor con funcionalidad nueva (deuda del Sprint 2) | Media | Medio | Commits y tareas separadas, con las decisiones de §9 |

---

## 9. Decisiones que necesito de ti

| # | Decisión | Recomendación |
|---|---|---|
| D1 | ¿Lo que falta del Sprint 2 (CRUD de categorías, datos reales en el inicio y el encabezado, prueba automática del recorrido completo) se completa **antes** del refactor o **dentro** de él? | **Decidido (18-10-2026): dentro del refactor.** Fase 2B, después de caracterizar cada módulo, en tareas y commits separados marcados como funcionalidad nueva |
| D2 | El CRUD de categorías, ¿es P0 (plan general) o P1 (documento del Sprint 2)? | **Resuelto con D1:** se completa (lote A3) |
| D3 | Paneles Docente y Admin quitados en `Edison`: ¿borrar los archivos huérfanos y corregir `README.md:141`, o restaurarlos con datos reales? | Borrar los huérfanos y corregir el README (restaurar sería funcionalidad nueva) |
| D4 | Pantallas del Sprint 3/4 con datos de ejemplo en rutas activas: ¿ocultarlas detrás de un flag apagado o dejarlas visibles como prototipo? | Ocultarlas detrás de un flag apagado por defecto |
| D5 | ¿Se versionan `contrasena.ts` (modificado) y los documentos del Sprint 2 sin versionar? | Versionar los documentos; `contrasena.ts`, a tu criterio |
| D6 | ¿Cuándo se actualiza `main`? | `main` con `--ff-only` a `baseline-pre-refactor`, solo con tu aprobación |
| D7 | ¿Quién ejecuta las operaciones con `postgres` (crear `learnity_test`, `pg_dump`)? | Tú, con los scripts que prepare `db`. **Alcance decidido (18-10-2026):** entorno solo local, sin producción; una única base de pruebas `learnity_test` compartida, sin clon `learnity_refactor` ni bases por desarrollador |
| D8 | ¿El catálogo pasa a ser un módulo de lectura propio, con vistas? | Sí, con un ADR |
| D9 | Dependencias nuevas: `openapi-typescript` (cliente tipado), `@playwright/test` (e2e), extensión `pg_trgm` | Cada una con su ADR y tu aprobación |
| D10 | ¿Endureces `.claude/settings.local.json` (equivalentes `PowerShell(...)` de las reglas `deny`)? | Sí, antes de la Fase 0B |

---

## 10. NO VERIFICADO y por qué

- **Diapositivas de la materia:** `Clase 1/3/4/5/6/8.pptx` no tienen texto extraíble (son imágenes) y `Clase 7.pdf` no se pudo abrir (falta `pdftoppm`). Se usó `Conocimientos entre clases.txt` (temario de capas, SOLID, DIP, DTO, Repository/Specification, transacciones, *trace ID*, validación y seguridad).
- **Suite del backend:** no se ejecutó hoy porque `learnity_test` no existe. El 78/78 corresponde a la sesión del 17-10-2026.
- **Recorrido manual en Angular:** lo afirman `README.md:392,768`; no se reprodujo en esta auditoría.
- **Recepción del correo Gmail.**
- **Accesibilidad, responsive y rendimiento con carga:** no se auditaron en el navegador.
- **Integrante de la rama `Milena`:** no tiene commits propios.
- **Configuración del servidor PostgreSQL** (`pg_hba.conf`, SSL, logs): requiere superusuario.
- **Documentos Word** (`Documentacion_Learnity.docx`, `Arquitectura_Learnity.docx`): no se leyeron; se usaron los `.md` del repositorio.

---

## Correcciones tras la verificación (19-10-2026)

Detalle y evidencia en `docs/refactor/VERIFICACION_AUDITORIA.md`. El resto de la auditoría se mantiene; la base `Learnity` coincide en las 21 comprobaciones.

| Sección | Dice la auditoría | Corrección |
|---|---|---|
| §4.2 S1 | Sin base aislada | Además, `identidad.test.ts:11-13` solo exige `NODE_ENV=test` (no comprueba `DB_NAME`) y borra las cuentas `@pruebas.test` (`:114-117`). `cursos-publicos.test.ts:5-8` admite `Learnity` con `LEARNITY_PRUEBA_LOCAL=true`. Solo `administracion-contenido`, `cursos-gestion-http` y `solicitudes-docente` exigen `_test` |
| §4.1 (b) y §1.4 | SQL fuera de repositorios: `app.ts`, `seed.ts`, `sembrar-catalogo.ts`, `pool.ts` y las pruebas | Falta `server.ts:36-47`: al arrancar consulta `current_database()`, `current_user` y `to_regclass('public.sesion')`. El SQL de `seed.ts` está en `:66-133` (8 llamadas), no en `:92-133` |
| §5.1 A1 | 10 comparaciones con `'BORRADOR'` | Son 8 (`cursos.service.ts:236,308,408,516,617,718,816,904`) |
| §5.1 A7 | 20 `registrarEvento` | Son 24 llamadas |
| §5.1 A12 | `limite-peticiones.ts:8-11` | El `Map` en memoria está en `:10` |
| §5.2 F3 | Servicios HTTP | Falta `core/auth/auth.service.ts`, que también usa `HttpClient` |
| §5.2 F6 | Guards | Falta `perfilEstudianteGuard` (`guards.ts:30`) |
| §4.2 S9 | `pool.ts:13` | `pool.ts:12` |
| §2.4 | `gestion-cursos.api.ts:24` | `:21` (método) y `:23` (URL) |
| §2.1 | `cursos.controller.ts:11-20` | El esquema termina en `:21` |
| §6 | — | `pg_isready`, `psql` y `pg_dump` no están en el PATH: se usan desde `C:\Program Files\PostgreSQL\17\bin\` |
