import { z } from 'zod';
import { idRuta } from '../../shared/http/esquemas.js';
import {
  datosCuestionarioSchema,
  datosLeccionSchema,
  datosModuloSchema,
  type DatosCuestionario,
  type DatosLeccion,
  type DatosModulo,
} from './temario/temario.esquemas.js';

export const idCursoRuta = z.object({ id: idRuta }).transform(({ id }) => id);

const textoOpcional = (maximo: number) =>
  z.string().trim().max(maximo).default('');

const listaTextos = z.array(
  z.string().trim().min(1).max(200),
).max(10).default([]);

/**
 * Regla única de portada (ADR-011, 11.8): la misma al guardar un curso y al comprobar
 * si está completo para enviarlo a revisión o aprobarlo.
 */
export function esPortadaValida(valor: string): boolean {
  if (!valor || valor.length > 255) return false;

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
}

const portada = z.string().trim().max(255)
  .refine((valor) => !valor || esPortadaValida(valor), 'Indica una URL o ruta pública válida.');

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
export { datosModuloSchema, datosLeccionSchema, datosCuestionarioSchema };
export type { DatosModulo, DatosLeccion, DatosCuestionario };
