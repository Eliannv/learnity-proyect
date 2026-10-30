import { z } from 'zod';
import { idRuta } from '../../shared/http/esquemas.js';

export const idRevisionRuta = z.object({ id: idRuta }).transform(({ id }) => id);

export const ESTADOS_REVISION = ['EN_REVISION', 'PUBLICADO', 'SUSPENDIDO', 'RECHAZADO', 'BORRADOR'] as const;

export const filtroRevision = z.strictObject({
  estado: z.enum(ESTADOS_REVISION).default('EN_REVISION'),
});

/** Suspender un curso publicado: motivo obligatorio y confirmación explícita («Confirmo»). */
export const suspensionCurso = z.strictObject({
  motivo: z
    .string()
    .trim()
    .min(1, 'Escribe el motivo de la suspensión.')
    .max(300, 'El motivo debe tener como máximo 300 caracteres.'),
  confirmo: z.literal(true, { error: 'Marca «Confirmo» para suspender el curso.' }),
});

export const decisionRevision = z.discriminatedUnion('decision', [
  z.strictObject({
    decision: z.literal('APROBAR'),
  }),
  z.strictObject({
    decision: z.literal('RECHAZAR'),
    motivo: z
      .string()
      .trim()
      .min(1, 'Escribe el motivo del rechazo.')
      .max(300, 'El motivo debe tener como máximo 300 caracteres.'),
  }),
]);

export type FiltroRevision = z.infer<typeof filtroRevision>;
export type SuspensionCursoDto = z.infer<typeof suspensionCurso>;
export type DecisionRevisionDto = z.infer<typeof decisionRevision>;
