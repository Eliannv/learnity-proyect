/** Tipos y constantes de presentación compartidos por los componentes de `shared/ui`. */

/** Variante de color de una portada o tarjeta de curso. */
export type Tono = 1 | 2 | 3;

/** Ícono de Lucide de cada categoría (portadas y accesos por categoría). */
export const ICONO_CATEGORIA: Record<string, string> = {
  Programación: 'code',
  Diseño: 'pen-tool',
  Idiomas: 'languages',
  Negocios: 'briefcase',
  Ofimática: 'monitor',
  Marketing: 'megaphone',
};
