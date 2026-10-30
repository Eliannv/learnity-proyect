import { z } from 'zod';

// Supervisión del administrador: registro de accesos (migración 032).

export const filtroAccesos = z.strictObject({
  resultado: z.enum(['todos', 'fallidos']).default('todos'),
  q: z.string().trim().max(100).optional(),
  pagina: z.coerce.number().int().min(1).default(1),
  limite: z.coerce.number().int().min(1).max(100).default(20),
});

export const consultaVacia = z.strictObject({});

export type FiltroAccesosAdmin = z.infer<typeof filtroAccesos>;
