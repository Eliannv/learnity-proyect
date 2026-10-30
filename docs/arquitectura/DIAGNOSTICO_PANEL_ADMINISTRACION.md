# Diagnóstico: panel de administración con control operativo y seguridad

- **Fecha:** 2026-10-29
- **Estado:** Fase 1 (diagnóstico). No se ha modificado código ni base de datos.
- **Base revisada:** `learnity_esquema.sql`, `015`, `016` y las migraciones `017`–`031`; módulos `identidad`, `usuarios`, `revision`, `cursos`, `categorias` y `resenas` del backend; `features/admin/*` del frontend.
- **Fuera de alcance (por decisión del usuario):** bloqueo y filtros por IP, `pg_cancel_backend`, "forzar re-revisión" y limpieza de tokens o archivos desde la UI.

---

## 1. Lo que ya existe

### 1.1 `auditoria_cambio` (migración 020)

| Columna | Tipo | Notas |
|---|---|---|
| `id_auditoria` | `BIGINT` identity | PK |
| `tabla` | `VARCHAR(63)` | `TG_TABLE_NAME` |
| `operacion` | `VARCHAR(6)` | `INSERT`, `UPDATE` o `DELETE` |
| `id_persona_actor` | `INTEGER`, sin FK | Lo fija `enTransaccion(..., { actor })` con `set_config('learnity.id_persona', …, true)`. Sin actor, queda `NULL` |
| `usuario_bd` | `TEXT` | `session_user`: normalmente `learnity_app`; `postgres` en migraciones y semillas |
| `cambiado_en` | `TIMESTAMPTZ` | |
| `id_transaccion` | `BIGINT` | `txid_current()`: agrupa los cambios de una misma operación |
| `columnas_cambiadas` | `TEXT[]` | Solo en `UPDATE`; incluye las columnas excluidas, pero no su valor |
| `antes` / `despues` | `JSONB` | Fila completa, sin `contrasena_hash`, `token_hash` ni `archivo.ruta` |

- **Tablas auditadas:** `persona`, `usuario`, `rol`, `usuario_rol`, `solicitud_docente`, `docente`, `categoria`, `curso`, `modulo`, `leccion`, `archivo`, `recurso_adjunto` (020), `resena` (030) y `reporte_resena` (031).
- **No auditadas:** `sesion`, `token_recuperacion`, `inscripcion`, `progreso_leccion`, evaluaciones y `visita_curso_dia`.
- **Índices:** `(tabla, cambiado_en)`, `(id_persona_actor)` y uno parcial para `resena`. **No hay índice por fecha sola**, que es el orden por defecto del visor.
- **Escritura:** `auditoria_registrar()` es `SECURITY DEFINER` con dueño `learnity_owner` y `search_path` fijo. Un `UPDATE` sin cambios reales no se registra.

### 1.2 Roles de PostgreSQL

| Rol | Login | Sobre `auditoria_cambio` | Uso |
|---|---|---|---|
| `learnity_owner` | No | Dueño | Dueño de todos los objetos; las migraciones hacen `SET LOCAL ROLE learnity_owner` |
| `learnity_app` | Sí | **Ningún permiso** | Pool del backend. Solo el DML que usa el código (019 y siguientes) |
| `learnity_lectura` | No | `SELECT` | Lectura sin datos sensibles: ni `sesion`, ni `token_recuperacion`, ni `contrasena_hash` |
| `learnity_pruebas` | No | — | Limpieza en bases `_test` |

**Precedente que funciona:** la 031 expuso parte de la auditoría con `historial_resena(int[])`, una función `SECURITY DEFINER` con `EXECUTE` solo para `learnity_app`. La app la usa y sigue sin poder leer la tabla.

### 1.3 Identidad: usuarios, bloqueo y sesiones

- **`usuario`:**
  - Ya tiene `intentos_fallidos`, `bloqueado_hasta` y `ultimo_acceso`. `identidad.service.ts` bloquea la cuenta 15 minutos tras 5 fallos seguidos (`MAX_INTENTOS`, `MINUTOS_BLOQUEO`).
  - **Para desbloquear no hace falta ninguna migración:** basta `UPDATE usuario SET intentos_fallidos = 0, bloqueado_hasta = NULL`, y la auditoría registra quién lo hizo.
  - `ultimo_acceso` solo cambia al entrar con contraseña, no al renovar la sesión.
- **`sesion` (015):**
  - Una fila por cada refresh token; los de una misma sesión comparten la columna `familia`.
  - Una sesión está activa si `revocado_en IS NULL AND reemplazado_en IS NULL AND expira_en > now()`. Guarda `agente` (User-Agent) e `ip`.
  - `motivo_revocacion` admite `CIERRE`, `REUTILIZACION`, `CAMBIO_CONTRASENA`, `RESTABLECIMIENTO` y `CUENTA_INACTIVA`; **no tiene un motivo para "revocada por un administrador"**.
- **No hay ningún registro persistente de inicios de sesión.** Los intentos solo llegan al log de la aplicación (`registrarEvento('login_fallido', …)`), que se pierde al reiniciar y que no se puede consultar desde la UI.
- **`token_recuperacion`:** su `CHECK` limita la validez a 30 minutos.

### 1.4 Lo que ya tiene cada vista

| Vista | Lo que ya existe | Lo que falta en la BD |
|---|---|---|
| Usuarios | Listado, filtros, cambio de roles con protección del último administrador, desactivación con cierre de sesiones (`identidadApi.revocarSesionesDeCuentaInactiva`) | Nada para desbloquear ni para el detalle. Para cerrar sesiones, el motivo `ADMIN`. Para dar de alta, depende de la decisión D1 |
| Solicitudes | **Motivo de rechazo completo:** `solicitud_docente.observacion` (300), obligatorio al rechazar, va en el correo y el estudiante lo ve en su perfil (`perfil-estudiante.html:116`) | Revocación: estado `REVOCADA`, quién la hizo, cuándo y el motivo |
| Revisión | Solo `EN_REVISION` (`revision.esquemas.ts` fija `z.literal('EN_REVISION')`); el detalle exige ese estado (`detalle-privado.service.ts:401`) | Estado `SUSPENDIDO` y sus datos (quién, cuándo y el motivo) |
| Categorías | `nombre`, `descripcion` y `activa`; el icono sale de `ICONO_CATEGORIA` en `tipos-ui.ts`, con los nombres de las categorías escritos en el código | Columna `icono`; las vistas `catalogo_categoria` y `catalogo_curso` tienen que devolverla |
| Reseñas | Todas, reportes pendientes, ocultadas y desestimadas, con historial | Ocultación propia del administrador (ver el fallo de §1.5) |

### 1.5 Fallos que se encontraron durante el diagnóstico

1. **Un estudiante puede volver a publicar una reseña que ocultó el administrador.**
   - Al resolver un reporte como `OCULTADA`, `resolverReporte` marca `resena.eliminado_en`, el mismo campo que usa el estudiante para borrar la suya.
   - `PUT /cursos/:id/resena` (`repo.guardar`) pone `eliminado_en = NULL` al republicar. Así la reseña ocultada vuelve al curso sin pasar por moderación.
   - Se corrige en el Lote 6 con columnas propias de ocultación.
2. **`verificacion/matriz_privilegios.sql` está desfasada.**
   - Se quedó en la 027: no incluye los permisos de la 028 (evaluaciones), la 029 (`UPDATE`/`DELETE` en `usuario_rol` y `UPDATE` en `categoria`), la 030 ni la 031.
   - Hay que ponerla al día antes de añadir más permisos; si no, `reconstruir-base.ps1` no puede validar nada.

---

## 2. Migraciones nuevas (032+)

Siguen las convenciones de la 027–031: guarda de versión, `SET LOCAL ROLE learnity_owner`, `lock_timeout`, un `.down.sql` que se niega a perder datos y el ciclo `up → down → up` en `learnity_test`. Hay una por lote, para poder revertir cada lote por separado.

### 032 · `accesos_y_sesiones` (Lotes 1 y 2)

```sql
CREATE TABLE evento_acceso (
    id_evento     BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_usuario    INTEGER      REFERENCES usuario (id_usuario) ON DELETE SET NULL,
    correo        VARCHAR(120) NOT NULL,          -- el escrito, en minúsculas (también si no existe la cuenta)
    paso          VARCHAR(12)  NOT NULL CHECK (paso IN ('CLAVE', 'REFRESH', 'RECUPERACION')),
    exito         BOOLEAN      NOT NULL,
    motivo        VARCHAR(20)  NOT NULL CHECK (motivo IN ('OK', 'CLAVE_INCORRECTA', 'CUENTA_BLOQUEADA',
                               'CUENTA_INACTIVA', 'CORREO_DESCONOCIDO', 'TOKEN_REUTILIZADO', 'TOKEN_INVALIDO')),
    agente        VARCHAR(200),                   -- User-Agent; sin IP (fuera de alcance)
    ocurrido_en   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CHECK (exito = (motivo = 'OK'))
);
CREATE INDEX evento_acceso_fecha_idx   ON evento_acceso (ocurrido_en DESC, id_evento DESC);
CREATE INDEX evento_acceso_usuario_idx ON evento_acceso (id_usuario, ocurrido_en DESC);
CREATE INDEX evento_acceso_fallido_idx ON evento_acceso (ocurrido_en DESC) WHERE NOT exito;

-- Revocación por un administrador.
ALTER TABLE sesion DROP CONSTRAINT sesion_motivo_revocacion_check;
ALTER TABLE sesion ADD CONSTRAINT sesion_motivo_revocacion_check CHECK (motivo_revocacion IN
  ('CIERRE', 'REUTILIZACION', 'CAMBIO_CONTRASENA', 'RESTABLECIMIENTO', 'CUENTA_INACTIVA', 'ADMIN'));

GRANT SELECT, INSERT ON evento_acceso TO learnity_app;    -- solo se añaden filas: ni UPDATE ni DELETE
GRANT SELECT ON evento_acceso TO learnity_lectura;
```

- `evento_acceso` no lleva trigger de auditoría: ya es un registro en sí mismo.
- Si se elige la invitación por correo (D1), la 032 añade también `token_recuperacion.proposito` (`RECUPERACION` | `INVITACION`) y cambia el `CHECK` de vigencia: 30 minutos para la recuperación y 72 horas para la invitación.

### 033 · `revocacion_docente` (Lote 3)

```sql
ALTER TABLE solicitud_docente DROP CONSTRAINT solicitud_docente_estado_check;
ALTER TABLE solicitud_docente ADD CONSTRAINT solicitud_docente_estado_check
  CHECK (estado IN ('PENDIENTE', 'APROBADA', 'RECHAZADA', 'REVOCADA'));
ALTER TABLE solicitud_docente
  ADD COLUMN revocada_en        TIMESTAMPTZ,
  ADD COLUMN revocada_por       INTEGER REFERENCES persona (id_persona),
  ADD COLUMN motivo_revocacion  VARCHAR(300),
  ADD CONSTRAINT solicitud_revocada_completa CHECK (
    (estado = 'REVOCADA') = (revocada_en IS NOT NULL AND revocada_por IS NOT NULL AND motivo_revocacion IS NOT NULL));
```

- Revocar significa: borrar la fila `DOCENTE` de `usuario_rol` (permiso de la 029), poner `docente.estado = 'INACTIVO'` y marcar la solicitud. Todo va en una transacción con actor.
- No hacen falta permisos nuevos.

### 034 · `suspension_cursos` (Lote 4)

```sql
ALTER TABLE curso DROP CONSTRAINT curso_estado_check;
ALTER TABLE curso ADD CONSTRAINT curso_estado_check
  CHECK (estado IN ('BORRADOR', 'EN_REVISION', 'PUBLICADO', 'RECHAZADO', 'ARCHIVADO', 'SUSPENDIDO'));
ALTER TABLE curso
  ADD COLUMN suspendido_en      TIMESTAMPTZ,
  ADD COLUMN suspendido_por     INTEGER REFERENCES persona (id_persona),
  ADD COLUMN motivo_suspension  VARCHAR(300),
  ADD CONSTRAINT curso_suspension_completa CHECK (
    (estado = 'SUSPENDIDO') = (suspendido_en IS NOT NULL AND suspendido_por IS NOT NULL AND motivo_suspension IS NOT NULL));
CREATE INDEX curso_estado_fecha_idx ON curso (estado, actualizado_en DESC);
```

- No se reutiliza `ARCHIVADO`: está reservado para que el docente retire su propio curso.
- **Efecto inmediato, sin tocar más código:**
  - `catalogo_curso` solo muestra cursos `PUBLICADO`, así que el curso sale del catálogo.
  - `aprendizaje.repository.ts` y `resenas.repository.ts` exigen `PUBLICADO`, así que los inscritos dejan de poder abrirlo y nadie puede reseñarlo.
  - Si esto es lo que se quiere, se decide en D2.
- **`politica-curso.ts`:** se añaden las transiciones `PUBLICADO → SUSPENDIDO` y `SUSPENDIDO → PUBLICADO`, solo para administradores. `SUSPENDIDO` no se incluye en `ESTADOS_EDITABLES`.
- `curso_publicado_revisado` (023) sigue valiendo: al reactivar, el curso conserva su revisor y su fecha.

### 035 · `icono_categoria` (Lote 5)

```sql
ALTER TABLE categoria ADD COLUMN icono VARCHAR(40) NOT NULL DEFAULT 'tags'
  CHECK (icono ~ '^[a-z0-9]+(-[a-z0-9]+)*$');            -- nombre kebab-case de Lucide
UPDATE categoria SET icono = CASE nombre WHEN 'Programación' THEN 'code' WHEN 'Diseño' THEN 'pen-tool'
  WHEN 'Idiomas' THEN 'languages' WHEN 'Negocios' THEN 'briefcase' WHEN 'Ofimática' THEN 'monitor'
  WHEN 'Marketing' THEN 'megaphone' ELSE 'tags' END;     -- conserva lo que hoy fija ICONO_CATEGORIA
CREATE OR REPLACE VIEW catalogo_categoria AS ... , cat.icono;                     -- columna nueva al final
CREATE OR REPLACE VIEW catalogo_curso     AS ... , cat.icono AS categoria_icono;  -- columna nueva al final
```

- La base solo comprueba el formato. La lista cerrada de iconos permitidos la valida zod, con una constante compartida que se genera a partir de `ICONOS` (`shared/ui/marca/iconos.ts`). Así, añadir un icono no exige una migración.
- `CREATE OR REPLACE VIEW` solo deja añadir columnas al final, y las consultas del catálogo seleccionan columnas por nombre, así que no cambia nada de lo que ya existe.
- **Reasignar cursos** a otra categoría no necesita permisos nuevos (`learnity_app` ya tiene `UPDATE` en `curso`). Es un `UPDATE` en lote con actor y la auditoría lo registra.

### 036 · `ocultacion_resenas` (Lote 6)

```sql
ALTER TABLE resena
  ADD COLUMN ocultada_en         TIMESTAMPTZ,
  ADD COLUMN ocultada_por        INTEGER REFERENCES persona (id_persona) ON DELETE SET NULL,
  ADD COLUMN motivo_ocultacion   VARCHAR(300);
UPDATE resena r SET ocultada_en = x.resuelto_en, ocultada_por = x.id_persona_resuelve,
                    motivo_ocultacion = 'Reporte ' || x.motivo
  FROM reporte_resena x WHERE x.id_resena = r.id_resena AND x.estado = 'OCULTADA';
```

- Las consultas públicas y las del docente filtran `eliminado_en IS NULL AND ocultada_en IS NULL`.
- `guardar()` no toca `ocultada_*`, así que el estudiante ya no puede deshacer la ocultación (corrige el fallo 1 de §1.5).
- **Retirar la respuesta del docente** no necesita columnas nuevas: se ponen `respuesta_docente` y `respondida_en` a `NULL` con actor. La auditoría lo guarda y `historial_resena` ya lo muestra como `RESPONDIDA_POR_DOCENTE`; se añade la acción `RESPUESTA_RETIRADA` cuando el actor no es el docente.
- **Filtros por curso, estrellas y texto:** no necesitan migración (`ILIKE` sobre comentario y respuesta). `propuestas/pg_trgm` queda para cuando el volumen lo pida.

### 037 · `supervision_auditoria` (Lote 7)

Expone la auditoría y la salud de la base con funciones `SECURITY DEFINER`, como en §3.

```sql
CREATE INDEX auditoria_cambio_fecha_idx ON auditoria_cambio (cambiado_en DESC, id_auditoria DESC);

CREATE FUNCTION auditoria_listar(p_tabla TEXT, p_operacion TEXT, p_usuario_bd TEXT, p_id_persona INTEGER,
                                 p_desde TIMESTAMPTZ, p_hasta TIMESTAMPTZ, p_limite INTEGER, p_offset INTEGER)
RETURNS TABLE (id_auditoria BIGINT, tabla TEXT, operacion TEXT, registro TEXT, id_persona_actor INTEGER,
               actor TEXT, usuario_bd TEXT, cambiado_en TIMESTAMPTZ, columnas_cambiadas TEXT[], total BIGINT) ...;

CREATE FUNCTION auditoria_detalle(p_id BIGINT)
RETURNS TABLE (..., id_transaccion BIGINT, antes JSONB, despues JSONB) ...;

CREATE FUNCTION auditoria_opciones()     -- tablas y usuarios de BD distintos, para los desplegables
RETURNS TABLE (tipo TEXT, valor TEXT) ...;

CREATE FUNCTION estado_base_datos()      -- versión, tamaño, conexiones a esta base, arranque y última migración
RETURNS TABLE (version TEXT, tamano_bytes BIGINT, conexiones INTEGER, iniciada_en TIMESTAMPTZ,
               ultima_migracion TEXT, aplicada_en TIMESTAMPTZ) ...;
```

- **Clave del registro:** `registro` se calcula con un `CASE tabla` sobre `COALESCE(despues, antes)`, por ejemplo `id_curso` o `id_usuario,id_rol` para `usuario_rol`.
- **Actor:** `actor` sale de unir `persona` y `usuario` (nombre y correo).
- **El diff se calcula en el frontend** a partir de `antes`, `despues` y `columnas_cambiadas`.
- **`estado_base_datos()`:**
  - Usa `SECURITY DEFINER` porque `learnity_app` no puede leer `schema_migraciones`.
  - No necesita `pg_read_all_stats`: cuenta las conexiones de `pg_stat_activity`, pero no lee su texto ni su estado.

### 038 · `alertas_seguridad` (Lote 8)

```sql
CREATE TABLE alerta_seguridad (
    id_alerta           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tipo                VARCHAR(20)  NOT NULL CHECK (tipo IN
                        ('INTENTOS_FALLIDOS', 'CAMBIO_PRIVILEGIOS', 'RAFAGA_RESENAS', 'MODIFICACION_MASIVA')),
    severidad           VARCHAR(5)   NOT NULL CHECK (severidad IN ('ALTA', 'MEDIA', 'BAJA')),
    descripcion         VARCHAR(300) NOT NULL,
    id_usuario          INTEGER      REFERENCES usuario (id_usuario) ON DELETE SET NULL,
    evidencia           JSONB        NOT NULL DEFAULT '{}',   -- {"auditoria": [ids], "accesos": [ids]}
    clave               VARCHAR(120) NOT NULL UNIQUE,         -- deduplicación: el mismo hallazgo no se repite
    detectada_en        TIMESTAMPTZ  NOT NULL DEFAULT now(),
    atendida_en         TIMESTAMPTZ,
    atendida_por        INTEGER      REFERENCES persona (id_persona) ON DELETE SET NULL,
    nota                VARCHAR(300),
    CHECK ((atendida_en IS NULL) = (atendida_por IS NULL))
);
CREATE INDEX alerta_seguridad_pendiente_idx ON alerta_seguridad (detectada_en DESC) WHERE atendida_en IS NULL;
CREATE TRIGGER auditoria AFTER INSERT OR UPDATE OR DELETE ON alerta_seguridad
  FOR EACH ROW EXECUTE FUNCTION auditoria_registrar();

CREATE FUNCTION analizar_alertas_seguridad(p_desde TIMESTAMPTZ) RETURNS INTEGER   -- alertas nuevas
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp ...;

GRANT SELECT ON alerta_seguridad TO learnity_app, learnity_lectura;
GRANT UPDATE (atendida_en, atendida_por, nota) ON alerta_seguridad TO learnity_app;    -- sin INSERT
GRANT EXECUTE ON FUNCTION analizar_alertas_seguridad(TIMESTAMPTZ) TO learnity_app;
```

- La app **no tiene `INSERT`** sobre las alertas: solo las crea la función de análisis. Un fallo en el backend no puede fabricarlas ni borrarlas, y atenderlas queda auditado.
- Reglas propuestas; los umbrales son constantes dentro de la función:

| Regla | Fuente | Condición | Severidad |
|---|---|---|---|
| `INTENTOS_FALLIDOS` | `evento_acceso` | ≥ 5 fallos sobre una cuenta en 15 min | MEDIA; ALTA si son ≥ 10 o si se bloqueó la cuenta |
| `CAMBIO_PRIVILEGIOS` | `auditoria_cambio` de `usuario_rol` | Alta o baja de `ADMIN` o `DOCENTE` | ALTA si es `ADMIN`. `DOCENTE`: MEDIA, o BAJA si en la misma `id_transaccion` se aprobó una solicitud (es el flujo normal) |
| `RAFAGA_RESENAS` | `auditoria_cambio` de `resena` | Un mismo actor hace ≥ 5 cambios (crear, editar o borrar) en 10 min | MEDIA |
| `MODIFICACION_MASIVA` | `auditoria_cambio` de `curso`, `modulo`, `leccion` y `recurso_adjunto` de un curso publicado | Un mismo actor hace ≥ 20 cambios en 10 min, o ≥ 3 `DELETE` | MEDIA; ALTA si hay `DELETE` |

- **Evidencia:** cada alerta guarda los `id_auditoria` o `id_evento` que la provocaron. En la UI enlazan al detalle del visor de auditoría.
- **Cuándo se ejecuta:**
  - Con el botón "Ejecutar análisis ahora", sobre las últimas 24 horas. Como `clave` es única, repetir el análisis no duplica alertas.
  - Opcionalmente, también en segundo plano tras un bloqueo de cuenta o un cambio de roles. No hace falta un programador de tareas.

### Sin migración

- Detalle del usuario (inscripciones, cursos creados y último acceso).
- Desbloqueo de cuentas.
- Tarjetas del resumen. `learnity_app` ya tiene `SELECT` sobre `usuario_rol`, `curso`, `inscripcion`, `resena`, `solicitud_docente` y `reporte_resena`; las alertas pendientes salen de la 038.
- Pestañas de cursos por estado.
- Filtros de reseñas.

---

## 3. Cómo exponer `auditoria_cambio` sin debilitar los roles

| Opción | Veredicto | Motivo |
|---|---|---|
| A. `GRANT SELECT ON auditoria_cambio TO learnity_app` | **No** | Rompe la decisión de la 020: la app podría leer toda la auditoría con cualquier consulta. Si alguna vez hubiera una inyección SQL, el historial completo saldría con ella |
| B. Un segundo pool que se conecte como `learnity_lectura` | **No** | Habría que darle `LOGIN` y una contraseña más que custodiar en `.env`, y cada máquina del equipo tendría que configurarla. Además ve todo lo que ve ese rol, no solo lo que muestra el panel |
| C. Hacer `learnity_app` miembro de `learnity_lectura` | **No** | Le daría lectura de casi todo el esquema, más de lo que necesita |
| **D. Funciones `SECURITY DEFINER` de `learnity_owner`** (`auditoria_listar`, `auditoria_detalle`, `auditoria_opciones`) | **Recomendada** | Es el patrón de `historial_resena` (031), que ya funciona |

Reglas de las funciones de la opción D:

1. Dueño `learnity_owner`; `SET search_path = pg_catalog, pg_temp`; nombres siempre calificados (`public.auditoria_cambio`).
2. `REVOKE EXECUTE … FROM PUBLIC` y `GRANT EXECUTE … TO learnity_app`.
3. **Sin SQL dinámico** (`EXECUTE format(...)`): los filtros son parámetros tipados con la forma `(p_x IS NULL OR columna = p_x)`, así que no hay inyección posible.
4. Límite forzado dentro de la función: `LEAST(COALESCE(p_limite, 50), 100)`. Una llamada no puede volcar toda la tabla.
5. Los datos sensibles ya no existen en `antes`/`despues` (la 020 excluye los hashes y `archivo.ruta`), y `sesion` y `token_recuperacion` no se auditan.
6. **Quién puede pedirlas lo decide el backend** (`autorizar('ADMIN')`), igual que con `historial_resena`. El rol de base de datos no distingue entre usuarios de la app.
7. `learnity_lectura` conserva su `SELECT` para consultas manuales y reportes; la app no lo usa.

Interpretación propuesta del filtro "Rol" del visor: el **rol de PostgreSQL que ejecutó el cambio** (`usuario_bd`: `learnity_app`, `postgres`…). El rol de la aplicación del actor (Estudiante, Docente o Administrador) se muestra en la fila, pero no se filtra por él.

---

## 4. Diseño del backend y del frontend

- **Backend:**
  - **`identidad`:**
    - Escribe en `evento_acceso` en cada camino de `iniciarSesion`, `refrescarSesion` y `restablecerContrasena`. El registro va dentro de un `try`: si falla, no rompe el login ni cambia los tiempos de respuesta.
    - Publica en `index.ts`: `listarAccesos`, `cuentasBloqueadas`, `desbloquearCuenta`, `sesionesActivas`, `revocarSesion(familia)` y `revocarSesionesDeUsuario`.
    - Nadie fuera de `identidad` toca `sesion` ni `evento_acceso`.
  - **`usuarios` (ya existe):** alta, detalle, desbloqueo y cierre de sesiones (a través de `identidadApi`) y revocación del rol docente.
  - **`cursos` y `revision`:** listado por estado, detalle en cualquier estado, suspender y reactivar.
  - **`categorias`:** campo `icono`, conteo de cursos y reasignación.
  - **`resenas`:** ocultar desde "Todas", retirar la respuesta del docente y filtros.
  - **Módulo nuevo `supervision`:**
    - Resumen, visor de auditoría, alertas y salud de la base.
    - Su repositorio llama a las funciones de la 037 y la 038. Para accesos y sesiones, delega en `identidadApi`.
    - Lee los totales del resumen con SQL propio, como ya hace `analiticas`.
  - **Contrato:** `shared/openapi/openapi-admin-*.ts` y, después, `api:serializar` → `openapi.yaml` → `api:tipos`.
- **Frontend:**
  - Carpetas nuevas `features/admin/{resumen,auditoria,accesos,alertas,sesiones}`, cada una con sus `*.routes.ts` y `*.api.ts`, y sus entradas en `layouts/panel/menu-panel`.
  - `/admin` redirigirá a `resumen` en vez de a `revision`. Las URLs actuales no cambian: la E2E `02-guards-roles` usa rutas explícitas.
  - El diff de la auditoría va en `features/admin/auditoria/componentes/diff-cambio`: rojo para el valor anterior y verde para el nuevo, con texto además de color para no depender solo de él.

---

## 5. Decisiones

**Aprobadas el 29-10-2026:**
- Diseño de las migraciones 032 a 038.
- Funciones `SECURITY DEFINER` bajo `learnity_owner`.
- Módulo `supervision`.
- D1 a D4 en su opción **a**, con estas precisiones:
  - D3: el modal de revocación muestra cuántos cursos publicados tiene el docente.
  - D4: los pasos `CLAVE` y `RECUPERACION` registran éxitos y fallos; `REFRESH` registra solo los fallos.
- Orden de ejecución: lotes 0 → 9.

| # | Decisión | Opciones | Recomendación |
|---|---|---|---|
| D1 | Cómo recibe su contraseña un usuario creado por el administrador | a) **Invitación por correo**: enlace de un solo uso válido 72 h; la usa la 032. b) Contraseña temporal que fija el administrador, más una marca "debe cambiarla" | **a**: el administrador nunca conoce la contraseña y se reutilizan el flujo de restablecimiento y Gmail |
| D2 | Qué pasa con los estudiantes ya inscritos en un curso suspendido | a) **Pierden el acceso** mientras dure la suspensión, conservan su progreso y ven el aviso "Curso suspendido" en Mi aprendizaje. b) Lo siguen viendo y solo desaparece del catálogo | **a**: si el contenido es inapropiado, no debe seguir visible. Hoy es lo que ya pasa por el filtro `PUBLICADO` |
| D3 | Qué pasa con los cursos de un docente revocado | a) **Siguen publicados**, pero el docente ya no puede editarlos. b) Se suspenden todos automáticamente | **a**, avisando al administrador de cuántos cursos tiene; si hace falta, los suspende desde Revisión |
| D4 | Qué se registra del paso `REFRESH` | a) **Solo los fallos** (token reutilizado o inválido). b) También cada renovación correcta, que ocurre cada 15 minutos por pestaña abierta | **a**: las sesiones válidas ya se ven en `sesion`; registrar cada renovación inundaría la tabla |

---

## 6. Plan de trabajo por lotes

Cada lote termina con la migración probada `up → down → up` en `learnity_test`, `matriz_privilegios.sql` al día, `tsc` y node:test, contrato regenerado, `ng build` y vitest, y E2E si toca recorridos existentes. Lleva commits separados por capa. No se toca `Learnity` sin un respaldo y tu aprobación.

| Lote | Contenido | Migración | Depende de |
|---|---|---|---|
| **0** | Poner al día `matriz_privilegios.sql` con la 028–031 (sin cambiar el esquema) | — | — |
| **1** | Registro de accesos: `identidad` escribe los eventos; vista **Accesos** con cuentas bloqueadas y botón Desbloquear, y pestañas Todos / Solo fallidos | 032 | 0 |
| **2** | **Usuarios:** desbloquear, cerrar sesiones, detalle (cursos inscritos, cursos creados y último acceso) y alta de usuarios (con especialidad si es docente) | 032 (motivo `ADMIN`; invitación si D1 = a) | 1 |
| **3** | **Solicitudes:** revocar el rol docente con motivo, y pestaña o etiqueta "Revocadas" | 033 | 0 |
| **4** | **Revisión:** pestañas Pendientes / Publicados / Rechazados / Borradores (y Suspendidos), detalle de solo lectura en cualquier estado, y suspender y reactivar con casilla "Confirmo" y motivo; correo al docente | 034 | 0 |
| **5** | **Categorías:** selector visual de icono; el catálogo, la portada y el inicio leen el icono de la API; al desactivar, se avisa de cuántos cursos tiene y se ofrece reasignarlos | 035 | 0 |
| **6** | **Reseñas:** ocultar o restaurar desde "Todas", retirar la respuesta del docente, filtros por curso, estrellas y texto, y **corrección del fallo de republicar** | 036 | 0 |
| **7** | **Auditoría** (tabla paginada, filtros y diff) y **Sesiones y salud de la BD** (sesiones activas, revocar sesiones y `estado_base_datos`) | 037 | 1 |
| **8** | **Alertas:** reglas, "Ejecutar análisis ahora", Pendientes / Todas, "Marcar atendida" y enlace a la evidencia | 038 | 1, 7 |
| **9** | **Resumen:** tarjetas de indicadores y contadores con enlaces; `/admin` pasa a redirigir a `resumen` | — | 3, 4, 6 y 8 (para los contadores) |

Los lotes 3, 4, 5 y 6 son independientes entre sí y pueden ir en cualquier orden. El orden recomendado es **0 → 1 → 2**, porque es la base de seguridad que luego usan las alertas.

---

## 7. Riesgos

- **Crecimiento de `evento_acceso` y `auditoria_cambio`:** no hay purga (la limpieza desde la UI está fuera de alcance). Con el volumen del proyecto no es un problema, pero conviene dejar anotada una política de retención en `database/README.md`.
- **Conflictos con los compañeros:**
  - Los lotes tocan `identidad`, `usuarios`, `cursos` y `resenas`, que tienen otros dueños según la asignación del sprint. Conviene confirmarlo con el coordinador.
  - Hay que hacerlo después de integrar `sprint4/elian-estructura`, para no mezclar los movimientos de carpetas con lógica nueva.
- **`token_recuperacion`:** si se elige D1 = a, su `CHECK` de 30 minutos cambia. El `down` de la 032 debe negarse si quedan invitaciones de más de 30 minutos sin usar.
- **El rol se llama `ADMIN` en la base de datos** (no "Administrador"). La UI muestra la etiqueta en español, pero la API y la base siguen usando `ADMIN`.
