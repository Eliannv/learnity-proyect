# Plan de base de datos (Fase 1 del refactor)

> Dueño: `db`. Fuente del estado inicial: `docs/refactor/AUDITORIA_INICIAL.md` (§2.5, §4.2 S1/S2 y §6) y `docs/refactor/VERIFICACION_AUDITORIA.md` (§7, filas BD-*), verificadas el 18/19-10-2026.
> Procedimiento operativo (respaldo, aplicar, revertir y probar): [`database/README.md`](../../database/README.md).

## 1. Reglas que sigue este plan

- Entorno solo local, sin producción. **Ningún DDL ni DML directo sobre `Learnity`.**
- Orden obligatorio: migración probada `up → down → up` en `learnity_test` → **Puerta DB** → `pg_dump -F c` fuera del repositorio → aplicar a `Learnity` solo con aprobación del usuario → cada integrante aplica las mismas migraciones en su base local.
- Todo lo que requiere `postgres` lo ejecuta el usuario (D7). `db` prepara los scripts; no se conecta a ninguna base.
- La app usa `learnity_app` (mínimo privilegio). Nadie usa `postgres` desde la app.
- Ninguna migración cambia rutas, cuerpos JSON, códigos HTTP ni códigos de error.

## 2. Diagnóstico (estado verificado el 18/19-10-2026)

Idéntico en `Learnity` y `learnity_test`:

| Aspecto | Estado | Consecuencia |
|---|---|---|
| Motor | PostgreSQL 17.10 en Windows; herramientas en `C:\Program Files\PostgreSQL\17\bin\` (fuera del PATH) | Los scripts usan la ruta completa |
| Tablas | 22 (19 de `learnity_esquema.sql`, más `sesion` y `token_recuperacion` de la 015 y `archivo_borrado_pendiente` de la 016), **todas de `postgres`** | Cualquier cambio de estructura exige `postgres` |
| Roles | `learnity_app` (sin superusuario, `CREATEROLE`, `CREATEDB` ni `BYPASSRLS`) y `postgres`. La creación de roles **no está en el repositorio** (`seed.ts:67` remite a una guía externa) | Hay que versionar los roles |
| Privilegios de la app | DML completo en 22/22 tablas, `USAGE` en 20 secuencias y sin `CREATE` en `public` | **S2:** la app puede borrar `rol`, `usuario_rol`, `persona`… aunque nunca lo hace |
| Vistas, funciones y triggers | Ninguno | — |
| Auditoría | No existe | No hay rastro de quién cambió qué |
| `actualizado_en` | 0 columnas | No se sabe cuándo cambió una fila |
| Control de migraciones | No existe; scripts numerados manuales | No se sabe qué está aplicado en cada base |
| RLS | Desactivado en todas las tablas | Fuera de alcance |
| Datos inválidos | 3 cursos `PUBLICADO` sin `revisado_por`; 3 lecciones `DOCUMENTO` sin PDF en cursos publicados (semillas `[Prueba Sprint 2]`) | Impiden el `CHECK` de `PUBLICADO` |
| Restricciones que faltan | `PUBLICADO ⇒ revisado_por y publicado_en`; una sola solicitud `PENDIENTE` por persona (hoy solo la garantiza un `FOR UPDATE` en el servicio) | — |
| FK sin índice (13) | `categoria.creada_por`, `curso.id_categoria`, `curso.revisado_por`, `inscripcion.id_ultima_leccion`, `intento_evaluacion.id_evaluacion`, `progreso_leccion.id_leccion`, `recurso_adjunto.id_leccion`, `respuesta.id_opcion`, `respuesta.id_pregunta`, `solicitud_docente.id_persona`, `solicitud_docente.revisada_por`, `usuario_rol.asignado_por` y `usuario_rol.id_rol` | Ver §6, 025 |
| Base de pruebas | `learnity_test` (Fase 0B), única y compartida | Toda prueba de migraciones va allí, con turno del lead |

### 2.1 Hallazgos del código que condicionan el plan

1. **Las pruebas se conectan como `learnity_app` y borran más que la app.** La app solo hace `DELETE` en `modulo`, `leccion`, `archivo`, `archivo_borrado_pendiente`, `sesion` y `token_recuperacion`. Los fixtures de `backend/test/*.test.ts`, en cambio, hacen `DELETE` en `persona`, `usuario`, `usuario_rol`, `curso`, `categoria`, `docente`, `solicitud_docente` e `inscripcion`, `INSERT` en `inscripcion` y `UPDATE` en `archivo` y `categoria`. Ver la decisión D-BD2 (§7).
2. **El `CHECK` de `PUBLICADO` rompe fixtures que crean cursos publicados sin revisor:** `cursos-publicos.test.ts:46`, `cursos-gestion-http.test.ts:285`, `administracion-contenido.test.ts:209` (`escenario('PUBLICADO')`) y `scripts/sembrar-catalogo.ts:42`. El lead lo registró como tarea de la Fase 2A (`be-a` y `be-b`): solo se ajustan los datos de prueba, nunca las aserciones. **La 023 queda retenida hasta entonces.**
3. `seed.ts` inserta en `persona`, `usuario`, `usuario_rol`, `docente`, `categoria` (`ON CONFLICT DO NOTHING`, que solo exige `INSERT`) y `solicitud_docente`.
4. Una violación de `UNIQUE` (23505) se responde como 409 `CONFLICTO` (`manejador-errores.ts:34`).
5. Ningún repositorio usa `SELECT *`, `RETURNING *`, `to_jsonb` ni `INSERT … VALUES` sin lista de columnas: agregar `actualizado_en` no cambia ningún JSON ni ningún `INSERT`.
6. Los roles son del clúster: `Learnity`, `learnity_test` y las demás bases del servidor los comparten.

## 3. Actividad de la web y privilegios que necesita

Matriz de la §6 de la auditoría, con la operación SQL real de cada repositorio. Leyenda: S = `SELECT`, I = `INSERT`, U = `UPDATE`, D = `DELETE`. `FOR UPDATE` exige `UPDATE`. Las cascadas (`ON DELETE CASCADE`/`SET NULL`) y las comprobaciones de FK se ejecutan con los permisos del dueño de la tabla, no con los de la app.

| Acción en la web | Endpoint | Tablas y operación | Qué aportan las migraciones |
|---|---|---|---|
| Registrarse | `POST /api/auth/registro` | persona I, usuario S I, usuario_rol I, rol S, sesion I | Auditoría de persona, usuario y usuario_rol (sin `contrasena_hash`) |
| Iniciar sesión | `POST /api/auth/login` | usuario S U, persona S, usuario_rol S, rol S, sesion I | Auditoría de intentos y bloqueos (una fila por login, ver R4) |
| Renovar o cerrar sesión | `POST /api/auth/refresh`, `/logout` | sesion S U D, usuario S | — (`sesion` no se audita) |
| Recuperar contraseña | `POST /api/auth/recuperar`, `/restablecer` | usuario S U (`FOR UPDATE`), token_recuperacion S I U D, sesion U | Auditoría del cambio de contraseña: queda el nombre de la columna, nunca el hash |
| Editar perfil o contraseña | `PUT /api/perfil`, `/perfil/contrasena` | persona U, usuario U, sesion U | Auditoría y `actualizado_en` |
| Ver catálogo y detalle | `GET /api/categorias`, `/api/cursos`, `/api/cursos/:id` | categoria, curso, docente, persona, modulo, leccion, archivo e inscripcion (todas S) | Vistas `catalogo_*` (D8); índice trigram opcional (D9) |
| Solicitar ser docente | `POST /api/solicitudes-docente` | usuario S U (`FOR UPDATE`), usuario_rol S, rol S, solicitud_docente S I | Índice único parcial de `PENDIENTE`; índices de `id_persona` |
| Admin decide solicitud | `PUT /api/admin/solicitudes/:id` | solicitud_docente S U (`FOR UPDATE`), usuario S, usuario_rol I, docente S I U (upsert), inscripcion S | Auditoría (quién aprobó) e índice `(estado, enviada_en)` |
| Docente crea o edita curso | `POST /api/cursos`, `PUT /api/cursos/:id` | curso S I U, categoria S, docente S, persona S | Auditoría y `actualizado_en` |
| Temario | `POST /cursos/:id/modulos`, `PUT/DELETE /modulos/:id`, lecciones | modulo S I U D, leccion S I U D, archivo S, recurso_adjunto S, archivo_borrado_pendiente I U | Índices para las cascadas (`recurso_adjunto`, `progreso_leccion`, `inscripcion`) |
| Subir PDF | `POST /api/lecciones/:id/archivo` | archivo S I D, leccion S U (`FOR UPDATE`), archivo_borrado_pendiente S I U D | Auditoría de archivo **sin `ruta`** |
| Descargar PDF | `GET /api/archivos/:id` | archivo, leccion, modulo, curso y docente (todas S) | — |
| Enviar a revisión | `POST /api/cursos/:id/enviar-revision` | curso S U (`FOR UPDATE`), modulo S, leccion S, archivo S | Auditoría |
| Admin revisa curso | `GET /api/admin/cursos(/:id)`, `PUT …/revision` | curso S U (`FOR UPDATE`), docente S, persona S, categoria S, temario S | `CHECK` de `PUBLICADO` (023) y auditoría del revisor |
| Arranque del servidor | `server.ts:36-47` | `current_database()`, `current_user`, `to_regclass` | No necesita privilegios sobre tablas |
| Datos de ejemplo | `seed.ts`, `sembrar-catalogo.ts` | persona, usuario, usuario_rol, docente, categoria, solicitud_docente, curso, modulo y leccion (I) | `categoria` conserva `INSERT` por el seed |

## 4. Roles y matriz de privilegios propuesta

| Rol | Tipo | Para qué |
|---|---|---|
| `learnity_owner` | NOLOGIN | Dueño de tablas, vistas y funciones. Las migraciones lo usan con `SET LOCAL ROLE learnity_owner`, ejecutadas por `postgres` |
| `learnity_app` | LOGIN (ya existe; su contraseña nunca va al repositorio) | Backend. DML mínimo por tabla |
| `learnity_lectura` | NOLOGIN | Lectura para inspección y reportes: se concede a un login con `GRANT learnity_lectura TO <login>` |
| `learnity_pruebas` | NOLOGIN | Solo con permisos en bases `_test` (ver D-BD2) |

**`learnity_app`** (migración 019; también es lo que comprueba `verificacion/matriz_privilegios.sql`):

| Tabla | Privilegios | Motivo |
|---|---|---|
| persona, usuario, solicitud_docente, docente, curso | S I U | Registro, perfil, solicitudes, upsert de docente y cursos |
| usuario_rol | S I | Registro y aprobación (`ON CONFLICT DO NOTHING`) |
| categoria | S I | Catálogo y `seed.ts`. El CRUD de categorías (A3, Fase 2B) añadirá `UPDATE` en su propia migración |
| modulo, leccion, sesion, token_recuperacion, archivo_borrado_pendiente | S I U D | Temario, sesiones, recuperación y cola de borrado de PDF |
| archivo | S I D | Subida, reemplazo y retiro de PDF (nunca se actualiza) |
| rol, recurso_adjunto, inscripcion | S | Lecturas (roles, adjuntos del temario, conteos) |
| progreso_leccion, evaluacion, pregunta, opcion, intento_evaluacion, respuesta | — | Módulos congelados del Sprint 3/4: sus repositorios están vacíos. Su migración llegará con su sprint |
| auditoria_cambio, schema_migraciones | — | Solo escribe el trigger (`SECURITY DEFINER`); la app no puede leer ni falsificar la auditoría |
| Vistas `catalogo_*` | S | Catálogo público (D8) |
| Secuencias de identidad | — | **NO VERIFICADO:** una columna `GENERATED ALWAYS AS IDENTITY` no debería necesitar `USAGE` sobre su secuencia. `verificacion/pruebas_funcionales.sql` lo comprueba con un `INSERT` real como `learnity_app`. Si falla, la 019 concede `USAGE` solo en las secuencias de las tablas con `I` |

**`learnity_lectura`**: `SELECT` en todas las tablas salvo `sesion` y `token_recuperacion`. En `usuario` el permiso es por columna, sin `contrasena_hash`; en `archivo`, por columna, sin `ruta`. También tiene `SELECT` en `auditoria_cambio`, `schema_migraciones` y las vistas.

**Base y esquema** (018): `REVOKE CONNECT ON DATABASE <base> FROM PUBLIC` y `GRANT CONNECT` a `learnity_owner`, `learnity_app` y `learnity_lectura`. `learnity_owner` recibe `USAGE, CREATE` en `public`. Ver el riesgo R1.

## 5. Convenciones de las migraciones

- Ubicación: `database/migraciones/0NN_<nombre>.up.sql` y `0NN_<nombre>.down.sql`, desde 017. Los scripts históricos (`learnity_esquema.sql`, 015 y 016) no se tocan; la 017 los registra como línea base.
- SQL puro (sin metacomandos de `psql`), así que funcionan con `psql -f` y en el Query Tool de pgAdmin. Cada archivo va entre `BEGIN … COMMIT` y fija `client_encoding = 'UTF8'` y un `lock_timeout`.
- Cada `up` comprueba que no está aplicado y que sus dependencias reales sí lo están. Al terminar, registra su fila en `schema_migraciones`.
- Cada `down` comprueba que es **la última migración aplicada** (`orden` máximo, no el número de versión) y borra su fila.
- Desde la 019, cada archivo hace `SET LOCAL ROLE learnity_owner` después de las comprobaciones, para que los objetos nuevos sean de `learnity_owner`.
- Lo que un `down` necesita restaurar (dueños, ACL o datos originales) lo guarda el `up` en `schema_migraciones.reversion` (`jsonb`). Así el `down` no depende de suposiciones sobre la base: los dueños originales pueden variar entre integrantes.
- **Migraciones retenidas:** `database/migraciones/RETENIDAS.txt` lista las versiones que `aplicar-migraciones.ps1` no aplica salvo con `-IncluirRetenidas`. Hoy contiene la 023 (ver §2.1, punto 2).

## 6. Migraciones

| Nº | `up` | `down` | Depende de |
|---|---|---|---|
| **017** `control_migraciones` | Tabla `schema_migraciones` (`version` PK, `orden` identity, `nombre`, `aplicada_en`, `aplicada_por` = `session_user`, `checksum` sha256 que rellena el script, `reversion jsonb`). Registra `000_esquema`, `015` y `016` como línea base | `DROP TABLE` | Esquema base, 015 y 016 (los comprueba) |
| **018** `roles_y_duenos` | Crea, si no existen, `learnity_owner`, `learnity_lectura` y `learnity_pruebas` (NOLOGIN). Si `learnity_owner` ya existía con LOGIN, avisa con NOTICE y no lo cambia. Guarda en `reversion` el dueño de cada tabla, qué roles creó y los permisos previos de base y esquema. Pasa a `learnity_owner` las 22 tablas y `schema_migraciones` (las secuencias de identidad siguen a su tabla). Concede `USAGE, CREATE` en `public` y aplica `REVOKE CONNECT … FROM PUBLIC` más los `GRANT CONNECT` | Devuelve cada tabla a su dueño original y restaura los permisos de base y esquema. Intenta `DROP ROLE` solo de los roles que creó; si otra base los usa (`dependent_objects_still_exist`), los conserva y avisa con NOTICE | 017. Requiere superusuario |
| **019** `privilegios_minimos` | Guarda en `reversion` los permisos explícitos de `learnity_app` en tablas y secuencias. `REVOKE ALL` y después aplica la matriz de §4 para `learnity_app` y `learnity_lectura` | `REVOKE ALL` de `learnity_app`, `learnity_lectura` y `learnity_pruebas` en tablas y secuencias, y vuelve a conceder exactamente lo guardado | 018 |
| **020** `auditoria` | Tabla `auditoria_cambio` (`id`, `tabla`, `operacion`, `id_persona_actor` **sin FK**, `usuario_bd`, `cambiado_en`, `id_transaccion`, `columnas_cambiadas`, `antes`, `despues`) con índices `(tabla, cambiado_en)` e `(id_persona_actor)`. Función `auditoria_registrar()`, `SECURITY DEFINER`, con `search_path` fijo y `EXECUTE` revocado a PUBLIC. Triggers `AFTER INSERT OR UPDATE OR DELETE FOR EACH ROW` en 12 tablas (detalle abajo). `SELECT` para `learnity_lectura` | `DROP` de los triggers, la función y la tabla | 019 |
| **021** `actualizado_en` | `actualizado_en timestamptz NOT NULL DEFAULT now()` en `persona`, `usuario`, `docente`, `solicitud_docente`, `categoria`, `curso`, `modulo` y `leccion` (las filas existentes quedan con la hora de la migración). Función `fijar_actualizado_en()` y trigger `BEFORE UPDATE … WHEN (OLD.* IS DISTINCT FROM NEW.*)`. `SELECT (actualizado_en)` en `usuario` para `learnity_lectura` | `DROP` de los triggers, la función y las columnas | 019 |
| **022** `correccion_cursos_publicados` | Guarda en `reversion` el (`id_curso`, `estado`, `revisado_por`, `publicado_en`) de los cursos `PUBLICADO` sin revisor o sin fecha y los corrige con la estrategia de la variable `v_estrategia` (**B** propuesta; **A** alternativa; ver D-BD1). Va después de la 020 para que la corrección quede auditada | Restaura exactamente esos valores desde `reversion` | 020 |
| **023** `check_curso_publicado` (**retenida**) | Comprobación previa (si queda alguna fila inválida, falla con sus `id_curso`). `ADD CONSTRAINT curso_publicado_revisado CHECK (estado <> 'PUBLICADO' OR (revisado_por IS NOT NULL AND publicado_en IS NOT NULL))` | `DROP CONSTRAINT` | 017 y datos válidos |
| **024** `solicitud_pendiente_unica` | Comprobación previa de duplicados. `CREATE UNIQUE INDEX solicitud_docente_pendiente_uq ON solicitud_docente (id_persona) WHERE estado = 'PENDIENTE'` | `DROP INDEX` | 018 |
| **025** `indices_fk` | `solicitud_docente (id_persona, enviada_en DESC)`, `solicitud_docente (estado, enviada_en)`, `recurso_adjunto (id_leccion)`, `progreso_leccion (id_leccion)` e `inscripcion (id_ultima_leccion)` | `DROP INDEX` | 018 |
| **026** `vistas_catalogo` | Vistas `catalogo_categoria`, `catalogo_curso` y `catalogo_temario` (detalle abajo), de `learnity_owner`, con `SELECT` para `learnity_app` y `learnity_lectura` | `DROP VIEW` | 019 |
| propuesta `pg_trgm` (sin número) | `CREATE EXTENSION IF NOT EXISTS pg_trgm` e índices GIN trigram. Solo recibe número si el usuario aprueba el ADR-010 en la Puerta 1 (D9) | `DROP INDEX`; `DROP EXTENSION` solo si la creó esta migración | 018 |

### 6.1 Auditoría (020)

- **Actor:** `current_setting('learnity.id_persona', true)`, convertido a entero solo si cumple `^\d{1,9}$`. Si llega vacío o no es un número, queda NULL y la transacción de la app no falla. El backend debe ejecutar `set_config('learnity.id_persona', $1, true)` dentro de cada transacción que escriba (`REGLAS_EQUIPO.md`, SQL y datos). Lo que pasa por `consultar()` fuera de una transacción queda sin actor.
- **`usuario_bd`:** `session_user` (no `current_user`, que dentro de la función es el dueño).
- **Columnas excluidas siempre:** `contrasena_hash` y `token_hash`. Cada trigger puede excluir más columnas con sus argumentos; `archivo` excluye `ruta`.
- **`columnas_cambiadas`:** nombres de las columnas que cambiaron en un `UPDATE`, incluidas las excluidas (por ejemplo `contrasena_hash`). Así un cambio de contraseña queda registrado, pero nunca su valor.
- **Un `UPDATE` sin cambios reales no se registra.**
- **Tablas auditadas:** `persona`, `usuario`, `rol`, `usuario_rol`, `solicitud_docente`, `docente`, `categoria`, `curso`, `modulo`, `leccion`, `archivo` y `recurso_adjunto`.
- **No auditadas:** `sesion` y `token_recuperacion` (mucho movimiento y guardan hashes), `archivo_borrado_pendiente` (es una cola) y las tablas congeladas del Sprint 3/4. Se pueden añadir con una migración nueva, sin tocar la función.
- `id_persona_actor` no tiene FK para que nunca impida borrar una persona (las pruebas lo hacen).

### 6.2 Índices de FK (025): incluidos y descartados

| FK | Decisión | Motivo |
|---|---|---|
| `solicitud_docente.id_persona` | Índice `(id_persona, enviada_en DESC)` | `existePendiente`, `ultimaSolicitud` y el join de `SELECT_SOLICITUD` |
| — | Índice `(estado, enviada_en)` | `listarSolicitudes` filtra por estado y ordena por fecha |
| `recurso_adjunto.id_leccion` | Índice | `cursos-integracion.repository.ts:336,504` y la cascada al borrar una lección |
| `progreso_leccion.id_leccion`, `inscripcion.id_ultima_leccion` | Índice | Borrar una lección o un módulo (función actual) dispara un `CASCADE` y un `SET NULL` que hoy recorren la tabla completa |
| `categoria.creada_por`, `curso.revisado_por`, `solicitud_docente.revisada_por`, `usuario_rol.asignado_por` | Descartado | Solo se usan para la integridad hacia `persona`, y la app nunca borra personas |
| `curso.id_categoria` | Descartado por ahora | La cubre `curso_catalogo_idx (estado, id_categoria)`. Se revisa con el CRUD de categorías (A3) |
| `usuario_rol.id_rol` | Descartado por ahora | Hoy ninguna consulta busca usuarios por rol; `rol` tiene 3 filas |
| `intento_evaluacion.id_evaluacion`, `respuesta.id_opcion`, `respuesta.id_pregunta` | Descartado por ahora | Sprint 4 (módulo congelado, tablas vacías) |

Se crean con `CREATE INDEX` normal dentro de la transacción: las tablas son pequeñas y el entorno es local. `CONCURRENTLY` no puede ir en una transacción.

### 6.3 Vistas del catálogo (026, D8 y ADR-002)

Acordadas con `arquitecto`. Reproducen exactamente lo que hoy leen `cursos.repository.ts:47-154` y `cursos.service.ts:948-994`.

| Vista | Filas | Columnas |
|---|---|---|
| `catalogo_categoria` | Categorías con `activa = TRUE` | `id`, `nombre` |
| `catalogo_curso` | Cursos con `estado = 'PUBLICADO'` (sin filtrar por `categoria.activa` ni por el estado del docente, igual que hoy) | `id`, `titulo`, `subtitulo`, `descripcion` (`COALESCE(…, '')`), `categoria_id`, `categoria_nombre`, `docente` (`concat_ws(' ', nombres, apellidos)`), `docente_bio`, `nivel`, `portada_url`, `objetivos`, `requisitos`, `publicado_en` (`COALESCE(publicado_en, creado_en)`, el valor que se devuelve), `publicado_en_orden` (crudo, para `recientes … NULLS LAST`), `modulos`, `lecciones`, `segundos` e `inscripciones` (solo para ordenar `populares`) |
| `catalogo_temario` | Módulos de cursos `PUBLICADO`, con `LEFT JOIN` a lección y archivo | `curso_id`, `modulo_id`, `modulo_orden`, `modulo_titulo`, `leccion_id`, `leccion_orden`, `leccion_titulo`, `leccion_tipo` y `segundos` (`archivo.duracion_seg`) |

- **Nunca se exponen** `archivo.ruta`, `id_archivo`, `nombre_original` ni ninguna otra columna de `archivo` salvo `duracion_seg`. Tampoco correos, `contrasena_hash`, `token_hash`, `vista_previa` ni columnas que hoy no se devuelven.
- Filtros (`q`, categorías y niveles), orden (lista cerrada) y paginación quedan en el repositorio de `modules/catalogo` (`be-a`).
- Las vistas son de `learnity_owner` y no son `security_invoker`: quien tiene `SELECT` sobre la vista no necesita permisos sobre las tablas base.
- No uso `security_barrier`: ni la app ni `learnity_lectura` pueden crear funciones, y con esa opción PostgreSQL no podría aplicar los filtros del repositorio hasta después de resolver la vista.
- **Equivalencia:** `database/verificacion/comparar_catalogo.sql` inserta datos de prueba dentro de una transacción que se deshace al final. Ejecuta las consultas actuales del repositorio y las de las vistas, y exige 0 filas en `(A EXCEPT B) UNION ALL (B EXCEPT A)` para categorías, listado, detalle y temario. También compara el orden de ids de `recientes`, `populares` y `az`.
- **Nota para el ADR-010 (`pg_trgm`):** a través de la vista, `descripcion` es `COALESCE(c.descripcion, '')`, así que un índice sobre `c.descripcion` no serviría para el `ILIKE`. La propuesta indexa la expresión `COALESCE(descripcion, '')`.

## 7. Decisiones para la Puerta 1

### D-BD1. Los 3 cursos `PUBLICADO` sin revisor (022 y 023)

| Opción | Qué hace | Consecuencias |
|---|---|---|
| **B (propuesta)** | `revisado_por` = el ADMIN activo con el menor `id_persona`; `publicado_en = COALESCE(publicado_en, creado_en)`. Si la base no tiene ningún ADMIN activo, ese curso pasa a A y se avisa con NOTICE | El catálogo no cambia: es lo coherente con "refactorizar no cambia funcionalidades". El revisor es un dato asignado por la migración, no una revisión real; queda marcado así en `auditoria_cambio` (`usuario_bd = postgres`, sin actor). Permite aplicar la 023 |
| **A (alternativa)** | `estado = 'EN_REVISION'`, sin tocar otras columnas | Más honesto, pero los 3 cursos **desaparecen del catálogo** y **no se pueden reaprobar** desde la UI: tienen 3 lecciones `DOCUMENTO` sin PDF y la revisión las rechaza. Si eran los únicos publicados, el catálogo queda vacío. Permite aplicar la 023 |
| **C (no hacer nada)** | No se aplican ni la 022 ni la 023 (`aplicar-migraciones.ps1 -Omitir 022,023`) | El catálogo no cambia, pero la base sigue aceptando cursos `PUBLICADO` sin revisor ni fecha: la regla depende solo del servicio. Quedan los 3 cursos inconsistentes y no se puede cerrar la Puerta DB con el `CHECK`. El resto de migraciones no depende de ellas |

Pasar de B a A solo exige cambiar `v_estrategia := 'B'` por `'A'` en `022_correccion_cursos_publicados.up.sql`. El `down` restaura cualquiera de las dos.

### D-BD2. Permisos de limpieza de los fixtures

| Opción | Qué hace | Ventajas | Inconvenientes |
|---|---|---|---|
| **019b (propuesta)** | `database/pruebas/privilegios_pruebas.sql` aborta si la base no termina en `_test`. Concede a `learnity_pruebas` los permisos de limpieza (§2.1, punto 1) y ejecuta `GRANT learnity_pruebas TO learnity_app`. En `Learnity`, `learnity_pruebas` no tiene ningún permiso, así que la pertenencia no aporta nada | No hay que tocar código de prueba ni `.env.test` | En `learnity_test` el código de la app corre con más permisos que en `Learnity`, así que un error de permisos de la app no saldría en la suite. Mitigación: `verificacion/matriz_privilegios.sql`, que lee los permisos propios de `learnity_app` (`relacl`, sin herencia) y los compara con §4. Podría convertirse en una prueba de `backend/test/seguridad/` |
| **Conexión de fixtures** | Los fixtures usan un segundo pool con otro login (`learnity_pruebas` con LOGIN y contraseña, solo en `learnity_test`), y la app sigue con `learnity_app` | La suite ejerce los permisos reales de la app | Hay que cambiar las 7 suites y `backend/test/ayudas/` (`qa-edge` y `be-*`), añadir variables a `.env.test` y que cada integrante cree el login con contraseña |

**Opinión de `qa-edge`:** *pendiente* (pedida el 19-10-2026; se recoge aquí cuando responda).

### D-BD3. `pg_trgm` (D9, ADR-010 del `arquitecto`)

La búsqueda `ILIKE '%q%'` recorre la tabla completa. La propuesta `database/migraciones/propuestas/pg_trgm.{up,down}.sql` crea la extensión (es *trusted* desde PG13, pero la crea `postgres`) e índices GIN trigram sobre `curso.titulo`, `curso.subtitulo` y `COALESCE(curso.descripcion, '')`. No se aplica ni recibe número sin el ADR aprobado.

## 8. Reversibilidad: cómo se comprueba que el `down` deja el esquema idéntico

`database/verificacion/huella_esquema.sql` solo lee `pg_catalog`, así que lo puede ejecutar cualquier rol. Devuelve un md5 por categoría y uno global:

- tablas y columnas (tipo, NOT NULL, default, identidad, RLS y opciones);
- `pg_get_constraintdef`, `pg_get_indexdef`, `pg_get_viewdef` y `pg_get_triggerdef`;
- funciones (`pg_get_functiondef`);
- el dueño de cada relación, función y del esquema;
- ACL de relaciones, columnas, esquema y base. Se normalizan con `acldefault()`, porque un ACL NULL y su equivalente explícito dan el mismo acceso;
- los roles `learnity_*` y sus pertenencias;
- las extensiones;
- un md5 de (`id_curso`, `estado`, `revisado_por`, `publicado_en`) de `curso`, que es el dato que toca la 022.

`database/scripts/probar-migraciones.ps1` ejecuta el ciclo e imprime un resumen para pegar:

1. **H0**: huella inicial.
2. `up` de todas, incluidas las retenidas → **H1**.
3. `down` de todas, en orden inverso → **H2**. Se exige **H2 = H0**.
4. `up` de todas → **H3**. Se exige **H3 = H1**.
5. Estado final para la suite: `down` hasta la 022 y `up` de 024–026 (la 023 queda retenida) → **H4**.
6. Matriz de privilegios, pruebas funcionales y comparación del catálogo.

Lo que un `down` no devuelve, por definición: las filas de `auditoria_cambio` y los valores de `actualizado_en` desaparecen con su tabla o columna. Los roles del clúster se conservan si otra base los usa (lo avisa con NOTICE). Si el `down` de la 018 sí puede borrarlos, H2 = H0 también en la categoría `roles`.

## 9. Riesgos para la Puerta DB

| # | Riesgo | Mitigación |
|---|---|---|
| R1 | `REVOKE CONNECT … FROM PUBLIC` (018): cualquier login que hoy entre a la base sin un `GRANT` explícito deja de poder conectarse. Los superusuarios no se ven afectados. **NO VERIFICADO** en las bases de cada integrante | Antes de aplicar, cada integrante ejecuta la consulta de abajo en su base. Cada login que aparezca necesita `GRANT CONNECT` o pertenecer a `learnity_lectura` |
| R2 | El mínimo privilegio rompe la limpieza de la suite | 019b (D-BD2), aplicada en `learnity_test` antes de `npm test` |
| R3 | El `CHECK` de `PUBLICADO` rompe 3 suites y `sembrar-catalogo.ts` | 023 retenida hasta la Fase 2A (§2.1, punto 2) |
| R4 | La auditoría añade filas: una por login y una por intento fallido (`UPDATE usuario`), además de muchas por las cascadas de limpieza en `learnity_test` | Volumen pequeño. Si molesta, una migración futura puede ignorar `ultimo_acceso`, `intentos_fallidos` y `bloqueado_hasta` mediante los argumentos del trigger |
| R5 | El actor queda NULL hasta que el backend use `set_config('learnity.id_persona', $1, true)` | Documentado para el `arquitecto` (`CONTRATOS_SERVICIO.md`) y para `be-a`/`be-b` |
| R6 | En una carrera, el índice único parcial (024) devuelve 409 `CONFLICTO` genérico en vez del error de negocio. En el caso normal no cambia nada, porque el `FOR UPDATE` del servicio ya serializa | Documentado; `qa-edge` lo anota en `RIESGOS.md` |
| R7 | Los roles son del clúster: un `down` en `learnity_test` no puede borrarlos si `Learnity` ya está migrada | El `down` captura el error, los conserva y avisa |
| R8 | Si `learnity_owner` ya existe con LOGIN en el clúster de un integrante (el antiguo `database/README.md` lo mencionaba), la 018 no lo cambia | NOTICE con la orden `ALTER ROLE learnity_owner NOLOGIN` para que la ejecute el usuario |
| R9 | Que la identidad no necesite `USAGE` sobre la secuencia está **NO VERIFICADO** | `pruebas_funcionales.sql` hace un `INSERT` real como `learnity_app` |
| R10 | Rutas con caracteres no ASCII (`Programación`) en `psql -f` | Los scripts hacen `Push-Location` a la carpeta y pasan nombres relativos en ASCII |

**Consulta previa para R1** (como `postgres`, conectado a la base que se va a migrar; solo lee):

```sql
WITH conceden AS (
  SELECT a.grantee
    FROM pg_database d,
         aclexplode(COALESCE(d.datacl, acldefault('d', d.datdba))) a
   WHERE d.datname = current_database()
     AND a.privilege_type = 'CONNECT'
     AND a.grantee <> 0                       -- 0 = PUBLIC
)
SELECT r.rolname AS login_que_hoy_depende_de_public
  FROM pg_roles r
 WHERE r.rolcanlogin
   AND NOT r.rolsuper
   AND r.rolname NOT IN ('learnity_app')     -- recibe CONNECT explícito en la 018
   AND NOT EXISTS (SELECT 1 FROM conceden c WHERE pg_has_role(r.oid, c.grantee, 'MEMBER'))
 ORDER BY 1;
```

## 10. Procedimiento (resumen)

El detalle, con los comandos exactos de PowerShell y `psql`, está en [`database/README.md`](../../database/README.md).

1. **Prueba en `learnity_test`** (turno del lead): `probar-migraciones.ps1 -Base learnity_test`. Si se usa 019b, después `privilegios_pruebas.sql`. Luego el lead ejecuta `npm test`.
2. **Puerta DB:** el usuario revisa H0–H4, la matriz y la suite.
3. **Respaldo de `Learnity`:** `pg_dump -F c` y `pg_dumpall --roles-only`, fuera del repositorio. El de roles contiene hashes de contraseñas.
4. **Aplicar a `Learnity`** con aprobación del usuario: `aplicar-migraciones.ps1 -Base Learnity`.
5. **Cada integrante**, en su base local: la consulta de R1, su propio respaldo y `aplicar-migraciones.ps1 -Base <su base>`.

## 11. Pendiente y NO VERIFICADO

- Todo el SQL está **NO VERIFICADO** hasta el turno de pruebas en `learnity_test`.
- Opinión de `qa-edge` sobre D-BD2.
- Decisiones D-BD1, D-BD2 y D-BD3 (Puerta 1).
- Las 3 lecciones `DOCUMENTO` sin PDF de cursos publicados: no hay `CHECK` posible (es una regla entre tablas). Quedan en el servicio, como hoy.
