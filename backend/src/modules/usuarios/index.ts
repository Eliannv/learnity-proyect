// modules/usuarios/index.ts: API pública del módulo Usuarios.
// app.ts y otros módulos SOLO importan desde aquí.
export { usuariosRoutes } from './usuarios.routes.js';
export type { EstadoSolicitud, SolicitudDocente } from './usuarios.modelo.js';
