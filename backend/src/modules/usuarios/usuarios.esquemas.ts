import { z } from 'zod';
import { idRuta } from '../../shared/http/esquemas.js';

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
