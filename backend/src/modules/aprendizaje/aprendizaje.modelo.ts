export type EstadoInscripcion = 'ACTIVA' | 'COMPLETADA';
export type TipoLeccionAprendizaje = 'DOCUMENTO' | 'VIDEO' | 'EVALUACION';

export interface InscripcionResumen {
  id: number;
  cursoId: number;
  estado: EstadoInscripcion;
  progresoPct: number;
  ultimaLeccionId: number | null;
  inscritoEn: string;
  completadoEn: string | null;
}

export interface FichaCursoAprendizaje {
  id: number;
  titulo: string;
  subtitulo: string | null;
  portadaUrl: string | null;
  nivel: 'PRINCIPIANTE' | 'INTERMEDIO' | 'AVANZADO';
  categoria: { id: number; nombre: string };
  docente: string;
}

export interface CursoInscrito {
  curso: FichaCursoAprendizaje;
  inscripcion: InscripcionResumen;
  totalLecciones: number;
  leccionesCompletadas: number;
}

export interface LeccionAprendizaje {
  id: number;
  orden: number;
  titulo: string;
  tipo: TipoLeccionAprendizaje;
  archivoId: number | null;
  youtubeVideoId: string | null;
  /** Evaluación de una lección EVALUACION; null en los demás tipos. */
  evaluacionId: number | null;
  /** Material descargable de la lección; se descarga con GET /api/archivos/{archivoId}. */
  recursos: RecursoAprendizaje[];
  progreso: { segundosVistos: number; completada: boolean };
}

export interface RecursoAprendizaje {
  id: number;
  titulo: string;
  archivoId: number;
  tipo: 'PDF' | 'PPT' | 'ZIP';
  nombreOriginal: string;
  tamanoBytes: number;
}

export interface ModuloAprendizaje {
  id: number;
  orden: number;
  titulo: string;
  lecciones: LeccionAprendizaje[];
}

export interface DetalleAprendizaje extends CursoInscrito {
  modulos: ModuloAprendizaje[];
}

export interface ProgresoGuardado {
  leccionId: number;
  segundosVistos: number;
  completada: boolean;
  progresoPct: number;
  estado: EstadoInscripcion;
  ultimaLeccionId: number;
}

export interface EstudianteCurso {
  idPersona: number;
  nombre: string;
  estado: EstadoInscripcion;
  progresoPct: number;
  ultimaLeccionId: number | null;
  inscritoEn: string;
  ultimaActividadEn: string | null;
  /** Estrellas de su reseña vigente; null si no reseñó el curso. */
  estrellas: number | null;
}

export interface SeguimientoDocente {
  curso: { id: number; titulo: string };
  items: EstudianteCurso[];
  pagina: number;
  limite: number;
  total: number;
  totalPaginas: number;
  resumen: {
    inscritos: number; completados: number; progresoPromedio: number;
    /** Reseñas vigentes del curso: promedio con un decimal (null sin reseñas) y cantidad. */
    valoracion: { promedio: number | null; total: number };
  };
}
