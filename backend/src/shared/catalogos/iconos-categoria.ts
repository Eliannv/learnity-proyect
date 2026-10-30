/**
 * Íconos que el administrador puede asignar a una categoría: nombres de Lucide en kebab-case (migración 035).
 * Única fuente para la validación (modules/categorias) y para el contrato (enum `IconoCategoria`).
 * Cada uno debe estar registrado en `ICONOS` del frontend (shared/ui/marca/iconos.ts); lo comprueba
 * frontend/src/app/shared/ui/marca/iconos-categoria.spec.ts. Para añadir uno: aquí, en `ICONOS` y en el selector.
 */
export const ICONOS_CATEGORIA = [
  'tags', 'code', 'pen-tool', 'languages', 'briefcase', 'monitor', 'megaphone',
  'book-open', 'graduation-cap', 'chart-line', 'lightbulb', 'presentation', 'camera', 'palette',
  'music', 'calculator', 'flask-conical', 'globe', 'heart-pulse', 'database', 'cpu', 'wrench',
] as const;

export type IconoCategoria = (typeof ICONOS_CATEGORIA)[number];

/** Ícono de una categoría sin uno elegido (valor por defecto de la columna). */
export const ICONO_CATEGORIA_POR_DEFECTO: IconoCategoria = 'tags';
