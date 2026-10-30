import type { IconoCategoria } from '../../shared/catalogos/iconos-categoria.js';

export interface CategoriaAdmin {
  id: number;
  nombre: string;
  descripcion: string | null;
  activa: boolean;
  /** Nombre de Lucide en kebab-case (migración 035). */
  icono: IconoCategoria;
  /** Cursos de cualquier estado con esta categoría; sirve para avisar antes de desactivarla. */
  cursos: number;
  cursosPublicados: number;
}
