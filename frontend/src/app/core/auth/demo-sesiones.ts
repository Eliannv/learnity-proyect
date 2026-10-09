import type { Rol, Sesion } from './sesion.model';

/**
 * MODO DEMOSTRACIÓN (environment.modoDemo).
 * Sesiones simuladas con las mismas cuentas que crea `npm run db:seed` en el backend.
 * Permiten recorrer las pantallas por rol antes de que el login real esté terminado.
 * Con modoDemo en false (valor por defecto) este archivo no se usa.
 */
export const SESIONES_DEMO: Record<Rol, Sesion> = {
  ESTUDIANTE: {
    accessToken: 'demo',
    expiraEn: '2099-01-01T00:00:00.000Z',
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
    accessToken: 'demo',
    expiraEn: '2099-01-01T00:00:00.000Z',
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
    accessToken: 'demo',
    expiraEn: '2099-01-01T00:00:00.000Z',
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
