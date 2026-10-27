// API pública del módulo Aprendizaje; otros módulos nunca importan su repositorio.
export { aprendizajeRoutes } from './aprendizaje.routes.js';
export { aprendizajeApi } from './aprendizaje.service.js';
export type { ContextoLeccionInscrita, ServicioAprendizaje } from './aprendizaje.service.js';
export type {
  CursoInscrito, DetalleAprendizaje, InscripcionResumen, ProgresoGuardado, SeguimientoDocente,
} from './aprendizaje.modelo.js';
