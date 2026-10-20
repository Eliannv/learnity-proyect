// modules/revision/index.ts — API pública del módulo Revisión.
// app.ts y otros módulos SOLO importan desde aquí.
export { revisionRoutes } from './revision.routes.js';
export type { CursoDetalle, CursoResumen, DecisionRevision } from './revision.modelo.js';
