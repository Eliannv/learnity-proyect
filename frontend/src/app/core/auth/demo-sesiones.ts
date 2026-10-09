import type { Rol, Sesion } from './sesion.model';

/**
 * MODO DEMOSTRACIÓN (environment.modoDemo).
 * Sesiones simuladas con las mismas cuentas que crea `npm run db:seed` en el backend.
 * Permiten recorrer las pantallas por rol antes de que el login real esté terminado.
 * Cuando el Sprint 1 esté listo, pon modoDemo en false: este archivo deja de usarse.
 */
export const SESIONES_DEMO: Record<Rol, Sesion> = {
  ESTUDIANTE: {
    token: 'demo',
    demo: true,
    usuario: {
      idUsuario: 3,
      idPersona: 3,
      nombres: 'Rosa',
      apellidos: 'Vera Chávez',
      correo: 'rosa.vera@correo.com',
      fotoUrl: null,
      roles: ['ESTUDIANTE'],
    },
  },
  DOCENTE: {
    token: 'demo',
    demo: true,
    usuario: {
      idUsuario: 2,
      idPersona: 2,
      nombres: 'Carlos',
      apellidos: 'Mendoza Ruiz',
      correo: 'carlos.mendoza@correo.com',
      fotoUrl: null,
      roles: ['ESTUDIANTE', 'DOCENTE'],
    },
  },
  ADMIN: {
    token: 'demo',
    demo: true,
    usuario: {
      idUsuario: 1,
      idPersona: 1,
      nombres: 'Ana',
      apellidos: 'Torres',
      correo: 'ana.torres@learnity.com',
      fotoUrl: null,
      roles: ['ESTUDIANTE', 'ADMIN'],
    },
  },
};
