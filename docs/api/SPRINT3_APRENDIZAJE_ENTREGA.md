# Sprint 3 · inscripción y aprendizaje

El contrato ejecutable está en `docs/api/openapi.yaml`. Se genera desde `backend/src/shared/openapi/openapi-aprendizaje.ts` y `openapi-gestion-cursos.ts` con `npm run api:serializar` en `backend/`; los tipos Angular se generan con `npm run api:tipos` en `frontend/`.

| Ruta | Resultado |
| --- | --- |
| `POST /api/cursos/:id/inscripcion` | `201` nueva o `200` repetida. Solo ESTUDIANTE y curso PUBLICADO. |
| `GET /api/mi-aprendizaje` | Cursos publicados en los que está inscrito el estudiante. |
| `GET /api/mi-aprendizaje/cursos/:id` | Lecciones DOCUMENTO y VIDEO, PDF asociado, YouTube ID y progreso del estudiante. |
| `PUT /api/lecciones/:id/progreso` | Guarda posición y finalización; persiste entre sesiones. |
| `GET /api/docente/cursos/:id/estudiantes` | Seguimiento paginado del curso propio o de ADMIN. |
| `GET /api/lecciones/:id/video-preview` | Solo vídeo marcado como muestra de un curso PUBLICADO; los demás devuelven 404. |

La migración reversible `027_aprendizaje_youtube` concede a `learnity_app` los permisos mínimos de inscripción y progreso, agrega `leccion.youtube_video_id` validado y `inscripcion.ultima_actividad_en`. Está aplicada y probada en `learnity_test`; **no se ha aplicado a `Learnity` ni a un servidor**. Antes de desplegar, se debe ejecutar el protocolo de respaldo y migración de `database/README.md` sobre el entorno de destino.

El frontend ofrece inscripción desde el catálogo, «Mi aprendizaje», lección PDF o YouTube y seguimiento docente. Los PDF se reciben solo por el endpoint autenticado y no se exponen rutas físicas. La reproducción usa IDs de YouTube validados; la vista previa pública requiere aprobación del docente (`vistaPrevia`).

Verificación local: `npm run build`, `npm run typecheck`, `npm run api:verificar` en `backend/`; `npm run build` y `npm test -- --watch=false` en `frontend/`; `npm test` en `backend/` con `backend/.env.test` apuntando exclusivamente a `learnity_test`. Anotar el resultado de la última ejecución antes de publicar la rama.
