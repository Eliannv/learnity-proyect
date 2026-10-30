export type NivelCurso = 'PRINCIPIANTE' | 'INTERMEDIO' | 'AVANZADO';
export type OrdenCatalogo = 'recientes' | 'populares' | 'az';
export type TipoLeccionPublica = 'VIDEO' | 'DOCUMENTO' | 'EVALUACION';

export interface FiltrosPublicos {
  q?: string | undefined;
  categorias: string[];
  niveles: NivelCurso[];
  orden: OrdenCatalogo;
  pagina: number;
  limite: number;
}

export interface CategoriaPublica {
  id: number;
  nombre: string;
  /** Ícono de Lucide elegido por el administrador (migración 035). */
  icono: string;
}

export interface CursoPublico {
  id: number;
  titulo: string;
  subtitulo: string | null;
  categoria: CategoriaPublica;
  docente: string;
  nivel: NivelCurso;
  portadaUrl: string | null;
  modulos: number;
  lecciones: number;
  minutos: number;
  publicadoEn: string;
  estado: 'PUBLICADO';
  /** Reseñas vigentes del curso (ni eliminadas ni ocultadas): la tarjeta del catálogo las muestra como en Udemy. */
  calificacion: CalificacionCurso;
}

export interface LeccionTemarioPublico {
  id: number;
  orden: number;
  titulo: string;
  tipo: TipoLeccionPublica;
  minutos: number;
}

export interface ModuloTemarioPublico {
  id: number;
  orden: number;
  titulo: string;
  lecciones: LeccionTemarioPublico[];
}

export interface InstructorPublico {
  nombre: string;
  especialidad: string;
  biografia: string | null;
  fotoUrl: string | null;
  cursosPublicados: number;
  /** Inscripciones en todos sus cursos publicados. */
  estudiantes: number;
  /** Valoración global: todas las reseñas vigentes de sus cursos publicados. */
  calificacion: CalificacionCurso;
}

export interface CalificacionCurso {
  /** Promedio de 1 a 5 con un decimal; null sin reseñas. */
  promedio: number | null;
  total: number;
}

export interface CursoPublicoDetalle extends CursoPublico {
  descripcion: string;
  docenteBio: string | null;
  instructor: InstructorPublico;
  calificacion: CalificacionCurso;
  objetivos: string[];
  requisitos: string[];
  temario: ModuloTemarioPublico[];
}
