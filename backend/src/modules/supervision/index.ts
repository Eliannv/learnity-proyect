// API pública del módulo Supervisión: lo que el administrador consulta para vigilar la plataforma
// (registro de accesos y cuentas bloqueadas; después, auditoría, alertas, sesiones y resumen).
export { supervisionRoutes } from './supervision.routes.js';
export type { AccesoAdmin, CuentaBloqueadaAdmin, PaginaAccesos } from './supervision.modelo.js';
