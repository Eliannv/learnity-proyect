import { z } from 'zod';
import { idRuta, textoSeguro } from '../../shared/http/esquemas.js';

// Solicitudes para ser docente (RF-05 y RF-22)

export const ESTADOS_SOLICITUD = ['PENDIENTE', 'APROBADA', 'RECHAZADA'] as const;

export const parametrosSolicitud = z.object({ id: idRuta }).transform(({ id }) => id);

export const nuevaSolicitudDocente = z.strictObject({
  especialidad: z
    .string()
    .trim()
    .min(3, 'Escribe la especialidad o el tema (mínimo 3 caracteres).')
    .max(100, 'La especialidad debe tener como máximo 100 caracteres.'),
  motivo: z
    .string()
    .trim()
    .min(50, 'Cuéntanos tu motivación en al menos 50 caracteres.')
    .max(2000, 'La motivación debe tener como máximo 2000 caracteres.'),
});

export const filtroSolicitudes = z.strictObject({
  estado: z.enum(ESTADOS_SOLICITUD).default('PENDIENTE'),
});

export const decisionSolicitud = z.discriminatedUnion('decision', [
  z.strictObject({ decision: z.literal('APROBAR') }),
  z.strictObject({
    decision: z.literal('RECHAZAR'),
    observacion: z
      .string()
      .trim()
      .min(1, 'Escribe la observación para que la persona sepa qué mejorar.')
      .max(300, 'La observación debe tener como máximo 300 caracteres.'),
  }),
]);

export type NuevaSolicitudDocente = z.infer<typeof nuevaSolicitudDocente>;
export type FiltroSolicitudes = z.infer<typeof filtroSolicitudes>;
export type DecisionSolicitud = z.infer<typeof decisionSolicitud>;

// Gestión de usuarios por administrador (RF-21)
export const ROLES_VALIDOS = ['ESTUDIANTE', 'DOCENTE', 'ADMIN'] as const;
export const ESTADOS_USUARIO = ['ACTIVO', 'INACTIVO'] as const;

export const parametrosUsuario = z.object({ id: idRuta }).transform(({ id }) => id);

export const filtroUsuariosAdmin = z.strictObject({
  q: z.string().trim().max(100).optional(),
  rol: z.enum(ROLES_VALIDOS).optional(),
  estado: z.enum(ESTADOS_USUARIO).optional(),
  pagina: z.coerce.number().int().min(1).default(1),
  limite: z.coerce.number().int().min(1).max(100).default(20),
});

export const cambioEstadoUsuario = z.strictObject({
  activo: z.boolean().optional(),
  estado: z.enum(ESTADOS_USUARIO).optional(),
}).refine((d) => d.activo !== undefined || d.estado !== undefined, {
  message: 'Debes indicar el nuevo estado (activo: boolean o estado: "ACTIVO" | "INACTIVO").',
});

export const cambioRolesUsuario = z.strictObject({
  roles: z.array(z.enum(ROLES_VALIDOS)).min(1, 'La cuenta debe tener al menos un rol.'),
});

/** Alta por un administrador (D1): la persona recibe un enlace de invitación para crear su contraseña. */
export const nuevoUsuarioAdmin = z.strictObject({
  nombres: textoSeguro().trim().min(1, 'Escribe los nombres.').max(80, 'Los nombres deben tener como máximo 80 caracteres.'),
  apellidos: textoSeguro().trim().min(1, 'Escribe los apellidos.').max(80, 'Los apellidos deben tener como máximo 80 caracteres.'),
  correo: z.string().trim().toLowerCase()
    .pipe(z.email('Correo no válido.').max(120, 'El correo debe tener como máximo 120 caracteres.')),
  /** Toda cuenta es Estudiante; aquí se añaden DOCENTE o ADMIN. */
  roles: z.array(z.enum(ROLES_VALIDOS)).max(3).default([]),
  especialidad: textoSeguro().trim()
    .min(3, 'Escribe la especialidad (mínimo 3 caracteres).')
    .max(100, 'La especialidad debe tener como máximo 100 caracteres.')
    .optional(),
}).superRefine((d, ctx) => {
  if (d.roles.includes('DOCENTE') && !d.especialidad) {
    ctx.addIssue({ code: 'custom', path: ['especialidad'], message: 'Escribe la especialidad del docente.' });
  }
});

export type NuevoUsuarioAdmin = z.infer<typeof nuevoUsuarioAdmin>;
export type FiltroUsuariosAdmin = z.infer<typeof filtroUsuariosAdmin>;
export type CambioEstadoUsuario = z.infer<typeof cambioEstadoUsuario>;
export type CambioRolesUsuario = z.infer<typeof cambioRolesUsuario>;
