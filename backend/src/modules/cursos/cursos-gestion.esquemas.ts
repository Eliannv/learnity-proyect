
import { z } from 'zod';

const textoOpcional = (maximo: number) =>
  z.string().trim().max(maximo).default('');

const listaTextos = z.array(
  z.string().trim().min(1).max(200),
).max(10).default([]);

const portada = z.string().trim().max(255)
  .refine((valor) => {
    if (!valor) return true;

    if (valor.startsWith('/')) {
      return !valor.startsWith('//')
        && !valor.includes('\\')
        && !valor.includes('..')
        && !/[\s?#]/.test(valor);
    }

    try {
      const url = new URL(valor);
      return ['http:', 'https:'].includes(url.protocol)
        && !!url.hostname
        && !url.username
        && !url.password;
    } catch {
      return false;
    }
  }, 'Indica una URL o ruta pública válida.');

export const datosCursoSchema = z.strictObject({
  titulo: z.string().trim().min(1).max(150),
  subtitulo: textoOpcional(200),
  descripcion: textoOpcional(10000),
  categoriaId: z.number().int().positive(),
  nivel: z.enum([
    'PRINCIPIANTE',
    'INTERMEDIO',
    'AVANZADO',
  ]),
  portadaUrl: portada.default(''),
  objetivos: listaTextos,
  requisitos: listaTextos,
});

export type DatosCurso = z.infer<typeof datosCursoSchema>;
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