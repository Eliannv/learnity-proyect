# Sprint 3 · contrato y dependencias de Aprendizaje

El contrato ejecutable está en `docs/api/openapi.yaml`, generado desde `backend/src/shared/http/openapi-aprendizaje.ts` con `npm run api:serializar` (cwd `backend/`). El frontend puede generar sus tipos desde ese archivo. La rama `sprint3/integrante4` no toca `frontend/` ni las migraciones asignadas a Melissa.

| Ruta | Resultado principal |
| --- | --- |
| `POST /api/cursos/:id/inscripcion` | `201` nueva, `200` repetida; mismo objeto `InscripcionAprendizaje`. Solo ESTUDIANTE y curso PUBLICADO. |
| `GET /api/mi-aprendizaje` | `{ items: CursoInscrito[] }`, solo cursos que siguen publicados. |
| `GET /api/mi-aprendizaje/cursos/:id` | Ficha, inscripción y módulos/lecciones con PDF y progreso; `404` si no hay inscripción. |
| `PUT /api/lecciones/:id/progreso` | Acepta `segundosVistos` (0–86400) y/o `completada`; devuelve posición, porcentaje, estado y última lección. |
| `GET /api/docente/cursos/:id/estudiantes` | Paginación (`pagina`, `limite`), nombres, porcentajes y resumen. Solo docente propietario o ADMIN. |

## Trabajo que debe integrar Melissa antes de considerar listo el Sprint 3

1. Una migración **numerada y reversible** debe conceder a `learnity_app` `SELECT, INSERT, UPDATE` sobre `inscripcion` y `progreso_leccion`. La migración 019 concede solo `SELECT` a `inscripcion` y ninguno a `progreso_leccion`. Se comprobó en `learnity_test`: las cuatro capacidades de escritura/lectura de progreso consultadas con `has_table_privilege` dieron `false`. No cambiar `Learnity` ni conceder permisos manualmente fuera de una migración.
2. Para `ultimaActividadEn` real, añadir y mantener una marca temporal de actividad de la inscripción y coordinar con el dueño de Aprendizaje el cambio de lectura. El contrato devuelve `null` de forma honesta hasta integrarla; el porcentaje y la fecha de inscripción sí son reales.
3. Contenido puede importar `aprendizajeApi.estaInscritoEnCurso(idPersona, idCurso)` desde `modules/aprendizaje/index.ts` al ampliar `GET /api/archivos/:id`. Debe comprobar además que el PDF corresponde a la lección y al mismo curso; ningún módulo importa `aprendizaje.repository.ts`.
4. El detalle privado ya reserva `youtubeVideoId`, que devuelve `null` hasta incorporar la migración y el dato validado de YouTube. Melissa debe comunicar el nombre de la columna; el coordinador actualiza la consulta de Aprendizaje. No activar la reproducción real de VIDEO antes de esa integración.

## Verificación disponible

`npm run build`, `npm run typecheck` y `npm run api:verificar` pasan. El test HTTP de Aprendizaje ejecutado con **el rol ampliado de fixtures**, únicamente en `learnity_test`, pasó 4/4; cubre inscripción simultánea e idempotente, persistencia tras otra sesión, permisos y seguimiento. Ese rol de fixtures no representa los privilegios reales de la aplicación: con `learnity_app` el mismo test falla por los permisos pendientes de la migración. Tras aplicarla en `learnity_test`, repetir `npx tsx --env-file=.env.test --test test/aprendizaje.test.ts` **sin** `PGOPTIONS` y luego `npm test`.
