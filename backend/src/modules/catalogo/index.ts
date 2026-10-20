// modules/catalogo/index.ts — API pública del módulo Catálogo.
// app.ts y otros módulos SOLO importan desde aquí.
export { catalogoRoutes } from './catalogo.routes.js';
export type {
  CategoriaPublica,
  CursoPublico,
  CursoPublicoDetalle,
  FiltrosPublicos,
  NivelCurso,
  OrdenCatalogo,
} from './catalogo.modelo.js';
