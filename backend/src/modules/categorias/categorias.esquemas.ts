import { z } from 'zod';
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

export const parametrosCategoria = z.object({ id: idRuta }).transform(({ id }) => id);
export const consultaCategorias = z.strictObject({});

export const datosCategoriaNueva = z.strictObject({ nombre, descripcion });
export const datosCategoria = z.strictObject({ nombre, descripcion, activa: z.boolean() });

export type DatosCategoriaNueva = z.infer<typeof datosCategoriaNueva>;
export type DatosCategoria = z.infer<typeof datosCategoria>;
