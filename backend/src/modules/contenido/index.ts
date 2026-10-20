// modules/contenido/index.ts — API pública del módulo Contenido.
// app.ts, server.ts y otros módulos SOLO importan desde aquí.
export { contenidoRoutes } from './contenido.routes.js';
export { contenidoApi } from './contenido.service.js';
export type { ServicioContenido } from './contenido.service.js';
export { liberadorArchivos } from './contenido-limpieza.service.js';
