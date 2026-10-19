# Sprint 2 — integrante 3: Administración y PDF

## Objetivo y límite de tu trabajo

Un ADMIN puede revisar y decidir cursos enviados; un DOCENTE puede subir el PDF principal de una lección propia y recuperarlo únicamente con autorización. Trabaja en `backend/src/modules/administracion/` y `backend/src/modules/contenido/`, con sus pruebas. Las rutas públicas ya están implementadas y el integrante 2 se encarga de la creación/edición de cursos.

## Dependencias que debes acordar primero

Con el integrante 2, define métodos del **servicio de Cursos** para: localizar curso y dueño a partir de una lección, comprobar estado editable y ejecutar la transición `EN_REVISION → PUBLICADO/RECHAZADO`. Llama a esos métodos desde Administración y Contenido; no leas ni escribas directamente `cursos.repository.ts` desde otro módulo. Con el integrante 4, acuerda la respuesta JSON y los errores de la cola, decisión y subida de archivo.

## Entrega A: revisión administrativa

1. Implementa `GET /api/admin/cursos?estado=EN_REVISION`, una vista de detalle para revisar temario y estado de PDF, y `PUT /api/admin/cursos/:id/revision` con decisión y motivo cuando se rechaza. El cuerpo exacto se acuerda con Angular; ejemplo: `{ "decision": "APROBAR" }` o `{ "decision": "RECHAZAR", "motivo": "Falta contenido" }`.
2. Exige sesión y rol `ADMIN` en todas esas rutas. Antes de aprobar, el servicio de Cursos revalida completitud y PDF. Cambia estado, `revisado_por`, `publicado_en` o `motivo_rechazo` en una operación atómica que impida dos decisiones sobre la misma revisión.
3. Prueba: solo ADMIN ve y decide; rechazo sin motivo y curso incompleto fallan; doble decisión falla; el aprobado aparece en el catálogo y el rechazado no. Un rechazado puede volver a edición y revisión según la regla acordada con el integrante 2.

## Entrega B: PDF privado

1. Implementa `POST /api/lecciones/:id/archivo` para un PDF principal de lección `DOCUMENTO`, máximo 10 MB. Comprueba propietario y estado editable **en el servidor** antes de aceptar el archivo. Valida tamaño, extensión y contenido PDF real; no confíes solo en el MIME del navegador.
2. Guarda con nombre generado por el backend en un directorio fuera de `frontend/public` y de cualquier ruta estática. Registra `archivo` y asocia `leccion.id_archivo`; si falla BD o disco, limpia el resultado parcial. Al reemplazar, evita archivos huérfanos. Comprueba que el archivo y la lección pertenecen al mismo curso.
3. Implementa `GET /api/archivos/:id` con autorización: en Sprint 2 solo ADMIN o DOCENTE propietario. Un visitante, estudiante o docente ajeno no puede descargarlo, aunque adivine el ID. No incluyas `archivo.ruta` en respuestas públicas ni logs.
4. Prueba PDF válido, archivo falso con extensión `.pdf`, otro tipo, 10 MB excedidos, curso bloqueado, docente ajeno, ID enumerado y fallo de asociación. La lectura para estudiantes inscritos queda para Sprint 3.

## Entrega al grupo

Comparte con el integrante 4 el contrato final de cola, detalle, decisión, subida y errores. Entrega pruebas de permisos y archivo, y actualiza OpenAPI/README. Los cursos `[Prueba Sprint 2]` sembrados para el catálogo no prueban revisión ni PDF: demuestra este recorrido con un curso creado por el integrante 2.
