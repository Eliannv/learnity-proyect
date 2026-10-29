import { z } from 'zod';

export const filtrosAnaliticas = z.strictObject({
  curso: z.preprocess((v) => (v === '' ? undefined : v), z.coerce.number().int().min(1).max(2_147_483_647).optional()),
});

export type FiltrosAnaliticas = z.infer<typeof filtrosAnaliticas>;
