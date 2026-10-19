# Sprint 2 de Learnity — catálogo, curso y publicación

**Estado comprobado el 9 de octubre de 2026.** Angular Público consume un servicio HTTP tipado y las rutas `GET /api/categorias`, `GET /api/cursos`, `GET /api/cursos/:id` ya leen PostgreSQL. El contrato está en [`CONTRATO_API_PUBLICA_SPRINT_2.md`](CONTRATO_API_PUBLICA_SPRINT_2.md). Con datos locales, la API mostró 3 publicados en 2 páginas, filtros combinados, detalle y 404 para un borrador; el navegador mostró catálogo, filtro, búsqueda, detalle y «Curso no disponible» para el borrador. Backend compila y pasa typecheck; Angular compila y sus 6 pruebas pasan. Las 6 pruebas nuevas del módulo público también pasaron contra PostgreSQL local con filas temporales que se eliminaron al terminar. La suite completa `npm test` contra `learnity_test` no se pudo ejecutar: `.env.test` apunta al puerto 5499 y esa base no existe en el PostgreSQL local.

**Pendiente de calidad de Angular Público:** ejecutar toda la suite del backend en la base aislada `learnity_test` cuando se configure y, si se desea comprobar el paginador visible con límite 9, disponer de más de nueve cursos publicados de prueba. El control de acceso ya se aplica en SQL; el filtro Angular sigue siendo una defensa adicional. La prueba de Gmail del Sprint 1 confirmó el envío por la API según el comando ejecutado por el equipo; aún falta confirmar recepción y enlace en el buzón.

## Alcance comprometido (P0)

1. Catálogo público con cursos `PUBLICADO`, búsqueda, filtros de categoría/nivel, paginación y detalle con temario.
2. Docente autenticado: crear y editar **sus propios** cursos en `BORRADOR`, módulos y lecciones; subir un PDF principal seguro para una lección; enviar curso completo a revisión.
3. Administrador autenticado: listar cursos `EN_REVISION`, ver su contenido, aprobar o rechazar con motivo. Un curso en revisión queda bloqueado para edición.
4. Angular conectado a la API para estas pantallas, sin `datos-demo.ts` en el recorrido del sprint.
5. Pruebas de permisos, reglas de estado y recorrido docente → administrador → visitante.

La revisión de un curso requiere archivos válidos. Por eso el sprint adelanta **solo la subida mínima de PDF**, limitada a 10 MB, para que la publicación sea un flujo real. Para la portada puede elegirse una imagen incluida y controlada en los recursos del proyecto; la subida de portadas queda como mejora secundaria. Video, PowerPoint, adjuntos, progreso e inscripción continúan en el Sprint 3. Si no se logra la subida segura de PDF, no se debe saltar la validación para publicar: el sprint terminaría con borradores y catálogo, y la publicación se replanifica explícitamente.

## Distribución para cuatro integrantes

| Integrante | Área y archivos propios | Trabajo principal | Entrega verificable |
|---|---|---|---|
| **1. Tú: Angular Público** | `frontend/src/app/pages/publico/catalogo/` y `detalle-curso/`; lecturas públicas de Cursos | **Hecho e integrado con PostgreSQL local.** Mantener el contrato y apoyar la prueba final del recorrido completo. | Catálogo y detalle reales; borrador ausente incluso por URL directa. |
| **2. Backend Cursos** | `backend/src/modules/cursos/` | Implementar solo las rutas privadas: creación/edición de cursos, módulos y lecciones; propiedad y estados. Exponer al módulo Administración una operación de decisión que valide la transición. | API y pruebas: solo se edita el curso propio en estado permitido. Ver [`INTEGRANTE_2_BACKEND_CURSOS_SPRINT_2.md`](INTEGRANTE_2_BACKEND_CURSOS_SPRINT_2.md). |
| **3. Backend Administración y PDF** | `backend/src/modules/administracion/` y `backend/src/modules/contenido/` | Implementar cola y decisión ADMIN, y subida/lectura privada del PDF principal. Coordinar con Cursos el acceso a las operaciones de negocio y la asociación archivo–lección. | Pruebas de autorización, estados y PDF. Ver [`INTEGRANTE_3_ADMIN_PDF_SPRINT_2.md`](INTEGRANTE_3_ADMIN_PDF_SPRINT_2.md). |
| **4. Angular Docente y Admin** | `frontend/src/app/pages/docente/mis-cursos/`, `editor-curso/` y `pages/admin/revision-curso/` | Conectar las pantallas existentes con las APIs de los integrantes 2 y 3; crear/editar curso, módulos y lecciones, subir PDF, enviar a revisión y resolver la cola. | Recorrido desde las pantallas. Ver [`INTEGRANTE_4_ANGULAR_DOCENTE_ADMIN_SPRINT_2.md`](INTEGRANTE_4_ANGULAR_DOCENTE_ADMIN_SPRINT_2.md). |

**Regla de colaboración:** cada integrante es responsable de pruebas de su área. Antes de integrar, Backend Cursos y Backend Administración acuerdan contratos de servicio y transacciones; tú y el integrante de Angular Docente/Admin acuerdan con ellos formas JSON, errores y rutas. No asignar el testing a una sola persona.

### Qué hacer primero desde el estado actual

1. **Hoy, integrantes 2, 3 y 4:** acordar cuerpos y errores de las rutas privadas y los métodos de servicio entre Cursos, Administración y Contenido. Mantener el contrato público ya implementado.
2. **En paralelo, integrantes 2 y 3:** el 2 implementa edición/estados; el 3 prepara la subida privada de PDF y la cola ADMIN. Definir primero cómo localizar el curso dueño de una lección y cómo mantener consistentes archivo y BD.
3. **Integrante 4:** conectar el editor y la revisión a medida que estén disponibles las rutas; puede construir los servicios Angular tipados y los estados de formulario siguiendo el contrato acordado.
4. **Tú:** las lecturas públicas ya están integradas; ayuda en la demostración docente → ADMIN → visitante y repite la prueba del catálogo si los compañeros cambian su contrato. La recepción de Gmail se verifica aparte como cierre del Sprint 1.

### Dificultad aproximada, de menor a mayor

| Orden | Trabajo | Dificultad | Dependencia principal |
|---|---|---|---|
| 1 | Acordar contrato JSON y criterios de aceptación | Baja, pero muy importante | Decisión conjunta del equipo |
| 2 | Listar categorías activas desde PostgreSQL | **Hecho** | Base y permisos funcionando |
| 3 | Conectar catálogo y detalle Angular a la API | **Hecho, probado con PostgreSQL local** | Endpoints de lectura |
| 4 | Búsqueda, filtros y paginación | **Hecho en frontend y backend** | 6 pruebas con PostgreSQL local; suite general pendiente de `learnity_test` |
| 5 | Crear/editar borradores, módulos y lecciones | Media–alta | Reglas de propiedad, orden y estados |
| 6 | Revisión y aprobación administrativa | Alta | Curso completo, permisos y transiciones de estado |
| 7 | Subida privada de PDF con validación real | Alta | Archivo, base de datos, acceso y manejo de errores |

**Importancia y dificultad son distintas:** el contrato es fácil pero debe resolverse primero; la subida PDF es difícil y puede desarrollarse en paralelo una vez acordado cómo se asociará a una lección.

## Trabajo 4 completado y backlog restante

### 4. Búsqueda, filtros y paginación — completado por integrante 1

- Están implementados `GET /api/categorias`, `GET /api/cursos` y `GET /api/cursos/:id` en repositorio, servicio, controlador y rutas. Filtran publicados desde SQL, buscan título/subtítulo/descripción, aceptan categoría y nivel repetidos, ordenan y paginan con conteo correcto. El detalle no expone archivos privados y responde 404 para borradores.
- `npm run db:seed-publico` creó 3 publicados y 1 borrador sintéticos en la base local. La prueba HTTP verificó categorías, filtros combinados, paginación, detalle, 404 y parámetros inválidos; la pantalla Angular mostró el catálogo, el filtro y el detalle real.
- **Pruebas:** pasaron las 6 pruebas HTTP del módulo público contra PostgreSQL local. Queda crear/configurar la base separada `learnity_test` para ejecutar la suite general con `npm test`. Los datos sintéticos permiten probar lecturas públicas, pero no sustituyen la demostración de crear y aprobar un curso por los integrantes 2–4.

### 5. Cursos, módulos y lecciones — integrante 2; interfaz del integrante 4

- Implementar `GET /api/docente/cursos`, `POST /api/cursos`, `PUT /api/cursos/:id`, `POST /api/cursos/:id/modulos`, `POST /api/modulos/:id/lecciones` y los endpoints mínimos de edición/eliminación que necesite el editor real. Fijar primero sus cuerpos JSON y códigos de error con el integrante 4.
- Exigir sesión y rol DOCENTE en las rutas; comprobar en el servicio que el curso pertenece al docente para **cada** operación, también cuando se llega por ID de módulo o lección. Una URL ajena debe responder 403 o 404 de forma consistente. Permitir edición en `BORRADOR` y `RECHAZADO` para corregir un rechazo; bloquear `EN_REVISION` y `PUBLICADO`.
- Validar título, categoría existente/activa, nivel, campos y límites de orden: 1–10 módulos, 1–12 lecciones por módulo, sin posiciones duplicadas. Usar transacciones para operaciones compuestas. Implementar `POST /api/cursos/:id/enviar-revision` con validación de completitud, incluido el PDF requerido para una lección DOCUMENTO.
- **Pruebas de aceptación:** docente dueño crea/edita; otro docente y ESTUDIANTE no pueden hacerlo; IDs de módulo/lección ajenos se rechazan; órdenes duplicados y límites inválidos se rechazan; curso incompleto no pasa a revisión; uno completo sí pasa y queda bloqueado.

### 6. Revisión y cambios de estado — integrante 3; regla de transición del integrante 2; interfaz del integrante 4

- Implementar `GET /api/admin/cursos?estado=EN_REVISION`, una vista de revisión con contenido necesario y `PUT /api/admin/cursos/:id/revision`. Acordar cuerpo de decisión, por ejemplo `{"decision":"APROBAR"}` o `{"decision":"RECHAZAR","motivo":"..."}`.
- Proteger con autenticación y rol ADMIN. Administración llama a una operación del servicio de Cursos que comprueba `EN_REVISION`, revalida completitud/archivos, cambia a `PUBLICADO` con `publicado_en` y `revisado_por`, o a `RECHAZADO` con motivo obligatorio. Hacer la transición de forma atómica para evitar dos decisiones concurrentes. Tras rechazo, el docente corrige y vuelve a enviar a revisión; al reenviar se limpia el motivo anterior.
- **Pruebas de aceptación:** ADMIN ve la cola y decide; DOCENTE/ESTUDIANTE reciben denegación; no se aprueba un curso incompleto o sin PDF válido; doble decisión o estado incorrecto falla; rechazo sin motivo falla; aprobado aparece en catálogo y rechazado no.

### 7. Subir y proteger PDF — integrante 3; integración con integrantes 2 y 4

- Implementar `POST /api/lecciones/:id/archivo` para **un PDF principal de lección DOCUMENTO** de hasta 10 MB. Limitar el tamaño de la petición, validar el contenido PDF en servidor además de extensión/MIME, rechazar otros tipos, generar nombre opaco y guardar fuera de cualquier directorio servido estáticamente. No permitir rutas aportadas por el cliente.
- Comprobar dueño del curso y estado editable antes de subir o reemplazar. Registrar en `archivo` y asociar `leccion.id_archivo` con consistencia entre BD y disco: si falla una parte, limpiar o revertir la otra. Evitar archivos huérfanos al reemplazar. Confirmar que el archivo corresponde al mismo curso que la lección.
- Implementar `GET /api/archivos/:id` con control de acceso servidor: en este sprint, DOCENTE propietario y ADMIN para revisión. La lectura para ESTUDIANTE inscrito se incorporará con inscripciones en Sprint 3. No exponer la ruta de disco en JSON, logs o `/public`.
- **Pruebas de aceptación:** PDF válido sube y se asocia; archivo de más de 10 MB, contenido falso, otro tipo, docente ajeno y curso bloqueado se rechazan; ID enumerado sin permiso no descarga; sustitución/fallo de BD no deja archivos públicos u huérfanos.

**Integrante 4 — interfaz transversal:** consumir las rutas 5–7 con servicios Angular tipados; mostrar validaciones y errores, estados de guardado y bloqueo de edición; permitir subir PDF y enviar a revisión solo cuando el servidor acepte; crear cola y decisión ADMIN. No dar por terminadas estas pantallas con `datos-demo.ts` ni con cambios de estado solo en memoria.

## Contratos API por confirmar ahora

Las tres rutas públicas ya están implementadas. Las rutas privadas siguen propuestas; el equipo debe cerrar sus cuerpos, respuestas y errores antes de implementarlas:

| Uso | Ruta propuesta | Acceso |
|---|---|---|
| Categorías activas | `GET /api/categorias` | Público |
| Catálogo y detalle | `GET /api/cursos`, `GET /api/cursos/:id` | Público; solo `PUBLICADO` |
| Mis cursos | `GET /api/docente/cursos` | DOCENTE |
| Curso | `POST /api/cursos`, `PUT /api/cursos/:id` | DOCENTE propietario |
| Temario | `POST /api/cursos/:id/modulos`, `POST /api/modulos/:id/lecciones` | DOCENTE propietario |
| PDF de lección | `POST /api/lecciones/:id/archivo`, `GET /api/archivos/:id` | DOCENTE propietario o ADMIN en este sprint |
| Enviar a revisión | `POST /api/cursos/:id/enviar-revision` | DOCENTE propietario |
| Cola y decisión | `GET /api/admin/cursos?estado=EN_REVISION`, `PUT /api/admin/cursos/:id/revision` | ADMIN |

Las rutas públicas deben paginar y usar parámetros SQL, nunca concatenar la búsqueda en la consulta. El servicio de Cursos es dueño de las reglas de estado; Administración coordina la decisión y registra quién revisó. La validación de archivos y el control de acceso son del servidor, no del formulario Angular.

## Reglas de aceptación

- Curso `BORRADOR` o `RECHAZADO` → `EN_REVISION` solo si tiene título, subtítulo, descripción, categoría, nivel, portada, al menos tres objetivos, 1–10 módulos y 1–12 lecciones por módulo. En este sprint, el curso demostrable incluye al menos una lección `DOCUMENTO` con PDF validado; una lección `VIDEO` solo sería publicable si se implementa su archivo en Sprint 3. Las evaluaciones solo se exigen cuando existan y se configuren; el editor de evaluaciones es del Sprint 4.
- El docente no edita un curso `EN_REVISION`; otro docente no modifica ni lee sus borradores por URL directa.
- Solo ADMIN puede pasar `EN_REVISION` a `PUBLICADO` o `RECHAZADO`; el rechazo incluye motivo. El catálogo no muestra borradores, rechazados ni archivados.
- PDF: máximo 10 MB, extensión y firma/contenido comprobados en backend, nombre de almacenamiento generado por el servidor, ruta privada y límite de petición. No confiar en el MIME que envía el navegador.
- La categoría y el docente deben existir; las operaciones compuestas usan transacciones cuando corresponda. Las respuestas de API tienen errores coherentes y OpenAPI actualizado.
- La demostración final se realiza con datos persistidos en PostgreSQL, no con tarjetas o listas hardcodeadas.

## Secuencia restante de la semana

| Día | Todos | Hito |
|---|---|---|
| **Primero** | Acordar cuerpos privados y operaciones entre Cursos, Administración y Contenido. Revisar recepción del correo Gmail como cierre separado del Sprint 1. | Contratos privados acordados y tareas pequeñas visibles. |
| **Después, en paralelo** | Integrante 2: edición/estados; integrante 3: PDF privado y revisión; integrante 4: servicios y pantallas docente/admin. Cada uno prueba su área. | Crear borrador mediante API; el catálogo público ya funciona. |
| **Integración** | Subir PDF, enviar curso, aprobar y verlo en catálogo y detalle. | Recorrido completo con cuentas de prueba y sin datos demo en esas pantallas. |
| **Cierre** | Corregir defectos, revisar permisos, actualizar OpenAPI/README, Sprint Review y retrospectiva. | Incremento demostrable y backlog del Sprint 3 ajustado. |

## Trabajo secundario (P1), solo tras terminar P0

- Solicitud real para pasar de Estudiante a Docente y aprobación por ADMIN (RF-05/RF-22). Para la demostración P0 ya existe una cuenta docente creada por el seed; la solicitud no se simula como función terminada.
- CRUD completo de categorías; el P0 puede usar categorías ya creadas en el seed.
- Reordenamiento sofisticado, portada subida desde la interfaz, indicadores del panel y filtros avanzados.

## Definition of Done del Sprint 2

Compila backend y frontend; las pruebas significativas pasan; endpoints y permisos se prueban en la API; la interfaz realiza el recorrido sin datos demo; OpenAPI y README reflejan lo implementado; no se exponen rutas de archivos ni credenciales; los cuatro integrantes participan en la revisión del incremento.
