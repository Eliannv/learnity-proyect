import { z } from 'zod';
import { idRuta } from '../../shared/http/esquemas.js';

const repetible = <T extends z.ZodType>(elemento: T) =>
  z
    .union([elemento, z.array(elemento).min(1).max(20)])
    .transform((valor) => (Array.isArray(valor) ? valor : [valor]));

export const filtrosCatalogo = z.strictObject({
  q: z.string().trim().max(100).optional(),
  categoria: repetible(z.string().min(1).max(80)).optional(),
  nivel: repetible(z.enum(['PRINCIPIANTE', 'INTERMEDIO', 'AVANZADO'])).optional(),
  orden: z.enum(['recientes', 'populares', 'az']).default('recientes'),
  pagina: z.coerce.number().int().min(1).max(10000).default(1),
  limite: z.coerce.number().int().min(1).max(50).default(9),
});

export const idCatalogoRuta = z.object({ id: idRuta }).transform(({ id }) => id);

export type FiltrosCatalogoDto = z.infer<typeof filtrosCatalogo>;
