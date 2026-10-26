import { z } from 'zod';
import { idYoutube } from './youtube.js';

export const datosModuloSchema = z.strictObject({
  titulo: z.string().trim().min(1).max(150),
  orden: z.number().int().min(1).max(10),
});

export type DatosModulo = z.infer<typeof datosModuloSchema>;

export const datosLeccionSchema = z.strictObject({
  titulo: z.string().trim().min(1).max(150),

  orden: z.number().int().min(1).max(12),

  tipo: z.enum([
    'DOCUMENTO',
    'VIDEO',
  ]),

  youtubeUrl: z.string()
    .trim()
    .max(2048)
    .optional(),

  vistaPrevia: z.boolean().default(false),

}).superRefine((datos, ctx) => {

  if (datos.tipo === 'VIDEO') {
    if (
      !datos.youtubeUrl ||
      !idYoutube(datos.youtubeUrl)
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['youtubeUrl'],
        message: 'Indica un enlace válido de YouTube.',
      });
    }
  }

  if (
    datos.tipo === 'DOCUMENTO' &&
    datos.youtubeUrl !== undefined
  ) {
    ctx.addIssue({
      code: 'custom',
      path: ['youtubeUrl'],
      message: 'Solo las lecciones VIDEO admiten YouTube.',
    });
  }
});

export type DatosLeccion = z.infer<typeof datosLeccionSchema>;
