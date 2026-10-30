import { z } from 'zod';
import { ICONOS_CATEGORIA } from '../../shared/catalogos/iconos-categoria.js';
import { idRuta, textoSeguro } from '../../shared/http/esquemas.js';

// Categorías del administrador (ADR-012). Los textos se normalizan a NFC antes de validar su longitud.

const nombre = textoSeguro()
  .transform((valor) => valor.normalize('NFC').trim())
  .pipe(z.string()
    .min(1, 'Escribe el nombre de la categoría.')
    .max(80, 'El nombre debe tener como máximo 80 caracteres.'));

/** Vacía o ausente se guarda como NULL. */
const descripcion = textoSeguro()
  .transform((valor) => valor.normalize('NFC').trim())
  .pipe(z.string().max(300, 'La descripción debe tener como máximo 300 caracteres.'))
  .nullish()
  .transform((valor) => valor || null);

/** Uno de los íconos permitidos (migración 035). */
const icono = z.enum(ICONOS_CATEGORIA, { error: 'Elige uno de los íconos disponibles.' });

export const parametrosCategoria = z.object({ id: idRuta }).transform(({ id }) => id);
export const consultaCategorias = z.strictObject({});

/** Sin ícono, la categoría nace con el genérico («tags»). */
export const datosCategoriaNueva = z.strictObject({ nombre, descripcion, icono: icono.optional() });

/**
 * Reemplazo completo. Sin `icono`, conserva el que tenía. `reasignarA` mueve todos sus cursos (de cualquier estado) a
 * otra categoría activa en la misma transacción; se usa al desactivarla.
 */
export const datosCategoria = z.strictObject({
  nombre, descripcion, activa: z.boolean(), icono: icono.optional(),
  reasignarA: z.number().int().min(1, 'Elige una categoría válida.').max(2_147_483_647, 'Elige una categoría válida.').optional(),
});

export type DatosCategoriaNueva = z.infer<typeof datosCategoriaNueva>;
export type DatosCategoria = z.infer<typeof datosCategoria>;
