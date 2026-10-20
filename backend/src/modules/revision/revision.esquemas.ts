import { z } from 'zod';
import { idRuta } from '../../shared/http/esquemas.js';

export const idRevisionRuta = z.object({ id: idRuta }).transform(({ id }) => id);

export const filtroRevision = z.strictObject({
  estado: z.literal('EN_REVISION').default('EN_REVISION'),
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
export type DecisionRevisionDto = z.infer<typeof decisionRevision>;
