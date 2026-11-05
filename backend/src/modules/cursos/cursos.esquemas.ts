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

/** `/img/portada.jpg` o `/img/carpeta/portada.webp`: segmentos sin `..`, espacios, `?` ni `#`. */
const RUTA_IMG = /^\/img(\/[A-Za-z0-9_-][A-Za-z0-9._-]*)+$/;
const RUTA_FOTO_SUBIDA = /^\/api\/fotos\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png|webp)$/;

/**
 * Regla única de portada (ADR-011, 11.8): la misma al guardar un curso y al comprobar
 * si está completo para enviarlo a revisión o aprobarlo.
 */
export function esPortadaValida(valor: string): boolean {
  if (!valor || valor.length > 255) return false;

  // Rutas propias: solo imágenes estáticas del frontend (/img/…) o portadas subidas (/api/fotos/<uuid>.<ext>).
  if (valor.startsWith('/')) return RUTA_IMG.test(valor) || RUTA_FOTO_SUBIDA.test(valor);

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
