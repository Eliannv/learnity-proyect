# Panel de administración · Resumen de la Fase 1

- **Fecha:** 2026-10-29
- **Rama:** `sprint4/elian-estructura`, sin commit.
- **Diagnóstico completo:** [`DIAGNOSTICO_PANEL_ADMINISTRACION.md`](DIAGNOSTICO_PANEL_ADMINISTRACION.md).

No he modificado código ni la base de datos.

---

## 1. Lo que ya existe y no necesita migración

- **Motivo de rechazo de solicitudes:** ya funciona completo. Se guarda en `solicitud_docente.observacion` (hasta 300 caracteres), es obligatorio al rechazar, va en el correo al estudiante y este lo ve en su perfil (`perfil-estudiante.html:116`).
- **Desbloquear cuentas:** `usuario` ya tiene `intentos_fallidos`, `bloqueado_hasta` y `ultimo_acceso`. La cuenta se bloquea 15 minutos tras 5 fallos seguidos. Para desbloquearla basta un `UPDATE`, y la auditoría registra quién lo hizo.
- **Tarjetas del resumen, detalle del usuario, filtros de reseñas y pestañas de cursos por estado:** `learnity_app` ya tiene permiso para leer todo lo que necesitan.

## 2. Fallos encontrados

1. **Un estudiante puede volver a publicar una reseña que ocultó el administrador.**
   - Al resolver un reporte como `OCULTADA`, se marca `resena.eliminado_en`. Es el mismo campo que usa el estudiante para borrar su reseña.
   - Al republicar, `PUT /cursos/:id/resena` lo deja otra vez en `NULL`, y la reseña vuelve al curso sin pasar por moderación.
   - Lo corrige la migración 036.
2. **`database/verificacion/matriz_privilegios.sql` está desfasada.**
   - Se quedó en la 027 y no recoge los permisos de las migraciones 028 a 031.
   - Mientras no se actualice, `reconstruir-base.ps1` no puede validar ningún permiso nuevo.

## 3. Migraciones nuevas, una por lote

| Migración | Qué añade |
|---|---|
| 032 | Tabla `evento_acceso` para los inicios de sesión (sin IP) y el motivo `ADMIN` para revocar sesiones |
| 033 | Estado `REVOCADA` en `solicitud_docente`, con quién la revocó, cuándo y por qué |
| 034 | Estado `SUSPENDIDO` en `curso`, con quién lo suspendió, cuándo y por qué |
| 035 | Columna `categoria.icono`; las vistas `catalogo_categoria` y `catalogo_curso` pasan a devolverla |
| 036 | Columnas propias para que el administrador oculte reseñas (`ocultada_en`, `ocultada_por`, `motivo_ocultacion`) |
| 037 | Funciones para el visor de auditoría (`auditoria_listar`, `auditoria_detalle`, `auditoria_opciones`) y para la salud de la base (`estado_base_datos`) |
| 038 | Tabla `alerta_seguridad` y la función `analizar_alertas_seguridad` |

## 4. Cómo se expone `auditoria_cambio`

Con funciones `SECURITY DEFINER` propiedad de `learnity_owner`. Es el mismo patrón que `historial_resena` (migración 031), que ya funciona.

- Solo `learnity_app` puede ejecutarlas.
- Las funciones no construyen SQL con texto: todos los filtros llegan como parámetros, así que no hay inyección posible.
- Cada llamada devuelve como mucho 100 filas.
- Que solo un administrador pueda pedirlas lo controla el backend con `autorizar('ADMIN')`.

Alternativas descartadas:

| Alternativa | Por qué se descarta |
|---|---|
| Dar `SELECT` sobre la tabla a `learnity_app` | Rompe el diseño de la 020: la app podría leer toda la auditoría |
| Un segundo pool conectado como `learnity_lectura` | Habría que darle login y custodiar una contraseña más en cada máquina |
| Hacer `learnity_app` miembro de `learnity_lectura` | Le daría lectura de casi todo el esquema |

En el visor, el filtro **"Rol"** se interpreta como el rol de PostgreSQL que hizo el cambio (`learnity_app`, `postgres`…).

## 5. Plan de lotes

| Lote | Contenido | Migración |
|---|---|---|
| 0 | Poner al día `matriz_privilegios.sql` | — |
| 1 | Registro de accesos y vista Accesos | 032 |
| 2 | Usuarios: alta, detalle, desbloqueo y cierre de sesiones | 032 |
| 3 | Solicitudes: revocar el rol docente | 033 |
| 4 | Revisión: todos los cursos por estado y suspensión | 034 |
| 5 | Categorías: icono y reasignación de cursos | 035 |
| 6 | Reseñas: acciones directas, filtros y corrección del fallo 1 | 036 |
| 7 | Auditoría, sesiones activas y salud de la base | 037 |
| 8 | Alertas de seguridad | 038 |
| 9 | Resumen del panel | — |

- Los lotes 3 a 6 son independientes entre sí.
- **Se recomienda empezar por 0 → 1 → 2**, porque las alertas se apoyan en ellos.

## 6. Decisiones pendientes

| # | Pregunta | Recomendación |
|---|---|---|
| 1 | ¿Cómo recibe su contraseña un usuario creado por el administrador? | **Invitación por correo** con un enlace válido 72 horas, en lugar de una contraseña temporal fijada por el administrador. Así el administrador nunca conoce la contraseña |
| 2 | ¿Qué pasa con los estudiantes inscritos en un curso suspendido? | **Pierden el acceso** mientras dure la suspensión y conservan su progreso. Es lo que ya ocurre hoy, porque solo pueden abrir cursos publicados |
| 3 | ¿Qué pasa con los cursos de un docente revocado? | **Siguen publicados**, pero el docente ya no puede editarlos. Si hace falta, el administrador los suspende uno a uno |
| 4 | ¿Qué se registra de las renovaciones de sesión (`REFRESH`)? | **Solo los fallos.** Si se registraran también las correctas, habría una fila cada 15 minutos por pestaña abierta |

## 7. Riesgo de coordinación

- Estos lotes tocan `identidad`, `usuarios`, `cursos` y `resenas`, que tienen otros dueños en el sprint. Conviene confirmarlo con el coordinador.
- Antes de empezar, hay que integrar `sprint4/elian-estructura`, para no mezclar los movimientos de carpetas con lógica nueva.

---

**¿Por qué lote empiezo, y qué decides en los puntos 1 a 4?**
