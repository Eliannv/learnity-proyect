export interface CategoriaAdmin {
  id: number;
  nombre: string;
  descripcion: string | null;
  activa: boolean;
  /** Cursos de cualquier estado con esta categoría; sirve para avisar antes de desactivarla. */
  cursos: number;
  cursosPublicados: number;
}
