import { z } from 'zod';

export const identificador = z.coerce
  .number()
  .int()
  .min(1)
  .max(2_147_483_647);

export const filtroRevision = z.strictObject({
  estado: z
    .literal('EN_REVISION')
    .default('EN_REVISION'),
});

export const decisionRevision =
  z.discriminatedUnion('decision', [
    z.strictObject({
      decision: z.literal('APROBAR'),
    }),

    z.strictObject({
      decision: z.literal('RECHAZAR'),

      motivo: z
        .string()
        .trim()
        .min(
          1,
          'Escribe el motivo del rechazo.',
        )
        .max(
          300,
          'El motivo debe tener como máximo 300 caracteres.',
        ),
    }),
  ]);