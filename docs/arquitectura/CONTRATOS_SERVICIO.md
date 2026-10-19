# Contratos de servicio: qué expone cada módulo

La mantiene `arquitecto`. Describe el **destino** del refactor según los ADR-001 a 005, *Propuestos* hasta la Puerta 1. Las firmas salen del código de `3c3c159`, y se conservan los nombres actuales cuando no hay motivo para cambiarlos. El contrato HTTP de cada ruta es el de `docs/api/openapi.yaml`.

Convenciones:
- "API pública" es lo que exporta `modules/<m>/index.ts` para **otros módulos**. Las rutas HTTP las monta `app.ts`.
- `cliente: PoolClient` indica que la función debe llamarse dentro de una transacción del consumidor.
- "Escribe" indica el módulo dueño de la tabla; solo él hace `INSERT`, `UPDATE` o `DELETE` en ella. "Lee" es una lectura permitida desde el repositorio propio, documentada aquí.

## 1. Endpoint actual → módulo destino

| Operación | Hoy | Destino | Lote |
|---|---|---|---|
| `POST /auth/{registro,login,refresh,logout,recuperar,restablecer}` | identidad | `identidad` | A1 |
| `GET/PUT /perfil`, `PUT /perfil/contrasena` | identidad | `identidad` | A1 |
| `GET /cursos`, `GET /cursos/{id}` | cursos (`cursos.service.ts:948-994`) | `catalogo` (ADR-002) | A2 |
| `GET /categorias` | cursos (`cursos.routes.ts:11`) | `categorias` | A3 |
| *(nuevo)* CRUD de categorías | — | `categorias`: **pendiente de un ADR en la Fase 2B** (D1) | A3 |
| `GET /solicitudes-docente/mia`, `POST /solicitudes-docente` | administracion | `usuarios` | A4 |
| `GET /admin/solicitudes`, `PUT /admin/solicitudes/{id}` | administracion | `usuarios` | A4 |
| `GET /docente/cursos`, `GET /docente/cursos/{id}`, `POST /cursos`, `PUT /cursos/{id}`, `POST /cursos/{id}/enviar-revision` | cursos | `cursos` (ficha) | B1 |
| `POST /cursos/{id}/modulos`, `PUT/DELETE /modulos/{id}`, `POST /modulos/{id}/lecciones`, `PUT/DELETE /lecciones/{id}` | cursos | `cursos/temario` | B2 |
| `POST /lecciones/{id}/archivo`, `GET /archivos/{id}` | contenido | `contenido` | B3 |
| `GET /admin/cursos`, `GET /admin/cursos/{id}`, `PUT /admin/cursos/{id}/revision` | administracion | `revision` | B4 |
| `GET /salud`, `/api/docs` | `app.ts` | `app.ts` + `shared/database` (ADR-011) | 2A (`be-a`) |

`administracion` desaparece. `aprendizaje` y `evaluaciones` siguen **congelados**: rutas vacías, sin cambios (Sprint 3/4).

## 2. Grafo de dependencias destino

```
app.ts ──► */index.ts   (monta rutas y registra puertos)
identidad ──(registrarVerificadorSesion)──► shared/auth
contenido ──► cursos/index        (+ implementa LiberadorArchivos, puerto de cursos)
revision  ──► cursos/index
catalogo, categorias, usuarios, cursos: sin dependencias de otros módulos
```

No hay ciclos. Cualquier dependencia nueva entre módulos pasa por un `index.ts` y se añade a este documento.

## 3. Módulos

### 3.1 `identidad` (`be-a`)

- **Responsabilidad:** registro, sesión (access JWT y refresh rotatorio), recuperación de contraseña, perfil propio y cambio de contraseña.
- **Rutas:** las 9 de `/auth/*` y `/perfil*`.
- **API pública:**
  - `identidadApi.sesionVigente(usuario: UsuarioSesion): Promise<boolean>`: solo la usa `app.ts`, para `registrarVerificadorSesion`.
  - Tipos: `UsuarioPublico`.
- **Usa de `shared`:** `auth` (jwt, contraseña y tokens), `http` (cookies, CSRF, límites), `correo` (`enviarCorreo`, ADR-005), `seguridad` (HIBP) y `log`.
- **Escribe:** `persona`, `usuario`, `usuario_rol` (solo el rol ESTUDIANTE al registrarse), `sesion` y `token_recuperacion`. **Lee:** `rol`.
- **Consumidores:** `app.ts`.

### 3.2 `catalogo` (`be-a`, ADR-002)

- **Responsabilidad:** lectura pública de los cursos publicados.
- **Rutas:** `GET /cursos` y `GET /cursos/{id}`.
- **API pública:** ninguna para otros módulos (solo `catalogoRoutes`).
- **Lee:** solo las vistas `catalogo_curso` y `catalogo_temario` (nombres pendientes de confirmar con `db`). **No escribe nada.**
- **Consumidores:** `app.ts`.

### 3.3 `categorias` (`be-a`)

- **Responsabilidad:** categorías de cursos.
- **Rutas:** `GET /categorias` (solo las activas, ordenadas por nombre e id). **El CRUD de administración (D1) está pendiente:** amplía el contrato y necesita un ADR con las rutas, los cuerpos, los códigos y las reglas (nombre único, desactivar o borrar con cursos asociados) **antes** de implementarse en la Fase 2B (lote A3).
- **API pública:** ninguna por ahora. Si el CRUD lo necesita, se añadirá aquí.
- **Escribe:** `categoria` (cuando exista el CRUD). **Lee:** `categoria`.
- **Lectura permitida a otros:** `cursos` lee `categoria.activa` desde su propio repositorio, dentro de su transacción (`categoriaActiva`), para validar `categoriaId`. Es solo lectura, documentada aquí.

### 3.4 `usuarios` (`be-a`)

- **Responsabilidad:** solicitudes para ser docente (RF-05 y RF-22) y asignación del rol DOCENTE. La gestión de usuarios (`admin/usuarios`) queda fuera del Sprint 2 (congelada).
- **Rutas:** `GET /solicitudes-docente/mia`, `POST /solicitudes-docente`, `GET /admin/solicitudes` y `PUT /admin/solicitudes/{id}`.
- **API pública:** ninguna para otros módulos.
- **Escribe:** `solicitud_docente`, `usuario_rol` (rol DOCENTE al aprobar) y `docente` (crear o reactivar). **Lee:** `persona`, `usuario`, `rol` e `inscripcion` (`cursosCompletados`, solo lectura de una tabla del Sprint 3).
- **Nota:** `usuario_rol` la escriben dos módulos (`identidad` al registrar y `usuarios` al aprobar). Se acepta porque cada uno inserta un rol distinto. Si aparece la gestión de usuarios, se reconsidera.

### 3.5 `cursos` (`be-b`; ficha + `temario/`)

- **Responsabilidad:** cursos del docente (ficha, módulos y lecciones), validación de completitud, envío a revisión, política de estados (ADR-003) y operaciones de revisión que expone a `revision`.
- **Rutas:** las 11 de la gestión del docente (ver §1).
- **API pública** (`cursosApi`). Son los métodos que hoy consumen otros módulos, con las mismas firmas:

| Función | Consumidor | Hoy en |
|---|---|---|
| `verificarCarga(idLeccion: number, usuario: UsuarioSesion): Promise<void>` | contenido | `cursos-integracion.service.ts:430` |
| `conLeccionEditable<T>(idLeccion: number, usuario: UsuarioSesion, trabajo: (ctx: ContextoLeccion, cliente: PoolClient) => Promise<T>): Promise<T>` | contenido | `:450` |
| `asociarPdfPrincipal(cliente: PoolClient, ctx: ContextoLeccion, idArchivo: number): Promise<void>` | contenido | `:477` |
| `detallePrivado(cliente: PoolClient, idCurso: number): Promise<CursoDetalle>` | contenido (y cursos internamente) | `:277` |
| `autorizarLectura(idLeccion: number, idCursoArchivo: number, usuario: UsuarioSesion): Promise<void>` | contenido | `:495` |
| `listarParaRevision(usuario: UsuarioSesion): Promise<{ items: CursoResumen[] }>` | revision | `:397` |
| `detalleParaRevision(id: number, usuario: UsuarioSesion): Promise<CursoDetalle>` | revision | `:407` |
| `decidirRevision(id: number, decision: DecisionRevision, usuario: UsuarioSesion): Promise<CursoDetalle>` | revision | `:531` |

  Tipos públicos (`cursos.modelo.ts`): `EstadoCurso`, `CursoResumen`, `CursoDetalle`, `ContextoLeccion` y `DecisionRevision`.
- **Puerto que define** (ADR-004): `LiberadorArchivos { retirarSinUso(cliente, idCurso, idsArchivo); limpiarPendientes() }`, más `registrarLiberadorArchivos(l)`.
- **Escribe:** `curso`, `modulo` y `leccion`, incluido `leccion.id_archivo` mediante `asociarPdfPrincipal`. **Lee:** `categoria`, `docente`, `persona`, los metadatos de `archivo` y `recurso_adjunto`.
- **Consumidores:** `contenido` y `revision`.
- **Pendiente de B1/B2 (riesgo R4):** `detallePrivado` lee y valida los PDF del disco (`almacenPdf.esValido`, `cursos-integracion.service.ts:338`) dentro de la transacción. Tiene que salir de la sección bloqueada sin cambiar su resultado (ADR-005).

### 3.6 `contenido` (`be-b`)

- **Responsabilidad:** subida, validación, almacenamiento, descarga y limpieza de los PDF de las lecciones.
- **Rutas:** `POST /lecciones/{id}/archivo` y `GET /archivos/{id}`.
- **API pública:** `liberadorArchivos: LiberadorArchivos`, la implementación del puerto de `cursos` que registra `app.ts`.
- **Usa:** `cursos/index` (las 5 funciones de la tabla anterior) y `shared/archivos` (`AlmacenArchivos` y `pdf-validacion`, ADR-005).
- **Escribe:** `archivo` y `archivo_borrado_pendiente`. **Lee:** `leccion` y `recurso_adjunto`.
- **Nunca expone** `archivo.ruta` ni el nombre interno del archivo.

### 3.7 `revision` (`be-b`)

- **Responsabilidad:** revisión administrativa de los cursos.
- **Rutas:** `GET /admin/cursos`, `GET /admin/cursos/{id}` y `PUT /admin/cursos/{id}/revision`.
- **API pública:** ninguna.
- **Usa:** `cursos/index` (`listarParaRevision`, `detalleParaRevision` y `decidirRevision`). **No tiene tablas propias.**

### 3.8 `shared` (sin módulos; dueños según ESTADO.md)

| Paquete | Qué ofrece | Dueño |
|---|---|---|
| `shared/config` | `env` validado con zod | be-a |
| `shared/database` | `consultar`, `enTransaccion`, ayudante del actor de auditoría y `comprobarConexion` (ADR-011) | be-b |
| `shared/http` | `AppError`, `manejadorErrores`, `validar*` (ADR-006), `limitarPorIp`, cookies y CSRF, middleware de correlación | be-a (`openapi*.ts`: arquitecto) |
| `shared/auth` | `autenticar`, `autorizar`, `registrarVerificadorSesion`, jwt, contraseña y tokens | be-a |
| `shared/log` | `registrarEvento` (con `idPeticion`) y `ocultarCorreo` | be-a |
| `shared/correo` | `enviarCorreo` y `TransporteCorreo` (gmail o buzón) | be-a |
| `shared/archivos` | `AlmacenArchivos` (`almacenLocal`) y `pdf-validacion` | be-b |
| `shared/seguridad` | contraseñas expuestas (HIBP) | be-a |

## 4. Pendientes que afectan a este documento

1. **CRUD de categorías (D1):** su ADR se escribe en la Fase 2B, antes de A3. Ampliará §1 y §3.3.
2. **Nombres de las vistas del catálogo:** los confirma `db` (ADR-002).
3. **D3 y D4** (frontend) no cambian este documento del backend.
4. Si se aprueba el ADR-011, `GET /salud` cambia de cuerpo (§1).
