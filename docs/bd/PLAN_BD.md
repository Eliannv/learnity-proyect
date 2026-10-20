# Plan de base de datos (Fase 1 del refactor)

> Dueño: `db`. Fuente del estado inicial: `docs/refactor/AUDITORIA_INICIAL.md` (§2.5, §4.2 S1/S2 y §6) y `docs/refactor/VERIFICACION_AUDITORIA.md` (§7, filas BD-*), verificadas el 18/19-10-2026.
> Procedimiento operativo (reconstruir, respaldo, aplicar, revertir y probar): [`database/README.md`](../../database/README.md).

## 1. Reglas que sigue este plan

- Entorno solo local, sin producción. **Ningún DDL ni DML directo sobre `Learnity`.**
- Orden obligatorio: migración probada `up → down → up` en `learnity_test` → **Puerta DB** → `pg_dump -F c` fuera del repositorio → aplicar a `Learnity` solo con aprobación del usuario → cada integrante aplica las mismas migraciones en su base local.
- Todo lo que requiere `postgres` lo ejecuta el usuario (D7). `db` prepara los scripts; no se conecta a ninguna base.
- La app usa `learnity_app` (mínimo privilegio). Nadie usa `postgres` desde la app.
- Ninguna migración cambia rutas, cuerpos JSON, códigos HTTP ni códigos de error.
- **Decisión del usuario (20-10-2026):** los datos de `Learnity` y `learnity_test` son desechables. Se autoriza **reconstruir `learnity_test`** con un procedimiento reproducible (§12). `Learnity` no se borra ni se reconstruye sin una aprobación explícita y única del usuario, una vez probado el procedimiento en `learnity_test`.

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
| Datos inválidos | 3 cursos `PUBLICADO` sin `revisado_por`; 3 lecciones `DOCUMENTO` sin PDF en cursos publicados (semillas `[Prueba Sprint 2]`) | Impiden **validar** el `CHECK` de `PUBLICADO`: la 023 lo añade `NOT VALID` y no se les inventa revisor ni fecha (D-BD1, decisión BD-022) |
| Restricciones que faltan | `PUBLICADO ⇒ revisado_por y publicado_en`; una sola solicitud `PENDIENTE` por persona (hoy solo la garantiza un `FOR UPDATE` en el servicio) | — |
| FK sin índice (13) | `categoria.creada_por`, `curso.id_categoria`, `curso.revisado_por`, `inscripcion.id_ultima_leccion`, `intento_evaluacion.id_evaluacion`, `progreso_leccion.id_leccion`, `recurso_adjunto.id_leccion`, `respuesta.id_opcion`, `respuesta.id_pregunta`, `solicitud_docente.id_persona`, `solicitud_docente.revisada_por`, `usuario_rol.asignado_por` y `usuario_rol.id_rol` | Ver §6, 025 |
| Base de pruebas | `learnity_test` (Fase 0B), única y compartida | Toda prueba de migraciones va allí, con turno del lead |

### 2.1 Hallazgos del código que condicionan el plan

1. **Las pruebas se conectan como `learnity_app` y borran más que la app.** La app solo hace `DELETE` en `modulo`, `leccion`, `archivo`, `archivo_borrado_pendiente`, `sesion` y `token_recuperacion`. Los fixtures de `backend/test/*.test.ts`, en cambio, hacen `DELETE` en `persona`, `usuario`, `usuario_rol`, `curso`, `categoria`, `docente`, `solicitud_docente` e `inscripcion`, `INSERT` en `inscripcion` y `UPDATE` en `archivo` y `categoria`. Ver la decisión D-BD2 (§7).
2. **El `CHECK` de `PUBLICADO` rompe fixtures que crean cursos publicados sin revisor:** `cursos-publicos.test.ts:46`, `cursos-gestion-http.test.ts:285`, `administracion-contenido.test.ts:209` (`escenario('PUBLICADO')`) y `scripts/sembrar-catalogo.ts:42`. Aunque sea `NOT VALID`, el `CHECK` rechaza esos `INSERT` nuevos. El lead lo registró como tarea de la Fase 2A (`be-a` y `be-b`): solo se ajustan los datos de prueba, nunca las aserciones. **La 023 queda retenida hasta entonces.**
   **Revisado el 20-10-2026:** esos cuatro ya ponen revisor y fecha, igual que `caracterizacion/cursos.test.ts`, `caracterizacion/contenido.test.ts` y `semillas.repository.ts`. Queda uno: `caracterizacion/catalogo.test.ts:91` crea `c4` "Delta heredado" como `PUBLICADO` sin `publicado_en` para `CAR-CAT-15`, y con la 023 ese `INSERT` da 23514. **La 023 sigue retenida** hasta que `qa-edge` retire o adapte `CAR-CAT-15` (RG-58).
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
| `learnity_pruebas` | NOLOGIN | Rol de los fixtures. Solo tiene permisos en bases `_test`; `learnity_app` es miembro sin herencia (ver D-BD2) |

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

**`learnity_lectura`**: `SELECT` en todas las tablas salvo `sesion` y `token_recuperacion`. En `usuario` el permiso es por columna, sin `contrasena_hash`; en `archivo`, por columna, sin `ruta`. También tiene `SELECT` en `auditoria_cambio`, `schema_migraciones`, las vistas del catálogo y `curso_publicado_sin_revision` (022). Esta última es **solo** suya: `learnity_app` no la lee.

**Base y esquema** (018): `REVOKE CONNECT ON DATABASE <base> FROM PUBLIC` y `GRANT CONNECT` a `learnity_owner`, `learnity_app` y `learnity_lectura`. `learnity_owner` recibe `USAGE, CREATE` en `public`. Ver el riesgo R1.

## 5. Convenciones de las migraciones

- Ubicación: `database/migraciones/0NN_<nombre>.up.sql` y `0NN_<nombre>.down.sql`, desde 017. Los scripts históricos (`learnity_esquema.sql`, 015 y 016) no se tocan; la 017 los registra como línea base.
- SQL puro (sin metacomandos de `psql`), así que funcionan con `psql -f` y en el Query Tool de pgAdmin. Cada archivo va entre `BEGIN … COMMIT` y fija `client_encoding = 'UTF8'` y un `lock_timeout`.
- Cada `up` comprueba que no está aplicado y que sus dependencias reales sí lo están. Al terminar, registra su fila en `schema_migraciones`.
- Cada `down` comprueba que es **la última migración aplicada** (`orden` máximo, no el número de versión) y borra su fila.
- Desde la 019, cada archivo hace `SET LOCAL ROLE learnity_owner` después de las comprobaciones, para que los objetos nuevos sean de `learnity_owner`.
- Lo que un `down` necesita restaurar (dueños, ACL o datos originales) lo guarda el `up` en `schema_migraciones.reversion` (`jsonb`). Así el `down` no depende de suposiciones sobre la base: los dueños originales pueden variar entre integrantes.
- **Migraciones retenidas:** `database/migraciones/RETENIDAS.txt` lista las versiones que `aplicar-migraciones.ps1` y `reconstruir-base.ps1` no aplican salvo con `-IncluirRetenidas`. Hoy contiene la 023 (ver §2.1, punto 2).
- **Una base nueva** no tiene un esquema propio: `reconstruir-base.ps1` ejecuta la línea base (`learnity_esquema.sql`, 015, 016 y `linea_base_permisos.sql`) y después las mismas migraciones, en el mismo orden y registradas con su checksum (§12).

## 6. Migraciones

| Nº | `up` | `down` | Depende de |
|---|---|---|---|
| **017** `control_migraciones` | Tabla `schema_migraciones` (`version` PK, `orden` identity, `nombre`, `aplicada_en`, `aplicada_por` = `session_user`, `checksum` sha256 que rellena el script, `reversion jsonb`). Registra `000_esquema`, `015` y `016` como línea base | `DROP TABLE` | Esquema base, 015 y 016 (los comprueba) |
| **018** `roles_y_duenos` | Crea, si no existen, `learnity_owner`, `learnity_lectura` y `learnity_pruebas` (NOLOGIN). Si `learnity_owner` ya existía con LOGIN, avisa con NOTICE y no lo cambia. Guarda en `reversion` el dueño de cada tabla, qué roles creó y los permisos previos de base y esquema. Pasa a `learnity_owner` las 22 tablas y `schema_migraciones` (las secuencias de identidad siguen a su tabla). Concede `USAGE, CREATE` en `public` y aplica `REVOKE CONNECT … FROM PUBLIC` más los `GRANT CONNECT` | Devuelve cada tabla a su dueño original y restaura los permisos de base y esquema. Intenta `DROP ROLE` solo de los roles que creó; si otra base los usa (`dependent_objects_still_exist`), los conserva y avisa con NOTICE | 017. Requiere superusuario |
| **019** `privilegios_minimos` | Guarda en `reversion` los permisos explícitos de `learnity_app` en tablas y secuencias. `REVOKE ALL` y después aplica la matriz de §4 para `learnity_app` y `learnity_lectura` | `REVOKE ALL` de `learnity_app`, `learnity_lectura` y `learnity_pruebas` en tablas y secuencias, y vuelve a conceder exactamente lo guardado | 018 |
| **020** `auditoria` | Tabla `auditoria_cambio` (`id`, `tabla`, `operacion`, `id_persona_actor` **sin FK**, `usuario_bd`, `cambiado_en`, `id_transaccion`, `columnas_cambiadas`, `antes`, `despues`) con índices `(tabla, cambiado_en)` e `(id_persona_actor)`. Función `auditoria_registrar()`, `SECURITY DEFINER`, con `search_path` fijo y `EXECUTE` revocado a PUBLIC. Triggers `AFTER INSERT OR UPDATE OR DELETE FOR EACH ROW` en 12 tablas (detalle abajo). `SELECT` para `learnity_lectura` | `DROP` de los triggers, la función y la tabla | 019 |
| **021** `actualizado_en` | `actualizado_en timestamptz NOT NULL DEFAULT now()` en `persona`, `usuario`, `docente`, `solicitud_docente`, `categoria`, `curso`, `modulo` y `leccion` (las filas existentes quedan con la hora de la migración). Función `fijar_actualizado_en()` y trigger `BEFORE UPDATE … WHEN (OLD.* IS DISTINCT FROM NEW.*)`. `SELECT (actualizado_en)` en `usuario` para `learnity_lectura` | `DROP` de los triggers, la función y las columnas | 019 |
| **022** `inventario_cursos_publicados` | **No cambia ninguna fila.** Vista `curso_publicado_sin_revision` (`id_curso`, `titulo`, `id_docente`, `revisado_por`, `publicado_en`, `creado_en`) con los cursos `PUBLICADO` sin revisor o sin fecha, de `learnity_owner`, con `COMMENT` y `SELECT` solo para `learnity_lectura`. Un NOTICE lista sus `id_curso` al aplicarse (D-BD1) | `DROP VIEW` | 019 |
| **023** `check_curso_publicado` (**retenida**) | `ADD CONSTRAINT curso_publicado_revisado CHECK (estado <> 'PUBLICADO' OR (revisado_por IS NOT NULL AND publicado_en IS NOT NULL)) NOT VALID` y `COMMENT ON CONSTRAINT` que explica la excepción. Sin comprobación previa: no rechaza ni reescribe las filas heredadas. Un NOTICE lista las que quedan sin validar (D-BD1) | `DROP CONSTRAINT` | 022 |
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

### D-BD1. Los 3 cursos `PUBLICADO` sin revisor (022 y 023): **decidida (BD-022, 19-10-2026)**

**Decisión** (del lead, siguiendo la indicación del usuario de no inventar un revisor ni una fecha de revisión; ver `docs/refactor/ESTADO.md`, BD-022):

- **La 022 no corrige datos.** Crea la vista `curso_publicado_sin_revision`, que deja a la vista los cursos que incumplen la regla. Nunca cambia `curso`; su `down` es un `DROP VIEW`.
- **La 023 añade el `CHECK` como `NOT VALID`.** PostgreSQL lo exige en todo `INSERT` o `UPDATE` nuevo, pero no revisa ni reescribe las filas que ya existen.
- **Efecto sobre el catálogo: ninguno.** Los 3 cursos siguen `PUBLICADO` y siguen en `catalogo_curso`.

**Mecanismo elegido para la excepción: una vista, en vez de una tabla o un `COMMENT` con los IDs.**

| Mecanismo | Por qué no / por qué sí |
|---|---|
| `COMMENT` con los IDs | Es texto libre: no se puede consultar con SQL normal ni cruzar con `curso`. Cualquier `COMMENT ON` posterior lo sobrescribe sin dejar rastro. Además, la lista se queda vieja si un curso se corrige o se borra |
| Tabla con los IDs | Copia datos de `curso` que pueden divergir: si un curso se corrige, la tabla sigue diciendo que es una excepción. Habría que decidir una FK (que bloquearía borrar el curso, o lo borraría en cascada) y alguien tendría que mantenerla. Además, la 022 tendría que escribir datos |
| **Vista (elegida)** | No copia nada ni escribe nada: lee `curso` en vivo con el mismo predicado del `CHECK`. Lista **exactamente** las filas por las que `VALIDATE CONSTRAINT` fallaría, así que no puede quedar desactualizada. Con la 023 aplicada no puede entrar ninguna fila nueva, así que solo muestra las heredadas, y una que se corrija sale sola. Es de `learnity_owner`, con `SELECT` solo para `learnity_lectura`, como pedía el lead para la tabla. Su `COMMENT` explica la excepción. Quién y cuándo la creó queda en `schema_migraciones`, y los IDs del momento, en el NOTICE de la 022 y de la 023 |

**Por qué el `CHECK NOT VALID` no cambia el comportamiento de la app.** Un `CHECK NOT VALID` se evalúa en cada fila nueva o modificada, aunque el `UPDATE` no toque `estado`, `revisado_por` ni `publicado_en`. Comprobé que la app nunca actualiza un curso `PUBLICADO`, porque sus tres `UPDATE curso` lo impiden:

| Ruta | Guarda |
|---|---|
| `cursos-integracion.repository.ts:184` (`actualizarCurso`, datos del curso) | `cursos.service.ts:212-243` lee el curso con `FOR UPDATE OF c` (`base(cliente, id, true)`, `cursos-integracion.repository.ts:623`) y responde 409 `CURSO_BLOQUEADO` si el estado no es `BORRADOR` ni `RECHAZADO` |
| `cursos-integracion.repository.ts:537` (enviar a revisión) | `WHERE … AND estado IN ('BORRADOR', 'RECHAZADO')` |
| `cursos-integracion.repository.ts:747` (revisión del admin) | `WHERE … AND estado = 'EN_REVISION'`; si publica, fija `revisado_por = $4` y `publicado_en = now()` |

Además, la FK `curso.revisado_por → persona` es `NO ACTION` (no hay `SET NULL` que reescriba la fila) y ningún otro archivo del repositorio, fuera de `backend/test/`, hace `UPDATE curso` (`git grep`). Los únicos otros `UPDATE curso` están en `backend/test/` (`administracion-contenido.test.ts` y `cursos-gestion-http.test.ts`) y los ajusta la Fase 2A junto con los fixtures.

**Efectos documentados** (los prueba `verificacion/pruebas_heredadas.sql`):

- Un `UPDATE` de una fila heredada que la deje inválida se **rechaza** con 23514, aunque cambie otra columna (por ejemplo `subtitulo`). Un `UPDATE` que la corrige (pone revisor y fecha) se acepta.
- `ALTER TABLE curso VALIDATE CONSTRAINT curso_publicado_revisado` **falla mientras `curso_publicado_sin_revision` tenga filas**. No se valida en ninguna migración. Si algún día las filas se corrigen o se retiran con una decisión del usuario, una migración nueva podrá validarlo.
- `pg_dump` guarda un `CHECK NOT VALID` aparte y lo crea después de cargar los datos, así que el respaldo se restaura con las filas heredadas. **NO VERIFICADO** en este entorno.

Opciones descartadas: **B** (asignar como revisor al ADMIN activo con el menor `id_persona`) inventaba un revisor. **A** (`EN_REVISION`) sacaba los cursos del catálogo, y además no se podían reaprobar porque tienen lecciones `DOCUMENTO` sin PDF. **C** (no aplicar la 022 ni la 023) dejaba la regla solo en el servicio.

### D-BD2. Permisos de limpieza de los fixtures

| Opción | Qué hace | Ventajas | Inconvenientes |
|---|---|---|---|
| **3. Pertenencia sin herencia (propuesta, de `qa-edge`)** | `database/pruebas/privilegios_pruebas.sql` (019b) aborta si la base no termina en `_test`. Da a `learnity_pruebas` (NOLOGIN) DML completo sobre las tablas del dominio y `SELECT` sobre auditoría, `schema_migraciones` y vistas. Ejecuta `GRANT learnity_pruebas TO learnity_app WITH INHERIT FALSE, SET TRUE`. Los fixtures usan un pool aparte en `backend/test/ayudas/` (`qa-edge`), con las mismas credenciales de `.env.test`, que hace `SET ROLE learnity_pruebas` al conectarse | Las conexiones de la app siguen con el mínimo privilegio real: la suite detecta un 42501 (que hoy acaba en 500) antes de llegar a `Learnity`. No hay login nuevo, ni contraseña, ni variables nuevas. En `Learnity`, `learnity_pruebas` no tiene ningún permiso | Requiere PostgreSQL 16 o superior. Cada suite cambia el `pool` de sus fixtures por el de `ayudas/`: una línea de import, que cambian sus dueños (`be-a` y `be-b`) junto con `guardia-bd.ts` |
| 1. Pertenencia con herencia | Igual que la 3, pero con `GRANT learnity_pruebas TO learnity_app` (con herencia) | No hay que tocar código de prueba | En `learnity_test` la app corre con más permisos que en `Learnity`, así que un fallo de permisos solo aparecería en `Learnity`. La matriz estática no detecta, por ejemplo, un `UPDATE` nuevo añadido en un refactor |
| 2. Login de fixtures | Los fixtures usan un segundo login (`learnity_pruebas` con LOGIN y contraseña, solo en `learnity_test`) | La suite ejerce los permisos reales de la app | Hay que crear el login con contraseña en cada máquina, añadir variables a `.env.test` y cambiar las 7 suites |

**Opinión de `qa-edge` (19-10-2026):** prefiere la **3**; si no es viable, la 2 antes que la 1. El motivo es que la caracterización debe detectar justo lo que puede romper la 019: una ruta que use un permiso retirado da 42501, que `manejador-errores.ts` no mapea y acaba en 500. Además:
- `qa-edge` convertirá la matriz en `backend/test/seguridad/privilegios.test.ts`. La fuente única de la matriz esperada es `database/verificacion/matriz_privilegios.sql`. Solo lee el catálogo, así que `learnity_app` lo puede ejecutar y la prueba exige que todas sus filas den OK; no hay que mantener una copia en JSON.
- La matriz comprueba también que `learnity_app` no tiene `CREATE` en `public`, que no es dueño de ninguna relación y que su pertenencia a `learnity_pruebas` tiene `inherit=false, set=true`.
- Nadie puede borrar filas de `auditoria_cambio`, así que en `learnity_test` se acumulan. Ninguna suite debe contar filas globales de auditoría: se filtra por una marca o por un rango de ids.
- `pg_terminate_backend` (SEG-30) se ejecutará desde una conexión sin `SET ROLE`. **NO VERIFICADO.**

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
- un md5 de (`id_curso`, `estado`, `revisado_por`, `publicado_en`) de `curso`. Ninguna migración debe cambiarlo: ni la 022 ni la 023 tocan `curso` (D-BD1).

`database/scripts/probar-migraciones.ps1` ejecuta el ciclo e imprime un resumen para pegar:

1. **H0**: huella inicial.
2. `up` de todas, incluidas las retenidas → **H1**. Justo antes de la 022 se ejecuta `verificacion/pruebas_heredadas.sql` (D-BD1): simula cursos `PUBLICADO` sin revisor o sin fecha, aplica dentro de la misma transacción el cuerpo real de 022, 024–026 y, al final, la 023 (el orden en que llegarían a `Learnity`), comprueba los efectos y lo deshace todo con `ROLLBACK`. Después se exige que la huella siga igual a la previa a la 022.
3. `down` de todas, en orden inverso → **H2**. Se exige **H2 = H0**.
4. `up` de todas → **H3**. Se exige **H3 = H1**. Se ejecutan las pruebas funcionales con todas aplicadas, incluida la 023: es el único punto en que las pruebas de la 023 dan OK en vez de NO APLICA.
5. Estado migrado sin las retenidas: `down` hasta la 022 y `up` de 024–026 (la 023 queda retenida) → **H4**.
6. Resultados de las filas heredadas y de las pruebas funcionales en H3; después, sobre H4, matriz de privilegios, pruebas funcionales y comparación del catálogo.
7. 019b: se aplica y se repiten la matriz y las pruebas funcionales.
8. Estado final: por defecto, la línea base (se quita la 019b, se revierte todo y se exige que la huella final sea igual a H0), para que la suite actual siga en verde hasta que los fixtures usen el pool de `learnity_pruebas` (R2). Con `-EstadoFinal Migrada` queda H4 con la 019b.

Lo que un `down` no devuelve, por definición: las filas de `auditoria_cambio` y los valores de `actualizado_en` desaparecen con su tabla o columna. Los roles del clúster se conservan si otra base los usa (lo avisa con NOTICE). Si el `down` de la 018 sí puede borrarlos, H2 = H0 también en la categoría `roles`.

**Huellas de referencia.** Las de la ejecución que probó las migraciones actuales (lead, 19-10-2026 10:04, `b9e7ba3`) están en `database/verificacion/referencias/`: línea base H0 `705|f15432412a68…`, migrada sin la 023 H4 `836|5caf4cbd1442…` y con la 023 H1 `837|4065121d5890…`. `reconstruir-base.ps1` compara con ellas la base que construye (§12).

## 9. Riesgos para la Puerta DB

| # | Riesgo | Mitigación |
|---|---|---|
| R1 | `REVOKE CONNECT … FROM PUBLIC` (018): cualquier login que hoy entre a la base sin un `GRANT` explícito deja de poder conectarse. Los superusuarios no se ven afectados. **NO VERIFICADO** en las bases de cada integrante | Antes de aplicar, cada integrante ejecuta la consulta de abajo en su base. Cada login que aparezca necesita `GRANT CONNECT` o pertenecer a `learnity_lectura` |
| R2 | El mínimo privilegio rompe la limpieza de la suite. Además, una ruta que use un permiso retirado da 42501 y acaba en 500 | 019b sin herencia y pool de fixtures con `SET ROLE learnity_pruebas` (D-BD2, opción 3). Mientras los fixtures no usen ese pool, `npm test` falla en la limpieza: la 019 no debe quedar aplicada en `learnity_test` para la suite hasta entonces |
| R3 | El `CHECK` de `PUBLICADO`, aunque sea `NOT VALID`, rompe 3 suites y `sembrar-catalogo.ts` | 023 retenida hasta la Fase 2A (§2.1, punto 2) |
| R11 | Con la 023, cualquier `UPDATE` de uno de los cursos heredados se rechaza (23514) salvo que lo corrija, y `VALIDATE CONSTRAINT` falla mientras existan (D-BD1) | La app nunca actualiza un curso `PUBLICADO` (§7, D-BD1). La vista `curso_publicado_sin_revision` los lista. Corregirlos o retirarlos es una decisión del usuario, con su propia migración |
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

1. **Prueba del ciclo en `learnity_test`** (hecha el 19-10-2026): `probar-migraciones.ps1 -Base learnity_test`, todo IGUAL. Para repetirla sobre una base reconstruida: `reconstruir-base.ps1 -SoloLineaBase` y después `probar-migraciones.ps1`.
2. **Reconstruir `learnity_test`** (turno del lead, autorizado el 20-10-2026): `reconstruir-base.ps1 -Base learnity_test` (§12). Después, la guarda de `.env.test` y `npm test`: es la primera vez que la suite corre con las migraciones aplicadas (fixtures con `SET ROLE learnity_pruebas` y catálogo sobre las vistas).
3. **Puerta DB:** el usuario revisa el resumen de la reconstrucción (huellas, `ESQUEMA OK`, `MATRIZ OK`, `PRUEBAS OK`, `CATALOGO IGUAL`) y el resultado de `npm test`, y decide para `Learnity` entre reconstruir (pierde los datos) o migrar en su sitio (los conserva).
4. **Respaldo de `Learnity`:** `pg_dump -F c` y `pg_dumpall --roles-only`, fuera del repositorio. El de roles contiene hashes de contraseñas.
5. **`Learnity`**, solo con la aprobación explícita del usuario:
   - **reconstruir:** `reconstruir-base.ps1 -Base Learnity -ConfirmoBorrar Learnity`, y después `npm run db:seed` (y, si se quiere, `npm run db:seed-publico`) desde `backend`; o
   - **migrar en su sitio:** `aplicar-migraciones.ps1 -Base Learnity -ConfirmoRespaldo`.
6. **Cada integrante**, en su base local: la consulta de R1, su propio respaldo y lo mismo que se decida para `Learnity`.

## 11. Pendiente y NO VERIFICADO

- **Reconstrucción (§12): NO VERIFICADA.** `db` no se conecta a ninguna base: `reconstruir-base.ps1`, `linea_base_permisos.sql`, `esquema_final.sql` y la ampliación de `matriz_privilegios.sql` (filas de `learnity_pruebas`) se prueban en la primera ejecución del lead en `learnity_test`. Solo se comprobó, sin conectarse, que el `.ps1` no tiene errores de sintaxis y que `-Simular` muestra el plan correcto.
- Que las semillas (`npm run db:seed`, `db:seed-publico`) funcionen con la 019 aplicada: por la lectura del código, solo hacen `INSERT` permitidos a `learnity_app`. Lo comprobará `test/database/semillas.test.ts` sobre la base reconstruida.

- 022 y 023 rediseñadas (D-BD1) y `verificacion/pruebas_heredadas.sql`: **NO VERIFICADO** hasta el próximo turno de `probar-migraciones.ps1` en `learnity_test`. El resto se probó el 19-10-2026 (ver `docs/refactor/ESTADO.md`, *Prueba de migraciones*).
- Opinión de `qa-edge` sobre D-BD2: recibida (opción 3, §7). El pool de fixtures con `SET ROLE learnity_pruebas` es de `qa-edge` (`backend/test/ayudas/`); el cambio de import en cada suite, de `be-a` y `be-b` (Fase 2A).
- `arquitecto` confirmó las tres vistas, sus columnas y que `catalogo_categoria` filtra `activa` dentro de la vista (ADR-002).
- Puerta 1 cerrada: D-BD1 decidida (BD-022, §7); D-BD2, opción 3 (BD-019b); D-BD3, `pg_trgm` aplazado (ADR-010, P1-2).
- Las 3 lecciones `DOCUMENTO` sin PDF de cursos publicados: no hay `CHECK` posible (es una regla entre tablas). Quedan en el servicio, como hoy.

## 12. Reconstrucción reproducible (20-10-2026)

**Por qué.** El usuario decidió que los datos de `Learnity` y `learnity_test` son desechables y autorizó reconstruir `learnity_test`. Hasta ahora las migraciones nunca habían quedado aplicadas en `learnity_test`: el ciclo `up → down → up` se probó y la base volvió a la línea base. Por eso el catálogo siempre usó la ruta de respaldo de `catalogo.repository.ts:108`.

**Qué se añade** (detalle y comandos en `database/README.md`, *Reconstruir una base desde cero*):

| Archivo | Para qué |
|---|---|
| `database/scripts/reconstruir-base.ps1` | `DROP DATABASE … WITH (FORCE)` y `CREATE DATABASE … TEMPLATE template0 ENCODING 'UTF8'`; línea base; migraciones desde la 017 (sin las retenidas); 019b solo en `_test`; verificación; resumen. Se niega a tocar una base que no termine en `_test` sin `-ConfirmoBorrar <nombre exacto>` |
| `database/linea_base_permisos.sql` | Los `GRANT` de la sección 14 del README principal, último paso de la línea base |
| `database/verificacion/esquema_final.sql` | Comprobación y resumen del esquema final, de solo lectura y válida en cualquier base |
| `database/verificacion/matriz_privilegios.sql` | Ahora también `learnity_pruebas`: en una base `_test` con la 019b se exige todo lo que concede; en cualquier otra, nada |
| `database/verificacion/referencias/huella-*.txt` | Huellas H0, H4 y H1 de la prueba del 19-10-2026 |

**Decisiones (reversibles):**

- **Reutilizar las migraciones en vez de un volcado del esquema final.** Un `pg_dump --schema-only` sería un segundo origen del esquema que podría divergir de las migraciones. Ejecutando los mismos archivos, la base reconstruida queda en el mismo estado que una migrada, con `schema_migraciones` y los checksums, y `aplicar`, `revertir` y `probar` siguen funcionando sobre ella.
- **Reproducir los permisos de la línea base aunque la 019 los retire** (`linea_base_permisos.sql`). La base pasa por el mismo estado H0 que las existentes, su huella se compara con la de referencia y la 019 guarda en `reversion` lo que su `down` restaura.
- **`learnity_esquema.sql` no incluye todo:** no tiene `sesion`, `token_recuperacion` ni `archivo_borrado_pendiente` (015 y 016), ni permisos, roles, dueños, auditoría, `actualizado_en`, vistas ni los índices de la 024 y la 025 (comprobado leyendo el archivo). Por eso la reconstrucción es la línea base completa más las migraciones.
- **`TEMPLATE template0 ENCODING 'UTF8'`.** `template0` no arrastra objetos añadidos a `template1`. Con UTF-8, la base acepta los textos con tildes de las semillas y de las pruebas (en Windows, UTF-8 es compatible con cualquier configuración regional). La collation es la del clúster y el script la imprime.
- **Comparar huellas con tolerancia solo en `roles`.** Los roles son del clúster: al repetir la reconstrucción, `learnity_owner`, `learnity_lectura`, `learnity_pruebas` y la pertenencia de la 019b ya existen. Cualquier otra categoría distinta es un fallo.
- **La 023 sigue retenida** (§2.1, punto 2): queda `CAR-CAT-15`.

**Lo que se haría en `Learnity`** (solo con aprobación explícita del usuario): respaldo `pg_dump -F c`; detener el backend; `reconstruir-base.ps1 -Base Learnity -Simular` y después `-ConfirmoBorrar Learnity`; `npm run db:seed`. **Efectos:** se pierden todos los datos (cuentas, cursos, los 3 `PUBLICADO` heredados y las 2 filas de `archivo`; los PDF del disco quedan huérfanos); el esquema queda igual que el de `learnity_test`, sin la 019b; `learnity_pruebas` no tiene permisos en `Learnity`; `learnity_app` y su contraseña no cambian; los logins ajenos pierden `CONNECT` (R1). La alternativa que conserva los datos es migrar en su sitio con `aplicar-migraciones.ps1 -ConfirmoRespaldo`. La tabla completa de efectos está en `database/README.md`, *Reconstruir `Learnity`*.
