// modules/identidad/index.ts: API pública del módulo Identidad.
// app.ts, server.ts y otros módulos SOLO importan desde aquí.
export { identidadRoutes } from './identidad.routes.js';
export { HORAS_INVITACION, identidadApi } from './identidad.service.js';
export type { ServicioIdentidad } from './identidad.service.js';
export type {
  CuentaBloqueada,
  EventoAcceso,
  FiltroAccesos,
  FiltroSesiones,
  MotivoAcceso,
  PasoAcceso,
  SesionActiva,
  SesionActivaDeCuenta,
} from './identidad.repository.js';
