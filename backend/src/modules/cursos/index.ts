// modules/cursos/index.ts — API pública del módulo Cursos.
// app.ts y otros módulos SOLO importan desde aquí.
export { cursosRoutes } from './cursos.routes.js';
export { cursosApi } from './cursos.service.js';
export type { ServicioCursos } from './cursos.service.js';
export type {
  ArchivoPdf,
  ContextoCurso,
  ContextoLeccion,
  CursoDetalle,
  CursoResumen,
  DecisionRevision,
  EstadoCurso,
  LeccionPrivada,
  ModuloPrivado,
  ProblemaCurso,
  TipoLeccion,
} from './cursos.modelo.js';
export { registrarLiberadorArchivos } from './puertos.js';
export type { LiberadorArchivos } from './puertos.js';
