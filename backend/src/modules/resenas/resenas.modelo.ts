export interface Resena {
  id: number;
  /** Nombre y la inicial del apellido: nunca el correo ni el nombre completo. */
  autor: string;
  fotoUrl: string | null;
  estrellas: number;
  comentario: string | null;
  creadoEn: string;
  actualizadoEn: string;
}

export interface ResumenResenas {
  promedio: number | null;
  total: number;
  /** Cantidad de reseñas con 1, 2, 3, 4 y 5 estrellas (índices 0 a 4). */
  distribucion: number[];
}

export interface PaginaResenas {
  resumen: ResumenResenas;
  items: Resena[];
  pagina: number;
  limite: number;
  total: number;
  totalPaginas: number;
}

export interface MiResena {
  /** Inscrito en el curso publicado: puede escribir, editar o borrar su reseña. */
  puedeResenar: boolean;
  resena: Resena | null;
}
