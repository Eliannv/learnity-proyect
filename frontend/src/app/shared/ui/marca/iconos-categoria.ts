import type { components } from '../../../core/api/generado/esquema';

/** Ícono que admite el backend para una categoría (enum `IconoCategoria` del contrato, migración 035). */
export type IconoCategoria = components['schemas']['IconoCategoria'];

/**
 * Íconos del selector de categorías, en el orden en que se muestran, con el nombre que lee el lector de pantalla.
 * El tipo obliga a cubrir exactamente el enum del contrato: si el backend añade o quita uno, esto no compila.
 * Todos deben estar en `ICONOS` (iconos.ts); lo comprueba iconos-categoria.spec.ts.
 */
export const ICONOS_CATEGORIA: Readonly<Record<IconoCategoria, string>> = {
  tags: 'Etiquetas (genérico)',
  code: 'Código',
  'pen-tool': 'Pluma de diseño',
  languages: 'Idiomas',
  briefcase: 'Maletín',
  monitor: 'Monitor',
  megaphone: 'Megáfono',
  'book-open': 'Libro abierto',
  'graduation-cap': 'Birrete',
  'chart-line': 'Gráfico',
  lightbulb: 'Bombilla',
  presentation: 'Presentación',
  camera: 'Cámara',
  palette: 'Paleta de pintura',
  music: 'Música',
  calculator: 'Calculadora',
  'flask-conical': 'Matraz',
  globe: 'Globo terráqueo',
  'heart-pulse': 'Salud',
  database: 'Base de datos',
  cpu: 'Procesador',
  wrench: 'Llave inglesa',
};

export const LISTA_ICONOS_CATEGORIA = Object.keys(ICONOS_CATEGORIA) as IconoCategoria[];
