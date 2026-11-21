import { z } from 'zod';

const id = z.coerce.number().int().positive().max(2147483647);
export const cursoGrupo = z.object({ id });
export const grupoRuta = z.object({ id, grupo: id });
export const grupoNuevo = z.strictObject({
  nombre: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .refine((v) => !v.includes('\0')),
  miembros: z
    .array(z.number().int().positive().max(2147483647))
    .refine((ids) => new Set(ids).size === ids.length),
});
export const grupoEditado = grupoNuevo.extend({ revision: z.number().int().positive() });
export type DatosGrupo = z.infer<typeof grupoNuevo>;
