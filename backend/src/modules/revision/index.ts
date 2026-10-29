// modules/revision/index.ts — API pública del módulo Revisión.
// «Revisión» es la aprobación de cursos: el administrador aprueba o rechaza un curso antes de publicarlo.
// No confundir con `resenas` (valoraciones de 1 a 5 estrellas que dejan los estudiantes).
// app.ts y otros módulos SOLO importan desde aquí.
export { revisionRoutes } from './revision.routes.js';
export type { CursoDetalle, CursoResumen, DecisionRevision } from './revision.modelo.js';
