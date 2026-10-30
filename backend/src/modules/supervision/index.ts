// API pública del módulo Supervisión: lo que el administrador consulta para vigilar la plataforma
// (accesos, cuentas bloqueadas, auditoría, salud de la base y sesiones; después, alertas y resumen).
export { supervisionRoutes } from './supervision.routes.js';
export type {
  AccesoAdmin, CambioAuditoria, CuentaBloqueadaAdmin, DetalleCambioAuditoria, EstadoBaseDatos, PaginaAccesos, PaginaAuditoria,
  PaginaSesiones, SesionAdmin,
} from './supervision.modelo.js';
