# Sprint 2 — integrante 4: Angular Docente y Admin

## Objetivo y límite de tu trabajo

Conectar las pantallas docentes y administrativas existentes a la API real para que un docente cree un curso con PDF, lo envíe y un ADMIN lo apruebe o rechace. Trabaja en `frontend/src/app/pages/docente/mis-cursos/`, `editor-curso/`, `frontend/src/app/pages/admin/revision-curso/` y servicios Angular relacionados. **Catálogo y detalle públicos ya funcionan con PostgreSQL**; no rehagas esas pantallas.

## Acuerdos previos con backend

Con el integrante 2, fija cuerpos JSON, respuesta y errores para mis cursos, crear/editar curso, módulo, lección y envío a revisión. Con el integrante 3, fija cola, detalle de revisión, decisión ADMIN y subida de PDF. Si una ruta aún no existe, crea el cliente tipado y la UI, pero no marques la historia como terminada hasta probarla con la API real.

## Trabajo ordenado

1. **Mis cursos:** consumir `GET /api/docente/cursos`; mostrar estado (`BORRADOR`, `EN_REVISION`, `PUBLICADO`, `RECHAZADO`) y motivo de rechazo. Añadir estados de carga, lista vacía, error y reintento.
2. **Editor:** crear y guardar curso con `POST /api/cursos` y `PUT /api/cursos/:id`; agregar/editar módulos y lecciones con las rutas acordadas. Mostrar errores del servidor junto al campo correspondiente. El servidor decide la propiedad y los límites; la UI también orienta al usuario.
3. **PDF y envío:** subir el archivo con `multipart/form-data` a `POST /api/lecciones/:id/archivo`, mostrar progreso/error y el estado de archivo asociado. Ofrecer envío a revisión; actualizar el estado solo cuando la API confirme. Desactivar edición de `EN_REVISION` y `PUBLICADO`.
4. **Administración:** consumir la cola `EN_REVISION`, mostrar contenido y estado de PDF; permitir aprobar o rechazar con motivo. Mostrar fallo si otro ADMIN ya decidió o el curso dejó de ser válido.
5. **Integración:** quitar `datos-demo.ts` del recorrido de estas pantallas. Reutilizar la sesión existente para el token Bearer; no guardar tokens en `localStorage`. Probar la navegación real de DOCENTE y ADMIN.

## Criterios de aceptación

- Un docente crea un curso propio, módulos y una lección `DOCUMENTO`, sube su PDF y lo envía a revisión; errores y validaciones se entienden desde la pantalla.
- Otro docente no puede abrir ni modificar el borrador por URL. Un curso en revisión no parece editable.
- ADMIN ve la cola, aprueba y el curso aparece en el catálogo público; si rechaza, el docente ve el motivo y puede corregir y reenviar.
- Compilación y pruebas Angular pasan. La demostración usa PostgreSQL y API reales; ninguna tarjeta o cambio de estado se simula en memoria.

## Entrega al grupo

Comparte con el integrante 2 los campos que el editor necesita y con el 3 la forma de subir/mostrar PDF y tomar decisiones. Si el backend cambia un contrato, actualiza los tipos y las pruebas de Angular. El integrante 1 mantiene el catálogo público y puede ayudar a probar el recorrido final.
