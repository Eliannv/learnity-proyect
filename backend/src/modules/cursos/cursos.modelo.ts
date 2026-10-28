export type EstadoCurso =
  | 'BORRADOR'
  | 'EN_REVISION'
  | 'PUBLICADO'
  | 'RECHAZADO'
  | 'ARCHIVADO';

export type TipoLeccion =
  | 'DOCUMENTO'
  | 'VIDEO'
  | 'EVALUACION';

export interface ArchivoPdf {
  id: number;
  tipo: 'PDF';
  nombreOriginal: string;
  tamanoBytes: number;
}

export interface LeccionPrivada {
  id: number;
  titulo: string;
  orden: number;
  tipo: TipoLeccion;
  archivo: ArchivoPdf | null;
  youtubeVideoId: string | null;
  /** Preguntas guardadas de una EVALUACION; 0 en los demás tipos. */
  preguntas: number;
  /** Material descargable adicional (PDF, PPT o ZIP), en el orden en que se subió. */
  recursos: RecursoLeccion[];
}

export const MAX_RECURSOS_LECCION = 5;

export interface RecursoLeccion {
  id: number;
  titulo: string;
  archivoId: number;
  tipo: 'PDF' | 'PPT' | 'ZIP';
  nombreOriginal: string;
  tamanoBytes: number;
}

export type LetraOpcion = 'A' | 'B' | 'C' | 'D';

/** Cuestionario tal como lo edita el docente: incluye la opción correcta. */
export interface CuestionarioDocente {
  leccionId: number;
  porcentajeAprobacion: number;
  preguntas: {
    id: number;
    orden: number;
    enunciado: string;
    opciones: { letra: LetraOpcion; texto: string }[];
    correcta: LetraOpcion;
  }[];
}

export interface ModuloPrivado {
  id: number;
  titulo: string;
  orden: number;
  lecciones: LeccionPrivada[];
}

export interface ProblemaCurso {
  campo: string;
  mensaje: string;
}

export interface CursoResumen {
  id: number;
  titulo: string;
  estado: EstadoCurso;
  motivoRechazo: string | null;
  docente: string;
  modulos: number;
  /** Portada para identificar el curso en los listados; null si no tiene. */
  portadaUrl: string | null;
}

export interface CursoDetalle {
  id: number;
  titulo: string;
  subtitulo: string;
  descripcion: string;

  categoriaId: number;
  categoriaNombre: string;

  nivel:
    | 'PRINCIPIANTE'
    | 'INTERMEDIO'
    | 'AVANZADO';

  portadaUrl: string;

  objetivos: string[];
  requisitos: string[];

  estado: EstadoCurso;
  motivoRechazo: string | null;
  docente: string;

  modulos: ModuloPrivado[];

  validacion: {
    completo: boolean;
    problemas: ProblemaCurso[];
  };
}

export type DecisionRevision =
  | {
      decision: 'APROBAR';
    }
  | {
      decision: 'RECHAZAR';
      motivo: string;
    };

export interface ContextoCurso {
  id: number;
  estado: EstadoCurso;
  idPersonaDocente: number;
  docenteActivo: boolean;
}

export interface ContextoLeccion
  extends ContextoCurso {
  leccionId: number;
  tipoLeccion: TipoLeccion;
  archivoId: number | null;
}
