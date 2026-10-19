# Sprint 2 — integrante 2: Backend Cursos

## Objetivo y límite de tu trabajo

El docente autenticado puede crear y editar sus cursos, módulos y lecciones, y enviarlos a revisión. **Las tres rutas públicas (`GET /api/categorias`, `GET /api/cursos`, `GET /api/cursos/:id`) ya están implementadas por el integrante 1**; no las rehagas. Conserva su contrato y ejecuta las pruebas al integrar tus cambios.

Trabaja principalmente en `backend/src/modules/cursos/` y en las pruebas de ese módulo. El repositorio contiene `routes → controller → service → repository`; conserva esa separación y consultas SQL parametrizadas. Si necesitas una migración, crea un SQL numerado en `database/` y coordínalo con el grupo.

## Acuerdos que debes cerrar al empezar

1. Con el integrante 4, fija JSON, errores y rutas para crear/editar curso, módulo y lección. Los endpoints de edición y eliminación no están cerrados; define solo los que exige el editor real.
2. Con el integrante 3, fija la interfaz del **servicio de Cursos** para comprobar propiedad y estado de una lección y para decidir una revisión. Administración y Contenido no deben importar `cursos.repository.ts`.
3. Define el ciclo `BORRADOR → EN_REVISION → PUBLICADO/RECHAZADO` y la corrección `RECHAZADO → EN_REVISION`. Un curso en revisión o publicado no se edita.

## Entregas

| Prioridad | API / regla | Resultado |
|---|---|---|
| 1 | `GET /api/docente/cursos` | Solo cursos del docente autenticado; incluye estado y motivo de rechazo cuando corresponda. |
| 2 | `POST /api/cursos`, `PUT /api/cursos/:id` | Crear borrador y editar únicamente uno propio en estado editable. Validar título, categoría activa, nivel, longitud de campos y arreglos. |
| 3 | `POST /api/cursos/:id/modulos`, `POST /api/modulos/:id/lecciones` más edición/eliminación mínima | Verificar propietario del curso incluso cuando llega un ID de módulo/lección; respetar orden único y límites 1–10 módulos y 1–12 lecciones por módulo. |
| 4 | `POST /api/cursos/:id/enviar-revision` | Revalidar curso completo y archivos requeridos; cambiar de estado de forma atómica; impedir doble envío y edición posterior. |
| 5 | Operaciones del servicio para integrantes 3 y 4 | Permitir a Administración decidir solo cursos `EN_REVISION`; permitir a Contenido validar dueño y estado de una lección. Documentar sus tipos y errores. |

La regla de completitud acordada en [`SPRINT_2_LEARNITY.md`](SPRINT_2_LEARNITY.md) exige título, subtítulo, descripción, categoría, nivel, portada, tres objetivos, 1–10 módulos y 1–12 lecciones por módulo. En este sprint, el curso publicable necesita al menos una lección `DOCUMENTO` con PDF válido. Los cursos sintéticos `[Prueba Sprint 2]` de la base local sirven **solo** para probar el catálogo y no demuestran este flujo de aprobación.

## Seguridad y casos que debes probar

- Exigir `autenticar` y rol `DOCENTE` en cada ruta privada. Nunca usar un ID de docente enviado por Angular como prueba de propiedad: resolverlo desde la sesión y verificarlo en el servicio.
- Docente A crea/edita su borrador; docente B y ESTUDIANTE reciben denegación. Probar también IDs de módulo y lección de otro docente y URL directa del borrador.
- Rechazar orden duplicado, módulo 11, lección 13, categoría inactiva, nivel inválido y datos demasiado largos. Evitar estados intermedios con transacciones en operaciones compuestas.
- Curso incompleto o sin PDF: no entra en revisión. Curso completo: entra y queda bloqueado. Un rechazado se corrige y reenvía; al reenviar se limpia el motivo anterior.
- Mantener pasando `npm run build`, `npm run typecheck`, las pruebas del módulo y las lecturas públicas. Actualizar OpenAPI y README de las rutas que agregues.

## Entrega al grupo

Comparte con integrantes 3 y 4 el contrato privado acordado, ejemplos de peticiones/respuestas y una cuenta DOCENTE de prueba. Indica qué rutas están listas y qué errores devuelven. El integrante 1 ya cerró su prueba del catálogo público; solo tendrá que repetirla si cambias los datos o el contrato de esas rutas.
