import { z } from 'zod';

export const datosModuloSchema = z.strictObject({
  titulo: z.string().trim().min(1).max(150),
  orden: z.number().int().min(1).max(10),
});

export type DatosModulo = z.infer<typeof datosModuloSchema>;

export const datosLeccionSchema = z.strictObject({
  titulo: z.string().trim().min(1).max(150),
  orden: z.number().int().min(1).max(12),
  tipo: z.literal('DOCUMENTO'),
});

export type DatosLeccion = z.infer<typeof datosLeccionSchema>;
