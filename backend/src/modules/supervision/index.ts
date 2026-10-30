// API pública del módulo Supervisión: lo que el administrador consulta para vigilar la plataforma
// (resumen, accesos, cuentas bloqueadas, auditoría, salud de la base, sesiones y alertas).
export { supervisionRoutes } from './supervision.routes.js';
export type {
  AccesoAdmin, CambioAuditoria, CuentaBloqueadaAdmin, DetalleCambioAuditoria, EstadoBaseDatos, PaginaAccesos, PaginaAuditoria,
  PaginaSesiones, SesionAdmin, AlertaSeguridad, PaginaAlertas, ResumenAdmin,
} from './supervision.modelo.js';
